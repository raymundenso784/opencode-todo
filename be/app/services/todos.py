from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from be.app.db.models import Todo
from be.app.schemas.todo import TodoCreate, TodoUpdate


class TodoNotFound(Exception):
    pass


def _now() -> datetime:
    return datetime.now(timezone.utc)


def list_todos(db: Session) -> list[Todo]:
    stmt = select(Todo).order_by(Todo.created_at.desc(), Todo.id.desc())
    return list(db.execute(stmt).scalars().all())


def get_todo(db: Session, todo_id: int) -> Todo:
    todo = db.get(Todo, todo_id)
    if todo is None:
        raise TodoNotFound(todo_id)
    return todo


def create_todo(db: Session, payload: TodoCreate) -> Todo:
    now = _now()
    todo = Todo(title=payload.title, is_done=False, created_at=now, updated_at=now)
    db.add(todo)
    db.commit()
    db.refresh(todo)
    return todo


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


def delete_todo(db: Session, todo_id: int) -> None:
    todo = get_todo(db, todo_id)
    db.delete(todo)
    db.commit()
