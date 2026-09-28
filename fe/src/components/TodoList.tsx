import { TodoItem } from "./TodoItem";
import type { Todo } from "../types/todo";

interface TodoListProps {
  todos: Todo[];
  pendingId: number | null;
  onToggle: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
}

export function TodoList({ todos, pendingId, onToggle, onDelete }: TodoListProps) {
  if (todos.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 py-10 text-center text-sm text-slate-400">
        Nothing here yet. Add your first todo above.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          isPending={pendingId === todo.id}
          onToggle={onToggle}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}
