// Turns the many ways people write Nigerian numbers into one form,
// so "0803 123 4567", "+234 803 123 4567" and "2348031234567" all match.
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  if (trimmed.startsWith('+')) return `+${digits}`;
  if (digits.startsWith('234') && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 11) return `+234${digits.slice(1)}`;
  if (digits.length === 10 && /^[789]/.test(digits)) return `+234${digits}`;
  return digits;
}

// "+2348031234567" -> "0803 123 4567" for showing to Nigerian staff
export function displayPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  if (phone.startsWith('+234') && phone.length === 14) {
    const local = `0${phone.slice(4)}`;
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  }
  return phone;
}