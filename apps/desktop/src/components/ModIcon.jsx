import {
  Box, Layers, ContactRound, Landmark, LayoutDashboard, Puzzle,
  Settings, Contact, Wallet, Users, Shield, Palette, FolderOpen,
  Building2, CreditCard, BarChart3, FileText, Home, Truck,
} from 'lucide-react';

export const ICON_MAP = {
  LayoutDashboard, Puzzle, Settings, Contact, Wallet, Users, Shield,
  Palette, FolderOpen, Building2, Layers, ContactRound, Landmark,
  CreditCard, BarChart3, FileText, Home, Truck, Box,
};

export function ModIcon({ name, size = 22, color, logoUrl }) {
  if (typeof logoUrl === 'string' && logoUrl.trim()) {
    return (
      <img
        src={logoUrl}
        alt=""
        className="object-contain"
        style={{ width: size, height: size }}
      />
    );
  }
  const raw = typeof name === 'string' ? name.trim() : '';
  const pascalName = raw
    .split(/[^a-zA-Z0-9]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
  const Icon = ICON_MAP[raw] ?? ICON_MAP[pascalName] ?? Box;
  return <Icon size={size} style={{ color }} />;
}
