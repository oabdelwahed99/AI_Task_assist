import { NextResponse } from "next/server";
import { z } from "zod";
import { handleChat } from "@/lib/chat/handle-chat";
import { flushTracesAfterResponse, UserIdSchema } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ChatRequestSchema = z.object({
  user_id: UserIdSchema,
  message: z.string().trim().min(1).max(1000),
});

/**
 * POST /chat  { "user_id": 2, "message": "..." }
 *          →  { "action": "create_task", "task_id": 12, "reply": "...", ... }
 *
 * `user_id` identifies the sender; their role is always read from the database.
 * In production it would come from the authenticated channel (e.g. the WhatsApp number), not the client.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ action: "error", reply: "صيغة الطلب غير صحيحة (JSON)." }, { status: 400 });
  }

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { action: "error", reply: "الطلب يجب أن يحتوي على user_id (رقم) و message (نص).", issues: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  const result = await handleChat({ userId: parsed.data.user_id, message: parsed.data.message, channel: "api" });
  flushTracesAfterResponse();

  const status = result.reason === "unknown_user" ? 404 : result.action === "error" ? 500 : 200;
  const { action, task_id, reply, ...details } = result;
  return NextResponse.json({ action, task_id: task_id ?? null, reply, ...details }, { status });
}
