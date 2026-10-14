import { NextResponse } from "next/server";
import { visibilityScope } from "@/lib/auth/permissions";
import { UserIdSchema } from "@/lib/http";
import { getEmployee } from "@/lib/repo/employees";
import { listTasksAs } from "@/lib/repo/tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/tasks?user_id=2 — every task the user is allowed to see (used by the demo UI side panel). */
export async function GET(request: Request) {
  const userId = UserIdSchema.safeParse(new URL(request.url).searchParams.get("user_id"));
  if (!userId.success) return NextResponse.json({ error: "user_id is required" }, { status: 400 });

  const actor = await getEmployee(userId.data);
  if (!actor) return NextResponse.json({ error: "unknown user" }, { status: 404 });

  const scope = visibilityScope(actor);
  const tasks = await listTasksAs(
    actor,
    scope.kind === "department" ? { kind: "department", department: scope.department } : { kind: scope.kind },
  );
  return NextResponse.json({ scope, tasks });
}
