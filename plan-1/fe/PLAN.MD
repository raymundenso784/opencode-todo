# FRONTEND PLAN

## STATUS
REQUIRED

## OBJECTIVE

Build a simple, clean todo UI in Vite + React + Tailwind, wired to the FastAPI backend,
supporting add, complete/incomplete, and delete.

## REQUIREMENTS OWNED

- Vite + React + Tailwind
- Simple, clean UI/UX — no component library
- Add a todo
- Mark a todo complete / incomplete
- Delete a todo
- Clear loading, empty, and error states

## DEPENDENCIES

The API contract in `plan-1/PLAN.MD`. The critical detail: completion toggling uses
`PATCH` with only `{"is_done": <bool>}` in the body. `PUT` must not be used, and omitted
fields must not be sent, because the backend performs a genuine partial update.

## REPOSITORY CONTEXT

- Greenfield `fe/`. Sibling `be/` runs on `http://127.0.0.1:8000`; the Vite dev server
  runs on `http://localhost:5173`. CORS on the backend allows only the latter.
- Tailwind v4 is wired as a Vite plugin, not as a PostCSS config.

## REQUIRED CHANGES

1. Scaffold `fe/` with Vite, React, and TypeScript. Install the pinned versions listed in
   the master plan. Pin TypeScript to 5.9.3, not 7.x.
2. Wire Tailwind v4 through the `@tailwindcss/vite` plugin in `vite.config.ts`, with a
   single `@import "tailwindcss";` at the top of `src/index.css`. Do NOT create
   `tailwind.config.js` and do NOT add PostCSS config — neither is used in v4.
3. Add `src/types/todo.ts` with the `Todo` interface mirroring the API exactly.
4. Add `src/api/todos.ts`, a small typed `fetch` client: `listTodos`, `createTodo`,
   `updateTodo` (PATCH), `deleteTodo`. Throw on non-OK responses so the hook can surface
   the message.
5. Add `src/hooks/useTodos.ts` holding the list plus loading, error, and per-item pending
   state, wiring the four client calls together.
6. Add `src/components/TodoForm.tsx`, `TodoList.tsx`, `TodoItem.tsx` and compose them in
   `App.tsx`.

## UI / CLIENT CONTRACT

- `TodoForm`: controlled input plus submit button. Submitting creates the todo, then
  clears the input. Do not submit a blank or whitespace-only value.
- `TodoItem`: a checkbox-like toggle that calls PATCH with only `is_done`, the todo title,
  and a delete button. A completed todo renders with `line-through` and dimmed text.
- `TodoList`: renders the items, or a friendly empty state when there are none.
- `App`: renders the form and the list; shows a loading state on first fetch and an error
  message with a retry when a request fails.
- Optimistic update on toggle is preferred so the toggle feels instant, with rollback to
  the previous value if the request fails.

## FILE EXPECTATIONS

- `fe/package.json`, `fe/vite.config.ts`, `fe/tsconfig.json`, `fe/tsconfig.node.json`,
  `fe/index.html`, `fe/.gitignore`
- `fe/src/main.tsx`, `fe/src/App.tsx`, `fe/src/index.css`
- `fe/src/api/todos.ts`
- `fe/src/types/todo.ts`
- `fe/src/hooks/useTodos.ts`
- `fe/src/components/TodoForm.tsx`, `TodoList.tsx`, `TodoItem.tsx`

## ACCEPTANCE CRITERIA

- [ ] `cd fe && npm install && npm run build` succeeds and `tsc -b` is clean
- [ ] Tailwind utilities actually render (confirm no `tailwind.config.js` is needed)
- [ ] Adding a todo appears in the list and survives a page refresh
- [ ] Toggling completion PATCHes and updates the row immediately
- [ ] A completed todo shows a strikethrough and dimmed styling
- [ ] Deleting removes the row and it does not come back on refresh
- [ ] First load shows a loading state; an empty list shows an empty state
- [ ] A failed request shows an error message rather than a blank screen
- [ ] No browser console CORS errors against `http://localhost:5173`

## VERIFICATION

```bash
cd fe && npm install && npm run build
cd fe && npm run dev
```

Then manually exercise add, toggle, and delete against the running backend.

## BOUNDARIES

- Frontend scope only
- Do not edit `be/`
- Follow the frozen API contract; do not invent extra endpoints or fields
