import type { Booking, TurfSettings } from "@/types/booking";

export const DEFAULT_TIME_SLOTS = [
  "08:00 AM – 09:30 AM",
  "10:00 AM – 11:30 AM",
  "04:00 PM – 05:30 PM",
  "05:30 PM – 07:00 PM",
  "07:00 PM – 08:30 PM",
  "09:00 PM – 10:30 PM",
  "10:30 PM – 12:00 AM",
];

export const DEFAULT_TURF_SETTINGS: TurfSettings = {
  tiers: [
    {
      players_per_team: 5,
      label: "5v5 Standard",
      total_price: 2500,
      advance_amount: 1200,
    },
    {
      players_per_team: 6,
      label: "6v6 Popular",
      total_price: 3000,
      advance_amount: 1400,
    },
    {
      players_per_team: 7,
      label: "7v7 Full Box",
      total_price: 3500,
      advance_amount: 1600,
    },
  ],
  custom_base_players: 5,
  custom_base_total: 2500,
  custom_base_advance: 1200,
  custom_per_player_total: 500,
  custom_per_player_advance: 200,
  admin_whatsapp_number:
    process.env.NEXT_PUBLIC_ADMIN_WHATSAPP_NUMBER || "8801712345678",
  time_slots: DEFAULT_TIME_SLOTS,
};

export function calculatePrice(
  playersPerTeam: number,
  settings: TurfSettings
): { totalAmount: number; advanceAmount: number; tierLabel: string } {
  const safePlayers = Math.max(2, Math.min(22, Math.round(playersPerTeam || 5)));

  const matchedTier = settings.tiers.find(
    (t) => t.players_per_team === safePlayers
  );

  if (matchedTier) {
    return {
      totalAmount: matchedTier.total_price,
      advanceAmount: matchedTier.advance_amount,
      tierLabel: matchedTier.label,
    };
  }

  const diff = safePlayers - settings.custom_base_players;
  const rawTotal =
    settings.custom_base_total + diff * settings.custom_per_player_total;
  const rawAdvance =
    settings.custom_base_advance + diff * settings.custom_per_player_advance;

  const totalAmount = Math.max(1000, Math.round(rawTotal / 50) * 50);
  const advanceAmount = Math.max(
    500,
    Math.min(totalAmount, Math.round(rawAdvance / 50) * 50)
  );

  return {
    totalAmount,
    advanceAmount,
    tierLabel: `${safePlayers}v${safePlayers} Custom`,
  };
}

export function formatBDT(amount: number): string {
  return `৳${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

export function formatTeamSize(playersPerTeam: number): string {
  return `${playersPerTeam}v${playersPerTeam}`;
}

export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return dateStr;
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function getTodayLocalISO(): string {
  // Uses Asia/Dhaka (UTC+6) to align with Bangladesh turf operations
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

export function buildWhatsAppBookingUrl(
  booking: Pick<
    Booking,
    | "booking_id"
    | "match_date"
    | "time_slot"
    | "players_per_team"
    | "customer_name"
    | "customer_phone"
    | "team_name"
    | "total_amount"
    | "advance_amount"
  >,
  adminWhatsappNumber: string,
  turfName = "Emerald Arena Turf & Box Cricket"
): string {
  const cleanNumber = adminWhatsappNumber.replace(/[^\d]/g, "");
  const lines = [
    `🏟️ *New Turf Booking Confirmation*`,
    `📍 ${turfName}`,
    ``,
    `🆔 *Booking ID:* ${booking.booking_id}`,
    `📅 *Date:* ${formatDisplayDate(booking.match_date)} (${booking.match_date})`,
    `⏰ *Slot:* ${booking.time_slot}`,
    `⚽ *Format:* ${booking.players_per_team}v${booking.players_per_team} (${booking.players_per_team} players/team)`,
    `👤 *Name:* ${booking.customer_name}`,
    `📞 *Phone:* ${booking.customer_phone}`,
    ...(booking.team_name ? [`🏏 *Team:* ${booking.team_name}`] : []),
    `💰 *Total Amount:* ${formatBDT(booking.total_amount)}`,
    `✅ *Required Advance (Ogrim):* ${formatBDT(booking.advance_amount)}`,
    ``,
    `Please verify my slot and share payment details for the advance. Thank you!`,
  ];

  const encoded = encodeURIComponent(lines.join("\n"));
  return `https://wa.me/${cleanNumber}?text=${encoded}`;
}
