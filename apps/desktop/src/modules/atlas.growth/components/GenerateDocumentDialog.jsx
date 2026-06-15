import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  LoadingState,
  SelectField,
} from "@atlas/ui";
import { Files } from "lucide-react";
import { toast } from "sonner";

import { atlas } from "../../../lib/atlas.js";

export function GenerateDocumentDialog({
  open,
  onOpenChange,
  leadId,
  token,
  onGenerated,
}) {
  const [templateId, setTemplateId] = useState("");
  const {
    data: templatesResponse,
    isLoading: isTemplatesLoading,
    isError: isTemplatesError,
  } = useQuery({
    queryKey: ["documents", "compatible-templates", "growth.lead"],
    queryFn: () =>
      atlas.documents.listTemplates(token, {
        sourceType: "growth.lead",
        enabled: true,
        pageSize: 100,
      }),
    enabled: Boolean(open && token),
  });
  const templates = useMemo(
    () =>
      (templatesResponse?.items ?? []).filter(
        (template) => template.publishedVersionId,
      ),
    [templatesResponse],
  );
  const mutation = useMutation({
    mutationFn: async () => {
      const generated = await atlas.documents.generate(
        templateId,
        { sourceId: leadId },
        token,
      );
      const download = await atlas.documents.getGeneratedDownload(
        generated.id,
        token,
      );
      return { generated, download };
    },
    onSuccess: (result) => {
      onOpenChange(false);
      setTemplateId("");
      onGenerated(result);
      toast.success("Documento generado");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generar documento</DialogTitle>
          <DialogDescription>
            Selecciona una plantilla publicada compatible con Growth.
          </DialogDescription>
        </DialogHeader>
        {isTemplatesLoading ? (
          <LoadingState label="Cargando plantillas..." />
        ) : null}
        {isTemplatesError ? (
          <ErrorState description="No se pudieron cargar las plantillas." />
        ) : null}
        {!isTemplatesLoading && !isTemplatesError && templates.length === 0 ? (
          <EmptyState
            icon={Files}
            title="No hay plantillas publicadas"
            description="Publica una plantilla growth.lead desde Atlas Documents."
          />
        ) : null}
        {templates.length ? (
          <SelectField
            label="Plantilla"
            value={templateId}
            options={templates.map((template) => ({
              value: template.id,
              label: template.name,
            }))}
            onValueChange={setTemplateId}
          />
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!templateId || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Generando..." : "Generar PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
