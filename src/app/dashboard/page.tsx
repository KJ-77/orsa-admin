import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { DataTable } from "@/components/data-table";
import { SectionCards } from "@/components/section-cards";
import { ProtectedRoute } from "@/components/protected-route";

export default function Page() {
  return (
    <ProtectedRoute>
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <SectionCards />{" "}
            <div className="px-4 lg:px-6">
              <ChartAreaInteractive />
            </div>
            {/* Fetch orders from API */}
            <DataTable apiUrl="/orders" />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
