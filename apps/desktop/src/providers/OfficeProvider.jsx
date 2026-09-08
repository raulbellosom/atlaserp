import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { OfficeActionsContext } from '@atlas/ui';
import { useAuth } from '../auth/AuthProvider';
import { atlas } from '../lib/atlas';

export function OfficeProvider({ children }) {
  const { session, userProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const canRead = userProfile?.isAdmin || userProfile?.permissions?.includes('files.assets.read');
  const canEdit = Boolean(userProfile?.isAdmin || userProfile?.permissions?.includes('files.assets.update'));
  const status = useQuery({ queryKey: ['office-status', userProfile?.id], queryFn: () => atlas.files.officeStatus(session.access_token), enabled: Boolean(session && canRead), staleTime: 60000, retry: false });
  const open = useCallback(id => navigate(`/app/m/atlas.files/files/${encodeURIComponent(id)}/edit`, { state: { officeReturnTo: location.pathname } }), [navigate, location.pathname]);
  const value = useMemo(() => ({ enabled: Boolean(canRead && status.data?.data?.enabled), canEdit, open }), [canRead, canEdit, status.data, open]);
  return <OfficeActionsContext.Provider value={value}>{children}</OfficeActionsContext.Provider>;
}
