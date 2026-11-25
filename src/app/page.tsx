import { getSlotAvailability, getTurfSettings } from "@/lib/db";
import { getTodayLocalISO } from "@/lib/pricing";
import { BookingClient } from "@/components/BookingClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const today = getTodayLocalISO();
  const [settings, initialSlots] = await Promise.all([
    getTurfSettings(),
    getSlotAvailability(today),
  ]);

  const turfName =
    process.env.NEXT_PUBLIC_TURF_NAME || "Emerald Arena Turf & Box Cricket";
  const turfLocation =
    process.env.NEXT_PUBLIC_TURF_LOCATION || "Sports Zone, Dhaka";

  return (
    <BookingClient
      initialDate={today}
      initialSettings={settings}
      initialSlots={initialSlots}
      turfName={turfName}
      turfLocation={turfLocation}
    />
  );
}
