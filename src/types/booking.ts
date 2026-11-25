export type BookingStatus = "pending" | "confirmed" | "cancelled";

export type WebhookDeliveryStatus = "sent" | "failed" | "skipped";

export interface Booking {
  id: number;
  booking_id: string;
  match_date: string; // YYYY-MM-DD
  time_slot: string;
  players_per_team: number;
  customer_name: string;
  customer_phone: string;
  team_name: string | null;
  total_amount: number;
  advance_amount: number;
  status: BookingStatus;
  webhook_status: WebhookDeliveryStatus;
  created_at: string;
  updated_at: string;
}

export interface PricingTier {
  players_per_team: number;
  label: string;
  total_price: number;
  advance_amount: number;
  updated_at?: string;
}

export interface TurfSettings {
  tiers: PricingTier[];
  custom_base_players: number;
  custom_base_total: number;
  custom_base_advance: number;
  custom_per_player_total: number;
  custom_per_player_advance: number;
  admin_whatsapp_number: string;
  time_slots: string[];
}

export interface SlotAvailability {
  time_slot: string;
  available: boolean;
  status: "available" | "pending" | "confirmed";
}

export interface CreateBookingInput {
  match_date: string;
  time_slot: string;
  players_per_team: number;
  customer_name: string;
  customer_phone: string;
  team_name?: string;
}

export interface BookingFilter {
  date?: string;
  status?: BookingStatus | "all";
  search?: string;
}

export interface DashboardSummary {
  total_bookings: number;
  todays_bookings: number;
  pending_bookings: number;
  confirmed_bookings: number;
  cancelled_bookings: number;
  total_advance_collected: number;
  confirmed_advance_collected: number;
  pending_advance_expected: number;
}

export interface WebhookPayload {
  booking_id: string;
  customer_name: string;
  customer_phone: string;
  team_name: string | null;
  date: string;
  time_slot: string;
  players_per_team: number;
  total_amount: number;
  advance_amount: number;
  status: BookingStatus;
  created_at: string;
}
