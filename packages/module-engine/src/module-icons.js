export const MODULE_ICON_NAMES = Object.freeze([
  // Analytics & Reporting
  'Activity',
  'BarChart3',
  'BarChart4',
  'LineChart',
  'PieChart',
  'TrendingDown',
  'TrendingUp',

  // Finance & Accounting
  'ArrowRightLeft',
  'Banknote',
  'Calculator',
  'Coins',
  'CreditCard',
  'DollarSign',
  'HandCoins',
  'Landmark',
  'Percent',
  'PiggyBank',
  'Receipt',
  'Scale',
  'Wallet',

  // Documents & Files
  'BookOpen',
  'BookMarked',
  'ClipboardCheck',
  'ClipboardList',
  'FileCheck',
  'Files',
  'FileSearch',
  'FileSpreadsheet',
  'FileText',
  'FolderOpen',
  'Library',
  'ListOrdered',
  'NotebookPen',

  // People & HR
  'Briefcase',
  'Contact',
  'ContactRound',
  'GraduationCap',
  'HeartPulse',
  'Stethoscope',
  'UserCheck',
  'UserPlus',
  'Users',
  'UsersRound',

  // Inventory & Logistics
  'Anchor',
  'Archive',
  'Barcode',
  'Box',
  'Boxes',
  'Container',
  'Fuel',
  'Package',
  'Package2',
  'QrCode',
  'Route',
  'Ship',
  'ShoppingBag',
  'ShoppingCart',
  'Store',
  'Tag',
  'Truck',
  'Warehouse',

  // Operations & Production
  'ClipboardCopy',
  'Construction',
  'Factory',
  'Gauge',
  'Hammer',
  'Layers',
  'LayoutDashboard',
  'LayoutTemplate',
  'ListChecks',
  'ListTree',
  'Plug',
  'Settings',
  'SlidersHorizontal',
  'SquareKanban',
  'Target',
  'Wrench',

  // Communication & CRM
  'Bell',
  'Calendar',
  'CalendarDays',
  'Mail',
  'MapPin',
  'Menu',
  'MessageCircle',
  'MessageSquare',
  'Phone',
  'Send',

  // Location & Navigation
  'Building2',
  'Globe',
  'Home',
  'Hotel',
  'Map',
  'Network',

  // Security & Admin
  'Award',
  'Crown',
  'Flag',
  'Gavel',
  'Key',
  'Lock',
  'Palette',
  'Puzzle',
  'Shield',
  'ShieldCheck',
  'Star',

  // Time & Scheduling
  'Clock',
  'History',
  'Hourglass',
  'Timer',

  // Tech & System
  'Database',
  'HardDrive',
  'Server',
  'Wifi',
  'Zap',
])

const MODULE_ICON_NAME_SET = new Set(MODULE_ICON_NAMES)

export function isModuleIconName(value) {
  return typeof value === 'string' && MODULE_ICON_NAME_SET.has(value)
}
