import { NextResponse } from "next/server";
import { resetDatabase } from "@/lib/db/client";
import { demoResetEnabled } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/reset — wipes tasks and the audit log. Demo only, disabled unless ENABLE_DEMO_RESET=true. */
export async function POST() {
  if (!demoResetEnabled()) return NextResponse.json({ error: "reset is disabled" }, { status: 403 });
  await resetDatabase();
  return NextResponse.json({ ok: true });
}
