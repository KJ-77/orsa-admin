import { OrderDetails } from "@/components/order-details";
import { ProtectedRoute } from "@/components/protected-route";

interface OrderPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function OrderPage({ params }: OrderPageProps) {
  const { id } = await params;

  return (
    <ProtectedRoute>
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <OrderDetails orderId={id} />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
