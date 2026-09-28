# BACKEND PLAN

## STATUS
REQUIRED

## OBJECTIVE

Scaffold `be/` and implement the FastAPI service that exposes the frozen todo API over
SQLite.

## REQUIREMENTS OWNED

- FastAPI backend
- SQLite-backed persistence
- Endpoints for list, get, create, partial update, and delete
- CORS for the Vite dev origin
- A `/health` endpoint

## DEPENDENCIES

Database contract from `plan-1/database/PLAN.MD`:

- Table `todos`: `id` INTEGER PK autoincrement, `title` TEXT NOT NULL (1-200 chars
  trimmed), `is_done` BOOLEAN NOT NULL default false, `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL.

## REPOSITORY CONTEXT

- Greenfield `be/`. The `database` layer already created `be/alembic.ini`,
  `be/migrations/`, and `be/database/SCHEMA.md` — do not recreate them.
- Entry command: `uvicorn be.app.main:app --reload` from the project root, so
  `be/__init__.py` and `be/app/__init__.py` must both exist.
- `uv` is not installed. Use `python3 -m venv .venv` and `.venv/bin/pip`.

## REQUIRED CHANGES

1. `be/requirements.txt` pinning `fastapi`, `uvicorn[standard]`, `sqlalchemy`, `alembic`,
   `pydantic`.
2. `be/app/config.py` — read `DATABASE_URL` and `CORS_ORIGINS` from the environment with
   working defaults. No extra dependency for this.
3. `be/app/db/base.py` — declarative Base.
4. `be/app/db/engine.py` — `create_engine`, `SessionLocal`, `get_db` dependency. Enable
   `check_same_thread=False` for SQLite.
5. `be/app/db/models.py` — the `Todo` ORM model matching the database contract.
6. `be/app/schemas/todo.py` — `TodoCreate`, `TodoUpdate`, `TodoRead`. `TodoUpdate` fields
   are all optional so PATCH is a genuine partial update. Validate the trimmed title is
   1-200 characters; keep the Pydantic schemas non-strict so SQLite integers coerce into
   `bool` correctly.
7. `be/app/services/todos.py` — list (newest first), get, create, update, delete. Update
   `updated_at` on every mutation.
8. `be/app/routers/todos.py` — thin HTTP layer only; all logic lives in the service.
9. `be/app/main.py` — app, CORS middleware with `http://localhost:5173` only, `/health`,
   router mount at `/api`.

## FILE EXPECTATIONS

- `be/__init__.py`
- `be/requirements.txt`
- `be/app/__init__.py`
- `be/app/main.py`
- `be/app/config.py`
- `be/app/db/__init__.py`, `base.py`, `engine.py`, `models.py`
- `be/app/schemas/__init__.py`, `todo.py`
- `be/app/services/__init__.py`, `todos.py`
- `be/app/routers/__init__.py`, `todos.py`

## API CONTRACT

Exactly the table in `plan-1/PLAN.MD`. Specifically:

- `GET /health` -> 200 `{"status": "ok"}`
- `GET /api/todos` -> 200, `Todo[]` ordered newest first
- `GET /api/todos/{id}` -> 200 `Todo`, or 404 `{"detail": "Todo not found"}`
- `POST /api/todos` -> 201 `Todo`; 422 on a blank or whitespace-only title
- `PATCH /api/todos/{id}` -> 200 `Todo`; 404; 422. Accepts any subset of
  `{"title": string, "is_done": bool}`. Must not reset omitted fields.
- `DELETE /api/todos/{id}` -> 204 with an empty body; 404

Every `Todo` response is `{id, title, is_done, created_at, updated_at}` with ISO-8601
timestamps.

## ACCEPTANCE CRITERIA

- [ ] `uvicorn be.app.main:app --reload` starts with no import errors
- [ ] All six endpoints return the documented status codes and bodies
- [ ] A blank title is rejected with 422
- [ ] A missing id returns 404 on GET, PATCH, and DELETE
- [ ] PATCH with only `is_done` leaves `title` unchanged
- [ ] Data survives a backend restart (`.db` file under `be/`)
- [ ] CORS allows `http://localhost:5173` and does not allow other origins

## VERIFICATION

```bash
python3 -m venv .venv
.venv/bin/pip install -r be/requirements.txt
.venv/bin/alembic -c be/alembic.ini upgrade head
.venv/bin/uvicorn be.app.main:app --reload
```

Then curl each endpoint, including the 404 and 422 cases, and restart the server to
confirm persistence.

## BOUNDARIES

- Backend scope only
- Do not edit the migration or `be/database/`
- Follow the frozen contracts from the master and database plans
