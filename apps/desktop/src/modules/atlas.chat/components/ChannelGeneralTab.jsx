// apps/desktop/src/modules/atlas.chat/components/ChannelGeneralTab.jsx
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Popover, PopoverTrigger, PopoverContent } from "@atlas/ui";
import { Image as ImageIcon, Smile, X } from "lucide-react";
import { toast } from "sonner";
import EmojiPicker from "emoji-picker-react";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";
import { useChatConversationDetail } from "../hooks/useChatConversationDetail";
import { roleHasPermission, findOwnMember, CHAT_PERMISSIONS } from "../lib/chatPermissions";

// "General" tab of ChannelDetailsSheet — avatar-editing UI for a channel/group
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

  const { data: convData } = useChatConversationDetail(conversationId);
  const conversation = convData?.data;
  const ownMember = findOwnMember(conversation?.members ?? [], currentUserId);
  const canManage = roleHasPermission(ownMember, CHAT_PERMISSIONS.CHANNEL_MANAGE);

  const updateMutation = useMutation({
    mutationFn: (updates) => atlas.chat.updateConversation(conversationId, updates, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversation", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
    onError: () => toast.error("No se pudo actualizar la imagen del canal."),
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

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center overflow-hidden shrink-0">
          {conversation?.avatarUrl ? (
            <img src={conversation.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : conversation?.avatar_emoji ? (
            <span className="text-3xl">{conversation.avatar_emoji}</span>
          ) : (
            <span className="text-lg font-semibold text-[hsl(var(--muted-foreground))]">
              {(conversation?.title ?? "?")[0]?.toUpperCase()}
            </span>
          )}
        </div>
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
              disabled={!canManage || uploadMutation.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon className="h-3.5 w-3.5 mr-1.5" />
              Cambiar imagen
            </Button>
            <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" disabled={!canManage}>
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
    </div>
  );
}
