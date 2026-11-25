import crypto from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  Booking,
  BookingFilter,
  BookingStatus,
  CreateBookingInput,
  DashboardSummary,
  PricingTier,
  SlotAvailability,
  TurfSettings,
  WebhookDeliveryStatus,
} from "@/types/booking";
import {
  DEFAULT_TIME_SLOTS,
  DEFAULT_TURF_SETTINGS,
  calculatePrice,
  getTodayLocalISO,
} from "@/lib/pricing";
import { SlotUnavailableError } from "./sqlite";

let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (supabaseClient) return supabaseClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase credentials missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or use DATABASE_PROVIDER=sqlite."
    );
  }

  supabaseClient = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
  return supabaseClient;
}

function generateBookingId(matchDate: string): string {
  const datePart = matchDate.replace(/-/g, "");
  const randomSuffix = crypto.randomInt(1000, 9999);
  return `TRF-${datePart}-${randomSuffix}`;
}

export async function supabaseGetTurfSettings(): Promise<TurfSettings> {
  const supabase = getSupabase();

  const [{ data: tierRows }, { data: cfgRows }] = await Promise.all([
    supabase
      .from("pricing_settings")
      .select("players_per_team, label, total_price, advance_amount, updated_at")
      .order("players_per_team", { ascending: true }),
    supabase.from("turf_config").select("key, value"),
  ]);

  const tiers: PricingTier[] =
    tierRows && tierRows.length > 0
      ? tierRows.map((r) => ({
          players_per_team: Number(r.players_per_team),
          label: String(r.label),
          total_price: Number(r.total_price),
          advance_amount: Number(r.advance_amount),
          updated_at: String(r.updated_at),
        }))
      : DEFAULT_TURF_SETTINGS.tiers;

  const cfgMap = new Map<string, string>();
  for (const r of cfgRows || []) {
    cfgMap.set(String(r.key), String(r.value));
  }

  let timeSlots = DEFAULT_TIME_SLOTS;
  const rawSlots = cfgMap.get("time_slots");
  if (rawSlots) {
    try {
      const parsed = JSON.parse(rawSlots);
      if (Array.isArray(parsed) && parsed.length > 0) {
        timeSlots = parsed.map(String);
      }
    } catch {
      timeSlots = DEFAULT_TIME_SLOTS;
    }
  }

  return {
    tiers,
    custom_base_players: Number(
      cfgMap.get("custom_base_players") ??
        DEFAULT_TURF_SETTINGS.custom_base_players
    ),
    custom_base_total: Number(
      cfgMap.get("custom_base_total") ?? DEFAULT_TURF_SETTINGS.custom_base_total
    ),
    custom_base_advance: Number(
      cfgMap.get("custom_base_advance") ??
        DEFAULT_TURF_SETTINGS.custom_base_advance
    ),
    custom_per_player_total: Number(
      cfgMap.get("custom_per_player_total") ??
        DEFAULT_TURF_SETTINGS.custom_per_player_total
    ),
    custom_per_player_advance: Number(
      cfgMap.get("custom_per_player_advance") ??
        DEFAULT_TURF_SETTINGS.custom_per_player_advance
    ),
    admin_whatsapp_number:
      cfgMap.get("admin_whatsapp_number") ??
      DEFAULT_TURF_SETTINGS.admin_whatsapp_number,
    time_slots: timeSlots,
  };
}

export async function supabaseUpdateTurfSettings(
  settings: TurfSettings
): Promise<TurfSettings> {
  const supabase = getSupabase();
  const now = new Date().toISOString();

  await supabase.from("pricing_settings").delete().gte("players_per_team", 0);

  const tierPayload = settings.tiers.map((tier) => ({
    players_per_team: Math.round(tier.players_per_team),
    label: tier.label.trim() || `${tier.players_per_team}v${tier.players_per_team}`,
    total_price: Math.max(0, Math.round(tier.total_price)),
    advance_amount: Math.max(0, Math.round(tier.advance_amount)),
    updated_at: now,
  }));

  const { error: tierErr } = await supabase
    .from("pricing_settings")
    .insert(tierPayload);
  if (tierErr) throw new Error(tierErr.message);

  const cfgPayload = [
    {
      key: "custom_base_players",
      value: String(Math.round(settings.custom_base_players)),
      updated_at: now,
    },
    {
      key: "custom_base_total",
      value: String(Math.round(settings.custom_base_total)),
      updated_at: now,
    },
    {
      key: "custom_base_advance",
      value: String(Math.round(settings.custom_base_advance)),
      updated_at: now,
    },
    {
      key: "custom_per_player_total",
      value: String(Math.round(settings.custom_per_player_total)),
      updated_at: now,
    },
    {
      key: "custom_per_player_advance",
      value: String(Math.round(settings.custom_per_player_advance)),
      updated_at: now,
    },
    {
      key: "admin_whatsapp_number",
      value: settings.admin_whatsapp_number.trim(),
      updated_at: now,
    },
    {
      key: "time_slots",
      value: JSON.stringify(settings.time_slots),
      updated_at: now,
    },
  ];

  const { error: cfgErr } = await supabase
    .from("turf_config")
    .upsert(cfgPayload, { onConflict: "key" });
  if (cfgErr) throw new Error(cfgErr.message);

  return supabaseGetTurfSettings();
}

