# Feature: Update a Todo (complete / incomplete)

The user clicks the checkbox on a todo. The row updates immediately, strikethrough and
dimmed styling are applied, and the "N tasks left" subtitle changes. If the request
fails, the checkbox snaps back and an error banner appears.

The API accepts a partial update of `title` and `is_done`. The shipped UI only exercises
`is_done`; the title field exists in the contract and is documented below for other
clients.

## User story

> As a user, I want to mark a task done so I can see what is left.

## Flow

```text
User clicks the checkbox
  -> TodoItem onChange            fe/src/components/TodoItem.tsx:17
     - calls onToggle(todo) with the full todo
  -> useTodos.toggle(todo)        fe/src/hooks/useTodos.ts:56
     - computes next = !todo.is_done
     - setPendingId(todo.id)      row becomes non-interactive
     - optimistic local patch     is_done flips right away
  -> updateTodo(id, {is_done})    fe/src/api/todos.ts:40
     - PATCH {BASE_URL}/api/todos/{id}
  -> request<Todo>()
  -> PATCH /api/todos/{id}        be/app/routers/todos.py:39
     - validates body into TodoUpdate, maps TodoNotFound to 404
  -> update_todo(db, id, payload) be/app/services/todos.py:39
     - get_todo, apply set fields, stamp updated_at, commit, refresh
  -> 200 OK + Todo JSON
  <- useTodos replaces the row with the server response (authoritative)
  <- setPendingId(null) in finally
```

The row is patched twice on success: once optimistically, then again with the server's
copy. The second write exists to adopt the server's `updated_at` and any future
server-side rule.

## Frontend

### `fe/src/components/TodoItem.tsx`

```tsx
<input
  type="checkbox"
  checked={todo.is_done}
  disabled={isPending}
  onChange={() => onToggle(todo)}
  aria-label={`Mark "${todo.title}" as ${todo.is_done ? "not done" : "done"}`}
/>
```

- `checked` is controlled, so the visual state comes entirely from props and the
  component never holds its own copy.
- `onChange` passes the whole `todo` rather than an event, which keeps the hook free of
  DOM event handling and gives the optimistic rollback the previous value for free.
- The title span switches between two class sets, `text-slate-400 line-through` when
  done and `text-slate-900` when not. That is the only visual difference between states.
- `aria-label` inverts the action wording, so a screen reader announces
  "Mark 'Buy milk' as done" for a checked row.
- The delete button is disabled in the same conditions, preventing a delete while a
  toggle is in flight on the same row.

### `fe/src/hooks/useTodos.ts`

```ts
const toggle = useCallback(async (todo: Todo) => {
  const next = !todo.is_done;
  setPendingId(todo.id);
  setError(null);
  setTodos((current) =>
    current.map((item) => (item.id === todo.id ? { ...item, is_done: next } : item)),
  );
  try {
    const updated = await updateTodo(todo.id, { is_done: next });
    setTodos((current) =>
      current.map((item) => (item.id === todo.id ? updated : item)),
    );
  } catch (err) {
    setTodos((current) =>
      current.map((item) => (item.id === todo.id ? todo : item)),
    );
    setError(message(err));
  } finally {
    setPendingId(null);
  }
}, []);
```

- **Optimistic patch** before the request. The checkbox feels instant; the request
  latency is hidden.
- **Rollback** restores the exact `todo` object the caller passed in, so a failure
  cannot leave a half-applied value.
- Only `is_done` is sent. `title` is never in the payload, so a toggle can never rewrite
  a title.
- `pendingId` is a single id, not a set. Toggling row A and then row B is fine, but two
  concurrent toggles on **different** rows share the slot: the second `setPendingId`
  overwrites the first, and the first row's `finally` clears the flag for row B. Rows are
  fast enough to click in sequence that this is not reachable in practice, but a set
  would be the correct type if slow networks made it matter.
- `setPendingId(null)` in `finally` runs on both paths.

### `fe/src/api/todos.ts`

