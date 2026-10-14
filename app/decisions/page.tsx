import type { Metadata } from "next";
import { DecisionsPage } from "@/components/decisions-page";

export const metadata: Metadata = {
  title: "قرارات التصميم — مساعد المهام الذكي",
  description: "لماذا هذه الأدوات، التكلفة الشهرية لـ 100 موظف بمعدل 20 رسالة يومياً، وماذا يتحسن في أسبوع إضافي.",
};

export default function DecisionsRoute() {
  return <DecisionsPage />;
}
