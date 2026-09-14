import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { OfficeActionsContext } from '@runly/ui';
import { useAuth } from '../auth/AuthProvider';
import { runly } from '../lib/runly';

export function OfficeProvider({ children }) {
  const { session, userProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const canRead = userProfile?.isAdmin || userProfile?.permissions?.includes('files.assets.read');
  const canEdit = Boolean(userProfile?.isAdmin || userProfile?.permissions?.includes('files.assets.update'));
  const status = useQuery({ queryKey: ['office-status', userProfile?.id], queryFn: () => runly.files.officeStatus(session.access_token), enabled: Boolean(session && canRead), staleTime: 60000, retry: false });
  const open = useCallback(id => navigate(`/app/m/runly.files/files/${encodeURIComponent(id)}/edit`, { state: { officeReturnTo: location.pathname } }), [navigate, location.pathname]);
  const openChatAttachment = useCallback(id => navigate(`/app/m/runly.chat/chat/attachment/${encodeURIComponent(id)}/edit`, { state: { officeReturnTo: location.pathname } }), [navigate, location.pathname]);
  const value = useMemo(() => ({ enabled: Boolean(canRead && status.data?.data?.enabled), available: Boolean(status.data?.data?.available), canEdit, open, openChatAttachment }), [canRead, canEdit, status.data, open, openChatAttachment]);
  return <OfficeActionsContext.Provider value={value}>{children}</OfficeActionsContext.Provider>;
}
