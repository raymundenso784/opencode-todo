# DATABASE PLAN

## STATUS
REQUIRED

## OBJECTIVE

Define the SQLite `todos` table and the versioned migration that creates it, plus
human-readable schema documentation.

## REQUIREMENTS OWNED

- SQLite is the datastore
- A single `todos` table with add / complete / delete support
- `is_done` persists completion state

## REPOSITORY CONTEXT

- Greenfield. `be/` does not exist yet.
- The backend runs as `uvicorn be.app.main:app --reload`, so the package root is `be/`
  and the DB file should live under `be/` (e.g. `be/todos.db`), path overridable by env.

## REQUIRED CHANGES

1. Create the Alembic scaffolding owned by `be/` (`alembic.ini`, `migrations/env.py`
   with `render_as_batch=True`, `migrations/script.py.mako`, `migrations/versions/`).
2. Write migration `0001_create_todos.py` creating exactly the table in the master
   plan contract.
3. Write `be/database/SCHEMA.md` documenting the table, columns, types, and constraints.

SQLite has no native boolean type. Use SQLAlchemy `Boolean`, which stores 0/1 and
coerces on read. Do not emit MySQL-flavoured DDL (`AUTO_INCREMENT`, `DATETIME` defaults
in a non-SQLite form, `ENGINE=` clauses, backticks).

## FILE EXPECTATIONS

Files/folders to create:

- `be/alembic.ini`
- `be/migrations/env.py`
- `be/migrations/script.py.mako`
- `be/migrations/versions/0001_create_todos.py`
- `be/database/SCHEMA.md`
- `be/database/seed.sql` (optional sample INSERTs only — no DDL)
- `be/app/__init__.py`

## DATABASE CONTRACT

- Table `todos`:
  - `id` INTEGER, primary key, autoincrement
  - `title` TEXT, NOT NULL, 1-200 characters after trimming
  - `is_done` BOOLEAN, NOT NULL, default false
  - `created_at` DATETIME, NOT NULL, default CURRENT_TIMESTAMP
  - `updated_at` DATETIME, NOT NULL
- No foreign keys, no joins, no secondary indexes.

## ACCEPTANCE CRITERIA

- [ ] `alembic upgrade head` creates the `todos` table with all five columns
- [ ] `is_done` defaults to 0 on insert
- [ ] `created_at` defaults to the current timestamp on insert
- [ ] `title` rejects NULL
- [ ] The data persists to a `.db` file under `be/`

## VERIFICATION

```bash
python3 -m venv .venv
.venv/bin/pip install -r be/requirements.txt
.venv/bin/alembic -c be/alembic.ini upgrade head
.venv/bin/python -c "import sqlite3;print(sqlite3.connect('be/todos.db').execute('select sql from sqlite_master where name=\"todos\"').fetchone())"
```

## BOUNDARIES

- Database scope only
- No unrelated schema refactors
- The Alembic scaffolding is created here but executed by the `be` layer
