import { useCallback, useEffect, useState } from "react";

import {
  createTodo,
  deleteTodo,
  listTodos,
  updateTodo,
} from "../api/todos";
import type { Todo } from "../types/todo";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setTodos(await listTodos());
    } catch (err) {
      setError(message(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = useCallback(async (title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return false;

    setIsAdding(true);
    setError(null);
    try {
      const created = await createTodo(trimmed);
      setTodos((current) => [created, ...current]);
      return true;
    } catch (err) {
      setError(message(err));
      return false;
    } finally {
      setIsAdding(false);
    }
  }, []);

  const toggle = useCallback(async (todo: Todo) => {
    const next = !todo.is_done;
    setPendingId(todo.id);
    setError(null);
    setTodos((current) =>
      current.map((item) => (item.id === todo.id ? { ...item, is_done: next } : item)),
    );
    try {
      const updated = await updateTodo(todo.id, { is_done: next });
      setTodos((current) =>
        current.map((item) => (item.id === todo.id ? updated : item)),
      );
    } catch (err) {
      setTodos((current) =>
        current.map((item) => (item.id === todo.id ? todo : item)),
      );
      setError(message(err));
    } finally {
      setPendingId(null);
    }
  }, []);

  const remove = useCallback(async (todo: Todo) => {
    setPendingId(todo.id);
    setError(null);
    try {
      await deleteTodo(todo.id);
      setTodos((current) => current.filter((item) => item.id !== todo.id));
    } catch (err) {
      setError(message(err));
    } finally {
      setPendingId(null);
    }
  }, []);

  return { todos, isLoading, error, pendingId, isAdding, add, toggle, remove, reload: load };
}
