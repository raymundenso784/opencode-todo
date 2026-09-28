# Feature: Delete a Todo

The user clicks the trash icon on a todo row. A confirmation dialog opens with the
title quoted back. Confirming issues `DELETE`, removes the row from the list, and closes
the dialog. Cancelling closes the dialog and changes nothing.

The dialog was added in `plan-2`. It is frontend-only: no endpoint, field, or table
changed.

## User story

> As a user, I want to confirm before deleting so I do not lose a task by accident.

## Flow

```text
User clicks the trash icon
  -> TodoItem onClick              fe/src/components/TodoItem.tsx:32
     - calls onDelete(todo); no request is made
  -> App setTodoPendingDelete      fe/src/App.tsx:12
     - holds the todo in local state; dialog renders
  -> ConfirmDialog focuses Cancel, listens for Escape
  -> User confirms
  -> onConfirm                      fe/src/App.tsx:64
     - void remove(todoPendingDelete).finally(close)
  -> useTodos.remove(todo)         fe/src/hooks/useTodos.ts:78
     - setPendingId, clear error
  -> deleteTodo(id)                 fe/src/api/todos.ts:47
     - DELETE {BASE_URL}/api/todos/{id}
  -> DELETE /api/todos/{id}         be/app/routers/todos.py:49
     - 204, no body
  -> delete_todo(db, id)            be/app/services/todos.py:51
     - get_todo (raises if absent), db.delete, db.commit
  <- useTodos filters the row out
  <- .finally closes the dialog regardless of outcome
```

## Frontend

### `fe/src/components/TodoItem.tsx`

The delete button is an icon-only control.

- `aria-label={`Delete "${todo.title}"`}` names the target, since the visible content is
  an SVG with no text.
- `disabled={isPending}` blocks the click while a toggle or another delete is in flight.
- The button is intentionally quiet (`text-slate-400`) and turns red on hover
  (`hover:text-red-600`), so a destructive action is reachable but not advertised.
- Clicking does **not** delete. It only surfaces the dialog, which is the whole point of
  the `plan-2` change.

### `fe/src/components/ConfirmDialog.tsx`

A presentational modal. It has no knowledge of todos and makes no network calls.

- `cancelRef.current?.focus()` on mount puts focus on **Cancel**, so a stray `Enter`
  dismisses rather than destroys.
- `Escape` calls `onCancel`, but the listener re-registers whenever `isPending` or
  `onCancel` changes, which is what keeps the guard `!isPending` fresh. Removing the
  listener in the effect cleanup prevents a leak across repeated opens.
- Clicking the backdrop calls `onCancel`; clicking the panel calls
  `event.stopPropagation()`, so the backdrop handler does not also fire.
- Both buttons are `disabled={isPending}`, so the dialog cannot be dismissed mid-request
  and the user cannot double-submit the delete.
- `role="dialog"`, `aria-modal="true"`, and the `aria-labelledby` /
  `aria-describedby` pair wire the visible title and message to the dialog.
- There is no focus trap. Focus is moved into the dialog on open but is not constrained
  while it is open, so `Tab` can reach the page behind it.

### `fe/src/App.tsx`

```tsx
const [todoPendingDelete, setTodoPendingDelete] = useState<Todo | null>(null);
```

`TodoList`'s `onDelete` is the setter itself, so the row hands its todo straight into
state. The dialog is rendered only when that state is non-null, which unmounts it on
close and re-runs the focus effect on the next open.

The message interpolates the title, so the user confirms the row they actually clicked:

```tsx
message={`"${todoPendingDelete.title}" will be permanently deleted. This cannot be undone.`}
```

`onConfirm` closes the dialog in a `.finally()`, not in a `.then()`. A failed delete
still closes the dialog; the row stays in the list and the banner explains why. Leaving
the dialog open on failure would strand the user over a row that is still there.

`isPending={pendingId === todoPendingDelete.id}` ties the dialog's busy state to the
same row-level pending flag the list uses.

