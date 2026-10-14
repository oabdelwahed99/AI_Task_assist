import { ChatApp } from "@/components/chat-app";
import { listEmployees } from "@/lib/repo/employees";
import { SCENARIOS } from "@/lib/scenarios";

export const dynamic = "force-dynamic";

export default async function Home() {
  const employees = await listEmployees();
  return <ChatApp employees={employees} scenarios={SCENARIOS} />;
}
