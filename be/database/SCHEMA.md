# Database Schema

SQLite. One table, no joins, no secondary indexes.

## `todos`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | INTEGER | no | autoincrement | Primary key |
| `title` | TEXT | no | — | 1-200 characters after trimming, validated in the Pydantic schema |
| `is_done` | BOOLEAN | no | `0` | Stored as integer 0/1; SQLAlchemy `Boolean` handles coercion |
| `created_at` | DATETIME | no | `CURRENT_TIMESTAMP` | Set on insert |
| `updated_at` | DATETIME | no | `CURRENT_TIMESTAMP` | Refreshed on every update by the service layer |

## SQLite notes

SQLite has no native boolean or datetime type. Booleans are stored as `0`/`1` and
datetimes as ISO-8601 strings. `Boolean` in the ORM model and non-strict Pydantic schemas
keep the conversion in one place.

## Migrations

Alembic owns the schema. `migrations/env.py` sets `render_as_batch=True` because SQLite
cannot `ALTER COLUMN`; without it, any future column change would fail.

```bash
.venv/bin/alembic -c be/alembic.ini upgrade head
```

## Files

- `be/app/db/models.py` — ORM model
- `be/migrations/versions/0001_create_todos.py` — the migration that creates the table
- `be/database/seed.sql` — optional sample data (INSERT only, no DDL)
