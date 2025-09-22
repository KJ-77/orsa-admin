"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  IconArrowLeft,
  IconCalendar,
  IconCreditCard,
  IconMapPin,
  IconMail,
  IconUser,
  IconPackage,
  IconShoppingCart,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

// Order data structure based on the actual API response
interface Order {
  id: number;
  user_name: string;
  total_price: number;
  order_status: string;
  created_at: string;
  user_location: string;
  email: string;
  first_name?: string;
  last_name?: string;
  user_id?: string;
  stripe_id?: string | null;
}

// Order item structure (based on the actual API response)
interface OrderItem {
  id: number;
  order_id: number;
  product_name: string;
  unit_price: string; // API returns as string
  quantity: number;
  total_price: string; // API returns as string
  product_id: number;
  product_description?: string;
}

// Internal structure for component state
interface OrderDetailsResponse {
  order: Order;
  order_items: OrderItem[];
}

interface OrderDetailsProps {
  orderId: string;
}

export function OrderDetails({ orderId }: OrderDetailsProps) {
  const router = useRouter();
  const [orderData, setOrderData] = React.useState<OrderDetailsResponse | null>(
    null
  );
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Use the provided API endpoint
        const response = await fetch(
          `https://rlg7ahwue7.execute-api.eu-west-3.amazonaws.com/orders/${orderId}`
        );

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Order not found");
          }
          throw new Error(`Failed to fetch order details: ${response.status}`);
        }

        const data = (await response.json()) as {
          id: number;
          user_name: string;
          user_location: string;
          order_status: string;
          total_price: number;
          created_at: string;
          user_id: string;
          stripe_id: string | null;
          first_name: string;
          last_name: string;
          email: string;
          items: OrderItem[];
        };

        // Transform the API response to our internal structure
        const order: Order = {
          id: data.id,
          user_name: data.user_name,
          total_price: data.total_price,
          order_status: data.order_status,
          created_at: data.created_at,
          user_location: data.user_location,
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          user_id: data.user_id,
          stripe_id: data.stripe_id,
        };

        const order_items: OrderItem[] = data.items || [];

        setOrderData({ order, order_items });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch order details";
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId]);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const formatPrice = (price: number | string) => {
    const numericPrice = typeof price === "string" ? parseFloat(price) : price;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(numericPrice);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-200";
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "processing":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  if (isLoading) {
    return (
      <div className="px-4 lg:px-6">
        <div className="mb-6">
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !orderData) {
    return (
      <div className="px-4 lg:px-6">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="mb-4"
          >
            <IconArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="text-red-500 mb-2">
                <IconPackage className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Order Not Found</h3>
              <p className="text-muted-foreground mb-4">
                {error || "The order you are looking for could not be found."}
              </p>
              <Button onClick={() => router.back()}>Return to Dashboard</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { order, order_items } = orderData;

  return (
    <div className="px-4 lg:px-6">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="mb-4"
        >
          <IconArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Order #{order.id}</h1>
            <p className="text-muted-foreground">
              Placed on {formatDate(order.created_at)}
            </p>
          </div>
          <Badge className={getStatusColor(order.order_status)}>
            {order.order_status}
          </Badge>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 md:grid-cols-2 mb-6">
        {/* Customer Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconUser className="h-5 w-5" />
              Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <IconUser className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">
                  {order.first_name && order.last_name
                    ? `${order.first_name} ${order.last_name}`
                    : order.user_name}
                </p>
                <p className="text-sm text-muted-foreground">Customer Name</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <IconMail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">{order.email}</p>
                <p className="text-sm text-muted-foreground">Email Address</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <IconMapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">{order.user_location}</p>
                <p className="text-sm text-muted-foreground">Location</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconShoppingCart className="h-5 w-5" />
              Order Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <IconCalendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">{formatDate(order.created_at)}</p>
                <p className="text-sm text-muted-foreground">Order Date</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <IconCreditCard className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium text-xl">
                  {formatPrice(order.total_price)}
                </p>
                <p className="text-sm text-muted-foreground">Total Amount</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <IconPackage className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">
                  {order_items.length} item{order_items.length !== 1 ? "s" : ""}
                </p>
                <p className="text-sm text-muted-foreground">Items Ordered</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Order Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconPackage className="h-5 w-5" />
            Order Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          {order_items.length === 0 ? (
            <div className="text-center py-8">
              <IconPackage className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No items found for this order
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {order_items.map((item, index) => (
                <div key={item.id}>
                  <div className="flex items-center justify-between py-4">
                    <div className="flex-1">
                      <h4 className="font-medium text-lg">
                        {item.product_name}
                      </h4>
                      {item.product_description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.product_description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span>Unit Price: {formatPrice(item.unit_price)}</span>
                        <span>Quantity: {item.quantity}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-lg">
                        {formatPrice(item.total_price)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatPrice(item.unit_price)} × {item.quantity}
                      </p>
                    </div>
                  </div>
                  {index < order_items.length - 1 && <Separator />}
                </div>
              ))}

              {/* Order Total */}
              <Separator className="my-4" />
              <div className="flex items-center justify-between py-4 bg-muted/50 rounded-lg px-4">
                <span className="font-semibold text-lg">
                  Total Order Amount:
                </span>
                <span className="font-bold text-2xl">
                  {formatPrice(order.total_price)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
