import { NextRequest, NextResponse } from "next/server";
import { listBookings } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { generateBookingsExcelBuffer } from "@/lib/excel";
import { getTodayLocalISO } from "@/lib/pricing";
import type { BookingStatus } from "@/types/booking";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAdminAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const scope = searchParams.get("scope") || "filtered";

    let bookings;
    if (scope === "all") {
      bookings = await listBookings({});
    } else {
      const date = searchParams.get("date") || undefined;
      const statusParam = searchParams.get("status") || "all";
      const search = searchParams.get("search") || undefined;
      const validStatuses = new Set(["all", "pending", "confirmed", "cancelled"]);
      const status = (
        validStatuses.has(statusParam) ? statusParam : "all"
      ) as BookingStatus | "all";
      bookings = await listBookings({ date, status, search });
    }

    const excelBuffer = generateBookingsExcelBuffer(bookings);
    const today = getTodayLocalISO();
    const filename =
      scope === "all"
        ? `turf-bookings-all-${today}.xlsx`
        : `turf-bookings-${today}.xlsx`;

    return new NextResponse(new Uint8Array(excelBuffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/export]", error);
    return NextResponse.json(
      { error: "Failed to generate Excel export." },
      { status: 500 }
    );
  }
}
