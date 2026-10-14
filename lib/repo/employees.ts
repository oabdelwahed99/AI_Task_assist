import { collections } from "@/lib/db/client";
import type { Employee, EmployeeDoc } from "@/lib/db/schema";

function toEmployee({ _id, ...rest }: EmployeeDoc): Employee {
  return { id: _id, ...rest };
}

export async function getEmployee(id: number): Promise<Employee | null> {
  const { employees } = await collections();
  const doc = await employees.findOne({ _id: id });
  return doc ? toEmployee(doc) : null;
}

export async function listEmployees(): Promise<Employee[]> {
  const { employees } = await collections();
  return (await employees.find().sort({ _id: 1 }).toArray()).map(toEmployee);
}
