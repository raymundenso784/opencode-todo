# Feature: Create a Todo

The user types a title into the input at the top of the page and presses **Add** or
`Enter`. The todo appears at the top of the list and the input clears.

## User story

> As a user, I want to add a task so I can keep track of what I need to do.

## Flow

```text
User types "Buy milk" and submits
  -> TodoForm.handleSubmit          fe/src/components/TodoForm.tsx:11
     - preventDefault, trim guard, isAdding guard
  -> useTodos.add(title)            fe/src/hooks/useTodos.ts:38
     - trims, sets isAdding + clears error
  -> createTodo(trimmed)            fe/src/api/todos.ts:33
     - POST {BASE_URL}/api/todos, body {"title": "..."}
  -> request<Todo>()                fe/src/api/todos.ts:5
     - fetch with Content-Type: application/json
  -> POST /api/todos                be/app/routers/todos.py:24
     - validates body into TodoCreate, injects Session via Depends(get_db)
  -> create_todo(db, payload)       be/app/services/todos.py:30
     - stamps created_at/updated_at, always starts is_done=False
  -> db.commit(); db.refresh()
  -> 201 Created + Todo JSON
  <- useTodos prepends the created todo, isAdding back to false
  <- onAdd resolved true, so TodoForm clears the input
```

The list is **not** refetched after a create. The `201` body is authoritative and is
prepended locally, so the new todo renders without a second round trip.

## Frontend

### `fe/src/components/TodoForm.tsx`

Controlled input plus submit button. It holds only the raw `title` string; all other
state lives in the hook.

- `maxLength={200}` on the input mirrors the backend limit, so the browser blocks
  over-long input before a request is made.
- The button is `disabled` when `isAdding` is true or when `title.trim()` is empty, so
  whitespace-only input cannot be submitted.
- `handleSubmit` calls `preventDefault()` and re-checks both guards. The second check
  exists because a form can also be submitted from the keyboard while the button is
  disabled.
- The input clears **only** on success: `if (await onAdd(title)) setTitle("")`. A failed
  request leaves the text in place so the user does not lose what they typed.
- The label flips to `Adding…` while the request is in flight.

### `fe/src/hooks/useTodos.ts`

`add` is the stateful half of the feature:

```ts
const add = useCallback(async (title: string) => {
  const trimmed = title.trim();
  if (!trimmed) return false;

  setIsAdding(true);
  setError(null);
  try {
    const created = await createTodo(trimmed);
    setTodos((current) => [created, ...current]);
    return true;
  } catch (err) {
    setError(message(err));
    return false;
  } finally {
    setIsAdding(false);
  }
}, []);
```

- The return value is the success signal that `TodoForm` uses to decide whether to clear.
- Trimming happens here as well as in the form, so a non-UI caller cannot bypass it.
- `setTodos` uses the functional updater form, so a concurrent load cannot clobber the
  prepend.
- `message(err)` normalises unknown throwables to a string for the banner.
- `isAdding` is reset in `finally`, so a failure still re-enables the button.

### `fe/src/api/todos.ts`

```ts
export function createTodo(title: string): Promise<Todo> {
  return request<Todo>("/api/todos", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}
```

`request` adds `Content-Type: application/json`, throws `Error(detail)` on a non-2xx
response, and parses the JSON body. The base URL is `import.meta.env.VITE_API_URL ??
"http://127.0.0.1:8000"`.

### `fe/src/App.tsx`

Renders `<TodoForm onAdd={add} isAdding={isAdding} />` above the error banner and the
list. `remaining` is derived with `todos.filter((todo) => !todo.is_done).length`, so a
create immediately increments the "N tasks left" subtitle.

## Backend

### `be/app/routers/todos.py:24`

```py
@router.post("", response_model=TodoRead, status_code=status.HTTP_201_CREATED)
def create(payload: TodoCreate, db: Session = Depends(get_db)) -> Todo:
    return create_todo(db, payload)
```

- The router is mounted at `/api` in `be/app/main.py:17` and declares
  `prefix="/todos"`, giving `POST /api/todos`.
- The trailing-slash-less path `""` is what the client requests. FastAPI would answer
  `307` for `/api/todos/`, so the client must not add the slash.
- `response_model=TodoRead` strips any ORM attribute not declared in the schema, so the
  response shape is fixed regardless of what the model gains later.
- The router is a pass-through. It adds no branching, so `create_todo` has no `try` here
  and cannot fail with `TodoNotFound`.

### `be/app/schemas/todo.py`

```py
class TodoCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=TITLE_MAX_LENGTH)

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("title must not be blank")
        return trimmed
```

- `min_length=1` rejects the empty string.
- The validator rejects `"   "`, which would otherwise pass `min_length=1`, and returns
  the trimmed value so the stored title has no surrounding whitespace.
- `TITLE_MAX_LENGTH = 200` is the single source of truth for the limit and matches the
  `String(200)` column.
- A `ValueError` inside a validator becomes a `422` response automatically.

