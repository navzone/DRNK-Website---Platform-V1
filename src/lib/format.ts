/** Display-only formatting of integer paise. No arithmetic on floats: whole rupees and paise are split with integer math. */
export function formatINR(paise: number): string {
  const rupees = Math.trunc(paise / 100);
  const rem = Math.abs(paise % 100);
  const whole = rupees.toLocaleString("en-IN");
  return rem === 0 ? `₹${whole}` : `₹${whole}.${String(rem).padStart(2, "0")}`;
}

export function formatDateTime(d: Date | string): string {
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(d));
}

export const categoryLabel: Record<string, string> = { restaurant: "Restaurant", pub: "Pub", microbrewery: "Microbrewery", lounge: "Lounge", cafe: "Café" };
