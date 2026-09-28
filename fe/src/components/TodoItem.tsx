import type { Todo } from "../types/todo";

interface TodoItemProps {
  todo: Todo;
  isPending: boolean;
  onToggle: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
}

export function TodoItem({ todo, isPending, onToggle, onDelete }: TodoItemProps) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <input
        type="checkbox"
        checked={todo.is_done}
        disabled={isPending}
        onChange={() => onToggle(todo)}
        aria-label={`Mark "${todo.title}" as ${todo.is_done ? "not done" : "done"}`}
        className="h-5 w-5 shrink-0 cursor-pointer rounded border-slate-300 accent-slate-900 disabled:cursor-not-allowed"
      />
      <span
        className={
          todo.is_done
            ? "flex-1 text-slate-400 line-through"
            : "flex-1 text-slate-900"
        }
      >
        {todo.title}
      </span>
      <button
        type="button"
        onClick={() => onDelete(todo)}
        disabled={isPending}
        aria-label={`Delete "${todo.title}"`}
        className="shrink-0 rounded-md px-2 py-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:ring-2 focus:ring-red-500/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
        >
          <path
            fillRule="evenodd"
            d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </li>
  );
}
