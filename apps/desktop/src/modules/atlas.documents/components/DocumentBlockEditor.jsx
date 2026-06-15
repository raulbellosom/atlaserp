import { Button, Card, CardContent, Input, SelectField, Textarea } from "@atlas/ui";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

const BLOCK_OPTIONS = [
  { value: "heading", label: "Titulo" },
  { value: "paragraph", label: "Parrafo" },
  { value: "fields", label: "Campos" },
  { value: "table", label: "Tabla" },
  { value: "totals", label: "Totales" },
  { value: "image", label: "Imagen" },
  { value: "divider", label: "Divisor" },
  { value: "spacer", label: "Espacio" },
  { value: "signature", label: "Firma" },
  { value: "pageBreak", label: "Salto de pagina" },
];

function blockId() {
  return `block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function newBlock(type) {
  const id = blockId();
  const blocks = {
    heading: { id, type, text: "Nuevo titulo", level: 2, align: "left" },
    paragraph: { id, type, text: "Nuevo parrafo", align: "left" },
    fields: {
      id,
      type,
      columns: 2,
      fields: [{ label: "Campo", value: "{{lead.name}}" }],
    },
    table: {
      id,
      type,
      collection: "submissions",
      columns: [{ label: "Formulario", value: "formName" }],
      maxRows: 100,
    },
    totals: {
      id,
      type,
      rows: [{ label: "Total", value: "{{summary.submissionCount}}" }],
    },
    image: {
      id,
      type,
      source: "{{company.logo}}",
      width: 160,
      align: "left",
    },
    divider: { id, type, thickness: 1, color: "#0F766E" },
    spacer: { id, type, height: 24 },
    signature: {
      id,
      type,
      source: "{{lead.signature}}",
      label: "Firma",
      width: 160,
    },
    pageBreak: { id, type },
  };
  return blocks[type];
}

function primaryValue(block) {
  if (block.type === "heading" || block.type === "paragraph") return block.text;
  if (block.type === "image" || block.type === "signature") return block.source;
  return "";
}

export function DocumentBlockEditor({ blocks, onChange, variables = [] }) {
  function update(index, patch) {
    onChange(blocks.map((block, itemIndex) =>
      itemIndex === index ? { ...block, ...patch } : block));
  }

  function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {BLOCK_OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onChange([...blocks, newBlock(option.value)])}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            {option.label}
          </Button>
        ))}
      </div>

      {blocks.map((block, index) => (
        <Card key={block.id}>
          <CardContent className="space-y-3 pt-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold capitalize">{block.type}</span>
              <div className="flex gap-1">
                <Button type="button" size="icon" variant="ghost" onClick={() => move(index, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" onClick={() => move(index, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => onChange(blocks.filter((_, itemIndex) => itemIndex !== index))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {block.type === "heading" || block.type === "paragraph" ? (
              <Textarea
                value={block.text}
                onChange={(event) => update(index, { text: event.target.value })}
                rows={3}
              />
            ) : null}
            {block.type === "image" || block.type === "signature" ? (
              <Input
                value={block.source}
                onChange={(event) => update(index, { source: event.target.value })}
              />
            ) : null}
            {block.type === "spacer" ? (
              <Input
                type="number"
                min={4}
                max={200}
                value={block.height}
                onChange={(event) => update(index, { height: Number(event.target.value) })}
              />
            ) : null}
            {block.type === "fields" ? (
              <Textarea
                value={block.fields.map((field) => `${field.label}|${field.value}`).join("\n")}
                onChange={(event) =>
                  update(index, {
                    fields: event.target.value.split("\n").filter(Boolean).map((line) => {
                      const [label, ...value] = line.split("|");
                      return { label: label || "Campo", value: value.join("|") || "-" };
                    }),
                  })
                }
                rows={4}
                placeholder="Etiqueta|{{lead.name}}"
              />
            ) : null}
            {block.type === "table" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  value={block.collection}
                  onChange={(event) => update(index, { collection: event.target.value })}
                  placeholder="submissions"
                />
                <Textarea
                  value={block.columns.map((column) => `${column.label}|${column.value}`).join("\n")}
                  onChange={(event) =>
                    update(index, {
                      columns: event.target.value.split("\n").filter(Boolean).map((line) => {
                        const [label, value] = line.split("|");
                        return { label: label || "Columna", value: value || "id" };
                      }),
                    })
                  }
                  rows={3}
                />
              </div>
            ) : null}
            {block.type === "totals" ? (
              <Textarea
                value={block.rows.map((row) => `${row.label}|${row.value}`).join("\n")}
                onChange={(event) =>
                  update(index, {
                    rows: event.target.value.split("\n").filter(Boolean).map((line) => {
                      const [label, ...value] = line.split("|");
                      return { label: label || "Total", value: value.join("|") || "-" };
                    }),
                  })
                }
                rows={3}
              />
            ) : null}

            {["heading", "paragraph", "image", "signature"].includes(block.type) ? (
              <SelectField
                label="Insertar variable"
                value=""
                options={variables.map((variable) => ({
                  value: variable.path,
                  label: `${variable.label} (${variable.path})`,
                }))}
                onValueChange={(path) => {
                  const binding = `{{${path}}}`;
                  if (block.type === "image" || block.type === "signature") {
                    update(index, { source: binding });
                  } else {
                    update(index, { text: `${primaryValue(block)} ${binding}`.trim() });
                  }
                }}
              />
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
