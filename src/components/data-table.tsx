/**
 * Data Table Component
 *
 * A comprehensive data table component that includes:
 * - Data fetching from API
 * - Sortable and draggable rows
 * - Row selection
 * - Pagination
 * - Column visibility toggling
 * - Detail view in a drawer
 * - Filtering
 * - Loading and error states
 */

"use client"; // Marks this as a Client Component in Next.js

import * as React from "react";

// Import drag and drop functionality from @dnd-kit/core
// This allows for interactive row reordering
import {
  DndContext, // Main context provider for drag and drop functionality
  KeyboardSensor, // Enables keyboard interactions for accessibility
  MouseSensor, // Enables mouse interactions
  TouchSensor, // Enables touch interactions for mobile devices
  closestCenter, // Algorithm to determine closest drop target
  useSensor, // Hook to initialize sensors
  useSensors, // Hook to combine multiple sensors
  type DragEndEvent, // Type for drag end events
  type UniqueIdentifier, // Type for unique identifiers
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"; // Limits dragging to vertical movement only
import {
  SortableContext, // Context provider for sortable items
  arrayMove, // Utility to reorder arrays after drag operations
  useSortable, // Hook for making elements sortable
  verticalListSortingStrategy, // Sorting strategy optimized for vertical lists
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities"; // CSS utilities for transforms

// Import icons from Tabler icon set
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft, // Double chevron for "go to first page"
  IconChevronsRight, // Double chevron for "go to last page"
  IconCircleCheckFilled, // Checkmark icon for completed status
  IconDotsVertical, // Three dots for actions menu
  IconGripVertical, // Drag handle icon
  IconLayoutColumns, // Icon for column customization
  IconLoader, // Spinning loader for loading states
  IconPlus, // Plus icon for adding items
  IconTrendingUp, // Icon for trend indicators
} from "@tabler/icons-react";
import {
  ColumnDef, // Type for defining table columns
  ColumnFiltersState, // State for column filters
  Row, // Type for table rows
  SortingState, // State for sorting
  VisibilityState, // State for column visibility
  flexRender, // Function to render cell and header contents
  getCoreRowModel, // Core table functionality
  getFacetedRowModel, // For faceted (grouped) data
  getFacetedUniqueValues, // For unique values in faceted data
  getFilteredRowModel, // For filtered data
  getPaginationRowModel, // For paginated data
  getSortedRowModel, // For sorted data
  useReactTable, // Main hook for table functionality
} from "@tanstack/react-table";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"; // Components for charts
import { toast } from "sonner"; // Toast notification library
import { z } from "zod"; // Schema validation library

import { useIsMobile } from "@/hooks/use-mobile";
import { apiClient } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ------x------
// DATA SCHEMA DEFINITION
// ------x------
// This schema defines the structure of our data using Zod
// It's used for type safety and validation throughout the component
export const schema = z.object({
  id: z.number(), // Unique identifier for each row
  user_name: z.string(), // Customer name
  total_price: z.number(), // Order total price (numeric for calculations)
  order_status: z.string(), // Order status
  created_at: z.string(), // Date when ordered (ISO date string)
  user_location: z.string(), // Customer location
  email: z.string(), // Customer email
});

// ------x------
// DRAG HANDLE COMPONENT
// ------x------
// Create a separate component for the drag handle
// This is used to allow users to drag rows for reordering
function DragHandle({ id }: { id: number }) {
  const { attributes, listeners } = useSortable({
    id,
  });

  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="text-muted-foreground size-7 hover:bg-transparent"
    >
      <IconGripVertical className="text-muted-foreground size-3" />
      <span className="sr-only">Drag to reorder</span>
    </Button>
  );
}

