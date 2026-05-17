import { AttachmentsPanel } from "./AttachmentsPanel.jsx";

export function DocumentsPanel(props) {
  const config = props?.config ?? {};
  return (
    <AttachmentsPanel
      {...props}
      context={props?.context ?? "detail"}
      config={{
        ...config,
        label: config?.label ?? "Documentos",
        placement: config?.placement ?? "embedded",
      }}
    />
  );
}

