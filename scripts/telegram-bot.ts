/**
 * Telegram demo channel (long polling — no public URL or tunnel needed).
 *
 *   pnpm telegram
 *
 * In Telegram: /start, then /as 2 to act as سارة, then chat normally.
 * The /as command stands in for real identity (e.g. a verified WhatsApp number). Whatever the
 * linked user writes, permissions still come from their role in the database.
 */
import "./load-env";
import { awaitAllCallbacks } from "@langchain/core/callbacks/promises";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { handleChat } from "@/lib/chat/handle-chat";
import { getEmployee, listEmployees } from "@/lib/repo/employees";
import { getLinkedUserId, linkTelegramChat } from "@/lib/repo/telegram";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN is missing. Create a bot with @BotFather and add the token to .env.");
  process.exit(1);
}
if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is missing.");
  process.exit(1);
}

const api = async <T>(method: string, body: Record<string, unknown> = {}): Promise<T> => {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; result: T; description?: string };
  if (!json.ok) throw new Error(`Telegram ${method} failed: ${json.description}`);
  return json.result;
};

type Update = { update_id: number; message?: { chat: { id: number }; text?: string } };

const sendMessage = (chatId: number, text: string) => api("sendMessage", { chat_id: chatId, text });

async function employeesText(): Promise<string> {
  const employees = await listEmployees();
  return employees.map((e) => `${e.id} — ${e.name} (${ROLE_LABELS[e.role]}، ${e.department})`).join("\n");
}

async function handleUpdate(update: Update) {
  const chatId = update.message?.chat.id;
  const text = update.message?.text?.trim();
  if (!chatId || !text) return;

  if (text === "/start" || text === "/help") {
    await sendMessage(
      chatId,
      `أهلاً بك في مساعد المهام الذكي.\nللتجربة اختر الموظف الذي تريد الكتابة باسمه:\n${await employeesText()}\n\nمثال: /as 2`,
    );
    return;
  }

  const asMatch = text.match(/^\/as\s+(\d+)$/);
  if (asMatch) {
    const employee = await getEmployee(Number(asMatch[1]));
    if (!employee) {
      await sendMessage(chatId, `رقم غير معروف. الموظفون:\n${await employeesText()}`);
      return;
    }
    await linkTelegramChat(String(chatId), employee.id);
    await sendMessage(chatId, `تم. تكتب الآن باسم ${employee.name} (${ROLE_LABELS[employee.role]} – ${employee.department}).`);
    return;
  }

  const userId = await getLinkedUserId(String(chatId));
  if (!userId) {
    await sendMessage(chatId, "اختر الموظف أولاً، مثال: /as 2 (اكتب /start لعرض القائمة).");
    return;
  }

  if (text === "/whoami") {
    const employee = await getEmployee(userId);
    await sendMessage(chatId, `${employee?.name} (${employee ? ROLE_LABELS[employee.role] : ""} – ${employee?.department})`);
    return;
  }

  await api("sendChatAction", { chat_id: chatId, action: "typing" });
  const result = await handleChat({ userId, message: text, channel: "telegram" });
  await sendMessage(chatId, result.reply);
}

let running = true;
process.on("SIGINT", () => {
  running = false;
  console.log("\nStopping…");
});

await api("deleteWebhook");
const me = await api<{ username: string }>("getMe");
console.log(`Telegram bot @${me.username} is polling. Press Ctrl+C to stop.`);

let offset = 0;
while (running) {
  try {
    const updates = await api<Update[]>("getUpdates", { offset, timeout: 25, allowed_updates: ["message"] });
    for (const update of updates) {
      offset = update.update_id + 1;
      await handleUpdate(update).catch((error) => console.error("[telegram] update failed", error));
    }
  } catch (error) {
    console.error("[telegram] polling error", error);
    await new Promise((r) => setTimeout(r, 3000));
  }
}

await awaitAllCallbacks();
process.exit(0);
