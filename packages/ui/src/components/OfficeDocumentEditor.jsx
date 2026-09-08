import { useCallback, useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { OfficeEditorHeader } from './OfficeEditorHeader.jsx';
import { OfficeEditorLoading } from './OfficeEditorLoading.jsx';
import { Button } from './Button.jsx';
import { ErrorState } from './ErrorState.jsx';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { officeErrorMessage, parseOfficeMessage } from './office-message.js';

export function OfficeDocumentEditor({ fileId, mode = 'auto', createSession, onClose, onDownload, onSaved }) {
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
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
    if (data.MessageId === 'Doc_ModifiedStatus') {
      setDirty(Boolean(data.Values?.Modified));
      if (data.Values?.Modified) setSaved(false);
    }
    if (data.MessageId === 'Action_Save_Resp') {
      if (data.Values?.success === true) {
        setDirty(false);
        setSaved(true);
        setSaveError('');
        onSaved?.();
        if (closeRequested.current) onClose?.();
      } else setSaveError('No se confirmó el guardado. Mantén el documento abierto y usa Archivo → Guardar en el editor, o vuelve a intentar regresar a Atlas ERP.');
      closeRequested.current = false;
      setSaving(false);
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
    if (!saving) return undefined;
    const timeout = setTimeout(() => {
      closeRequested.current = false;
      setSaving(false);
      setSaveError('No se confirmó el guardado a tiempo. Reintenta o descarga una copia desde el editor antes de salir.');
    }, 15000);
    return () => clearTimeout(timeout);
  }, [saving]);

  function save(exitAfterSave = false) {
    if (session?.mode !== 'edit' || !ready || saving) return;
    closeRequested.current = exitAfterSave;
    setSaveError('');
    setSaving(true);
    post('Action_Save', { DontTerminateEdit: false, DontSaveIfUnmodified: false, Notify: true });
  }

  function close() {
    if (session?.mode !== 'edit' || !ready) { if (dirty) setConfirmLeave(true); else onClose?.(); return; }
    save(true);
  }
  function restart() { setError(''); setSaveError(''); setSession(null); setReady(false); setSaved(false); setDirty(false); setRetry(value => value + 1); }
  const visibleError = error || saveError;
  const opening = !ready && !visibleError;

  return (
    <section className="flex h-full min-h-0 w-full flex-col bg-[hsl(var(--background))]" aria-label="Editor de documentos">
      <OfficeEditorHeader fileName={session?.fileName} mode={session?.mode} ready={ready} dirty={dirty} saving={saving} saved={saved} error={visibleError} onBack={close} onDownload={onDownload} />
      {visibleError && (session ? <div role="alert" className="flex flex-wrap items-center gap-2 border-b p-3 text-sm"><span className="flex-1">{visibleError}</span><Button variant="outline" size="sm" onClick={() => setConfirmLeave(true)}>Salir del editor</Button></div> : <ErrorState title="Office no disponible" description={visibleError} onRetry={restart} />)}
      <div className="relative min-h-0 w-full flex-1">
      {session && <>
        <form ref={form} action={session.editorUrl} method="post" target={frameName} hidden>
          <input type="hidden" name="access_token" value={session.accessToken} readOnly />
          <input type="hidden" name="access_token_ttl" value={session.expiresAt} readOnly />
        </form>
        <iframe ref={frame} name={frameName} title={`Office: ${session.fileName}`} className={`absolute inset-0 h-full w-full border-0 ${opening ? 'pointer-events-none opacity-0' : 'office-editor-frame-ready'}`} inert={opening} aria-hidden={opening} tabIndex={opening ? -1 : undefined} allow="clipboard-read; clipboard-write; fullscreen" referrerPolicy="no-referrer" onLoad={() => post('Host_PostmessageReady')} />
      </>}
      {opening && <OfficeEditorLoading fileName={session?.fileName} sessionReady={Boolean(session)} />}
      </div>
      <ConfirmDialog open={confirmLeave} onOpenChange={setConfirmLeave} title="Salir del editor" description="Comprueba que los cambios estén guardados. Si el guardado falló, descarga una copia desde el editor antes de salir." confirmLabel="Salir" onConfirm={onClose} />
    </section>
  );
}