```ts
export function updateTodo(id: number, changes: TodoUpdate): Promise<Todo> {
  return request<Todo>(`/api/todos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });
}
```

`PATCH`, never `PUT`. The route only accepts a partial body, and a `PUT` would fail to
match the route signature.

### `fe/src/App.tsx`

`remaining` is recomputed from `todos` on every render, so the subtitle updates with no
extra wiring. `onToggle={(todo) => void toggle(todo)}` discards the promise because the
hook already routes failures into `error`.

## Backend

### `be/app/routers/todos.py:39`

```py
@router.patch("/{todo_id}", response_model=TodoRead)
def patch(todo_id: int, payload: TodoUpdate, db: Session = Depends(get_db)) -> Todo:
    try:
        return update_todo(db, todo_id, payload)
    except TodoNotFound:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Todo not found"
        )
```

- `TodoNotFound` is a service-layer exception. The router is the only place that knows
  it maps to `404`; the service stays HTTP-agnostic.
- `detail="Todo not found"` is a plain string, which is exactly what the client's error
  extraction reads, so the banner shows `Todo not found` rather than a status code.
- The `try` wraps the whole `update_todo` call, so a `TodoNotFound` from either the
  explicit `get_todo` lookup or anything `update_todo` does internally is converted.
  `raise ... from` is not used, so FastAPI renders the `404` without chaining a traceback
  into the response body.

### `be/app/schemas/todo.py`

```py
class TodoUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=TITLE_MAX_LENGTH)
    is_done: bool | None = None
```

Both fields are optional. The distinction between "absent" and "present but `null`"
matters and is handled by the service, see below.

The title validator short-circuits on `None` and otherwise applies the same trim and
blank rejection as `TodoCreate`. That means `{"title": "  "}` is a `422`, not a silent
no-op.

`TodoRead` is the response model, so the response always carries all five fields even
though the request carried one.

### `be/app/services/todos.py:39`

```py
def update_todo(db: Session, todo_id: int, payload: TodoUpdate) -> Todo:
    todo = get_todo(db, todo_id)
    changes = payload.model_dump(exclude_unset=True, exclude_none=True)
    for field, value in changes.items():
        setattr(todo, field, value)
    if changes:
        todo.updated_at = _now()
        db.commit()
        db.refresh(todo)
    return todo
```

- `get_todo` raises `TodoNotFound` when the row is gone. Update and delete share that
  lookup, so a stale id produces the same `404` from every verb.
- `exclude_unset=True` drops keys the client never sent, so a partial body leaves other
  columns untouched.
- `exclude_none=True` additionally drops explicit `null`s. This is why the API cannot
  set `title` to `NULL` or clear `is_done` back to "unknown": `null` means "leave it
  alone". `is_done` is `NOT NULL` in the schema, so the alternative would be a `500`.
- `if changes:` guards the write. An empty patch returns `200` with the unchanged row
  and does not move `updated_at`. This is what makes the "no-op toggle" safe: a client
  that sends `{}` cannot churn timestamps.
- The `for` loop is driven by `changes`, whose keys are constrained by the schema. Only
  `title` and `is_done` can ever reach `setattr`; the loop is not an injection point
  because the key set comes from a validated Pydantic model, not from raw input.

### `be/app/db/models.py`

`title` is `String(200)` `NOT NULL`, `is_done` is `Boolean` `NOT NULL` defaulting to
`0`. Both are writable through the service; `id`, `created_at`, and `updated_at` are
not in `TodoUpdate` and cannot be changed by a client.

## Data

| Column | On `{"is_done": true}` | On `{}` |
|---|---|---|
| `id` | unchanged | unchanged |
| `title` | unchanged | unchanged |
| `is_done` | `true` | unchanged |
| `created_at` | unchanged | unchanged |
| `updated_at` | new UTC timestamp | unchanged |

## Contract

**Request**

```http
PATCH /api/todos/1
Content-Type: application/json

