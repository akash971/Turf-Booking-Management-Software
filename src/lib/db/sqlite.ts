import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
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

export class SlotUnavailableError extends Error {
  constructor(message = "This time slot is already booked or pending verification.") {
    super(message);
    this.name = "SlotUnavailableError";
  }
}

interface SqliteStatement {
  run: (...params: unknown[]) => { changes: number; lastInsertRowid: number };
  get: (...params: unknown[]) => Record<string, unknown> | undefined;
  all: (...params: unknown[]) => Record<string, unknown>[];
}

interface SqliteDatabase {
  exec: (sql: string) => void;
  prepare: (sql: string) => SqliteStatement;
}

let sqliteInstance: SqliteDatabase | null = null;

function loadSqliteModule(): { DatabaseSync: new (path: string) => SqliteDatabase } {
  const builtinLoader = (
    process as unknown as { getBuiltinModule?: (name: string) => unknown }
  ).getBuiltinModule;
  if (typeof builtinLoader === "function") {
    const mod = builtinLoader("node:sqlite") as
      | { DatabaseSync: new (path: string) => SqliteDatabase }
      | undefined;
    if (mod?.DatabaseSync) return mod;
  }
  const req = createRequire(import.meta.url);
  return req("node:sqlite") as {
    DatabaseSync: new (path: string) => SqliteDatabase;
  };
}

