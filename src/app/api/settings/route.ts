import { NextRequest, NextResponse } from "next/server";
import { getTurfSettings, updateTurfSettings } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import type { TurfSettings } from "@/types/booking";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getTurfSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("[GET /api/settings]", error);
    return NextResponse.json(
      { error: "Failed to load turf settings." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authenticated = await isAdminAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as Partial<TurfSettings>;

    if (!Array.isArray(body.tiers) || body.tiers.length === 0) {
      return NextResponse.json(
        { error: "At least one pricing tier is required." },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.time_slots) || body.time_slots.length === 0) {
      return NextResponse.json(
        { error: "At least one daily time slot is required." },
        { status: 400 }
      );
    }

    const sanitized: TurfSettings = {
      tiers: body.tiers
        .map((t) => ({
          players_per_team: Math.max(2, Math.min(22, Number(t.players_per_team) || 5)),
          label: String(t.label || `${t.players_per_team}v${t.players_per_team}`),
          total_price: Math.max(0, Number(t.total_price) || 0),
          advance_amount: Math.max(0, Number(t.advance_amount) || 0),
        }))
        .sort((a, b) => a.players_per_team - b.players_per_team),
      custom_base_players: Math.max(2, Number(body.custom_base_players) || 5),
      custom_base_total: Math.max(0, Number(body.custom_base_total) || 2500),
      custom_base_advance: Math.max(0, Number(body.custom_base_advance) || 1200),
      custom_per_player_total: Math.max(
        0,
        Number(body.custom_per_player_total) || 500
      ),
      custom_per_player_advance: Math.max(
        0,
        Number(body.custom_per_player_advance) || 200
      ),
      admin_whatsapp_number: String(body.admin_whatsapp_number || "").replace(
        /[^\d]/g,
        ""
      ),
      time_slots: body.time_slots
        .map((s) => String(s).trim())
        .filter((s) => s.length > 0),
    };

    const updated = await updateTurfSettings(sanitized);
    return NextResponse.json({ settings: updated });
  } catch (error) {
    console.error("[PUT /api/settings]", error);
    return NextResponse.json(
      { error: "Failed to save turf settings." },
      { status: 500 }
    );
  }
}
