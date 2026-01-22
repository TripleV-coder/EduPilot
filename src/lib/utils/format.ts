import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

export function formatDate(date: Date | string, formatStr: string = "dd/MM/yyyy"): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, formatStr, { locale: fr });
}

export function formatDateTime(date: Date | string): string {
  return formatDate(date, "dd/MM/yyyy HH:mm");
}

export function formatCurrency(amount: number, currency: string = "XOF"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatGrade(value: number | null | undefined, maxGrade: number = 20): string {
  if (value === null || value === undefined) return "-";
  return `${value.toFixed(2)}/${maxGrade}`;
}

export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function getFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`;
}

/**
 * Serialize an object by converting Date objects and Decimal objects to strings/numbers
 * Handles nested objects and arrays recursively
 */
export function serializeData<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (data instanceof Date) {
    return data.toISOString() as unknown as T;
  }

  // Handle Prisma Decimal objects
  if (typeof data === 'object' && data !== null && 'toNumber' in data && typeof (data as any).toNumber === 'function') {
    return (data as any).toNumber() as T;
  }

  if (Array.isArray(data)) {
    return data.map(item => serializeData(item)) as unknown as T;
  }

  if (typeof data === 'object' && data !== null) {
    const serialized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      serialized[key] = serializeData(value);
    }
    return serialized as T;
  }

  return data;
}
