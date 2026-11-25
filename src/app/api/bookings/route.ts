import { NextRequest, NextResponse } from "next/server";
import {
  SlotUnavailableError,
  createBooking,
  getActiveDatabaseProvider,
  getDashboardSummary,
  getTurfSettings,
  listBookings,
  updateBookingWebhookStatus,
} from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { triggerBookingWebhook } from "@/lib/webhook";
import { buildWhatsAppBookingUrl, getTodayLocalISO } from "@/lib/pricing";
import type { BookingStatus } from "@/types/booking";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAdminAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const date = searchParams.get("date") || undefined;
    const statusParam = searchParams.get("status") || "all";
    const search = searchParams.get("search") || undefined;

    const validStatuses = new Set(["all", "pending", "confirmed", "cancelled"]);
    const status = (
      validStatuses.has(statusParam) ? statusParam : "all"
    ) as BookingStatus | "all";

    const [bookings, summary] = await Promise.all([
      listBookings({ date, status, search }),
      getDashboardSummary(),
    ]);

    return NextResponse.json({
      bookings,
      summary,
      database_provider: getActiveDatabaseProvider(),
      webhook_configured: Boolean(process.env.ADMIN_WEBHOOK_URL?.trim()),
    });
  } catch (error) {
    console.error("[GET /api/bookings]", error);
    return NextResponse.json(
      { error: "Failed to fetch bookings." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const matchDate = String(body.match_date || "").trim();
    const timeSlot = String(body.time_slot || "").trim();
    const playersPerTeam = Number(body.players_per_team);
    const customerName = String(body.customer_name || "").trim();
    const customerPhone = String(body.customer_phone || "").trim();
    const teamName = body.team_name ? String(body.team_name).trim() : undefined;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(matchDate)) {
      return NextResponse.json(
        { error: "Please select a valid upcoming date." },
        { status: 400 }
      );
    }

    const today = getTodayLocalISO();
    if (matchDate < today) {
      return NextResponse.json(
        { error: "You cannot book a slot in the past. Please choose today or an upcoming date." },
        { status: 400 }
      );
    }

    const settings = await getTurfSettings();
    if (!timeSlot || !settings.time_slots.includes(timeSlot)) {
      return NextResponse.json(
        { error: "Please select a valid time slot." },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(playersPerTeam) ||
      playersPerTeam < 2 ||
      playersPerTeam > 22
    ) {
      return NextResponse.json(
        { error: "Players per team must be a whole number between 2 and 22." },
        { status: 400 }
      );
    }

    if (customerName.length < 2) {
      return NextResponse.json(
        { error: "Please enter your full name." },
        { status: 400 }
      );
    }

    const digitsOnly = customerPhone.replace(/[^\d]/g, "");
    if (digitsOnly.length < 10 || digitsOnly.length > 15) {
      return NextResponse.json(
        {
          error:
            "Please enter a valid Phone / WhatsApp number (e.g. 017XXXXXXXX).",
        },
        { status: 400 }
      );
    }

    const booking = await createBooking({
      match_date: matchDate,
      time_slot: timeSlot,
      players_per_team: playersPerTeam,
      customer_name: customerName,
      customer_phone: customerPhone,
      team_name: teamName,
    });

    const webhookStatus = await triggerBookingWebhook(booking);
    if (webhookStatus !== booking.webhook_status) {
      await updateBookingWebhookStatus(booking.booking_id, webhookStatus);
      booking.webhook_status = webhookStatus;
    }

    const turfName =
      process.env.NEXT_PUBLIC_TURF_NAME || "Emerald Arena Turf & Box Cricket";
    const whatsappUrl = buildWhatsAppBookingUrl(
      booking,
      settings.admin_whatsapp_number,
      turfName
    );

    return NextResponse.json(
      {
        booking,
        whatsapp_url: whatsappUrl,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof SlotUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[POST /api/bookings]", error);
    return NextResponse.json(
      { error: "Could not complete your booking. Please try again." },
      { status: 500 }
    );
  }
}
