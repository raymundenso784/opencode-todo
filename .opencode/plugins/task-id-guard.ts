import type { Plugin } from "@opencode-ai/plugin"

export const TaskIdGuard: Plugin = async () => {
  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool !== "task") return
      const taskId = output.args?.task_id
      if (taskId === undefined) return
      if (typeof taskId !== "string" || !taskId.startsWith("ses_")) {
        delete output.args.task_id
      }
    },
  }
}
