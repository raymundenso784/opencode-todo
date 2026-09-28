```md
# FRONTEND PLAN

## STATUS
IMPLEMENTED

## OBJECTIVE
\- [ ] Confirmation dialog guards todo deletion.\
\- [ ] The dialog is presentational and the delete request stays in the existing hook.

## REQUIREMENTS OWNED
\- [ ] Dialog opens instead of deleting.
\- [ ] `Cancel`, `Escape`, or backdrop click dismiss without deleting.
\- [ ] `Delete` sends exactly one `DELETE /api/todos/{id}`.
\- [ ] Both buttons disabled while the request is in flight.
\- [ ] Dialog closes after the request settles, success or failure.
\- [ ] Add, toggle, loading, empty, and error states unaffected.
\- [ ] No new dependency.

## DEPENDENCIES
- [ ] useTodos from `fe/src/hooks/useTodos.ts` (\`remove(todo)`, \`pendingId\`)\
- [ ] The `onDelete: (todo: Todo) => void` prop on `TodoList` and `TodoItem`\
- [ ] `Todo` type in `fe/src/types/todo.ts`
- [ ] `DELETE /api/todos/{id}` contract inherited from `plan-1/PLAN.MD`

## REPOSITORY CONTEXT
- Vite + React 19 + Tailwind v4 in `fe/src/`
- No test runner in `fe/src/package.json`
- `plan-1/PLAN.MD` is not modified

## REQUIRED CHANGES
1. `fe/src/components/ConfirmDialog.tsx` - new file, exports the named `ConfirmDialog` component with props `title`, `message`, `confirmLabel`, `cancelLabel`, `isPending`, `onConfirm`, `onCancel`.
2. `fe/src/App.tsx` - modified. Adds `todoPendingDelete: Todo | null` state, passes `onDelete={setTodoPendingDelete}`, renders `ConfirmDialog` only when `todoPendingDelete` is non-null, and passes `isPending={pendingId === todoPendingDelete?.id}`, `onCancel={() => setTodoPendingDelete(null)}`, and an `onConfirm` that calls `remove(todoPendingDelete).finally(() => setTodoPendingDelete(null))`.

### Files Not Changed
- `fe/src/components/TodoList.tsx`
- `fe/src/components/TodoItem.tsx`
- `fe/src/hooks/useTodos.ts`
- `fe/src/api/todos.ts`
- `fe/src/types/todo.ts`

## COMPONENT / CLIENT CONTRACT
First a markdown table with columns `Prop | Type | Meaning` and one row per prop:
| title | string | dialog heading |
| message | string | body text |
| confirmLabel | string | confirm button text |
| cancelLabel | string | cancel button text |
| isPending | boolean | disables both buttons and blocks cancel paths |
| onConfirm | () => void | runs the delete |
| onCancel | () => void | closes without deleting |

Then a short bullet list of the interaction rules:
- Overlay is `fixed inset-0 z-50`
- Clicking the overlay calls `onCancel` unless `isPending`;
- The panel calls `event.stopPropagation()` so inner clicks do not cancel;
- A `window` `keydown` listener calls `onCancel` on `Escape` unless `isPending` and is removed in the effect cleanup;
- The cancel button is focused on mount through a ref;
- Both buttons are disabled while `isPending`;
- The component never calls `fetch` or the API client.

Then a bullet list of the copy used in `App.tsx`:
- Title: Delete this todo?
- Message: "<title>" will be permanently deleted. This cannot be undone.
- Confirm label: Delete
- Cancel label: Cancel

## ACCESSIBILITY
- `role="dialog"`
- `aria-modal="true"`
- `aria-labelledby="confirm-dialog-title"`
- `aria-describedby="confirm-dialog-message"`
- The cancel button is focused on mount.

No focus trap, no focus restore to the delete button after closing, no body scroll lock, no Enter-to-confirm shortcut, static element IDs so only one dialog may be open at a time.

### Acceptance Criteria\n- [ ] Clicking the row delete button opens the dialog and deletes nothing.
- [ ] `Cancel` closes it and the todo remains.
- [ ] `Escape` closes it and the todo remains.
- [ ] A backdrop click closes it and the todo remains.
- [ ] `Delete` issues one `DELETE /api/todos/{id}` and the row disappears.
- [ ] The row is still gone after a page refresh.
- [ ] Both buttons are disabled while the request is in flight.
- [ ] The dialog closes after the request settles even when it fails, and the failure shows in the existing error banner.
- [ ] Add, toggle, loading, empty, and error states still work.
- [ ] `cd fe && npm run build` succeeds with a clean `tsc -b`.

### Verification
- Commands: `cd fe && npm run build` then `cd fe && npm run dev`.
- Manual steps: open the dialog from a row; cancel with the button, with `Escape`, and with a backdrop click; confirm the delete and watch the row disappear; refresh the page and confirm it stayed deleted.

### Boundaries
- Frontend scope only;
- No component library and no focus-trap dependency;
- No new API fields or endpoints.

FINALLY, run `cd fe && npm run build` and report the real output, including whether `tsc -b` was clean.

#### Output:
```
build
    tsc -b
    ✓ [PASS] Success: 0, Warnings: 0, Errors: 0
```

1. `ls -l plan-2/fe`
2. Report the exact file name and size, and confirm you wrote nothing outside `plan-2/fe/PLAN.MD`.