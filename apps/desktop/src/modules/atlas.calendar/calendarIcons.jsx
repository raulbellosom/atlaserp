import {
  Calendar, Briefcase, Home, Heart, Star,
  GraduationCap, Globe, Music, Camera, ShoppingBag,
  Dumbbell, Coffee, Plane, Baby, Stethoscope,
  BookOpen, Zap, Target, Users, Gift,
  Sun, Leaf, Dog, Car,
} from 'lucide-react'

export const CALENDAR_ICONS = {
  Calendar,
  Briefcase,
  Home,
  Heart,
  Star,
  GraduationCap,
  Globe,
  Music,
  Camera,
  ShoppingBag,
  Dumbbell,
  Coffee,
  Plane,
  Baby,
  Stethoscope,
  BookOpen,
  Zap,
  Target,
  Users,
  Gift,
  Sun,
  Leaf,
  Dog,
  Car,
}

export function CalendarIcon({ name, size = 14, color, className }) {
  const Icon = name ? CALENDAR_ICONS[name] : null
  if (!Icon) return null
  return <Icon size={size} color={color} className={className} />
}
