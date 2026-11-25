import { NextRequest, NextResponse } from "next/server";
import { SlotUnavailableError, updateBookingStatus } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import type { BookingStatus } from "@/types/booking";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ bookingId: string }> }
) {
  try {
    const authenticated = await isAdminAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { bookingId } = await context.params;
    const body = await request.json();
    const status = String(body.status || "") as BookingStatus;

    if (!["pending", "confirmed", "cancelled"].includes(status)) {
      return NextResponse.json(
        { error: "Status must be pending, confirmed, or cancelled." },
        { status: 400 }
      );
    }

    const updated = await updateBookingStatus(bookingId, status);
    if (!updated) {
      return NextResponse.json(
        { error: "Booking not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ booking: updated });
  } catch (error) {
    if (error instanceof SlotUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[PATCH /api/bookings/[bookingId]]", error);
    return NextResponse.json(
      { error: "Failed to update booking status." },
      { status: 500 }
    );
  }
}
