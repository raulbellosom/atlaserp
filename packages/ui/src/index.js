// Lib
export { cn } from "./lib/utils.js";

// Core primitives
export { Button, buttonVariants } from "./components/Button.jsx";
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./components/Card.jsx";
export { Badge, badgeVariants } from "./components/Badge.jsx";
export { Separator } from "./components/Separator.jsx";
export { Skeleton } from "./components/Skeleton.jsx";
export { Avatar, AvatarImage, AvatarFallback } from "./components/Avatar.jsx";

// Forms
export { Label } from "./components/Label.jsx";
export { Input } from "./components/Input.jsx";
export { Textarea } from "./components/Textarea.jsx";
export {
  FieldWrapper,
  TextField,
  PasswordField,
  TextareaField,
  NumberField,
  CurrencyField,
  DateField,
  DateTimeField,
  YearField,
  DropzoneField,
  SelectField,
  PhoneField,
  CheckboxField,
  SwitchField,
  RadioGroupField,
  TagsField,
  ComboboxField,
  CreatableComboboxField,
  CarColorPickerField,
} from "./components/FormFields.jsx";
export { MarkdownField } from "./components/MarkdownField.jsx";
export { MarkdownViewer } from "./components/MarkdownViewer.jsx";
export { Checkbox } from "./components/Checkbox.jsx";
export { Switch } from "./components/Switch.jsx";
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from "./components/Select.jsx";
export {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  useFormField,
} from "./components/Form.jsx";

// Navigation & Layout
export { AppShell } from "./components/AppShell.jsx";
export { ModuleSidebar } from "./components/ModuleSidebar.jsx";
export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "./components/Tabs.jsx";
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from "./components/DropdownMenu.jsx";
export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from "./components/Breadcrumb.jsx";

// Data Display
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "./components/Table.jsx";
export { DataTable } from "./components/DataTable.jsx";
export {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "./components/Pagination.jsx";

// Overlays & Feedback
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./components/Dialog.jsx";
export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "./components/Sheet.jsx";
export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
} from "./components/Popover.jsx";
export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "./components/Tooltip.jsx";
export { Toaster } from "./components/Toast.jsx";
export { Alert, AlertTitle, AlertDescription } from "./components/Alert.jsx";

// Molecules & Organisms
export { DatePickerField } from "./components/DatePickerField.jsx";
export { PageHeader } from "./components/PageHeader.jsx";
export { EmptyState } from "./components/EmptyState.jsx";
export { ErrorState } from "./components/ErrorState.jsx";
export { StatCard } from "./components/StatCard.jsx";
export { SearchInput } from "./components/SearchInput.jsx";
export { FilterBar } from "./components/FilterBar.jsx";
export { DynamicTable } from "./components/DynamicTable.jsx";
export { DynamicForm } from "./components/DynamicForm.jsx";
export { ActionMenu } from "./components/ActionMenu.jsx";
export { ConfirmDialog } from "./components/ConfirmDialog.jsx";
export { ContactPicker } from "./components/ContactPicker.jsx";
export { FileCard } from "./components/FileCard.jsx";
export { FileUploader } from "./components/FileUploader.jsx";
export { FileViewer } from "./components/FileViewer.jsx";
export { AttachmentsPanel } from "./components/AttachmentsPanel.jsx";
export { DocumentsPanel } from "./components/DocumentsPanel.jsx";
export { ImageViewer } from "./components/ImageViewer.jsx";
export { ImageUploader } from "./components/ImageUploader.jsx";
export { PageFooter } from "./components/PageFooter.jsx";
export { BrandFooter } from "./components/BrandFooter.jsx";

// Responsive / Mobile patterns
export {
  ViewModeSwitch,
  getStoredViewMode,
} from "./components/ViewModeSwitch.jsx";
export { MobileFiltersSheet } from "./components/MobileFiltersSheet.jsx";
export { ListLayout } from "./components/ListLayout.jsx";
export { useAttachmentsController } from "./hooks/useAttachmentsController.js";

// atlas.activity
export { ActivityTimeline } from "./components/ActivityTimeline.jsx";
export { ActivityDrawer } from "./components/ActivityDrawer.jsx";
export { ActivityBellTrigger } from "./components/ActivityBellTrigger.jsx";

// Atlas blueprint renderer
export {
  AtlasTable,
  AtlasForm,
  AtlasDetail,
  AtlasCrudView,
  AtlasCardView,
  BulkActionBar,
  normalizeSpanishLabel,
  shouldUsePageMode,
  CostsSummaryPanel,
} from "./atlas-renderer/index.js";

export { UserSearchModal } from "./components/UserSearchModal.jsx";

export { OfflineIndicator } from "./components/OfflineIndicator.jsx";
export { SyncStatusBar } from "./components/SyncStatusBar.jsx";
