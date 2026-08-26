// apps/desktop/src/modules/atlas.chat/components/ChannelMembersTab.jsx
import { useState } from "react";
import {
  Button, EmptyState, Skeleton, ConfirmDialog,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@atlas/ui";
import { Users, MoreVertical, UserMinus, ShieldCheck, UserPlus } from "lucide-react";
import { useChatConversationDetail } from "../hooks/useChatConversationDetail";
import { useChannelRoles, useAssignMemberRole } from "../hooks/useChannelRoles";
import { useRemoveMember } from "../hooks/useCreateConversation";
import { roleHasPermission, findOwnMember, CHAT_PERMISSIONS } from "../lib/chatPermissions";
import { AddChannelMembersDialog } from "./AddChannelMembersDialog";

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

function MemberRow({ member, ownMember, canManageMembers, canManageRoles, assignableRoles, onRemove, onAssignRole }) {
  const isSelf = member.userId === ownMember?.userId;
  const outranksTarget = member.rolePosition < (ownMember?.rolePosition ?? -1);
  const canRemoveThis = isSelf || (canManageMembers && outranksTarget);
  const canAssignToThis = canManageRoles && !isSelf && outranksTarget && assignableRoles.length > 0;
  const showMenu = canRemoveThis || canAssignToThis;

  return (
    <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[hsl(var(--muted))]">
      <div className="h-8 w-8 rounded-full flex items-center justify-center font-semibold text-xs shrink-0"
           style={{ backgroundColor: "var(--brand-primary)", color: "var(--brand-primary-foreground)" }}>
        {member.displayName?.[0]?.toUpperCase() ?? "?"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium truncate">{member.displayName}</p>
          <RoleBadge name={member.roleName} color={member.roleColor} />
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{member.email}</p>
      </div>
      {showMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0">
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canAssignToThis && assignableRoles.map((role) => (
              <DropdownMenuItem key={role.id} onSelect={() => onAssignRole(member.userId, role.id)}>
                <ShieldCheck className="h-3.5 w-3.5 mr-2" />
                Asignar rol: {role.name}
              </DropdownMenuItem>
            ))}
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

export function ChannelMembersTab({ conversationId, currentUserId }) {
  const { data: convData, isLoading } = useChatConversationDetail(conversationId);
  const { data: rolesData } = useChannelRoles(conversationId);
  const { mutateAsync: removeMember } = useRemoveMember(conversationId);
  const { mutateAsync: assignRole } = useAssignMemberRole(conversationId);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [showAddMembers, setShowAddMembers] = useState(false);

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
          if (confirmTarget) await removeMember(confirmTarget.userId);
          setConfirmTarget(null);
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
