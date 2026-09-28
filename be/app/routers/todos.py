from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from be.app.db.engine import get_db
from be.app.db.models import Todo
from be.app.schemas.todo import TodoCreate, TodoRead, TodoUpdate
from be.app.services.todos import (
    TodoNotFound,
    create_todo,
    delete_todo,
    get_todo,
    list_todos,
    update_todo,
)

router = APIRouter(prefix="/todos", tags=["todos"])


@router.get("", response_model=list[TodoRead])
def read_todos(db: Session = Depends(get_db)) -> list[Todo]:
    return list_todos(db)


@router.post("", response_model=TodoRead, status_code=status.HTTP_201_CREATED)
def create(payload: TodoCreate, db: Session = Depends(get_db)) -> Todo:
    return create_todo(db, payload)


@router.get("/{todo_id}", response_model=TodoRead)
def read(todo_id: int, db: Session = Depends(get_db)) -> Todo:
    try:
        return get_todo(db, todo_id)
    except TodoNotFound:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Todo not found"
        )


@router.patch("/{todo_id}", response_model=TodoRead)
def patch(todo_id: int, payload: TodoUpdate, db: Session = Depends(get_db)) -> Todo:
    try:
        return update_todo(db, todo_id, payload)
    except TodoNotFound:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Todo not found"
        )


@router.delete("/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove(todo_id: int, db: Session = Depends(get_db)) -> Response:
    try:
        delete_todo(db, todo_id)
    except TodoNotFound:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Todo not found"
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
