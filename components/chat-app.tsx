"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatAction } from "@/lib/agent/types";
import type { Employee } from "@/lib/db/schema";
import type { TaskView } from "@/lib/repo/tasks";
import type { Scenario } from "@/lib/scenarios";

type ChatApiResponse = {
  action: ChatAction;
  task_id: number | null;
  reply: string;
  reason?: string;
  run_id?: string;
  [key: string]: unknown;
};

type Message =
  | { id: number; kind: "user"; userId: number; text: string; scenarioId?: string }
  | { id: number; kind: "bot"; response: ChatApiResponse; scenarioId?: string };

const ROLE_LABELS: Record<Employee["role"], string> = { manager: "مدير", supervisor: "مشرف", employee: "موظف" };

const ACTION_STYLES: Record<ChatAction, { label: string; className: string }> = {
  create_task: { label: "إنشاء مهمة", className: "bg-emerald-100 text-emerald-800" },
  list_tasks: { label: "عرض مهام", className: "bg-sky-100 text-sky-800" },
  answer_policy: { label: "إجابة من السياسة", className: "bg-indigo-100 text-indigo-800" },
  info_not_available: { label: "غير متوفرة في السياسة", className: "bg-amber-100 text-amber-800" },
  clarify: { label: "طلب توضيح", className: "bg-amber-100 text-amber-800" },
  rejected: { label: "رفض", className: "bg-rose-100 text-rose-800" },
  error: { label: "خطأ", className: "bg-slate-200 text-slate-700" },
};

let nextId = 1;