### `be/app/services/todos.py:30`

```py
def create_todo(db: Session, payload: TodoCreate) -> Todo:
    now = _now()
    todo = Todo(title=payload.title, is_done=False, created_at=now, updated_at=now)
    db.add(todo)
    db.commit()
    db.refresh(todo)
    return todo
```

- `is_done=False` is hard-coded. The client cannot create an already-completed todo.
- `_now()` returns `datetime.now(timezone.utc)`, so timestamps are timezone-aware and
  written on the application side rather than by SQLite's `CURRENT_TIMESTAMP`.
- `db.refresh` reloads the row so `id` (assigned by SQLite on insert) and the stored
  timestamps are populated on the returned object.
- The session is request-scoped and closed by the `get_db` generator in
  `be/app/db/engine.py:16`.

### `be/app/db/models.py`

The insert targets the `todos` table. Only `title` comes from the request; `is_done`,
`created_at`, and `updated_at` are supplied by the service.

## Data

| Column | Value on create | Source |
|---|---|---|
| `id` | autoincrement | SQLite on insert |
| `title` | trimmed request value | `TodoCreate.title` |
| `is_done` | `False` | hard-coded in `create_todo` |
| `created_at` | UTC now | `_now()` |
| `updated_at` | UTC now | `_now()` |

`server_default` values in the model are the safety net for rows inserted outside the
service, for example by `be/database/seed.sql`.

## Contract

**Request**

```http
POST /api/todos
Content-Type: application/json

{ "title": "Buy milk" }
```

**Success — 201 Created**

```json
{
  "id": 1,
  "title": "Buy milk",
  "is_done": false,
  "created_at": "2026-09-28T05:00:00",
  "updated_at": "2026-09-28T05:00:00"
}
```

**Errors**

| Condition | Status | Body |
|---|---|---|
| Title absent | 422 | FastAPI validation array |
| `""` | 422 | `min_length` violation |
| `"   "` | 422 | `title must not be blank` |
| Longer than 200 chars | 422 | `max_length` violation |
| Non-string title | 422 | Type validation |

`detail` from a `422` is an array of error objects, not a string. The client's
`request` helper only surfaces a string `detail`, so a `422` shows as
`Request failed (422)` in the banner. That is deliberate: the input stays in the form
and the banner explains the request failed.

## Edge cases

- **Double submit.** `isAdding` disables the button and `handleSubmit` re-checks it, so
  a fast double `Enter` produces one request. The `disabled` attribute alone is not
  enough: a form can still be submitted with `Enter` from the focused input, and during
  the in-flight window the click handler is the only thing stopping a second POST.
- **Whitespace-only input.** Caught three times: the button's `disabled` check, the
  `add` guard, and the backend validator. Only the last one is load-bearing for other
  clients.
- **Title is not trimmed on failure.** The form keeps the raw text so a retry does not
  require retyping.
- **Ordering.** The new todo is prepended, matching the backend's
  `ORDER BY created_at DESC, id DESC` on read.
- **Concurrent adds.** Because each add prepends on its own response, two rapid creates
  land in response order, not submission order.

## Verify

Backend:

```bash
.venv/bin/uvicorn be.app.main:app --reload

# 201 with a Todo body
curl -i -X POST http://127.0.0.1:8000/api/todos \
  -H 'Content-Type: application/json' -d '{"title":"Buy milk"}'

# 422, blank
curl -i -X POST http://127.0.0.1:8000/api/todos \
  -H 'Content-Type: application/json' -d '{"title":"   "}'

# 422, missing field
curl -i -X POST http://127.0.0.1:8000/api/todos \
  -H 'Content-Type: application/json' -d '{}'
```

Frontend:

```bash
cd fe && npm run build   # tsc -b && vite build
```

Browser:

1. Open `http://localhost:5173`, type `Buy milk`, press **Add**.
2. The todo appears at the top of the list and the input is empty.
3. The subtitle reads `1 task left`.
4. Type spaces only, confirm the **Add** button stays disabled.
5. Stop the backend, submit a todo, confirm the red banner appears and the typed text
   is still in the input.
6. Restart the backend, click **Retry** in the banner, confirm the todo loads.

## Files

| Layer | File | Role |
|---|---|---|
| FE | `fe/src/components/TodoForm.tsx` | Input, submit, disable rules, clear on success |
| FE | `fe/src/hooks/useTodos.ts` | `add`, `isAdding`, prepend to list |
| FE | `fe/src/api/todos.ts` | `createTodo`, `request` wrapper |
| FE | `fe/src/App.tsx` | Renders the form, derives `remaining` |
| BE | `be/app/routers/todos.py` | `POST /api/todos`, 201 |
| BE | `be/app/schemas/todo.py` | `TodoCreate` validation |
| BE | `be/app/services/todos.py` | `create_todo` defaults and timestamps |
| BE | `be/app/db/models.py` | `Todo` mapping |
| DB | `be/migrations/versions/0001_create_todos.py` | Table creation |
