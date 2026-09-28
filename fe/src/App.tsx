import { useState } from "react";

import { ConfirmDialog } from "./components/ConfirmDialog";
import { TodoForm } from "./components/TodoForm";
import { TodoList } from "./components/TodoList";
import { useTodos } from "./hooks/useTodos";
import type { Todo } from "./types/todo";

export default function App() {
  const { todos, isLoading, error, pendingId, isAdding, add, toggle, remove, reload } =
    useTodos();
  const [todoPendingDelete, setTodoPendingDelete] = useState<Todo | null>(null);

  const remaining = todos.filter((todo) => !todo.is_done).length;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-col gap-6 px-4 py-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Todo</h1>
        <p className="mt-1 text-sm text-slate-500">
          {remaining === 0
            ? "All clear"
            : `${remaining} ${remaining === 1 ? "task" : "tasks"} left`}
        </p>
      </header>

      <TodoForm onAdd={add} isAdding={isAdding} />

      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void reload()}
            className="shrink-0 rounded-md px-2 py-1 font-medium text-red-700 underline underline-offset-2 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading…</p>
      ) : (
        <TodoList
          todos={todos}
          pendingId={pendingId}
          onToggle={(todo) => void toggle(todo)}
          onDelete={setTodoPendingDelete}
        />
      )}

      {todoPendingDelete && (
        <ConfirmDialog
          title="Delete this todo?"
          message={`"${todoPendingDelete.title}" will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          isPending={pendingId === todoPendingDelete.id}
          onCancel={() => setTodoPendingDelete(null)}
          onConfirm={() => {
            void remove(todoPendingDelete).finally(() => setTodoPendingDelete(null));
          }}
        />
      )}
    </div>
  );
}
