import { NextResponse } from "next/server";
import { getActiveDatabaseProvider } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      provider: getActiveDatabaseProvider(),
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
