/** Normalize an Indian mobile number to E.164 (+91XXXXXXXXXX). Returns null if invalid. */
export function normalizeIndianPhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, "");
  let national: string;
  if (/^\+91\d{10}$/.test(digits)) national = digits.slice(3);
  else if (/^91\d{10}$/.test(digits)) national = digits.slice(2);
  else if (/^0\d{10}$/.test(digits)) national = digits.slice(1);
  else if (/^\d{10}$/.test(digits)) national = digits;
  else return null;
  return /^[6-9]\d{9}$/.test(national) ? `+91${national}` : null;
}

export function maskPhone(e164: string): string {
  return e164.length > 6 ? `${e164.slice(0, 3)}******${e164.slice(-2)}` : "***";
}
