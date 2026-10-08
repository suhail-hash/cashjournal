import { Timestamp } from '@angular/fire/firestore';
import { Entry } from '../models/cash-journal.models';
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Convert Firestore Timestamp | Date | string-ish to a real Date for display. */
export function toDateValue(v: any): Date | null {
  if (!v) return null;
  return typeof v?.toDate === 'function' ? v.toDate() : new Date(v);
}

/** Convert ISO string or Date to Firestore Timestamp (optionally normalize to local noon). */
export function toFirestoreTimestamp(
  v: string | Date,
  normalizeNoon = false
): Timestamp {
  const d = typeof v === 'string' ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date');
  if (normalizeNoon) d.setHours(12, 0, 0, 0);
  return Timestamp.fromDate(d);
}

/** Format any date-like value in de-DE (used in PDF). */
export function formatDateDE(d: any): string {
  const dt = toDateValue(d);
  if (!dt || Number.isNaN(dt.getTime())) return '—';
  return new Intl.DateTimeFormat('de-DE').format(dt);
}

export function formatCurrencyEUR(n: number | null | undefined): string {
  const total = Number(n || 0);
  if (total === 0) return '—';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(total);
}

/** Best-effort guess for Content-Type from File (fallbacks to extension). */
export function guessContentType(file: File): string {
  if (file.type) return file.type;
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
  };
  return map[ext] || 'application/octet-stream';
}

/** Simple filename sanitizer for storage paths. */
export function makeSafeFilename(name: string): string {
  return name.replace(/[^\w.\-]+/g, '_');
}

/** Check allow-list for attachments. */
export function isAllowedAttachmentType(mime: string): boolean {
  return mime.startsWith('image/') || mime === 'application/pdf';
}

/** Build a deterministic storage path for an entry attachment. */
export function buildAttachmentPath(
  jid: string,
  eid: string,
  originalName: string,
  now = Date.now()
): string {
  return `journals/${jid}/entries/${eid}/attachments/${now}_${makeSafeFilename(
    originalName
  )}`;
}

/** Compute running saldo (pure) given entries and opening balance. */
export function computeRunningSaldo(entries: Entry[], openingBalance: number) {
  let saldo = Number(openingBalance || 0);
  return entries.map((e) => {
    const debit = Number(e.debit ?? 0) || 0;
    const credit = Number(e.credit ?? 0) || 0;
    saldo += debit - credit;
    return { ...e, saldo };
  });
}

/**
 * Cross-field validator: ensures control[fromKey] is strictly before control[toKey].
 * Reuses toDateValue() so it works with Timestamp | Date | string.
 */
export function dateOrderValidator(
  fromKey: string,
  toKey: string
): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const from = group.get(fromKey)?.value;
    const to = group.get(toKey)?.value;
    if (!from || !to) return null; // "required" handles empties

    const f = toDateValue(from)?.getTime();
    const t = toDateValue(to)?.getTime();

    return Number.isFinite(f) &&
      Number.isFinite(t) &&
      (f as number) < (t as number)
      ? null
      : { dateOrder: true };
  };
}
