# Module System

Los módulos de Atlas ERP se llaman internamente **maps**.

Un map es un paquete funcional que declara:

- key
- name
- version
- kind
- dependencies
- permissions
- navigation
- blueprints
- exposed capabilities
- consumed capabilities

## Manifest base

```js
export const financeMap = createModuleManifest({
  key: 'atlas.finance',
  name: 'Finanzas',
  version: '0.1.0',
  dependencies: [{ key: 'atlas.core' }, { key: 'atlas.contacts', optional: true }],
  navigation: [{ label: 'Finanzas', path: '/finance', icon: 'Wallet' }],
  permissions: [
    { key: 'finance.read', name: 'Read Finance' },
    { key: 'finance.create', name: 'Create Finance Records' }
  ],
  exposes: {
    accountPicker: true,
    transactionSummary: true
  },
  consumes: {
    contacts: 'optional'
  }
})
```

## Core modules

Un módulo core tiene:

```js
core: true,
uninstallable: false
```

No se puede eliminar, solo actualizar.

## Feature modules

Un módulo feature puede:

- instalarse
- desactivarse
- desinstalarse lógicamente
- actualizarse de versión

Nunca debe borrar datos por defecto. La desinstalación debe ser lógica salvo que exista una operación explícita de purge.

## Versionado

Cada módulo debe usar SemVer:

```txt
0.1.0
1.0.0
1.2.3
```

Reglas iniciales:

- patch: correcciones internas
- minor: nuevas capacidades compatibles
- major: cambios incompatibles

## Comunicación entre módulos

Primera etapa:

- shared capabilities declaradas en manifest
- API endpoints por módulo
- eventos internos mediante `AtlasEventBus`

Futuro:

- service registry
- module hooks
- workflow engine
