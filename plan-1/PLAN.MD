# PLAN 1 — TODO APP

## STATUS
READY FOR IMPLEMENTATION

## ORIGINAL OBJECTIVE

Build a todo app with a simple, clean UI. The user can add a todo, mark a todo
complete/incomplete, and delete a todo. The frontend is Vite + React + Tailwind. The
backend is FastAPI. The database is SQLite.

## REQUIREMENTS

- [ ] Simple, clean todo UI/UX (Tailwind, no component library)
- [ ] Add a todo
- [ ] Delete a todo
- [ ] Mark a todo complete / incomplete (toggle)
- [ ] Frontend: Vite + React + Tailwind
- [ ] Backend: FastAPI
- [ ] Database: SQLite
- [ ] No auth, no priorities, no due dates, no tags, no subtasks, no filters

## REPOSITORY CONTEXT

- New app code lives in two new root folders: `be/` and `fe/`. Nothing else changes.
- `todo-plan/PLAN.md` is an older single-file plan. Do not delete or modify it.
- Toolchain: Python 3.14.7, Node 22.14.0, npm 10.9.2. `uv` is NOT installed — use
  `python3 -m venv` + `pip`. Docker is not required.
- Backend entrypoint is `be.app.main:app`, so `be/app/__init__.py` must exist.
- Frontend dev server is Vite on `http://localhost:5173`; CORS must allow exactly that.

## AFFECTED LAYERS

### Database
REQUIRED

### Backend
REQUIRED

### Frontend
REQUIRED

## EXECUTION ORDER

1. database
2. be
3. fe

Sequential. The backend consumes the database contract; the frontend consumes the
API contract.

## CROSS-LAYER CONTRACTS

### Table `todos`

| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | primary key, autoincrement |
| `title` | TEXT | NOT NULL, 1-200 characters after trimming |
| `is_done` | BOOLEAN | NOT NULL, default 0 |
| `created_at` | DATETIME | NOT NULL, default CURRENT_TIMESTAMP |
| `updated_at` | DATETIME | NOT NULL |

No joins. No indexes beyond the primary key.

### API

| Method | Path | Result |
|---|---|---|
| GET | `/health` | 200 `{"status":"ok"}` |
| GET | `/api/todos` | 200 `Todo[]`, newest first |
| GET | `/api/todos/{id}` | 200 `Todo` / 404 `{"detail":"Todo not found"}` |
| POST | `/api/todos` | 201 `Todo` / 422 on blank title |
| PATCH | `/api/todos/{id}` | 200 `Todo` / 404 / 422 — accepts partial `title?` and `is_done?` |
| DELETE | `/api/todos/{id}` | 204 / 404 |

`Todo` JSON shape:

```json
{
  "id": 1,
  "title": "Buy milk",
  "is_done": false,
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-01T00:00:00Z"
}
```

CORS allows `http://localhost:5173` only.

### Frontend expectations

- Toggling completion MUST use `PATCH` (never `PUT`) and MUST send only `is_done`.
- Deleting MUST use `DELETE` and expect 204 with no body.
- The list MUST surface loading, empty, and error states.

## ACCEPTANCE CRITERIA

- [ ] `todos` table exists after migration and survives a backend restart
- [ ] `GET /health` returns 200 `{"status":"ok"}`
- [ ] `POST /api/todos` creates a todo and returns 201
- [ ] `POST /api/todos` with a blank title returns 422
- [ ] `GET /api/todos` returns todos newest first
- [ ] `GET /api/todos/{missing}` returns 404
- [ ] `PATCH /api/todos/{id}` with `{"is_done": true}` flips completion and leaves `title` untouched
- [ ] `DELETE /api/todos/{id}` returns 204 and the todo is gone
- [ ] `GET /api/todos/{id}` on a deleted todo returns 404
- [ ] Frontend renders the todo list, allows adding, toggling, and deleting
- [ ] `cd fe && npm install && npm run build` succeeds with a clean `tsc -b`
- [ ] Completed todos render with a strikethrough and a dimmed style

## VERIFICATION SUMMARY

- database: migration applies; `\d todos` / table introspection shows the columns above
- backend: app imports, `/health` responds, all six endpoints curl-tested, `.db` persists
- frontend: `npm run build` passes; manual browser pass over add / toggle / delete
- final: backend CORS allows `http://localhost:5173` and no request is blocked

## LAYER PLAN FILES

- Database: `plan-1/database/PLAN.MD`
- Backend: `plan-1/be/PLAN.MD`
- Frontend: `plan-1/fe/PLAN.MD`

## IMPLEMENTATION RULES

- Execute the layers sequentially in EXECUTION ORDER.
- Follow the frozen contracts above exactly.
- Create missing folders and files; do not stop after scaffolding.
- Do not add features beyond the requirements list.
- Do not modify `.opencode/agents/` or `todo-plan/`.
- DONE means every acceptance criterion above is satisfied.