// ------x------
// ACTIONS CELL COMPONENT
// ------x------
// This component handles the dropdown menu actions for each row
// It includes confirmation dialogs for destructive actions
function ActionsCell({
  row,
  onRefresh,
}: {
  row: Row<z.infer<typeof schema>>;
  onRefresh: () => void;
}) {
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = React.useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await apiClient.delete(`/orders/${row.original.id}`);

      toast.success(`Order #${row.original.id} has been deleted`);
      setDeleteDialogOpen(false);
      onRefresh(); // Refresh the data to reflect the deletion
    } catch (error) {
      toast.error("Failed to delete order");
      console.error("Delete error:", error);
    } finally {
      setIsDeleting(false);
    }
  };
  const handleMarkComplete = async () => {
    setIsUpdating(true);
    try {
      await apiClient.put(`/orders/${row.original.id}`, {
        user_name: row.original.user_name,
        user_location: row.original.user_location,
        order_status: "Completed",
        total_price: row.original.total_price,
      });

      toast.success(`Order #${row.original.id} marked as complete`);
      setCompleteDialogOpen(false);
      onRefresh(); // Refresh the data to reflect the status change
    } catch (error) {
      toast.error("Failed to update order status");
      console.error("Update error:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);
      const updates = {
        user_name: formData.get("customer-name") as string,
        user_location: formData.get("location") as string,
        order_status: formData.get("order-status") as string,
        total_price: parseFloat(formData.get("total-price") as string),
      };

      await apiClient.put(`/orders/${row.original.id}`, updates);

      toast.success(`Order #${row.original.id} has been updated`);
      setEditDrawerOpen(false);
      onRefresh(); // Refresh the data to reflect the changes
    } catch (error) {
      toast.error("Failed to update order");
      console.error("Update error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isMobile = useIsMobile();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="data-[state=open]:bg-muted text-muted-foreground flex size-8"
            size="icon"
          >
            <IconDotsVertical />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => setEditDrawerOpen(true)}>
            Edit
          </DropdownMenuItem>

          <Dialog
            open={completeDialogOpen}
            onOpenChange={setCompleteDialogOpen}
          >
            <DialogTrigger asChild>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                Mark as Complete
              </DropdownMenuItem>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Mark Order as Complete</DialogTitle>
                <DialogDescription>
                  Are you sure you want to mark order #{row.original.id} for{" "}
                  {row.original.user_name} as complete? This action cannot be
                  undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCompleteDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleMarkComplete} disabled={isUpdating}>
                  {isUpdating ? "Updating..." : "Mark Complete"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <DropdownMenuSeparator />

          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger asChild>
              <DropdownMenuItem
                variant="destructive"
                onSelect={(e) => e.preventDefault()}
              >
                Delete
              </DropdownMenuItem>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Order</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete order #{row.original.id} for{" "}
                  {row.original.user_name}? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDeleteDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Drawer */}
      <Drawer
        direction={isMobile ? "bottom" : "right"}
        open={editDrawerOpen}
        onOpenChange={setEditDrawerOpen}
      >
        <DrawerContent>
          <DrawerHeader className="gap-1">
            <DrawerTitle>{row.original.user_name}</DrawerTitle>
            <DrawerDescription>Order details</DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
            {!isMobile && (
              <>
                <ChartContainer config={chartConfig}>
                  <AreaChart
                    accessibilityLayer
                    data={chartData}
                    margin={{
                      left: 0,
                      right: 10,
                    }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={(value) => value.slice(0, 3)}
                      hide
                    />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent indicator="dot" />}
                    />
                    <Area
                      dataKey="mobile"
                      type="natural"
                      fill="var(--color-mobile)"
                      fillOpacity={0.6}
                      stroke="var(--color-mobile)"
                      stackId="a"
                    />
                    <Area
                      dataKey="desktop"
                      type="natural"
                      fill="var(--color-desktop)"
                      fillOpacity={0.4}
                      stroke="var(--color-desktop)"
                      stackId="a"
                    />
                  </AreaChart>
                </ChartContainer>
                <Separator />
                <div className="grid gap-2">
                  <div className="flex gap-2 leading-none font-medium">
                    Trending up by 5.2% this month{" "}
                    <IconTrendingUp className="size-4" />
                  </div>
                  <div className="text-muted-foreground">
                    Showing total visitors for the last 6 months. This is just
                    some random text to test the layout. It spans multiple lines
                    and should wrap around.
                  </div>
                </div>
                <Separator />
              </>
            )}{" "}
            <form className="flex flex-col gap-4" onSubmit={handleEditSubmit}>
              <div className="flex flex-col gap-3">
                <Label htmlFor="customer-name">Customer Name</Label>
                <Input
                  id="customer-name"
                  name="customer-name"
                  defaultValue={row.original.user_name}
                />
              </div>
              <div className="flex flex-col gap-3">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  defaultValue={row.original.email}
                  disabled
                  className="opacity-50"
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be modified
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-3">
                  <Label htmlFor="total-price">Total Price</Label>
                  <Input
                    id="total-price"
                    name="total-price"
                    type="number"
                    step="0.01"
                    defaultValue={row.original.total_price.toString()}
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <Label htmlFor="order-status">Order Status</Label>
                  <Select
                    name="order-status"
                    defaultValue={row.original.order_status || "Pending"}
                  >
                    <SelectTrigger id="order-status" className="w-full">
                      <SelectValue placeholder="Select a status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-3">
                  <Label htmlFor="created-at">Date Ordered</Label>
                  <Input
                    id="created-at"
                    name="created-at"
                    defaultValue={new Date(
                      row.original.created_at
                    ).toLocaleDateString()}
                    disabled
                    className="opacity-50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Date cannot be modified
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    name="location"
                    defaultValue={row.original.user_location}
                  />
                </div>{" "}
              </div>
            </form>
          </div>
          <DrawerFooter>
            <Button
              type="submit"
              disabled={isSubmitting}
              onClick={(e) => {
                e.preventDefault();
                const form = e.currentTarget
                  .closest("[data-vaul-drawer]")
                  ?.querySelector("form") as HTMLFormElement;
                if (form) {
                  const formEvent = new Event("submit", {
                    bubbles: true,
                    cancelable: true,
                  });
                  form.dispatchEvent(formEvent);
                }
              }}
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}

// ------x------
// COLUMN DEFINITIONS
// ------x------
// Define all the columns for our data table
// This includes special columns for drag handles and row selection checkboxes
const createColumns = (
  onRefresh: () => void
): ColumnDef<z.infer<typeof schema>>[] => [
  {
    id: "drag",
    header: () => null,
    cell: ({ row }) => <DragHandle id={row.original.id} />,
  },
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "user_name",
    header: "Customer Name",
    cell: ({ row }) => {
      return <TableCellViewer item={row.original} onRefresh={onRefresh} />;
    },
    enableHiding: false,
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => <div className="font-medium">{row.original.email}</div>,
  },
  {
    accessorKey: "total_price",
    header: "Total Price",
    cell: ({ row }) => (
      <div
        className="text-right font-medium"
        onClick={() =>
          toast(`Total Price: $${row.original.total_price.toFixed(2)}`)
        }
      >
        ${row.original.total_price.toFixed(2)}
      </div>
    ),
  },
  {
    accessorKey: "order_status",
    header: "Order Status",
    cell: ({ row }) => (
      <Badge variant="outline" className="text-muted-foreground px-1.5">
        {row.original.order_status === "Completed" ? (
          <IconCircleCheckFilled className="fill-green-500 dark:fill-green-400" />
        ) : (
          <IconLoader />
        )}
        {row.original.order_status || "Pending"}
      </Badge>
    ),
  },
  {
    accessorKey: "created_at",
    header: "Date Ordered",
    cell: ({ row }) => {
      // Format the ISO date string to a more readable format
      const date = new Date(row.original.created_at);
      return <div>{date.toLocaleDateString()}</div>;
    },
  },
  {
    accessorKey: "user_location",
    header: "Location",
    cell: ({ row }) => <div>{row.original.user_location}</div>,
  },
  {
    id: "actions",
    cell: ({ row }) => <ActionsCell row={row} onRefresh={onRefresh} />,
  },
];

