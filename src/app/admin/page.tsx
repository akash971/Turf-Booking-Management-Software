import { isAdminAuthenticated } from "@/lib/auth";
import { AdminDashboardClient } from "@/components/AdminDashboardClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const authenticated = await isAdminAuthenticated();
  const turfName =
    process.env.NEXT_PUBLIC_TURF_NAME || "Emerald Arena Turf & Box Cricket";

  return (
    <AdminDashboardClient
      initialAuthenticated={authenticated}
      turfName={turfName}
    />
  );
}
