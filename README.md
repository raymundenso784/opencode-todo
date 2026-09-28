# Local LLM Workflow — Todo App

A small CRUD todo app built with an OpenCode agent pipeline: **Build (Big Pickle)** plans and coordinates, then local Ollama agents write the plan package and implement each layer.

```text
Build (OpenCode Zen · Big Pickle)
  -> tech-lead          writes plan-N/
       -> fullstack-dev reads plan-N/ and delegates
            -> database   schema / seed
            -> be         FastAPI API
            -> fe         React UI
```

## Tech stack

| Layer | Stack |
|---|---|
| Backend | FastAPI, SQLAlchemy, Alembic, Pydantic, Uvicorn |
| Database | SQLite (`be/todos.db`) |
| Frontend | Vite, React 19, TypeScript, Tailwind CSS v4 |
| Agents | OpenCode + Ollama (local) for planning/implementation specialists |

The app supports create, toggle complete/incomplete, edit title, and delete. Plans that drove the build live under `plan-1/`, `plan-2/`, and so on.

## How the app was created

1. OpenCode starts on the built-in **Build** agent, running **Big Pickle** from OpenCode Zen.
2. Build calls **`tech-lead`**, which inspects the repo and writes a numbered plan folder (`plan-N/PLAN.MD` plus layer plans for database, be, and fe).
3. Build then calls **`fullstack-dev`**, which reads that plan and runs specialists in order.
4. **`database`**, **`be`**, and **`fe`** implement only their layer, verify files on disk, and return status.
5. `fullstack-dev` checks the result against the plan before reporting `DONE`, `PARTIAL`, or `BLOCKED`.

Agent definitions live in [`.opencode/agents/`](.opencode/agents/). Config is in [`opencode.json`](opencode.json).

## Agents

| Agent | Role | Model |
|---|---|---|
| **Build** | Primary session agent. Coordinates the run; launches specialists via Task. | **Big Pickle** (OpenCode Zen) |
| `tech-lead` | Analyzer and plan author. Writes `plan-N/`; does not implement app code. | `ollama/qwen3.5:4b` |
| `fullstack-dev` | Plan executor. Delegates database → be → fe; does not edit app files itself. | `ollama/qwen3.5:4b` |
| `database` | Schema, migrations, seed / data docs under `be/database/`. | `ollama/qwen2.5:3b` |
| `be` | FastAPI routes, services, models, Alembic migrations. | `ollama/qwen2.5:3b` |
| `fe` | Vite + React UI, API client, hooks, components. | `ollama/qwen2.5:3b` |

Also available in config (not on the main Build path):

| Agent | Role |
|---|---|
| `quick-fix` | Small frontend/backend fixes via `fe` / `be` only |
| `ask` | Read-only Q&A about the codebase |

## Run the workflow

1. Give Ollama enough context (32K recommended so tool schemas are not truncated):

   ```bash
   launchctl setenv OLLAMA_CONTEXT_LENGTH 32768
   # restart the Ollama app / service, or:
   ollama serve
   ```

2. Pull the local models used by specialists:

   ```bash
   ollama pull qwen3.5:4b
   ollama pull qwen2.5:3b
   ```

3. Start OpenCode from this repo. New sessions default to **Build**.
4. Ask Build for a feature. It should Task `tech-lead` (plan), then `fullstack-dev` (implement). You can also `@tech-lead` or `@fullstack-dev` directly.
5. Restart OpenCode after changing agent markdown so prompts reload.

`subagent_depth` is `2` so Build → `fullstack-dev` → specialists is allowed. Build may Task only `tech-lead` and `fullstack-dev`.

## Run the app

**Backend** (from the project root):

```bash
python3 -m venv .venv
.venv/bin/pip install -r be/requirements.txt
.venv/bin/alembic -c be/alembic.ini upgrade head
.venv/bin/uvicorn be.app.main:app --reload
```

API: http://127.0.0.1:8000 · SQLite file: `be/todos.db`

**Frontend:**

```bash
cd fe && npm install && npm run dev
```

UI: http://localhost:5173 · CORS allows that origin; override with `CORS_ORIGINS` or `VITE_API_URL`.

Feature docs that trace create / update / delete across both sides: [`docs/`](docs/README.md).

## Delivery status

| Status | Meaning |
|---|---|
| `DONE` | Acceptance criteria verified on disk; checks actually run |
| `PARTIAL` | Some verified work; gaps listed |
| `BLOCKED` | Could not proceed; blocker listed |

Delegation alone is never `DONE`. Orchestrators verify after specialists return.
