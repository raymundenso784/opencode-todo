export interface Todo {
  id: number;
  title: string;
  is_done: boolean;
  created_at: string;
  updated_at: string;
}

export type TodoUpdate = Partial<Pick<Todo, "title" | "is_done">>;
