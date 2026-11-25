import { NextRequest, NextResponse } from "next/server";
import { getSlotAvailability } from "@/lib/db";
import { getTodayLocalISO } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const dateParam =
      request.nextUrl.searchParams.get("date") || getTodayLocalISO();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return NextResponse.json(
        { error: "Invalid date format. Expected YYYY-MM-DD." },
        { status: 400 }
      );
    }

    const slots = await getSlotAvailability(dateParam);
    return NextResponse.json({ date: dateParam, slots });
  } catch (error) {
    console.error("[GET /api/slots]", error);
    return NextResponse.json(
      { error: "Failed to load slot availability." },
      { status: 500 }
    );
  }
}
