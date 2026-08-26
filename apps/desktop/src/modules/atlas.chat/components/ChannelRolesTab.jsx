import { useState } from "react";
import { Button, EmptyState, Skeleton, ConfirmDialog, Badge } from "@atlas/ui";
import { ShieldCheck, Plus, Pencil, Trash2 } from "lucide-react";
import { useChannelRoles, useCreateChannelRole, useUpdateChannelRole, useDeleteChannelRole } from "../hooks/useChannelRoles";
import { RoleEditorDialog } from "./RoleEditorDialog";
import { findOwnMember, roleHasPermission, CHAT_PERMISSIONS } from "../lib/chatPermissions";
import { useChatConversationDetail } from "../hooks/useChatConversationDetail";

export function ChannelRolesTab({ conversationId, currentUserId }) {
  const { data: rolesData, isLoading } = useChannelRoles(conversationId);
  const { data: convData } = useChatConversationDetail(conversationId);
  const { mutateAsync: createRole, isPending: isCreating } = useCreateChannelRole(conversationId);
  const { mutateAsync: updateRole, isPending: isUpdating } = useUpdateChannelRole(conversationId);
  const { mutateAsync: deleteRole } = useDeleteChannelRole(conversationId);

  const [editorState, setEditorState] = useState({ open: false, role: null });
  const [confirmDelete, setConfirmDelete] = useState(null);

  const roles = rolesData?.data ?? [];
  const ownMember = findOwnMember(convData?.data?.members ?? [], currentUserId);
  const ownPosition = ownMember?.rolePosition ?? -1;
  const maxPosition = Math.max(0, ownPosition - 1);
  // The backend (chat-permissions-service.js createRole/updateRole/deleteRole)
  // requires roles.manage regardless of rank — a role's permissions are set
  // independently of its position, so a high-position role without
  // roles.manage would still get a 403 from the API. Gate on the actual
  // permission, not just position, to avoid showing controls the backend
  // will reject (same class of bug fixed in ChannelMembersTab, commit 64c0231).
  const canManageRoles = roleHasPermission(ownMember, CHAT_PERMISSIONS.ROLES_MANAGE);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
      </div>
    );
  }

  if (!roles.length) {
    return <EmptyState icon={ShieldCheck} title="Sin roles" description="Este canal aun no tiene roles configurados." />;
  }

  return (
    <div className="space-y-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => setEditorState({ open: true, role: null })}
        disabled={!canManageRoles || ownPosition <= 0}
      >
        <Plus className="h-3.5 w-3.5 mr-1.5" />
        Crear rol
      </Button>

      <div className="space-y-1">
        {roles.map((role) => (
          <div key={role.id} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-[hsl(var(--muted))]">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: role.color || "hsl(var(--muted-foreground))" }}
            />
            <span className="text-sm font-medium flex-1 truncate">{role.name}</span>
            {role.isSystem && <Badge variant="secondary">Sistema</Badge>}
            {canManageRoles && !role.isSystem && role.position < ownPosition && (
              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditorState({ open: true, role })}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-500" onClick={() => setConfirmDelete(role)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <RoleEditorDialog
        open={editorState.open}
        role={editorState.role}
        maxPosition={maxPosition}
        isSaving={isCreating || isUpdating}
        onClose={() => setEditorState({ open: false, role: null })}
        onSave={(data) =>
          editorState.role
            ? updateRole({ roleId: editorState.role.id, data })
            : createRole(data)
        }
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
        title="Eliminar rol"
        description={`Los miembros con el rol "${confirmDelete?.name}" pasaran al rol Member.`}
        confirmLabel="Eliminar"
        onConfirm={async () => {
          if (confirmDelete) await deleteRole(confirmDelete.id);
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}
