// apps/desktop/src/modules/atlas.chat/components/ChannelMembersTab.jsx
import { useState } from "react";
import {
  Button, EmptyState, Skeleton, ConfirmDialog,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@atlas/ui";
import { Users, MoreVertical, UserMinus, ShieldCheck, UserPlus, Check } from "lucide-react";
import { toast } from "sonner";
import { useChatConversationDetail } from "../hooks/useChatConversationDetail";
import { useChannelRoles, useAssignMemberRole } from "../hooks/useChannelRoles";
import { useRemoveMember, useCreateConversation } from "../hooks/useCreateConversation";
import { roleHasPermission, findOwnMember, CHAT_PERMISSIONS } from "../lib/chatPermissions";
import { AddChannelMembersDialog } from "./AddChannelMembersDialog";
import { AvatarCircle } from "./AvatarCircle";

function RoleBadge({ name, color }) {
  if (!name) return null;
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium shrink-0"
      style={{
        backgroundColor: color ? `${color}22` : "hsl(var(--muted))",
        color: color ?? "hsl(var(--muted-foreground))",
      }}
    >
      {name}
    </span>
  );
}

function MemberRow({ member, ownMember, canManageMembers, canManageRoles, assignableRoles, onRemove, onAssignRole, onOpenChat }) {
  const isSelf = member.userId === ownMember?.userId;
  const outranksTarget = member.rolePosition < (ownMember?.rolePosition ?? -1);
  const canRemoveThis = isSelf || (canManageMembers && outranksTarget);
  // At least one role actually assignable (i.e. not the one this member already has) —
  // otherwise the menu would offer nothing but a single disabled "current role" row.
  const hasAssignableChange = assignableRoles.some((r) => r.id !== member.roleId);
  const canAssignToThis = canManageRoles && !isSelf && outranksTarget && hasAssignableChange;
  const showMenu = canRemoveThis || canAssignToThis;

  return (
    <div className="flex items-center gap-1 rounded-lg hover:bg-[hsl(var(--muted))]">
      {/* Own button (not nested inside the overflow menu's button) so opening a DM
          and opening the menu are two independent, non-overlapping click targets. */}
      <button
        type="button"
        onClick={() => onOpenChat(member)}
        disabled={isSelf}
        title={isSelf ? undefined : `Enviar mensaje a ${member.displayName}`}
        className="flex items-center gap-3 flex-1 min-w-0 px-2 py-2 text-left rounded-lg disabled:cursor-default touch-manipulation"
      >
        <AvatarCircle avatarUrl={member.avatarUrl} name={member.displayName} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium truncate">{member.displayName}</p>
            <RoleBadge name={member.roleName} color={member.roleColor} />
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{member.email}</p>
        </div>
      </button>
      {showMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0">
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canAssignToThis && assignableRoles.map((role) => {
              const isCurrentRole = role.id === member.roleId;
              return (
                <DropdownMenuItem
                  key={role.id}
                  disabled={isCurrentRole}
                  onSelect={() => onAssignRole(member.userId, role.id)}
                  className={isCurrentRole ? "text-[hsl(var(--muted-foreground))]" : undefined}
                >
                  {isCurrentRole ? <Check className="h-3.5 w-3.5 mr-2" /> : <ShieldCheck className="h-3.5 w-3.5 mr-2" />}
                  {isCurrentRole ? `${role.name} (rol actual)` : `Asignar rol: ${role.name}`}
                </DropdownMenuItem>
              );
            })}
            {canAssignToThis && <DropdownMenuSeparator />}
            {canRemoveThis && (
              <DropdownMenuItem onSelect={() => onRemove(member)} className="text-red-500 focus:text-red-500">
                <UserMinus className="h-3.5 w-3.5 mr-2" />
                {isSelf ? "Salir del canal" : "Eliminar miembro"}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export function ChannelMembersTab({ conversationId, currentUserId, onOpenConversation }) {
  const { data: convData, isLoading } = useChatConversationDetail(conversationId);
  const { data: rolesData } = useChannelRoles(conversationId);
  const { mutateAsync: removeMember } = useRemoveMember(conversationId);
  const { mutateAsync: assignRole } = useAssignMemberRole(conversationId);
  const { mutateAsync: createConversation } = useCreateConversation();
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [showAddMembers, setShowAddMembers] = useState(false);

  // createConversation({ type: "direct" }) is idempotent server-side (see
  // chat-service.js's createConversation: it looks up an existing direct
  // conversation with this pair before inserting) — no need to search the
  // caller's own conversation list first, unlike FloatingChatHub's
  // OnlineUserPill which already has that list in memory for a different reason.
  // MemberRow's button is `disabled` for the current user's own row, so this
  // never fires for currentUserId.
  async function handleOpenChat(member) {
    try {
      const result = await createConversation({ type: "direct", memberUserIds: [member.userId] });
      if (result?.data) onOpenConversation?.(result.data);
    } catch {
      toast.error("No se pudo abrir la conversacion.");
    }
  }

  const members = convData?.data?.members ?? [];
  const roles = rolesData?.data ?? [];
  const ownMember = findOwnMember(members, currentUserId);
  const canManageMembers = roleHasPermission(ownMember, CHAT_PERMISSIONS.MEMBERS_MANAGE);
  const canManageRoles = roleHasPermission(ownMember, CHAT_PERMISSIONS.ROLES_MANAGE);
  const assignableRoles = roles.filter((r) => r.position < (ownMember?.rolePosition ?? -1) || (r.isSystem && ownMember?.roleIsSystem));

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {canManageMembers && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowAddMembers(true)}>
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            Anadir miembros
          </Button>
        </div>
      )}

      {!members.length ? (
        <EmptyState icon={Users} title="Sin miembros" description="Este canal no tiene miembros activos." />
      ) : (
        <div className="space-y-0.5">
          {members.map((member) => (
            <MemberRow
              key={member.userId}
              member={member}
              ownMember={ownMember}
              canManageMembers={canManageMembers}
              canManageRoles={canManageRoles}
              assignableRoles={assignableRoles}
              onRemove={(m) => setConfirmTarget(m)}
              onAssignRole={(memberId, roleId) => assignRole({ memberId, roleId })}
              onOpenChat={handleOpenChat}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        onOpenChange={(v) => !v && setConfirmTarget(null)}
        title={confirmTarget?.userId === currentUserId ? "Salir del canal" : "Eliminar miembro"}
        description={
          confirmTarget?.userId === currentUserId
            ? "Dejaras de tener acceso a este canal."
            : `${confirmTarget?.displayName ?? "Este miembro"} sera eliminado del canal.`
        }
        confirmLabel={confirmTarget?.userId === currentUserId ? "Salir" : "Eliminar"}
        onConfirm={async () => {
          // useRemoveMember's own onError already toasts a failure (e.g. "you're
          // the sole Owner, assign another first") — this dialog should still
          // close either way so the toast isn't left sitting behind a stale open modal.
          try {
            if (confirmTarget) await removeMember(confirmTarget.userId);
          } catch {
            // already toasted by useRemoveMember's onError
          } finally {
            setConfirmTarget(null);
          }
        }}
      />

      {canManageMembers && (
        <AddChannelMembersDialog
          open={showAddMembers}
          onClose={() => setShowAddMembers(false)}
          conversationId={conversationId}
          existingMemberIds={members.map((m) => m.userId)}
        />
      )}
    </div>
  );
}
