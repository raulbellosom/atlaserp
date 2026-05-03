import { createModuleManifest } from '@atlas/core'

export const contactsMap = createModuleManifest({
  key: 'atlas.contacts',
  name: 'Contactos',
  description: 'Clientes, proveedores, personas y empresas.',
  version: '0.1.0',
  dependencies: [{ key: 'atlas.core' }, { key: 'atlas.identity' }],
  navigation: [
    { label: 'Contactos', path: '/contacts', icon: 'Contact', layout: 'main' }
  ],
  permissions: [
    { key: 'contacts.read', name: 'Read Contacts' },
    { key: 'contacts.create', name: 'Create Contacts' },
    { key: 'contacts.update', name: 'Update Contacts' },
    { key: 'contacts.delete', name: 'Delete Contacts' }
  ],
  exposes: {
    contactPicker: true,
    getContactById: true
  },
  blueprints: [
    {
      key: 'contacts.contact.entity',
      kind: 'ENTITY',
      version: '0.1.0',
      schema: {
        entity: 'Contact',
        label: 'Contacto',
        fields: [
          { name: 'type', label: 'Tipo', type: 'select', options: ['customer', 'supplier', 'person', 'company'], required: true },
          { name: 'name', label: 'Nombre', type: 'text', required: true },
          { name: 'email', label: 'Correo', type: 'email' },
          { name: 'phone', label: 'Teléfono', type: 'phone' },
          { name: 'taxId', label: 'RFC / Tax ID', type: 'text' }
        ],
        table: { columns: ['type', 'name', 'email', 'phone'] }
      }
    }
  ]
})

export const financeMap = createModuleManifest({
  key: 'atlas.finance',
  name: 'Finanzas',
  description: 'Cuentas, movimientos, ingresos, egresos y conciliación básica.',
  version: '0.1.0',
  dependencies: [{ key: 'atlas.core' }, { key: 'atlas.contacts', optional: true }],
  navigation: [
    { label: 'Finanzas', path: '/finance', icon: 'Wallet', layout: 'main' }
  ],
  permissions: [
    { key: 'finance.read', name: 'Read Finance' },
    { key: 'finance.create', name: 'Create Finance Records' },
    { key: 'finance.update', name: 'Update Finance Records' },
    { key: 'finance.delete', name: 'Delete Finance Records' }
  ]
})

export const featureModules = [contactsMap, financeMap]
