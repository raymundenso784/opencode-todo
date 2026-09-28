import { useState } from "react";

interface TodoFormProps {
  onAdd: (title: string) => Promise<boolean>;
  isAdding: boolean;
}

export function TodoForm({ onAdd, isAdding }: TodoFormProps) {
  const [title, setTitle] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || isAdding) return;
    if (await onAdd(title)) setTitle("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="What needs doing?"
        maxLength={200}
        aria-label="New todo"
        className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-900/10 focus:outline-none"
      />
      <button
        type="submit"
        disabled={isAdding || !title.trim()}
        className="rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white transition-colors hover:bg-slate-700 focus:ring-2 focus:ring-slate-900/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isAdding ? "Adding…" : "Add"}
      </button>
    </form>
  );
}