{ "is_done": true }
```

**Success — 200 OK**

```json
{
  "id": 1,
  "title": "Buy milk",
  "is_done": true,
  "created_at": "2026-09-28T05:00:00",
  "updated_at": "2026-09-28T05:07:31"
}
```

**Errors**

| Condition | Status | Body |
|---|---|---|
| Unknown id | 404 | `{"detail": "Todo not found"}` |
| Blank `title` | 422 | `title must not be blank` |
| `title` over 200 chars | 422 | `max_length` violation |
| Non-boolean `is_done` | 422 | Type validation |
| Empty body `{}` | 200 | Row returned unchanged |

## Edge cases

- **Optimistic rollback.** A `404` or a network failure restores the previous
  `is_done` and shows `Todo not found` in the banner. The list and the database stay
  consistent.
- **Stale id.** If the row was deleted in another tab, the toggle's `PATCH` returns
  `404`, the row un-checks itself, and the banner explains why.
- **Empty patch.** `{}` returns `200` and does not touch `updated_at`, so a client can
  probe a todo without side effects.
- **`null` is not a value.** `{"is_done": null}` is a no-op, not an error and not a
  clear. Sending `false` is how you un-complete a todo.
- **`title` is unreachable from the UI.** The API supports it, but no component exposes
  an edit affordance. `TodoItem` renders the title as a static `span`.
- **PATCH is required.** The route is registered for `PATCH` only. `PUT /api/todos/1`
  returns `405 Method Not Allowed`.

## Verify

Backend:

```bash
.venv/bin/uvicorn be.app.main:app --reload

ID=$(curl -s -X POST http://127.0.0.1:8000/api/todos \
  -H 'Content-Type: application/json' -d '{"title":"Buy milk"}' | python3 -c 'import json,sys;print(json.load(sys.stdin)["id"])')

# 200, is_done flips, title untouched, updated_at advances
curl -i -X PATCH "http://127.0.0.1:8000/api/todos/$ID" \
  -H 'Content-Type: application/json' -d '{"is_done":true}'

# 200, no change, updated_at identical
curl -i -X PATCH "http://127.0.0.1:8000/api/todos/$ID" \
  -H 'Content-Type: application/json' -d '{}'

# 404
curl -i -X PATCH http://127.0.0.1:8000/api/todos/999999 \
  -H 'Content-Type: application/json' -d '{"is_done":true}'

# 422, blank title
curl -i -X PATCH "http://127.0.0.1:8000/api/todos/$ID" \
  -H 'Content-Type: application/json' -d '{"title":"   "}'

# 405, PUT is not registered
curl -i -X PUT "http://127.0.0.1:8000/api/todos/$ID" \
  -H 'Content-Type: application/json' -d '{"title":"x","is_done":true}'
```

Frontend:

```bash
cd fe && npm run build
```

Browser:

1. Add `Buy milk`, confirm the checkbox is empty and the subtitle says `1 task left`.
2. Click the checkbox, confirm it fills immediately and the title goes strikethrough and
   dimmed; the subtitle says `All clear`.
3. Click it again, confirm it un-fills and the subtitle returns to `1 task left`.
4. Stop the backend, click the checkbox, confirm the row un-checks itself and the red
   banner appears. Restart the backend and click **Retry**.
5. Delete the row in a second browser tab, then click the checkbox in the first tab.
   Confirm `Todo not found` appears and the checkbox reverts.

## Files

| Layer | File | Role |
|---|---|---|
| FE | `fe/src/components/TodoItem.tsx` | Checkbox, strikethrough styling, aria labels |
| FE | `fe/src/components/TodoList.tsx` | Maps `todos`, computes `isPending` per row |
| FE | `fe/src/hooks/useTodos.ts` | `toggle`, optimistic patch, rollback, `pendingId` |
| FE | `fe/src/api/todos.ts` | `updateTodo` via `PATCH` |
| FE | `fe/src/App.tsx` | Derives `remaining` from `todos` |
| BE | `be/app/routers/todos.py` | `PATCH /api/todos/{id}`, `404` mapping |
| BE | `be/app/schemas/todo.py` | `TodoUpdate` optional fields and validation |
| BE | `be/app/services/todos.py` | `update_todo`, `TodoNotFound`, timestamp rules |
| DB | `be/database/SCHEMA.md` | Column constraints and nullability |
