/** Billing lifecycle: H-7/H-3 reminders, H+1 overdue, H+7 suspend, H+30 terminate. */
export type Stage = "REMIND_7" | "REMIND_3" | "OVERDUE_1" | "SUSPEND_7" | "TERMINATE_30";
const ORDER: Stage[] = ["REMIND_7", "REMIND_3", "OVERDUE_1", "SUSPEND_7", "TERMINATE_30"];

export function daysFromDue(dueDate: string, today: Date): number {
  const due = Date.UTC(+dueDate.slice(0, 4), +dueDate.slice(5, 7) - 1, +dueDate.slice(8, 10));
  const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((t - due) / 86_400_000);
}

/** Highest stage reached today that is newer than the last stage already applied. */
export function nextStage(dueDate: string, today: Date, last: string | null): Stage | null {
  const d = daysFromDue(dueDate, today);
  const reached: Stage | null =
    d >= 30 ? "TERMINATE_30" : d >= 7 ? "SUSPEND_7" : d >= 1 ? "OVERDUE_1" : d >= -3 ? "REMIND_3" : d >= -7 ? "REMIND_7" : null;
  if (!reached) return null;
  const lastIdx = last ? ORDER.indexOf(last as Stage) : -1;
  return ORDER.indexOf(reached) > lastIdx ? reached : null;
}

/** Pro-rata charge for activation mid-month (inclusive of activation day). */
export function proRata(monthlyPrice: number, activation: Date): number {
  const y = activation.getUTCFullYear();
  const m = activation.getUTCMonth();
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const remaining = days - activation.getUTCDate() + 1;
  return Math.round((monthlyPrice * remaining) / days);
}