function getSqliteDb(): SqliteDatabase {
  if (sqliteInstance) return sqliteInstance;

  const dbPathEnv = process.env.SQLITE_DB_PATH || "./data/turf-bookings.db";
  const resolvedPath = path.isAbsolute(dbPathEnv)
    ? dbPathEnv
    : path.join(process.cwd(), dbPathEnv);

  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const { DatabaseSync } = loadSqliteModule();
  const db = new DatabaseSync(resolvedPath);

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS pricing_settings (
      players_per_team INTEGER PRIMARY KEY,
      label TEXT NOT NULL,
      total_price INTEGER NOT NULL,
      advance_amount INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS turf_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id TEXT NOT NULL UNIQUE,
      match_date TEXT NOT NULL,
      time_slot TEXT NOT NULL,
      players_per_team INTEGER NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      team_name TEXT,
      total_amount INTEGER NOT NULL,
      advance_amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
      webhook_status TEXT NOT NULL DEFAULT 'skipped',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_slot
      ON bookings (match_date, time_slot)
      WHERE status IN ('pending', 'confirmed');

    CREATE INDEX IF NOT EXISTS idx_bookings_match_date ON bookings (match_date);
    CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);
    CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings (created_at);
  `);

  seedDefaults(db);
  sqliteInstance = db;
  return db;
}

function seedDefaults(db: SqliteDatabase): void {
  const now = new Date().toISOString();

  const tierCount = db
    .prepare("SELECT COUNT(*) as count FROM pricing_settings")
    .get();
  if (!tierCount || Number(tierCount.count) === 0) {
    const insertTier = db.prepare(
      "INSERT OR IGNORE INTO pricing_settings (players_per_team, label, total_price, advance_amount, updated_at) VALUES (?, ?, ?, ?, ?)"
    );
    for (const tier of DEFAULT_TURF_SETTINGS.tiers) {
      insertTier.run(
        tier.players_per_team,
        tier.label,
        tier.total_price,
        tier.advance_amount,
        now
      );
    }
  }

  const insertCfg = db.prepare(
    "INSERT OR IGNORE INTO turf_config (key, value, updated_at) VALUES (?, ?, ?)"
  );
  const defaults: Record<string, string> = {
    custom_base_players: String(DEFAULT_TURF_SETTINGS.custom_base_players),
    custom_base_total: String(DEFAULT_TURF_SETTINGS.custom_base_total),
    custom_base_advance: String(DEFAULT_TURF_SETTINGS.custom_base_advance),
    custom_per_player_total: String(
      DEFAULT_TURF_SETTINGS.custom_per_player_total
    ),
    custom_per_player_advance: String(
      DEFAULT_TURF_SETTINGS.custom_per_player_advance
    ),
    admin_whatsapp_number: DEFAULT_TURF_SETTINGS.admin_whatsapp_number,
    time_slots: JSON.stringify(DEFAULT_TIME_SLOTS),
  };

  for (const [k, v] of Object.entries(defaults)) {
    insertCfg.run(k, v, now);
  }
}

function mapBookingRow(row: Record<string, unknown>): Booking {
  return {
    id: Number(row.id),
    booking_id: String(row.booking_id),
    match_date: String(row.match_date),
    time_slot: String(row.time_slot),
    players_per_team: Number(row.players_per_team),
    customer_name: String(row.customer_name),
    customer_phone: String(row.customer_phone),
    team_name: row.team_name ? String(row.team_name) : null,
    total_amount: Number(row.total_amount),
    advance_amount: Number(row.advance_amount),
    status: String(row.status) as BookingStatus,
    webhook_status: String(row.webhook_status || "skipped") as WebhookDeliveryStatus,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function generateBookingId(matchDate: string): string {
  const datePart = matchDate.replace(/-/g, "");
  const randomSuffix = crypto.randomInt(1000, 9999);
  return `TRF-${datePart}-${randomSuffix}`;
}

export async function sqliteGetTurfSettings(): Promise<TurfSettings> {
  const db = getSqliteDb();

  const tierRows = db
    .prepare(
      "SELECT players_per_team, label, total_price, advance_amount, updated_at FROM pricing_settings ORDER BY players_per_team ASC"
    )
    .all();

  const tiers: PricingTier[] =
    tierRows.length > 0
      ? tierRows.map((r) => ({
          players_per_team: Number(r.players_per_team),
          label: String(r.label),
          total_price: Number(r.total_price),
          advance_amount: Number(r.advance_amount),
          updated_at: String(r.updated_at),
        }))
      : DEFAULT_TURF_SETTINGS.tiers;

  const cfgRows = db.prepare("SELECT key, value FROM turf_config").all();
  const cfgMap = new Map<string, string>();
  for (const r of cfgRows) {
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

export async function sqliteUpdateTurfSettings(
  settings: TurfSettings
): Promise<TurfSettings> {
  const db = getSqliteDb();
  const now = new Date().toISOString();

  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM pricing_settings").run();
    const insertTier = db.prepare(
      "INSERT INTO pricing_settings (players_per_team, label, total_price, advance_amount, updated_at) VALUES (?, ?, ?, ?, ?)"
    );
    for (const tier of settings.tiers) {
      insertTier.run(
        Math.round(tier.players_per_team),
        tier.label.trim() || `${tier.players_per_team}v${tier.players_per_team}`,
        Math.max(0, Math.round(tier.total_price)),
        Math.max(0, Math.round(tier.advance_amount)),
        now
      );
    }

    const upsertCfg = db.prepare(
      "INSERT INTO turf_config (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
    );

    const pairs: [string, string][] = [
      ["custom_base_players", String(Math.round(settings.custom_base_players))],
      ["custom_base_total", String(Math.round(settings.custom_base_total))],
      ["custom_base_advance", String(Math.round(settings.custom_base_advance))],
      [
        "custom_per_player_total",
        String(Math.round(settings.custom_per_player_total)),
      ],
      [
        "custom_per_player_advance",
        String(Math.round(settings.custom_per_player_advance)),
      ],
      ["admin_whatsapp_number", settings.admin_whatsapp_number.trim()],
      ["time_slots", JSON.stringify(settings.time_slots)],
    ];

    for (const [k, v] of pairs) {
      upsertCfg.run(k, v, now);
    }

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return sqliteGetTurfSettings();
}

export async function sqliteGetSlotAvailability(
  matchDate: string
): Promise<SlotAvailability[]> {
  const db = getSqliteDb();
  const settings = await sqliteGetTurfSettings();

  const activeRows = db
    .prepare(
      "SELECT time_slot, status FROM bookings WHERE match_date = ? AND status IN ('pending', 'confirmed')"
    )
    .all(matchDate);

  const bookedMap = new Map<string, "pending" | "confirmed">();
  for (const row of activeRows) {
    bookedMap.set(
      String(row.time_slot),
      String(row.status) as "pending" | "confirmed"
    );
  }

  return settings.time_slots.map((slot) => {
    const existingStatus = bookedMap.get(slot);
    if (existingStatus) {
      return {
        time_slot: slot,
        available: false,
        status: existingStatus,
      };
    }
    return {
      time_slot: slot,
      available: true,
      status: "available",
    };
  });
}

export async function sqliteCreateBooking(
  input: CreateBookingInput
): Promise<Booking> {
  const db = getSqliteDb();
  const settings = await sqliteGetTurfSettings();
  const { totalAmount, advanceAmount } = calculatePrice(
    input.players_per_team,
    settings
  );

  const now = new Date().toISOString();
  let bookingId = generateBookingId(input.match_date);

  // Retry once if random 4-digit booking_id collided
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = db
        .prepare(
          `INSERT INTO bookings (
            booking_id, match_date, time_slot, players_per_team,
            customer_name, customer_phone, team_name,
            total_amount, advance_amount, status, webhook_status,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'skipped', ?, ?)`
        )
        .run(
          bookingId,
          input.match_date,
          input.time_slot,
          input.players_per_team,
          input.customer_name.trim(),
          input.customer_phone.trim(),
          input.team_name?.trim() || null,
          totalAmount,
          advanceAmount,
          now,
          now
        );

      const created = db
        .prepare("SELECT * FROM bookings WHERE id = ?")
        .get(result.lastInsertRowid);

      if (!created) {
        throw new Error("Failed to load created booking.");
      }

      return mapBookingRow(created);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (
        msg.includes("idx_unique_active_slot") ||
        (msg.includes("UNIQUE constraint failed") &&
          msg.includes("match_date"))
      ) {
        throw new SlotUnavailableError(
          `The slot "${input.time_slot}" on ${input.match_date} is already booked or pending verification.`
        );
      }
      if (msg.includes("bookings.booking_id") && attempt < 2) {
        bookingId = generateBookingId(input.match_date);
        continue;
      }
      throw error;
    }
  }

  throw new Error("Unable to generate unique booking ID.");
}

export async function sqliteListBookings(
  filter: BookingFilter = {}
): Promise<Booking[]> {
  const db = getSqliteDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.date && filter.date.trim()) {
    conditions.push("match_date = ?");
    params.push(filter.date.trim());
  }

  if (filter.status && filter.status !== "all") {
    conditions.push("status = ?");
    params.push(filter.status);
  }

  if (filter.search && filter.search.trim()) {
    const q = `%${filter.search.trim().toLowerCase()}%`;
    conditions.push(
      "(LOWER(booking_id) LIKE ? OR LOWER(customer_name) LIKE ? OR LOWER(customer_phone) LIKE ? OR LOWER(COALESCE(team_name, '')) LIKE ? OR LOWER(time_slot) LIKE ?)"
    );
    params.push(q, q, q, q, q);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = db
    .prepare(
      `SELECT * FROM bookings ${whereClause} ORDER BY created_at DESC, id DESC`
    )
    .all(...params);

  return rows.map(mapBookingRow);
}

export async function sqliteGetDashboardSummary(): Promise<DashboardSummary> {
  const db = getSqliteDb();
  const today = getTodayLocalISO();
  const rows = db.prepare("SELECT * FROM bookings").all().map(mapBookingRow);

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

export async function sqliteUpdateBookingStatus(
  bookingId: string,
  status: BookingStatus
): Promise<Booking | null> {
  const db = getSqliteDb();
  const existing = db
    .prepare("SELECT * FROM bookings WHERE booking_id = ?")
    .get(bookingId);

  if (!existing) return null;

  const now = new Date().toISOString();
  try {
    db.prepare(
      "UPDATE bookings SET status = ?, updated_at = ? WHERE booking_id = ?"
    ).run(status, now, bookingId);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("UNIQUE constraint failed")) {
      throw new SlotUnavailableError(
        "Cannot reactivate this booking because another active booking already holds this date and time slot."
      );
    }
    throw error;
  }

  const updated = db
    .prepare("SELECT * FROM bookings WHERE booking_id = ?")
    .get(bookingId);

  return updated ? mapBookingRow(updated) : null;
}

export async function sqliteUpdateBookingWebhookStatus(
  bookingId: string,
  webhookStatus: WebhookDeliveryStatus
): Promise<void> {
  const db = getSqliteDb();
  db.prepare(
    "UPDATE bookings SET webhook_status = ?, updated_at = ? WHERE booking_id = ?"
  ).run(webhookStatus, new Date().toISOString(), bookingId);
}
