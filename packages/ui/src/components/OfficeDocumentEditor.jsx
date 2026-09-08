import { useCallback, useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { PageHeader } from './PageHeader.jsx';
import { Button } from './Button.jsx';
import { Badge } from './Badge.jsx';
import { ErrorState } from './ErrorState.jsx';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { officeErrorMessage, parseOfficeMessage } from './office-message.js';

export function OfficeDocumentEditor({ fileId, mode = 'auto', createSession, onClose, onDownload, onSaved }) {
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const [closing, setClosing] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [dirty, setDirty] = useState(false);
  const frame = useRef(null);
  const loadingTimeout = useRef(null);
  const form = useRef(null);
  const closeRequested = useRef(false);
  const frameName = `office-${useId().replaceAll(':', '')}`;
  const post = useCallback((MessageId, Values = {}) => {
    if (session) frame.current?.contentWindow?.postMessage(JSON.stringify({ MessageId, SendTime: Date.now(), Values }), session.editorOrigin);
  }, [session]);

  const receive = useEffectEvent(event => {
    const data = parseOfficeMessage(event, frame.current?.contentWindow, session.editorOrigin);
    if (!data) return;
    if (data.MessageId === 'App_LoadingStatus') {
      post('Host_PostmessageReady');
      if (data.Values?.Status === 'Document_Loaded') { clearTimeout(loadingTimeout.current); setReady(true); setError(''); }
    }
    if (data.MessageId === 'Doc_ModifiedStatus') setDirty(Boolean(data.Values?.Modified));
    if (data.MessageId === 'Action_Save_Resp') {
      if (data.Values?.success === true) {
        setDirty(false);
        onSaved?.();
        if (closeRequested.current) onClose?.();
      } else setError('No se confirmó el guardado. Mantén el documento abierto y reintenta desde el editor.');
      closeRequested.current = false;
      setClosing(false);
    }
    if (data.MessageId === 'UI_Close') setConfirmLeave(true);
    if (data.MessageId === 'App_Error') setError('El editor informó un error. Revisa el documento y la conexión antes de cerrar.');
  });

  useEffect(() => {
    let cancelled = false;
    createSession(fileId, mode).then(data => { if (!cancelled) setSession(data); })
      .catch(err => { if (!cancelled) setError(officeErrorMessage(err)); });
    return () => { cancelled = true; };
  }, [createSession, fileId, mode, retry]);

  useEffect(() => {
    if (!session) return undefined;
    // WOPI requires a POST. Tokens remain in memory and never in an iframe URL.
    form.current?.submit();
    const expires = setTimeout(() => setError('La sesión expiró. Conserva el editor abierto si necesitas recuperar cambios; vuelve a abrir después de guardarlos.'), Math.max(0, session.expiresAt - Date.now()));
    loadingTimeout.current = setTimeout(() => setError(current => current || 'El editor tarda en responder. Revisa la conexión, el proxy y el servicio Office.'), 45000);
    const listener = event => receive(event);
    window.addEventListener('message', listener);
    return () => { clearTimeout(expires); clearTimeout(loadingTimeout.current); window.removeEventListener('message', listener); };
  }, [session]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    if (!closing) return undefined;
    const timeout = setTimeout(() => {
      closeRequested.current = false;
      setClosing(false);
      setError('No se confirmó el guardado a tiempo. Reintenta o descarga una copia desde el editor antes de salir.');
    }, 15000);
    return () => clearTimeout(timeout);
  }, [closing]);

  function close() {
    if (session?.mode !== 'edit' || !ready) { if (dirty) setConfirmLeave(true); else onClose?.(); return; }
    closeRequested.current = true;
    setClosing(true);
    post('Action_Save', { DontTerminateEdit: false, DontSaveIfUnmodified: false, Notify: true });
  }
  function restart() { setError(''); setSession(null); setReady(false); setRetry(value => value + 1); }

  return (
    <section className="flex h-full min-h-0 w-full flex-col bg-[hsl(var(--background))]" aria-label="Editor de documentos">
      <PageHeader compact title={session?.fileName ?? 'Documento Office'} className="px-3 pt-2 pb-2" actions={
        <><Badge variant="secondary">{session?.mode === 'edit' ? 'Edición' : 'Lectura'}</Badge>
          {onDownload && <Button variant="ghost" size="icon" aria-label="Descargar archivo" onClick={onDownload}><Download className="h-4 w-4" /></Button>}
          <Button variant="outline" size="sm" onClick={close} disabled={closing}><ArrowLeft className="h-4 w-4" />{closing ? 'Guardando…' : 'Volver'}</Button></>
      } />
      {error && (session ? <div role="alert" className="flex flex-wrap items-center gap-2 border-b p-3 text-sm"><span className="flex-1">{error}</span><Button variant="outline" size="sm" onClick={() => setConfirmLeave(true)}>Salir del editor</Button></div> : <ErrorState title="Office no disponible" description={error} onRetry={restart} />)}
      {!ready && !error && <div role="status" className="flex items-center gap-2 p-3 text-sm"><Loader2 className="h-4 w-4 animate-spin" />{session ? 'Cargando documento…' : 'Preparando editor…'}</div>}
      {session && <>
        <form ref={form} action={session.editorUrl} method="post" target={frameName} hidden>
          <input type="hidden" name="access_token" value={session.accessToken} readOnly />
          <input type="hidden" name="access_token_ttl" value={session.expiresAt} readOnly />
        </form>
        <iframe ref={frame} name={frameName} title={`Office: ${session.fileName}`} className="min-h-0 w-full flex-1 border-0" allow="clipboard-read; clipboard-write; fullscreen" referrerPolicy="no-referrer" onLoad={() => post('Host_PostmessageReady')} />
      </>}
      <ConfirmDialog open={confirmLeave} onOpenChange={setConfirmLeave} title="Salir del editor" description="Comprueba que los cambios estén guardados. Si el guardado falló, descarga una copia desde el editor antes de salir." confirmLabel="Salir" onConfirm={onClose} />
    </section>
  );
}