// ------x------
// DRAGGABLE ROW COMPONENT
// ------x------
// This component wraps each table row with drag-and-drop functionality
// It applies the necessary CSS transforms when a row is being dragged
function DraggableRow({ row }: { row: Row<z.infer<typeof schema>> }) {
  // Get drag-and-drop functionality from useSortable hook
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.original.id,
  });

  return (
    <TableRow
      data-state={row.getIsSelected() && "selected"} // Apply styling when row is selected
      data-dragging={isDragging} // Apply styling during drag operation
      ref={setNodeRef} // Connect to the sortable library
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
      style={{
        transform: CSS.Transform.toString(transform), // Apply transformation during drag
        transition: transition, // Smooth transition animation
      }}
    >
      {/* Render each cell in the row */}
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
}

// ------x------
// MAIN DATA TABLE COMPONENT
// ------x------
// This is the primary component that puts everything together
// It handles data fetching, state management, and rendering
export function DataTable({
  data: initialData, // Optional initial data to use instead of API fetching
  apiUrl, // URL to fetch data from
}: {
  data?: z.infer<typeof schema>[];
  apiUrl: string;
}) {
  // Initialize state for data with either the provided initialData or a default test row
  const [data, setData] = React.useState<z.infer<typeof schema>[]>(
    () =>
      initialData || [
        // Single test row for when no data is provided
        {
          id: 1,
          user_name: "Test Customer",
          total_price: 99.99,
          order_status: "Completed",
          created_at: "2025-05-15T10:30:00.000Z",
          user_location: "Test Location",
          email: "test@example.com",
        },
      ]
  );
  const [loading, setLoading] = React.useState<boolean>(!initialData);
  const [error, setError] = React.useState<string | null>(null);
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const sortableId = React.useId();
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  ); // ------x------
  // API DATA FETCHING
  // ------x------
  // This effect fetches data from the API when the component mounts
  // It only runs if initialData is not provided
  const fetchData = React.useCallback(async () => {
    if (initialData) return; // Skip API call if initial data is provided

    try {
      setLoading(true);
      const response = await apiClient.get(apiUrl);
      const apiData = response.data; // Transform the API data to match your schema
      // We extract only the fields we need from the API response
      const apiDataArray = Array.isArray(apiData) ? apiData : [];
      const transformedData = apiDataArray.map(
        (item: Record<string, unknown>) => ({
          id: item.id as number,
          user_name: item.user_name as string,
          total_price:
            typeof item.total_price === "string"
              ? parseFloat(item.total_price)
              : (item.total_price as number),
          order_status: (item.order_status as string) || "Pending", // Default to "Pending" if empty
          created_at: item.created_at as string,
          user_location: item.user_location as string,
          email: item.email as string,
        })
      );
      setData(transformedData);
      setError(null);
    } catch {
      setError("Failed to load data. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, initialData]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]); // Re-fetch if apiUrl or initialData changes

  // Refresh function that can be called to reload data
  const refreshData = React.useCallback(() => {
    if (!initialData) {
      fetchData();
    }
  }, [fetchData, initialData]);

  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => data?.map(({ id }) => id) || [],
    [data]
  );

  // Create columns with refresh function
  const columns = React.useMemo(
    () => createColumns(refreshData),
    [refreshData]
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id.toString(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  // ------x------
  // ROW REORDERING HANDLER
  // ------x------
  // This function handles the end of a drag operation
  // It updates the data state to reflect the new row order
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setData((data) => {
        const oldIndex = dataIds.indexOf(active.id);
        const newIndex = dataIds.indexOf(over.id);
        return arrayMove(data, oldIndex, newIndex);
      });
    }
  }

  return (
    <Tabs
      defaultValue="outline"
      className="w-full flex-col justify-start gap-6"
    >
      <div className="flex items-center justify-between px-4 lg:px-6">
        <Label htmlFor="view-selector" className="sr-only">
          View
        </Label>
        <Select defaultValue="outline">
          <SelectTrigger
            className="flex w-fit @4xl/main:hidden"
            size="sm"
            id="view-selector"
          >
            <SelectValue placeholder="Select a view" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="outline">Outline</SelectItem>
            <SelectItem value="past-performance">Past Performance</SelectItem>
            <SelectItem value="key-personnel">Key Personnel</SelectItem>
            <SelectItem value="focus-documents">Focus Documents</SelectItem>
          </SelectContent>
        </Select>
        <TabsList className="**:data-[slot=badge]:bg-muted-foreground/30 hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:px-1 @4xl/main:flex">
          <TabsTrigger value="outline">Outline</TabsTrigger>
          <TabsTrigger value="past-performance">
            Past Performance <Badge variant="secondary">3</Badge>
          </TabsTrigger>
          <TabsTrigger value="key-personnel">
            Key Personnel <Badge variant="secondary">2</Badge>
          </TabsTrigger>
          <TabsTrigger value="focus-documents">Focus Documents</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <IconLayoutColumns />
                <span className="hidden lg:inline">Customize Columns</span>
                <span className="lg:hidden">Columns</span>
                <IconChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {table
                .getAllColumns()
                .filter(
                  (column) =>
                    typeof column.accessorFn !== "undefined" &&
                    column.getCanHide()
                )
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm">
            <IconPlus />
            <span className="hidden lg:inline">Add Section</span>
          </Button>
        </div>
      </div>
      <TabsContent
        value="outline"
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <IconLoader className="animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64 text-red-500">
            {error}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <DndContext
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragEnd={handleDragEnd}
              sensors={sensors}
              id={sortableId}
            >
              <Table>
                <TableHeader className="bg-muted sticky top-0 z-10">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => {
                        return (
                          <TableHead key={header.id} colSpan={header.colSpan}>
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody className="**:data-[slot=table-cell]:first:w-8">
                  {table.getRowModel().rows?.length ? (
                    <SortableContext
                      items={dataIds}
                      strategy={verticalListSortingStrategy}
                    >
                      {table.getRowModel().rows.map((row) => (
                        <DraggableRow key={row.id} row={row} />
                      ))}
                    </SortableContext>
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center"
                      >
                        No results.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </DndContext>
          </div>
        )}
        <div className="flex items-center justify-between px-4">
          <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
            {table.getFilteredSelectedRowModel().rows.length} of{" "}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                Rows per page
              </Label>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => {
                  table.setPageSize(Number(value));
                }}
              >
                <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                  <SelectValue
                    placeholder={table.getState().pagination.pageSize}
                  />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 40, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <IconChevronsLeft />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <IconChevronLeft />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <IconChevronRight />
              </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <IconChevronsRight />
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>
      <TabsContent
        value="past-performance"
        className="flex flex-col px-4 lg:px-6"
      >
        <div className="aspect-video w-full flex-1 rounded-lg border border-dashed"></div>
      </TabsContent>
      <TabsContent value="key-personnel" className="flex flex-col px-4 lg:px-6">
        <div className="aspect-video w-full flex-1 rounded-lg border border-dashed"></div>
      </TabsContent>
      <TabsContent
        value="focus-documents"
        className="flex flex-col px-4 lg:px-6"
      >
        <div className="aspect-video w-full flex-1 rounded-lg border border-dashed"></div>
      </TabsContent>
    </Tabs>
  );
}

// ------x------
// SAMPLE DATA FOR CHART
// ------x------
// This data is used to populate the chart in the detail view
// In a real application, this could come from an API or be generated dynamically
const chartData = [
  { month: "January", desktop: 186, mobile: 80 },
  { month: "February", desktop: 305, mobile: 200 },
  { month: "March", desktop: 237, mobile: 120 },
  { month: "April", desktop: 73, mobile: 190 },
  { month: "May", desktop: 209, mobile: 130 },
  { month: "June", desktop: 214, mobile: 140 },
];

// Configuration for the chart colors and labels
const chartConfig = {
  desktop: {
    label: "Desktop",
    color: "var(--primary)",
  },
  mobile: {
    label: "Mobile",
    color: "var(--primary)",
  },
} satisfies ChartConfig;

// ------x------
// TABLE CELL VIEWER COMPONENT
// ------x------
// This component provides a detailed view of a row when clicking on the name field
// It opens a drawer with additional information and form controls
function TableCellViewer({
  item,
  trigger,
  onRefresh,
}: {
  item: z.infer<typeof schema>;
  trigger?: React.ReactNode;
  onRefresh: () => void;
}) {
  // Check if the user is on a mobile device to change drawer direction
  const isMobile = useIsMobile();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);
      const updates = {
        user_name: formData.get("customer-name") as string,
        user_location: formData.get("location") as string,
        order_status: formData.get("order-status") as string,
        total_price: parseFloat(formData.get("total-price") as string),
      }; // Use apiClient which already includes authentication headers
      await apiClient.put(`/orders/${item.id}`, updates);

      toast.success(`Order #${item.id} has been updated`);
      onRefresh(); // Refresh the data to reflect the changes
    } catch (error) {
      toast.error("Failed to update order");
      console.error("Update error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const defaultTrigger = (
    <Button variant="link" className="text-foreground w-fit px-0 text-left">
      {item.user_name}
    </Button>
  );

  return (
    <Drawer direction={isMobile ? "bottom" : "right"}>
      <DrawerTrigger asChild>{trigger || defaultTrigger}</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="gap-1">
          <DrawerTitle>{item.user_name}</DrawerTitle>
          <DrawerDescription>Order details</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
          {!isMobile && (
            <>
              <ChartContainer config={chartConfig}>
                <AreaChart
                  accessibilityLayer
                  data={chartData}
                  margin={{
                    left: 0,
                    right: 10,
                  }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => value.slice(0, 3)}
                    hide
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" />}
                  />
                  <Area
                    dataKey="mobile"
                    type="natural"
                    fill="var(--color-mobile)"
                    fillOpacity={0.6}
                    stroke="var(--color-mobile)"
                    stackId="a"
                  />
                  <Area
                    dataKey="desktop"
                    type="natural"
                    fill="var(--color-desktop)"
                    fillOpacity={0.4}
                    stroke="var(--color-desktop)"
                    stackId="a"
                  />
                </AreaChart>
              </ChartContainer>
              <Separator />
              <div className="grid gap-2">
                <div className="flex gap-2 leading-none font-medium">
                  Trending up by 5.2% this month{" "}
                  <IconTrendingUp className="size-4" />
                </div>
                <div className="text-muted-foreground">
                  Showing total visitors for the last 6 months. This is just
                  some random text to test the layout. It spans multiple lines
                  and should wrap around.
                </div>
              </div>
              <Separator />{" "}
            </>
          )}{" "}
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-3">
              <Label htmlFor="customer-name">Customer Name</Label>
              <Input
                id="customer-name"
                name="customer-name"
                defaultValue={item.user_name}
              />
            </div>
            <div className="flex flex-col gap-3">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                defaultValue={item.email}
                disabled
                className="opacity-50"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be modified
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <Label htmlFor="total-price">Total Price</Label>
                <Input
                  id="total-price"
                  name="total-price"
                  type="number"
                  step="0.01"
                  defaultValue={item.total_price.toString()}
                />
              </div>
              <div className="flex flex-col gap-3">
                <Label htmlFor="order-status">Order Status</Label>
                <Select
                  name="order-status"
                  defaultValue={item.order_status || "Pending"}
                >
                  <SelectTrigger id="order-status" className="w-full">
                    <SelectValue placeholder="Select a status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <Label htmlFor="created-at">Date Ordered</Label>
                <Input
                  id="created-at"
                  name="created-at"
                  defaultValue={new Date(item.created_at).toLocaleDateString()}
                  disabled
                  className="opacity-50"
                />
                <p className="text-xs text-muted-foreground">
                  Date cannot be modified
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  name="location"
                  defaultValue={item.user_location}
                />
              </div>
            </div>
          </form>
        </div>
        <DrawerFooter>
          <Button
            type="submit"
            disabled={isSubmitting}
            onClick={(e) => {
              e.preventDefault();
              const form = e.currentTarget
                .closest("[data-vaul-drawer]")
                ?.querySelector("form") as HTMLFormElement;
              if (form) {
                const formEvent = new Event("submit", {
                  bubbles: true,
                  cancelable: true,
                });
                form.dispatchEvent(formEvent);
              }
            }}
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
          <DrawerClose asChild>
            <Button variant="outline">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
