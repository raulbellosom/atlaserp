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
    const frameSize = Math.max(12, Math.round(size));
    return (
      <span
        className="inline-flex items-center justify-center overflow-hidden border border-[hsl(var(--border))] bg-[hsl(var(--background))]/85 shadow-sm"
        style={{
          width: frameSize,
          height: frameSize,
          borderRadius: Math.max(4, Math.round(frameSize * 0.26)),
        }}
      >
        <img
          src={logoUrl}
          alt=""
          className="h-full w-full object-cover"
          style={{ width: frameSize, height: frameSize }}
        />
      </span>
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