### `fe/src/hooks/useTodos.ts`

```ts
const remove = useCallback(async (todo: Todo) => {
  setPendingId(todo.id);
  setError(null);
  try {
    await deleteTodo(todo.id);
    setTodos((current) => current.filter((item) => item.id !== todo.id));
  } catch (err) {
    setError(message(err));
  } finally {
    setPendingId(null);
  }
}, []);
```

- The row is removed **after** the request resolves. A delete is not optimistically
  applied, unlike a toggle: if the row vanished immediately, a failed delete would
  require re-inserting it, and the user would have to retype nothing but would see a
  row jump back into the list.
- `filter` on `id` removes exactly one row and is safe even if the row is already gone.
- The function never throws. Failures land in `error`, so `.finally()` in `App` is a
  plain cleanup, not error handling.

### `fe/src/api/todos.ts`

```ts
export function deleteTodo(id: number): Promise<void> {
  return request<void>(`/api/todos/${id}`, { method: "DELETE" });
}
```

`request` short-circuits on `204` and returns `undefined as T` instead of calling
`response.json()`. Parsing an empty body would throw `SyntaxError` and surface as a
spurious failure, so the `204` check is required for this endpoint.

## Backend

### `be/app/routers/todos.py:49`

```py
@router.delete("/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove(todo_id: int, db: Session = Depends(get_db)) -> Response:
    try:
        delete_todo(db, todo_id)
    except TodoNotFound:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Todo not found"
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

- `status_code=204` on the decorator sets the success code. The explicit `return
  Response(...)` is still needed because a `None` return with a declared return
  annotation would otherwise fail response-model validation.
- `204` means no body. The client must not try to parse one.
- The `except` is reached through `get_todo` inside `delete_todo`, so deleting an
  already-deleted id is a clean `404` rather than a `500`.
- Delete is idempotent in effect but not in status: a repeat `DELETE` answers `404`,
  not `204`.

### `be/app/services/todos.py:51`

```py
def delete_todo(db: Session, todo_id: int) -> None:
    todo = get_todo(db, todo_id)
    db.delete(todo)
    db.commit()
```

- `get_todo` first, so the `404` is raised by the same lookup every other verb uses.
- `db.delete(todo)` then `db.commit()`. Without the commit the session would flush at
  close anyway, but an explicit commit makes the durability point obvious and matches
  `create_todo` and `update_todo`.
- Nothing else reads the row. There are no foreign keys or secondary indexes to cascade.

### `be/app/schemas/todo.py`

No schema is involved. A `DELETE` takes only a path parameter, so there is no request
body to validate and no `response_model`.

## Data

The delete removes exactly one row from `todos`:

| Column | Effect |
|---|---|
| `id` | row removed |
| `title`, `is_done`, `created_at`, `updated_at` | row removed |

**Ids are not monotonic.** The table is created by `0001_create_todos.py` as
`id INTEGER NOT NULL, PRIMARY KEY (id)`. SQLAlchemy's `autoincrement=True` on the
column is a Core-level marker for a primary key; it does not emit SQLite's `AUTOINCREMENT`
keyword, and there is no `sqlite_sequence` table. SQLite therefore assigns
`MAX(id) + 1`, which reuses an id once the highest row is gone:

```text
insert A        -> id 1
insert B        -> id 2
delete 2
insert C        -> id 2      # reused
```

Deleting a lower id does not cause reuse, because the maximum is unchanged. This does not
break the current frontend, which keys rows on `todo.id` within one list render and
removes rows before the next one can appear. It does mean a **stale id is not a safe
handle**: a client holding id 2 from before the delete would `PATCH` the new todo that
reused id 2, not get a `404`. If ids ever need to be unique for the life of the table,
the migration has to declare `sqlite_autoincrement=True`.

## Contract

**Request**

```http
DELETE /api/todos/1
```

No body. `Content-Type` is sent by `request` regardless, which is harmless.

**Success — 204 No Content**

Empty body, no `Content-Type` payload.

**Errors**

| Condition | Status | Body |
|---|---|---|
| Unknown or already-deleted id | 404 | `{"detail": "Todo not found"}` |
| Non-integer id | 422 | Path validation array |

A `404` here is surfaced as the string `Todo not found` in the banner, because
`detail` is a string and the client extracts it directly.

## Edge cases

- **Confirmation is the only guard.** There is no soft delete, no trash, and no undo.
  The row is gone from the database the moment `db.commit()` returns.
- **Dialog closes on failure too.** `.finally()` dismisses it. The row is still in the
  list and the banner explains the failure, so nothing is silently lost.
- **Escape and backdrop both cancel.** Neither issues a request. The cleanup listener
  removes the keydown handler on unmount, so repeated open/close cycles do not stack
  listeners.
- **Pending rows are inert.** While a delete is in flight both the checkbox and the
  trash button on that row are disabled, so a toggle cannot race the delete on the same
  row. Across different rows the shared `pendingId` slot is a known limitation, see
  [update-todo.md](update-todo.md).
- **`204` has no body.** Any client that calls `.json()` on this response gets a
  `SyntaxError`. `request` guards against that.
- **Direct API deletes bypass the dialog.** The confirmation is a UI affordance. A
  `curl` or another client deletes with one call and no confirmation.
- **Ids can be reused.** See [Data](#data). A `PATCH` with a stale id can land on a
  different, newly created todo rather than returning `404`.

## Verify

Backend:

```bash
.venv/bin/uvicorn be.app.main:app --reload

