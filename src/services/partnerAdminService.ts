/**
 * partnerAdminService — the admin console's access to the creator-partner
 * books (2026-10-18). Reads come straight from Firestore (admin-read rules);
 * EVERY write goes through an audited billing-function endpoint, because the
 * collections have exactly one writer (firestore.rules: write if false).
 */
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { PUBLIC_ENV } from '../config/env';

export interface Partner {
  pid: string; name: string; email: string; otherEmails?: string[]; lang: string; country: string;
  channelUrl?: string; contractNo?: string; contractStatus?: 'none' | 'sent' | 'signed';
  contractSentAt?: string; contractSignedAt?: string; contractDocPath?: string; termsVersion?: string;
  payoutMethod?: string; notes?: string; status: 'prospect' | 'active' | 'paused' | 'ended';
  code: string; discountId: string; discountPct: number; refSlug: string;
  commissionRate: number; premiumUntil?: string; uid?: string; testPartner?: boolean;
  interestId?: string; createdAt: string; endedAt?: string; endReason?: string; commissionStopped?: boolean;
}
export interface LedgerEntry {
  id: string; pid: string; type: 'commission' | 'clawback' | 'video_support' | 'payout' | 'payout_fee' | 'manual';
  amountCents: number; at: string; month: string; customerRef?: string; planCode?: string; billingTerm?: string;
  netCents?: number | null; pending?: boolean; pendingReason?: string; note?: string; reference?: string;
  transactionId?: string; adjustmentId?: string; action?: string; first?: boolean; videoUrl?: string;
  receiptSentAt?: string; receiptSignedAt?: string; receiptSignedDocPath?: string; createdBy?: string;
}
export interface Attribution {
  id: string; pid: string; code: string; customerRef: string; planCode: string; billingTerm: string;
  firstPaidAt: string | null; commissionEndsAt: string | null; qualifying: boolean; notQualifyingReason?: string;
  reviewFlags?: string[]; subStatus?: string; canceledAt?: string | null; firstPaymentReversed?: boolean;
  voided?: boolean; voidNote?: string; createdAt: string; uid?: string;
}
export interface Statement { id: string; pid: string; month: string; status: 'draft' | 'approved' | 'sent'; [k: string]: any }
export interface ReviewItem { id: string; kind: string; pid?: string; status: string; note?: string; createdAt: string; [k: string]: any }
export interface PartnerDoc { id: string; pid: string; kind: string; path: string; filename: string; createdAt: string; [k: string]: any }
export interface InterestRecord { id: string; pid: string; email: string; name?: string; lang?: string; createdAt: string; status: string; registeredAt?: string }

const all = async <T,>(col: string, ...cons: any[]): Promise<T[]> => {
  const snap = await getDocs(cons.length ? query(collection(db, col), ...cons) : collection(db, col));
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as T[];
};

export const listPartners = () => all<Partner>('partners').then(xs => xs.sort((a, b) => a.name.localeCompare(b.name)));
export const listLedger = (pid: string) => all<LedgerEntry>('partnerLedger', where('pid', '==', pid))
  .then(xs => xs.sort((a, b) => String(b.at).localeCompare(String(a.at))));
export const listAllLedger = () => all<LedgerEntry>('partnerLedger');
export const listAttributions = (pid: string) => all<Attribution>('partnerAttributions', where('pid', '==', pid))
  .then(xs => xs.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
export const listStatements = (month?: string) => (month
  ? all<Statement>('partnerStatements', where('month', '==', month))
  : all<Statement>('partnerStatements'));
export const listPartnerStatements = (pid: string) => all<Statement>('partnerStatements', where('pid', '==', pid))
  .then(xs => xs.sort((a, b) => b.month.localeCompare(a.month)));
export const listReview = () => all<ReviewItem>('partnerReview').then(xs => xs.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
export const listPartnerDocs = (pid: string) => all<PartnerDoc>('partnerDocs', where('pid', '==', pid))
  .then(xs => xs.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
export const listInterest = () => all<InterestRecord>('partnerInterest').then(xs => xs.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
export const listPartnerMails = (pid: string) => all<any>('partnerMails', where('pid', '==', pid));
export const listPartnerAudit = () => all<any>('partnerAudit', orderBy('at', 'desc'), limit(200));

/** Balance = sum of entries (the only definition there is). */
export const balanceOf = (entries: LedgerEntry[]) => entries.reduce((s, e) => s + (e.amountCents || 0), 0);

async function call<T = any>(path: string, body: Record<string, unknown>): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error('unauthenticated');
  if (!PUBLIC_ENV.BILLING_FN_URL) throw new Error('billing-fn-not-configured');
  const token = await user.getIdToken();
  const res = await fetch(`${PUBLIC_ENV.BILLING_FN_URL}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) throw new Error(json.error || `http-${res.status}`);
  return json as T;
}

export const registerPartner = (b: Record<string, unknown>) => call<{ pid: string; code: string; discountId: string; refSlug: string; premiumUntil: string }>('partnerRegister', b);
export const updatePartner = (pid: string, patch: Record<string, unknown>) => call('partnerUpdate', { pid, patch });
export const endPartner = (pid: string, reason: string, forBreach: boolean) => call<{ errors: string[] }>('partnerEnd', { pid, reason, forBreach });
export const addLedgerEntry = (b: { pid: string; type: string; amountEur?: string; at?: string; note?: string; reference?: string; videoUrl?: string }) =>
  call<{ entryId: string; amountCents: number }>('partnerLedgerAdd', b);
export const voidAttribution = (subscriptionId: string, note: string) => call('partnerAttributionVoid', { subscriptionId, note });
export const resolveReview = (id: string, note: string) => call('partnerReviewResolve', { id, note });
export const closeMonth = (month: string) => call<{ drafts: number; settled: number; stillPending: number; skippedFinal: number }>('partnerCloseMonth', { month });
export const setStatementStatus = (id: string, status: 'draft' | 'approved') => call('partnerStatementStatus', { id, status });
export const sendPartnerDocument = (b: { pid: string; kind: 'statement' | 'receipt' | 'annual'; statementId?: string; ledgerEntryId?: string; year?: string; pdfBase64: string; filename: string; resend?: boolean }) =>
  call<{ messageId: string | null }>('partnerSendDocument', b);
export const uploadPartnerDocument = (b: { pid: string; kind: string; filename: string; contentType: string; fileBase64: string; ledgerEntryId?: string }) =>
  call<{ id: string; path: string }>('partnerUploadDocument', b);
export const getPartnerDocument = (path: string) => call<{ contentType: string; base64: string }>('partnerGetDocument', { path });

/** Links a partner puts in a video description: market site + code + ref. */
export const MARKET_SITES: Record<string, string> = {
  DE: 'https://www.heatpumpdb.de', GB: 'https://www.heatpumpdb.uk', FR: 'https://www.heatpumpdb.fr',
  PL: 'https://www.heatpumpdb.pl', IT: 'https://www.heatpumpdb.it',
};
export const partnerLink = (p: Pick<Partner, 'code' | 'refSlug'>, country: string) =>
  `${MARKET_SITES[country] || MARKET_SITES.DE}/?coupon=${encodeURIComponent(p.code)}&ref=${encodeURIComponent(p.refSlug)}`;
