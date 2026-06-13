import { useState } from "react";
import {
  // Tech
  Laptop,
  Monitor,
  Keyboard,
  Mouse,
  Printer,
  Phone,
  Tablet,
  HardDrive,
  Cpu,
  Server,
  Wifi,
  Camera,
  // Tools
  Wrench,
  Hammer,
  Scissors,
  Ruler,
  Plug,
  Battery,
  Flashlight,
  // Office/Furniture
  BookOpen,
  Archive,
  Inbox,
  Clipboard,
  FileText,
  Folder,
  // Vehicles
  Car,
  Truck,
  Bike,
  // General
  Box,
  Boxes,
  Package,
  Tag,
  Barcode,
  Warehouse,
  Building,
  Home,
  Globe,
  Shield,
  Key,
  Lock,
  // People
  User,
  Users,
  UserCheck,
  // Finance
  CreditCard,
  DollarSign,
  Receipt,
  // Placeholder
  Grid3x3,
} from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "./Popover.jsx";
import { Input } from "./Input.jsx";
import { cn } from "../lib/utils.js";

const ICONS = [
  // Tech
  { name: "Laptop", component: Laptop },
  { name: "Monitor", component: Monitor },
  { name: "Keyboard", component: Keyboard },
  { name: "Mouse", component: Mouse },
  { name: "Printer", component: Printer },
  { name: "Phone", component: Phone },
  { name: "Tablet", component: Tablet },
  { name: "HardDrive", component: HardDrive },
  { name: "Cpu", component: Cpu },
  { name: "Server", component: Server },
  { name: "Wifi", component: Wifi },
  { name: "Camera", component: Camera },
  // Tools
  { name: "Wrench", component: Wrench },
  { name: "Hammer", component: Hammer },
  { name: "Scissors", component: Scissors },
  { name: "Ruler", component: Ruler },
  { name: "Plug", component: Plug },
  { name: "Battery", component: Battery },
  { name: "Flashlight", component: Flashlight },
  // Office/Furniture
  { name: "BookOpen", component: BookOpen },
  { name: "Archive", component: Archive },
  { name: "Inbox", component: Inbox },
  { name: "Clipboard", component: Clipboard },
  { name: "FileText", component: FileText },
  { name: "Folder", component: Folder },
  // Vehicles
  { name: "Car", component: Car },
  { name: "Truck", component: Truck },
  { name: "Bike", component: Bike },
  // General
  { name: "Box", component: Box },
  { name: "Boxes", component: Boxes },
  { name: "Package", component: Package },
  { name: "Tag", component: Tag },
  { name: "Barcode", component: Barcode },
  { name: "Warehouse", component: Warehouse },
  { name: "Building", component: Building },
  { name: "Home", component: Home },
  { name: "Globe", component: Globe },
  { name: "Shield", component: Shield },
  { name: "Key", component: Key },
  { name: "Lock", component: Lock },
  // People
  { name: "User", component: User },
  { name: "Users", component: Users },
  { name: "UserCheck", component: UserCheck },
  // Finance
  { name: "CreditCard", component: CreditCard },
  { name: "DollarSign", component: DollarSign },
  { name: "Receipt", component: Receipt },
];

export function IconPickerField({
  value,
  onChange,
  label,
  placeholder = "Seleccionar icono",
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = ICONS.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()),
  );

  const SelectedIcon = ICONS.find((i) => i.name === value)?.component ?? null;

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-sm font-medium text-[hsl(var(--foreground))]">
          {label}
        </label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "flex items-center gap-2 h-9 px-3 rounded-md border border-[hsl(var(--border))]",
              "bg-[hsl(var(--background))] text-sm w-full text-left",
              "transition-colors hover:bg-[hsl(var(--accent))]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]",
            )}
          >
            {SelectedIcon ? (
              <SelectedIcon
                size={16}
                className="shrink-0 text-[hsl(var(--foreground))]"
              />
            ) : (
              <Grid3x3
                size={16}
                className="shrink-0 text-[hsl(var(--muted-foreground))]"
              />
            )}
            <span
              className={cn(
                "flex-1 truncate",
                value
                  ? "text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))]",
              )}
            >
              {value || placeholder}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="start">
          <Input
            placeholder="Buscar icono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-3 h-8 text-sm"
          />
          <div className="grid grid-cols-6 gap-1 max-h-48 overflow-y-auto">
            {filtered.map(({ name, component: Icon }) => (
              <button
                key={name}
                type="button"
                title={name}
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                  setSearch("");
                }}
                className={cn(
                  "flex items-center justify-center h-9 w-9 rounded-md transition-colors",
                  "hover:bg-[hsl(var(--accent))]",
                  value === name &&
                    "bg-[hsl(var(--accent))] ring-1 ring-[hsl(var(--ring))]",
                )}
              >
                <Icon size={16} />
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-6 text-xs text-center text-[hsl(var(--muted-foreground))] py-4">
                Sin resultados
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
