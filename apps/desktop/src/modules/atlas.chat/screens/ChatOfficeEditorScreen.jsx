import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { OfficeDocumentEditor } from '@atlas/ui';
import { atlas } from '../../../lib/atlas';
import { useAuth } from '../../../auth/AuthProvider';

// Full-screen WOPI editor for a chat attachment. Twin of atlas.files'
// OfficeEditorScreen, but mints its session through the chat endpoint
// (POST /chat/attachments/:id/office/session) and returns to the chat.
export default function ChatOfficeEditorScreen() {
  const { session } = useAuth();
  const authToken = useRef(session?.access_token);
  const downloadName = useRef('documento');
  useEffect(() => { authToken.current = session?.access_token; }, [session?.access_token]);
  const { pathname, state } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const attId = pathname.match(/\/chat\/attachment\/([^/]+)\/edit\/?$/)?.[1] ?? '';
  const createSession = useCallback(async (id, mode) => {
    const { data } = await atlas.chat.createAttachmentOfficeSession(id, mode, authToken.current);
    downloadName.current = data.fileName ?? 'documento';
    return data;
  }, []);
  const saved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['chat-attachment-url', attId] });
  }, [queryClient, attId]);
  const close = useCallback(() => {
    saved();
    const returnTo = state?.officeReturnTo;
    navigate(
      typeof returnTo === 'string' && returnTo.startsWith('/app/') && !returnTo.endsWith('/edit')
        ? returnTo
        : '/app/m/atlas.chat',
    );
  }, [navigate, saved, state]);
  return (
    <div className="fixed inset-0 z-50 h-[100dvh] w-full pb-[env(safe-area-inset-bottom)]">
      <OfficeDocumentEditor
        key={`${attId}:${session?.user?.id}`}
        fileId={attId}
        createSession={createSession}
        onClose={close}
        onSaved={saved}
      />
    </div>
  );
}
