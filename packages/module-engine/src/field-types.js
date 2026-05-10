// Maps each FIELD_TYPES value to a function (field) => SQL column type string.
// Used by generateCreateTableSql.

export const SQL_TYPE_MAP = Object.freeze({
  text:        (f) => `VARCHAR(${f.maxLength ?? 255})`,
  textarea:    ()  => 'TEXT',
  number:      ()  => 'INTEGER',
  decimal:     ()  => 'NUMERIC(18,4)',
  boolean:     ()  => 'BOOLEAN',
  select:      ()  => 'VARCHAR(64)',
  multiselect: ()  => 'TEXT[]',
  date:        ()  => 'DATE',
  datetime:    ()  => 'TIMESTAMPTZ',
  email:       ()  => 'VARCHAR(255)',
  phone:       ()  => 'VARCHAR(64)',
  relation:    ()  => 'UUID',
  file:        ()  => 'UUID',
  json:        ()  => 'JSONB',
  markdown:    ()  => 'TEXT',
  color:       ()  => 'VARCHAR(32)',
  richtext:    ()  => 'TEXT',
})
