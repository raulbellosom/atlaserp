import { Button, Card, CardContent, Input, Textarea } from "@atlas/ui";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

const BLOCK_TYPES = {
  heading: "Titulo",
  paragraph: "Parrafo",
  fields: "Campos",
  table: "Tabla",
  totals: "Totales",
  image: "Imagen",
  divider: "Divisor",
  spacer: "Espacio",
  signature: "Firma",
  pageBreak: "Salto de pagina",
};

const BLOCK_OPTIONS = Object.entries(BLOCK_TYPES).map(([value, label]) => ({ value, label }));

function blockId() {
  return `block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function newBlock(type) {
  const id = blockId();
  const defaults = {
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
    image: { id, type, source: "{{company.logo}}", width: 160, align: "left" },
    divider: { id, type, thickness: 1, color: "#0F766E" },
    spacer: { id, type, height: 24 },
    signature: { id, type, source: "{{lead.signature}}", label: "Firma", width: 160 },
    pageBreak: { id, type },
  };
  return defaults[type];
}

function RowsEditor({ rows, onChange, labelPlaceholder = "Etiqueta", valuePlaceholder = "Valor" }) {
  function updateRow(index, patch) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }
  function addRow() {
    onChange([...rows, { label: "", value: "" }]);
  }
  function removeRow(index) {
    onChange(rows.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            className="flex-1"
            value={row.label}
            onChange={(e) => updateRow(index, { label: e.target.value })}
            placeholder={labelPlaceholder}
          />
          <Input
            className="flex-1 font-mono text-xs"
            value={row.value}
            onChange={(e) => updateRow(index, { value: e.target.value })}
            placeholder={valuePlaceholder}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="shrink-0"
            onClick={() => removeRow(index)}
            disabled={rows.length <= 1}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={addRow}>
        <Plus className="mr-1.5 h-3.5 w-3.5" /> Agregar fila
      </Button>
    </div>
  );
}

function BlockBody({ block, index, update }) {
  const textBlock = block.type === "heading" || block.type === "paragraph";
  const mediaBlock = block.type === "image" || block.type === "signature";

  if (textBlock) {
    return (
      <Textarea
        value={block.text}
        onChange={(e) => update(index, { text: e.target.value })}
        rows={3}
        className="resize-none font-mono text-sm"
        placeholder="Escribe el contenido. Usa {{variable}} para insertar datos dinamicos."
      />
    );
  }

  if (mediaBlock) {
    return (
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">Fuente</p>
        <Input
          value={block.source}
          onChange={(e) => update(index, { source: e.target.value })}
          className="font-mono text-xs"
          placeholder="{{company.logo}}"
        />
      </div>
    );
  }

  if (block.type === "fields") {
    return (
      <RowsEditor
        rows={block.fields}
        onChange={(fields) => update(index, { fields })}
        labelPlaceholder="Etiqueta"
        valuePlaceholder="{{lead.campo}}"
      />
    );
  }

  if (block.type === "table") {
    return (
      <div className="space-y-3">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Coleccion</p>
          <Input
            value={block.collection}
            onChange={(e) => update(index, { collection: e.target.value })}
            placeholder="submissions"
            className="font-mono text-xs"
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Columnas</p>
          <RowsEditor
            rows={block.columns}
            onChange={(columns) => update(index, { columns })}
            labelPlaceholder="Titulo columna"
            valuePlaceholder="campo"
          />
        </div>
      </div>
    );
  }

  if (block.type === "totals") {
    return (
      <RowsEditor
        rows={block.rows}
        onChange={(rows) => update(index, { rows })}
        labelPlaceholder="Etiqueta"
        valuePlaceholder="{{summary.campo}}"
      />
    );
  }

  if (block.type === "spacer") {
    return (
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">Altura (px)</p>
        <Input
          type="number"
          min={4}
          max={200}
          value={block.height}
          onChange={(e) => update(index, { height: Number(e.target.value) })}
          className="w-28"
        />
      </div>
    );
  }

  if (block.type === "divider") {
    return (
      <div className="flex items-center gap-4">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Grosor (px)</p>
          <Input
            type="number"
            min={1}
            max={8}
            value={block.thickness}
            onChange={(e) => update(index, { thickness: Number(e.target.value) })}
            className="w-20"
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Color</p>
          <Input
            type="color"
            value={block.color}
            onChange={(e) => update(index, { color: e.target.value })}
            className="h-9 w-16 cursor-pointer p-1"
          />
        </div>
      </div>
    );
  }

  if (block.type === "pageBreak") {
    return (
      <p className="text-xs text-muted-foreground">
        Inserta un salto de pagina en el PDF generado.
      </p>
    );
  }

  return null;
}

export function DocumentBlockEditor({ blocks, onChange }) {
  function update(index, patch) {
    onChange(blocks.map((block, i) => (i === index ? { ...block, ...patch } : block)));
  }

  function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function remove(index) {
    onChange(blocks.filter((_, i) => i !== index));
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
          <CardContent className="space-y-3 p-5!">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">
                {BLOCK_TYPES[block.type] ?? block.type}
              </span>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={index === blocks.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => remove(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <BlockBody block={block} index={index} update={update} />
          </CardContent>
        </Card>
      ))}

      {blocks.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Agrega bloques usando los botones de arriba para construir la plantilla.
        </div>
      )}
    </div>
  );
}
