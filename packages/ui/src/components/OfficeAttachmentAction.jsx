import { FilePenLine } from 'lucide-react';
import { getOfficeFormat } from '@atlas/core';
import { Button } from './Button.jsx';
import { useOfficeActions } from './office-actions-context.js';

export function OfficeAttachmentAction({ file }) {
  const office = useOfficeActions();
  const id = file?.fileAssetId ?? file?.id;
  if (!office?.enabled || !id || !getOfficeFormat(file)) return null;
  return <Button variant="ghost" size="sm" aria-label={`${office.canEdit ? 'Editar' : 'Abrir'} ${file.fileName ?? 'documento'} en Office`} onClick={() => office.open(id)}><FilePenLine className="h-4 w-4" /><span>{office.canEdit ? 'Editar' : 'Abrir'}</span></Button>;
}