export async function supabaseGetSlotAvailability(
  matchDate: string
): Promise<SlotAvailability[]> {
  const supabase = getSupabase();
  const settings = await supabaseGetTurfSettings();

  const { data, error } = await supabase
    .from("bookings")
    .select("time_slot, status")
    .eq("match_date", matchDate)
    .in("status", ["pending", "confirmed"]);

  if (error) throw new Error(error.message);

  const bookedMap = new Map<string, "pending" | "confirmed">();
  for (const row of data || []) {
    bookedMap.set(row.time_slot, row.status as "pending" | "confirmed");
  }

  return settings.time_slots.map((slot) => {
    const st = bookedMap.get(slot);
    return {
      time_slot: slot,
      available: !st,
      status: st || "available",
    };
  });
}

export async function supabaseCreateBooking(
  input: CreateBookingInput
): Promise<Booking> {
  const supabase = getSupabase();
  const settings = await supabaseGetTurfSettings();
  const { totalAmount, advanceAmount } = calculatePrice(
    input.players_per_team,
    settings
  );

  const now = new Date().toISOString();
  const bookingId = generateBookingId(input.match_date);

  const { data, error } = await supabase
    .from("bookings")
    .insert({
      booking_id: bookingId,
      match_date: input.match_date,
      time_slot: input.time_slot,
      players_per_team: input.players_per_team,
      customer_name: input.customer_name.trim(),
      customer_phone: input.customer_phone.trim(),
      team_name: input.team_name?.trim() || null,
      total_amount: totalAmount,
      advance_amount: advanceAmount,
      status: "pending",
      webhook_status: "skipped",
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new SlotUnavailableError(
        `The slot "${input.time_slot}" on ${input.match_date} is already booked or pending verification.`
      );
    }
    throw new Error(error.message);
  }

  return data as Booking;
}

export async function supabaseListBookings(
  filter: BookingFilter = {}
): Promise<Booking[]> {
  const supabase = getSupabase();
  let query = supabase
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false });

  if (filter.date && filter.date.trim()) {
    query = query.eq("match_date", filter.date.trim());
  }

  if (filter.status && filter.status !== "all") {
    query = query.eq("status", filter.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let rows = (data || []) as Booking[];

  if (filter.search && filter.search.trim()) {
    const q = filter.search.trim().toLowerCase();
    rows = rows.filter(
      (b) =>
        b.booking_id.toLowerCase().includes(q) ||
        b.customer_name.toLowerCase().includes(q) ||
        b.customer_phone.toLowerCase().includes(q) ||
        (b.team_name || "").toLowerCase().includes(q) ||
        b.time_slot.toLowerCase().includes(q)
    );
  }

  return rows;
}

export async function supabaseGetDashboardSummary(): Promise<DashboardSummary> {
  const supabase = getSupabase();
  const today = getTodayLocalISO();
  const { data, error } = await supabase.from("bookings").select("*");
  if (error) throw new Error(error.message);

  const rows = (data || []) as Booking[];
  let todaysBookings = 0;
  let pendingBookings = 0;
  let confirmedBookings = 0;
  let cancelledBookings = 0;
  let confirmedAdvance = 0;
  let pendingAdvance = 0;

  for (const b of rows) {
    if (b.match_date === today && b.status !== "cancelled") {
      todaysBookings++;
    }
    if (b.status === "pending") {
      pendingBookings++;
      pendingAdvance += b.advance_amount;
    } else if (b.status === "confirmed") {
      confirmedBookings++;
      confirmedAdvance += b.advance_amount;
    } else if (b.status === "cancelled") {
      cancelledBookings++;
    }
  }

  return {
    total_bookings: rows.length,
    todays_bookings: todaysBookings,
    pending_bookings: pendingBookings,
    confirmed_bookings: confirmedBookings,
    cancelled_bookings: cancelledBookings,
    total_advance_collected: confirmedAdvance,
    confirmed_advance_collected: confirmedAdvance,
    pending_advance_expected: pendingAdvance,
  };
}

export async function supabaseUpdateBookingStatus(
  bookingId: string,
  status: BookingStatus
): Promise<Booking | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("bookings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("booking_id", bookingId)
    .select("*")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      throw new SlotUnavailableError(
        "Cannot reactivate this booking because another active booking already holds this date and time slot."
      );
    }
    throw new Error(error.message);
  }

  return (data as Booking) || null;
}

export async function supabaseUpdateBookingWebhookStatus(
  bookingId: string,
  webhookStatus: WebhookDeliveryStatus
): Promise<void> {
  const supabase = getSupabase();
  await supabase
    .from("bookings")
    .update({ webhook_status: webhookStatus, updated_at: new Date().toISOString() })
    .eq("booking_id", bookingId);
}
