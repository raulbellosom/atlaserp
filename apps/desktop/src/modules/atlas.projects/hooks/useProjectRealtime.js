import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRealtimeContext } from "../../../providers/RealtimeProvider";

/**
 * Subscribe to broadcast task events for a project.
 * Invalidates task queries whenever a team member creates, updates, deletes,
 * or moves a task in the same project. Mount once per project board/list.
 */
export function useProjectRealtime(projectId) {
  const queryClient = useQueryClient();
  const { on } = useRealtimeContext();

  useEffect(() => {
    if (!projectId) return;
    return on("projects.task.updated", ({ projectId: pid }) => {
      if (pid !== projectId) return;
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
    });
  }, [projectId, on, queryClient]);
}
