// apps/desktop/src/modules/atlas.chat/components/ChannelGeneralTab.jsx
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Popover, PopoverTrigger, PopoverContent, ImageViewer, ComboboxField, Label } from "@atlas/ui";
import { Image as ImageIcon, Smile, X } from "lucide-react";
import { toast } from "sonner";
import EmojiPicker from "emoji-picker-react";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";
import { useChatConversationDetail } from "../hooks/useChatConversationDetail";
import { roleHasPermission, findOwnMember, CHAT_PERMISSIONS } from "../lib/chatPermissions";

// "General" tab of ConversationProfilePanel — avatar-editing UI for a channel/group
// conversation. Mirrors MessageReactionPicker.jsx's Popover + emoji-picker-react
// pattern for the emoji button (but with a real PopoverTrigger, since the button
// itself is the trigger here, not opened externally) and CompanyBranding.jsx's
// uploadLogoMutation for the image button (FormData -> atlas.files.upload ->
// use the returned file id). `toast` comes from "sonner" directly, matching the
// convention used by every other toast-using screen in this app (@atlas/ui only
// exports the <Toaster/> container, not the `toast()` function itself).
export function ChannelGeneralTab({ conversationId, currentUserId }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [avatarViewerOpen, setAvatarViewerOpen] = useState(false);

  const { data: convData } = useChatConversationDetail(conversationId);
  const conversation = convData?.data;
  const ownMember = findOwnMember(conversation?.members ?? [], currentUserId);
  const canManage = roleHasPermission(ownMember, CHAT_PERMISSIONS.CHANNEL_MANAGE);

  const isChannel = conversation?.type === "channel";
  const projectsQuery = useQuery({
    queryKey: ["chat-channel-tab-projects", token],
    queryFn: async () => {
      // GET /projects returns a raw array, not { data: [...] } — see the
      // same note in CreateChannelModal.jsx's equivalent query.
      const res = await atlas.projects.listProjects(token);
      return (res?.data ?? res ?? []).map((p) => ({ label: p.name, value: p.id }));
    },
    enabled: Boolean(isChannel && token),
    staleTime: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: (updates) => atlas.chat.updateConversation(conversationId, updates, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversation", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
    onError: () => toast.error("No se pudo actualizar la imagen del canal."),
  });

  const linkMutation = useMutation({
    mutationFn: (linkedProjectId) => atlas.chat.updateConversation(conversationId, {
      linkedModule: linkedProjectId ? "atlas.projects" : null,
      linkedEntityId: linkedProjectId,
    }, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversation", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
    onError: (err) => toast.error(err?.status === 409 ? "Ese proyecto ya tiene un canal vinculado." : "No se pudo vincular el proyecto."),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("moduleKey", "atlas.chat");
      formData.append("entityType", "ChatConversation");
      const uploaded = await atlas.files.upload(formData, token);
      return uploaded?.data?.id ?? null;
    },
    onSuccess: (fileId) => {
      if (fileId) updateMutation.mutate({ avatarFileId: fileId });
    },
    onError: () => toast.error("No se pudo subir la imagen."),
  });

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    e.target.value = "";
  }

  const hasAvatar = Boolean(conversation?.avatarUrl || conversation?.avatar_emoji);

  const { data: fullAvatarUrl } = useQuery({
    queryKey: ["chat-avatar-full-url", conversation?.avatar_file_id],
    queryFn: async () => {
      const res = await atlas.files.getSignedUrl(conversation.avatar_file_id, token, { variant: "full" });
      return res?.data?.signedUrl ?? null;
    },
    enabled: Boolean(avatarViewerOpen && conversation?.avatar_file_id && token),
    staleTime: 50 * 60 * 1000,
  });

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-4">
        {conversation?.avatarUrl ? (
          <button
            type="button"
            onClick={() => setAvatarViewerOpen(true)}
            title="Ver imagen del canal"
            aria-label="Ver imagen del canal"
            className="h-16 w-16 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center overflow-hidden shrink-0 hover:opacity-90 transition-opacity"
          >
            <img src={conversation.avatarUrl} alt="" className="h-full w-full object-cover" />
          </button>
        ) : (
          <div className="h-16 w-16 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center overflow-hidden shrink-0">
            {conversation?.avatar_emoji ? (
              // snake_case is correct here, not a typo: getConversation/listConversations
              // rename avatar_file_id's resolved URL to camelCase avatarUrl, but pass
              // avatar_emoji straight through unaliased from `SELECT c.*` — the backend's
              // own response shape is genuinely inconsistent between these two fields.
              <span className="text-3xl">{conversation.avatar_emoji}</span>
            ) : (
              <span className="text-lg font-semibold text-[hsl(var(--muted-foreground))]">
                {(conversation?.title ?? "?")[0]?.toUpperCase()}
              </span>
            )}
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={!canManage}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!canManage || uploadMutation.isPending || updateMutation.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon className="h-3.5 w-3.5 mr-1.5" />
              Cambiar imagen
            </Button>
            <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" disabled={!canManage || uploadMutation.isPending || updateMutation.isPending}>
                  <Smile className="h-3.5 w-3.5 mr-1.5" />
                  Cambiar emoji
                </Button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start" className="w-auto p-0 overflow-hidden">
                <EmojiPicker
                  onEmojiClick={(emojiData) => {
                    updateMutation.mutate({ avatarEmoji: emojiData.emoji });
                    setEmojiOpen(false);
                  }}
                  theme="dark"
                  width={260}
                  height={320}
                  searchPlaceholder="Buscar emoji..."
                  lazyLoadEmojis
                  skinTonesDisabled
                  autoFocusSearch={false}
                />
              </PopoverContent>
            </Popover>
          </div>
          {hasAvatar && canManage && (
            <button
              type="button"
              onClick={() => updateMutation.mutate({ avatarFileId: null, avatarEmoji: null })}
              className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-red-500 transition-colors self-start"
            >
              <X className="h-3 w-3" />
              Quitar imagen o emoji
            </button>
          )}
        </div>
      </div>
      {!canManage && (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Solo un administrador del canal puede cambiar esta imagen.
        </p>
      )}
      {isChannel && (
        <div className="space-y-1.5">
          <Label>Proyecto vinculado</Label>
          <ComboboxField
            options={projectsQuery.data ?? []}
            value={conversation?.linked_module === "atlas.projects" ? conversation.linked_entity_id : null}
            onChange={(projectId) => linkMutation.mutate(projectId)}
            placeholder="Buscar proyecto..."
            emptyText={projectsQuery.isLoading ? "Cargando..." : "Sin resultados"}
            disabled={!canManage || linkMutation.isPending}
          />
          {conversation?.linked_module === "atlas.projects" && canManage && (
            <button
              type="button"
              onClick={() => linkMutation.mutate(null)}
              disabled={linkMutation.isPending}
              className="text-xs text-[hsl(var(--muted-foreground))] hover:text-red-500 transition-colors"
            >
              Quitar vinculo
            </button>
          )}
        </div>
      )}
      <ImageViewer
        src={fullAvatarUrl ?? conversation?.avatarUrl}
        alt={conversation?.title ?? "Canal"}
        open={avatarViewerOpen}
        onClose={() => setAvatarViewerOpen(false)}
      />
    </div>
  );
}
