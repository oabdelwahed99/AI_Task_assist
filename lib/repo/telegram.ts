import { collections } from "@/lib/db/client";

export async function linkTelegramChat(chatId: string, userId: number): Promise<void> {
  const { telegramLinks } = await collections();
  await telegramLinks.updateOne({ _id: chatId }, { $set: { userId, linkedAt: new Date() } }, { upsert: true });
}

export async function getLinkedUserId(chatId: string): Promise<number | null> {
  const { telegramLinks } = await collections();
  const doc = await telegramLinks.findOne({ _id: chatId });
  return doc?.userId ?? null;
}
