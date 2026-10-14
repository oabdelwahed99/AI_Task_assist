import type { Employee } from "./schema";

export const DEPARTMENTS = ["الإدارة", "المشاريع", "المالية"] as const;

export const SEED_EMPLOYEES: Employee[] = [
  { id: 1, name: "منيرة", department: "الإدارة", role: "manager" },
  { id: 2, name: "سارة", department: "المشاريع", role: "supervisor" },
  { id: 3, name: "فهد", department: "المشاريع", role: "employee" },
  { id: 4, name: "خالد", department: "المشاريع", role: "employee" },
  { id: 5, name: "نورة", department: "المالية", role: "employee" },
  { id: 6, name: "عبدالرحمن", department: "المالية", role: "supervisor" },
];
