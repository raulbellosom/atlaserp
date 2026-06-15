import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
} from "@atlas/ui";
import { ArrowLeft, Eye, FilePlus2, Save, Send } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { useAuth } from "../../../auth/AuthProvider.jsx";
import { atlas } from "../../../lib/atlas.js";
import { DocumentBlockEditor } from "../components/DocumentBlockEditor.jsx";
import { DocumentPreviewDialog } from "../components/DocumentPreviewDialog.jsx";

const STARTER_BLOCKS = [
  {
    id: "title",
    type: "heading",
    text: "Resumen de {{lead.name}}",
    level: 1,
    align: "left",
  },
  {
    id: "contact",
    type: "fields",
    columns: 2,
    fields: [
      { label: "Correo", value: "{{lead.email}}" },
      { label: "Telefono", value: "{{lead.phone}}" },
    ],
  },
  {
    id: "message",
    type: "paragraph",
    text: "{{lead.message}}",
    align: "left",
  },
];

function EditorWorkspace({ template, version, variables, token, canPublish }) {
  const queryClient = useQueryClient();
  const [blocks, setBlocks] = useState(() => version.blocks);
  const [sourceId, setSourceId] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState(null);
  const saveMutation = useMutation({
    mutationFn: () =>
      atlas.documents.updateVersion(
        template.id,
        version.id,
        { blocks, updatedAt: version.updatedAt },
        token,
      ),
    onSuccess: async () => {
      toast.success("Borrador guardado");
      await queryClient.invalidateQueries({ queryKey: ["documents", "versions", template.id] });
    },
    onError: (error) => toast.error(error.message),
  });
  const previewMutation = useMutation({
    mutationFn: () =>
      atlas.documents.preview(
        template.id,
        { sourceId, versionId: version.id },
        token,
      ),
    onSuccess: (blob) => {
      setPreviewBlob(blob);
      setPreviewOpen(true);
    },
    onError: (error) => {
      setPreviewOpen(true);
      toast.error(error.message);
    },
  });
  const publishMutation = useMutation({
    mutationFn: () =>
      atlas.documents.publishVersion(
        template.id,
        version.id,
        { updatedAt: version.updatedAt },
        token,
      ),
    onSuccess: async () => {
      toast.success("Version publicada");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["documents", "template", template.id] }),
        queryClient.invalidateQueries({ queryKey: ["documents", "versions", template.id] }),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <DocumentBlockEditor blocks={blocks} onChange={setBlocks} variables={variables} />
        <Card className="h-fit">
          <CardContent className="space-y-4 pt-5">
            <div>
              <p className="text-sm font-semibold">Version {version.versionNumber}</p>
              <Badge variant="secondary">{version.status}</Badge>
            </div>
            <Input
              value={sourceId}
              onChange={(event) => setSourceId(event.target.value)}
              placeholder="ID del lead para preview"
            />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={!sourceId || previewMutation.isPending}
              onClick={() => previewMutation.mutate()}
            >
              <Eye className="mr-2 h-4 w-4" /> Vista previa
            </Button>
            <Button
              type="button"
              className="w-full"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              <Save className="mr-2 h-4 w-4" /> Guardar borrador
            </Button>
            {canPublish ? (
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled={publishMutation.isPending}
                onClick={() => publishMutation.mutate()}
              >
                <Send className="mr-2 h-4 w-4" /> Publicar
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
      <DocumentPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        blob={previewBlob}
        loading={previewMutation.isPending}
        error={previewMutation.error}
      />
    </>
  );
}

export default function DocumentTemplateEditorScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session, userProfile } = useAuth();
  const token = session?.access_token;
  const permissions = userProfile?.permissions ?? [];
  const allowed = (key) => userProfile?.isAdmin || permissions.includes(key);
  const templateQuery = useQuery({
    queryKey: ["documents", "template", id],
    queryFn: () => atlas.documents.getTemplate(id, token),
    enabled: Boolean(token && id),
  });
  const versionsQuery = useQuery({
    queryKey: ["documents", "versions", id],
    queryFn: () => atlas.documents.listVersions(id, token),
    enabled: Boolean(token && id),
  });
  const schemaQuery = useQuery({
    queryKey: ["documents", "provider", templateQuery.data?.sourceType],
    queryFn: () => atlas.documents.getProviderSchema(templateQuery.data.sourceType, token),
    enabled: Boolean(token && templateQuery.data?.sourceType),
    staleTime: 5 * 60_000,
  });
  const createVersion = useMutation({
    mutationFn: () => {
      const published = versionsQuery.data?.find(
        (version) => version.id === templateQuery.data?.publishedVersionId,
      );
      return atlas.documents.createVersion(
        id,
        { blocks: published?.blocks ?? STARTER_BLOCKS },
        token,
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["documents", "versions", id] });
    },
    onError: (error) => toast.error(error.message),
  });

  if (templateQuery.isLoading || versionsQuery.isLoading) {
    return <LoadingState label="Cargando plantilla..." />;
  }
  if (templateQuery.isError || versionsQuery.isError) {
    return <ErrorState description="No se pudo cargar la plantilla." />;
  }

  const template = templateQuery.data;
  const draft = versionsQuery.data?.find((version) => version.status === "draft");
  const variables = schemaQuery.data?.fields ?? [];

  return (
    <div className="min-h-dvh space-y-6 p-4 md:p-6">
      <PageHeader
        eyebrow="Atlas Documents"
        title={template.name}
        description={`${template.key} · ${template.sourceType}`}
        actions={(
          <Button type="button" variant="outline" onClick={() => navigate("/app/m/atlas.documents/templates")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Button>
        )}
      />
      {draft ? (
        <EditorWorkspace
          key={draft.id}
          template={template}
          version={draft}
          variables={variables}
          token={token}
          canPublish={allowed("documents.templates.publish")}
        />
      ) : (
        <EmptyState
          icon={FilePlus2}
          title="No hay un borrador editable"
          description="Crea una nueva version a partir de la publicada o de la plantilla inicial."
          action={allowed("documents.templates.update") ? {
            label: "Crear borrador",
            onClick: () => createVersion.mutate(),
          } : undefined}
        />
      )}
    </div>
  );
}
