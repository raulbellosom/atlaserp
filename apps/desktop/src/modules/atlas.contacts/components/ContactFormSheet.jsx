import {
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  DynamicForm,
} from "@atlas/ui";
import { TYPE_OPTIONS, CONTACTS_BLUEPRINT_FALLBACK } from "../constants";

function withNotesField(blueprint) {
  const fields = Array.isArray(blueprint?.schema?.fields)
    ? blueprint.schema.fields
    : [];
  const hasNotes = fields.some((f) => f?.name === "notesMarkdown");
  if (hasNotes) return blueprint;
  return {
    ...blueprint,
    schema: {
      ...blueprint.schema,
      fields: [
        ...fields,
        {
          name: "notesMarkdown",
          label: "Observaciones",
          type: "markdown",
          maxLength: 5000,
        },
      ],
    },
  };
}

export function resolveContactsBlueprint(blueprints) {
  const found = blueprints?.find((b) => b.key === "contacts.contact.entity");
  if (!found?.schema) return CONTACTS_BLUEPRINT_FALLBACK;
  return withNotesField(found);
}

export function ContactFormSheet({
  open,
  onOpenChange,
  contact,
  blueprint,
  onSubmit,
  isMutating,
}) {
  const isEditing = Boolean(contact);

  const defaultValues = isEditing
    ? {
        type: contact.type,
        name: contact.name,
        legalName: contact.legalName ?? "",
        email: contact.email ?? "",
        phone: contact.phone ?? "",
        taxId: contact.taxId ?? "",
        notesMarkdown: contact.notesMarkdown ?? "",
      }
    : {
        type: "customer",
        name: "",
        legalName: "",
        email: "",
        phone: "",
        taxId: "",
        notesMarkdown: "",
      };

  return (
    <Sheet
      open={open}
      onOpenChange={(value) => {
        if (!isMutating) onOpenChange(value);
      }}
    >
      <SheetContent className="sm:max-w-lg lg:max-w-2xl xl:max-w-3xl">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? "Editar contacto" : "Nuevo contacto"}
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto py-4">
          <DynamicForm
            key={contact?.id ?? "new"}
            formId="contact-form"
            blueprint={blueprint}
            defaultValues={defaultValues}
            onSubmit={onSubmit}
            renderActions={false}
            fieldOrder={[
              "type",
              "name",
              "legalName",
              "email",
              "phone",
              "taxId",
              "notesMarkdown",
            ]}
            fieldOptions={{ type: TYPE_OPTIONS }}
          />
        </div>
        <SheetFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isMutating}
          >
            Cancelar
          </Button>
          <Button type="submit" form="contact-form" disabled={isMutating}>
            {isMutating
              ? "Guardando..."
              : isEditing
                ? "Guardar cambios"
                : "Crear contacto"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