export function ChatApp({ employees, scenarios }: { employees: Employee[]; scenarios: Scenario[] }) {
  const [userId, setUserId] = useState(employees[1]?.id ?? employees[0].id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [visibleTasks, setVisibleTasks] = useState<TaskView[]>([]);
  const [scenarioResults, setScenarioResults] = useState<Record<string, ChatAction>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const employeeById = (id: number) => employees.find((e) => e.id === id)!;
  const current = employeeById(userId);

  const refreshTasks = useCallback(async (id: number) => {
    const res = await fetch(`/api/tasks?user_id=${id}`);
    if (res.ok) setVisibleTasks((await res.json()).tasks);
  }, []);

  useEffect(() => {
    refreshTasks(userId);
  }, [userId, refreshTasks]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(senderId: number, text: string, scenarioId?: string) {
    setMessages((m) => [...m, { id: nextId++, kind: "user", userId: senderId, text, scenarioId }]);
    setBusy(true);
    try {
      const res = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: senderId, message: text }),
      });
      const response = (await res.json()) as ChatApiResponse;
      setMessages((m) => [...m, { id: nextId++, kind: "bot", response, scenarioId }]);
      if (scenarioId) setScenarioResults((r) => ({ ...r, [scenarioId]: response.action }));
    } catch {
      setMessages((m) => [
        ...m,
        { id: nextId++, kind: "bot", response: { action: "error", task_id: null, reply: "تعذر الاتصال بالخادم." } },
      ]);
    } finally {
      setBusy(false);
      await refreshTasks(senderId);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    await send(userId, text);
  }

  async function runScenario(s: Scenario) {
    setUserId(s.userId);
    await send(s.userId, s.message, s.id);
  }

  async function runAll() {
    for (const s of scenarios) await runScenario(s);
  }

  async function reset() {
    const res = await fetch("/api/reset", { method: "POST" });
    if (!res.ok) {
      alert("إعادة التعيين معطّلة (ENABLE_DEMO_RESET).");
      return;
    }
    setMessages([]);
    setScenarioResults({});
    await refreshTasks(userId);
  }

  return (
    <div className="mx-auto grid min-h-screen max-w-[1500px] grid-cols-1 gap-4 p-4 lg:h-screen lg:grid-cols-[300px_1fr_340px]">
      {/* Users + scenarios */}
      <aside className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h1 className="text-lg font-bold text-wa-teal">مساعد المهام الذكي</h1>
          <p className="mt-1 text-xs text-slate-500">Next.js + LangGraph + LangSmith · الصلاحيات تُطبّق في الكود وقاعدة البيانات</p>
          <Link href="/decisions" className="mt-3 inline-flex rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-wa-teal hover:bg-slate-200">
            قرارات التصميم
          </Link>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-600">المرسل (يحاكي رقم الواتساب)</h2>
          <ul className="space-y-1">
            {employees.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => setUserId(e.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-right text-sm transition ${
                    e.id === userId ? "bg-wa-teal text-white" : "hover:bg-slate-100"
                  }`}
                >
                  <span>
                    {e.name} <span className="opacity-60">#{e.id}</span>
                  </span>
                  <span className="text-xs opacity-80">
                    {ROLE_LABELS[e.role]} · {e.department}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-600">رسائل الاختبار T01–T10</h2>
            <div className="flex gap-2">
              <button onClick={reset} disabled={busy} className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-40">
                تصفير
              </button>
              <button onClick={runAll} disabled={busy} className="rounded-md bg-wa-green px-3 py-1 text-xs font-semibold text-white disabled:opacity-40">
                تشغيل الكل
              </button>
            </div>
          </div>
          <ol className="space-y-2">
            {scenarios.map((s) => {
              const action = scenarioResults[s.id];
              return (
                <li key={s.id}>
                  <button
                    onClick={() => runScenario(s)}
                    disabled={busy}
                    className="w-full rounded-lg border border-slate-200 p-2 text-right text-xs hover:border-wa-teal disabled:opacity-60"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-wa-teal">{s.id}</span>
                      <span className="text-slate-500">{s.sender}</span>
                    </div>
                    <p className="mt-1 text-slate-800">{s.message}</p>
                    <p className="mt-1 text-slate-400">المتوقع: {s.expected}</p>
                    {action && <ActionBadge action={action} className="mt-1" />}
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      </aside>

      {/* Chat */}
      <main className="flex h-[75vh] min-h-0 flex-col overflow-hidden rounded-2xl shadow-sm lg:h-auto">
        <header className="flex items-center gap-3 bg-wa-teal px-4 py-3 text-white">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 font-bold">م</div>
          <div>
            <p className="font-semibold">مساعد المهام</p>
            <p className="text-xs opacity-80">
              تكتب الآن باسم: {current.name} ({ROLE_LABELS[current.role]} – {current.department})
            </p>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-wa-bg p-4">
          {messages.length === 0 && (
            <p className="mx-auto mt-10 max-w-md rounded-lg bg-white/80 p-4 text-center text-sm text-slate-600">
              اختر المرسل واكتب رسالة، أو شغّل رسائل الاختبار من القائمة. جرّب: «سجل مهمة لخالد بكرة الساعة 10 يراجع العقد»
            </p>
          )}
          {messages.map((m) =>
            m.kind === "user" ? (
              <div key={m.id} className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-wa-bubble px-3 py-2 shadow-sm">
                  <p className="text-xs font-semibold text-wa-teal">
                    {m.scenarioId && <span className="font-mono">{m.scenarioId} · </span>}
                    {employeeById(m.userId).name}
                  </p>
                  <p className="whitespace-pre-line">{m.text}</p>
                </div>
              </div>
            ) : (
              <BotBubble key={m.id} response={m.response} />
            ),
          )}
          {busy && (
            <div className="flex justify-end">
              <div className="rounded-2xl bg-white px-4 py-2 text-sm text-slate-400 shadow-sm">يكتب…</div>
            </div>
          )}
        </div>

        <form onSubmit={onSubmit} className="flex gap-2 bg-slate-50 p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`اكتب رسالة كـ ${current.name}…`}
            className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 outline-none focus:border-wa-teal"
          />
          <button type="submit" disabled={busy || !input.trim()} className="rounded-full bg-wa-teal px-5 text-white disabled:opacity-40">
            إرسال
          </button>
        </form>
      </main>

      {/* Visible tasks */}
      <aside className="flex max-h-[60vh] min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-sm lg:max-h-none">
        <div className="border-b border-slate-100 p-4">
          <h2 className="text-sm font-semibold text-slate-600">المهام التي يحق لـ {current.name} رؤيتها</h2>
          <p className="mt-1 text-xs text-slate-400">
            {current.role === "manager" ? "المدير: كل المهام" : current.role === "supervisor" ? `المشرف: مهام قسم ${current.department}` : "الموظف: مهامه فقط"}
          </p>
        </div>
        <ul className="flex-1 space-y-2 overflow-y-auto p-4">
          {visibleTasks.length === 0 && <li className="text-sm text-slate-400">لا توجد مهام.</li>}
          {visibleTasks.map((t) => (
            <li key={t.id} className="rounded-lg border border-slate-100 p-3 text-sm">
              <div className="flex justify-between">
                <span className="font-semibold">#{t.id} {t.description}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {t.assigneeName} · {t.dueDate}
                {t.dueTime ? ` ${t.dueTime}` : ""}
                {t.movedFromDate && <span className="text-amber-600"> · مرحّلة من الجمعة {t.movedFromDate}</span>}
              </p>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function ActionBadge({ action, className = "" }: { action: ChatAction; className?: string }) {
  const style = ACTION_STYLES[action] ?? ACTION_STYLES.error;
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.className} ${className}`}>
      {style.label} <span className="font-mono opacity-60">{action}</span>
    </span>
  );
}

function BotBubble({ response }: { response: ChatApiResponse }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 shadow-sm">
        <ActionBadge action={response.action} />
        <p className="mt-1 whitespace-pre-line">{response.reply}</p>
        <details className="mt-2 text-xs text-slate-500">
          <summary className="cursor-pointer select-none">JSON</summary>
          <pre dir="ltr" className="mt-1 max-h-64 overflow-auto rounded bg-slate-900 p-2 text-left text-[11px] text-slate-100">
            {JSON.stringify(response, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}