ID=$(curl -s -X POST http://127.0.0.1:8000/api/todos \
  -H 'Content-Type: application/json' -d '{"title":"Disposable"}' | python3 -c 'import json,sys;print(json.load(sys.stdin)["id"])')

# 204, empty body
curl -i -X DELETE "http://127.0.0.1:8000/api/todos/$ID"

# 404, already gone
curl -i -X DELETE "http://127.0.0.1:8000/api/todos/$ID"

# 404, never existed
curl -i -X DELETE http://127.0.0.1:8000/api/todos/999999

# 422, non-integer id
curl -i -X DELETE http://127.0.0.1:8000/api/todos/abc
```

Frontend:

```bash
cd fe && npm run build
```

Browser:

1. Add two todos, then click the trash icon on the first.
2. Confirm the dialog quotes the correct title and focus starts on **Cancel**.
3. Press `Escape`, confirm the dialog closes and the list is unchanged.
4. Reopen, click the backdrop, confirm the dialog closes and the list is unchanged.
5. Reopen, click **Delete**, confirm the dialog closes and only that row disappears.
6. Add `A`, add `B`, delete `B`, add `C`. Confirm `C` is appended at the top of the list
   and renders correctly, including when it reuses the deleted `B` id.
7. Stop the backend, open the dialog, confirm, and verify the row stays in the list with
   the banner showing the failure.

## Files

| Layer | File | Role |
|---|---|---|
| FE | `fe/src/components/ConfirmDialog.tsx` | Modal, focus, Escape, backdrop, `isPending` guards |
| FE | `fe/src/components/TodoItem.tsx` | Trash button, `onDelete(todo)` |
| FE | `fe/src/components/TodoList.tsx` | Passes `onDelete` through to each row |
| FE | `fe/src/App.tsx` | `todoPendingDelete` state, dialog wiring, `.finally` close |
| FE | `fe/src/hooks/useTodos.ts` | `remove`, post-success `filter`, error capture |
| FE | `fe/src/api/todos.ts` | `deleteTodo`, `204` short-circuit in `request` |
| BE | `be/app/routers/todos.py` | `DELETE /api/todos/{id}`, 204 / 404 |
| BE | `be/app/services/todos.py` | `delete_todo` via `get_todo` |
| Plan | `plan-2/plan.MD` | The dialog change and its acceptance criteria |
