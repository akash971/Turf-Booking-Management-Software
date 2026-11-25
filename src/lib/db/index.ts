import type {
  Booking,
  BookingFilter,
  BookingStatus,
  CreateBookingInput,
  DashboardSummary,
  SlotAvailability,
  TurfSettings,
  WebhookDeliveryStatus,
} from "@/types/booking";
import {
  SlotUnavailableError,
  sqliteCreateBooking,
  sqliteGetDashboardSummary,
  sqliteGetSlotAvailability,
  sqliteGetTurfSettings,
  sqliteListBookings,
  sqliteUpdateBookingStatus,
  sqliteUpdateBookingWebhookStatus,
  sqliteUpdateTurfSettings,
} from "./sqlite";
import {
  supabaseCreateBooking,
  supabaseGetDashboardSummary,
  supabaseGetSlotAvailability,
  supabaseGetTurfSettings,
  supabaseListBookings,
  supabaseUpdateBookingStatus,
  supabaseUpdateBookingWebhookStatus,
  supabaseUpdateTurfSettings,
} from "./supabase";

export { SlotUnavailableError };

function useSupabase(): boolean {
  return (
    process.env.DATABASE_PROVIDER?.toLowerCase() === "supabase" &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

export function getActiveDatabaseProvider(): "supabase" | "sqlite" {
  return useSupabase() ? "supabase" : "sqlite";
}

export async function getTurfSettings(): Promise<TurfSettings> {
  return useSupabase() ? supabaseGetTurfSettings() : sqliteGetTurfSettings();
}

export async function updateTurfSettings(
  settings: TurfSettings
): Promise<TurfSettings> {
  return useSupabase()
    ? supabaseUpdateTurfSettings(settings)
    : sqliteUpdateTurfSettings(settings);
}

export async function getSlotAvailability(
  matchDate: string
): Promise<SlotAvailability[]> {
  return useSupabase()
    ? supabaseGetSlotAvailability(matchDate)
    : sqliteGetSlotAvailability(matchDate);
}

export async function createBooking(
  input: CreateBookingInput
): Promise<Booking> {
  return useSupabase()
    ? supabaseCreateBooking(input)
    : sqliteCreateBooking(input);
}

export async function listBookings(
  filter?: BookingFilter
): Promise<Booking[]> {
  return useSupabase()
    ? supabaseListBookings(filter)
    : sqliteListBookings(filter);
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return useSupabase()
    ? supabaseGetDashboardSummary()
    : sqliteGetDashboardSummary();
}

export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus
): Promise<Booking | null> {
  return useSupabase()
    ? supabaseUpdateBookingStatus(bookingId, status)
    : sqliteUpdateBookingStatus(bookingId, status);
}

export async function updateBookingWebhookStatus(
  bookingId: string,
  status: WebhookDeliveryStatus
): Promise<void> {
  return useSupabase()
    ? supabaseUpdateBookingWebhookStatus(bookingId, status)
    : sqliteUpdateBookingWebhookStatus(bookingId, status);
}
