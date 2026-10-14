import { NextResponse } from "next/server";
import { UserIdSchema } from "@/lib/http";
import { listAudit } from "@/lib/repo/audit";
import { getEmployee } from "@/lib/repo/employees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /audit?user_id=1 — the operations log, readable by the manager only. */
export async function GET(request: Request) {
  const userId = UserIdSchema.safeParse(new URL(request.url).searchParams.get("user_id"));
  if (!userId.success) return NextResponse.json({ error: "user_id is required" }, { status: 400 });

  const actor = await getEmployee(userId.data);
  if (!actor) return NextResponse.json({ error: "unknown user" }, { status: 404 });
  if (actor.role !== "manager") {
    return NextResponse.json({ error: "سجل العمليات متاح للمدير فقط." }, { status: 403 });
  }
  return NextResponse.json({ entries: await listAudit(200) });
}
