import type {
  Booking,
  WebhookDeliveryStatus,
  WebhookPayload,
} from "@/types/booking";

export async function triggerBookingWebhook(
  booking: Booking
): Promise<WebhookDeliveryStatus> {
  const webhookUrl = process.env.ADMIN_WEBHOOK_URL?.trim();

  if (!webhookUrl) {
    return "skipped";
  }

  const payload: WebhookPayload = {
    booking_id: booking.booking_id,
    customer_name: booking.customer_name,
    customer_phone: booking.customer_phone,
    team_name: booking.team_name,
    date: booking.match_date,
    time_slot: booking.time_slot,
    players_per_team: booking.players_per_team,
    total_amount: booking.total_amount,
    advance_amount: booking.advance_amount,
    status: booking.status,
    created_at: booking.created_at,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "TurfBookingSystem/1.0",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(
        `[Webhook] Failed with status ${response.status} for ${booking.booking_id}`
      );
      return "failed";
    }

    return "sent";
  } catch (error) {
    console.error(`[Webhook] Request error for ${booking.booking_id}:`, error);
    return "failed";
  } finally {
    clearTimeout(timeout);
  }
}
