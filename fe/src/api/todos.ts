import type { Todo, TodoUpdate } from "../types/todo";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      // keep the generic message when the body is not JSON
    }
    throw new Error(detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function listTodos(): Promise<Todo[]> {
  return request<Todo[]>("/api/todos");
}

export function createTodo(title: string): Promise<Todo> {
  return request<Todo>("/api/todos", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export function updateTodo(id: number, changes: TodoUpdate): Promise<Todo> {
  return request<Todo>(`/api/todos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });
}

export function deleteTodo(id: number): Promise<void> {
  return request<void>(`/api/todos/${id}`, { method: "DELETE" });
}
