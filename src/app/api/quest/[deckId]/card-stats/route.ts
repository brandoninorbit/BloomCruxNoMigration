import { NextResponse } from "next/server";

// Deprecated route: per-card stats integration has been removed.
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json({ error: "per-card stats removed" }, { status: 410 });
}
