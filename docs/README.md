# Documentation

Feature-level documentation for the todo app. Each document covers one user-facing
feature end to end: the React UI, the HTTP contract, the FastAPI route, the service
layer, and the SQLite row it touches.

| Feature | Document | Endpoint |
|---|---|---|
| Create a todo | [features/create-todo.md](features/create-todo.md) | `POST /api/todos` |
| Update / complete a todo | [features/update-todo.md](features/update-todo.md) | `PATCH /api/todos/{id}` |
| Delete a todo | [features/delete-todo.md](features/delete-todo.md) | `DELETE /api/todos/{id}` |

Read-only companion endpoint: `GET /api/todos` (list) and `GET /api/todos/{id}` (single).
Both are consumed by `useTodos` on mount and documented in
[features/update-todo.md](features/update-todo.md) for the read path.

## Document layout

Every feature document uses the same sections:

1. **User story** — what the user does and what they see.
2. **Flow** — an ordered trace of every call across the stack.
3. **Frontend** — component, hook, and API client, in that order.
4. **Backend** — route, Pydantic schema, service function, ORM model.
5. **Data** — the columns read and written, and how defaults are applied.
6. **Contract** — request, success response, and every error response.
7. **Edge cases** — the behaviour that is easy to get wrong.
8. **Verify** — curl commands and the browser steps to prove it works.
9. **Files** — every file that participates in the feature.

## Architecture in one page

```text
fe/src/components/*.tsx     presentational + interaction
        |  props, callbacks
fe/src/hooks/useTodos.ts    state, optimistic updates, error surface
        |
fe/src/api/todos.ts         fetch wrapper, error normalisation
        |  HTTP + JSON
be/app/routers/todos.py     route, status codes, 404 mapping
        |
be/app/services/todos.py    business rules, timestamps, TodoNotFound
        |
be/app/schemas/todo.py      request validation (Pydantic v2)
be/app/db/models.py         ORM mapping
        |
be/todos.db                 SQLite, table `todos`
```

Layering rules the code follows:

- Components never call `fetch`. They receive callbacks and render state.
- The hook owns all state and is the only caller of the API client.
- The API client owns `fetch`, the base URL, and error message extraction.
- Routers own HTTP: they translate `TodoNotFound` into `404`.
- Services own persistence and never raise `HTTPException`.
- Pydantic owns input validation; the database stores what survives validation.

## Shared contract

Base URL is `http://127.0.0.1:8000`, overridable with `VITE_API_URL` on the frontend.
CORS defaults to `http://localhost:5173`, overridable with `CORS_ORIGINS`.

`Todo` response shape:

```json
{
  "id": 1,
  "title": "Buy milk",
  "is_done": false,
  "created_at": "2026-09-28T05:00:00",
  "updated_at": "2026-09-28T05:00:00"
}
```

`TodoUpdate` is the partial patch body:

```ts
type TodoUpdate = Partial<Pick<Todo, "title" | "is_done">>;
```

| Status | Meaning |
|---|---|
| `200` | Success with a `Todo` body |
| `201` | Created, with a `Todo` body |
| `204` | Deleted, no body |
| `404` | `{"detail": "Todo not found"}` |
| `422` | Validation failed; FastAPI's error array in `detail` |

## Running the app

```bash
# backend, from the project root
.venv/bin/alembic -c be/alembic.ini upgrade head
.venv/bin/uvicorn be.app.main:app --reload

# frontend
cd fe && npm install && npm run dev
```

## Related documents

- [../be/database/SCHEMA.md](../be/database/SCHEMA.md) — table and migration reference
- [../plan-1/PLAN.MD](../plan-1/PLAN.MD) — the original frozen API contract
- [../plan-2/plan.MD](../plan-2/plan.MD) — the delete confirmation dialog change
