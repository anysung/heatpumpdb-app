/**
 * Creator Partner Programme Terms — the public rules every partner agreement
 * incorporates by version (docs/PARTNER_CREATOR_PROGRAM_PLAN.md).
 *
 * INTERNAL REFERENCE ONLY (owner 2026-10-16): not published and not sent.
 * Creators receive the offer pack and then the short agreement
 * (marketing folder influencer-marketing/10-partner-agreement-simple.*). The
 * numbers here must stay identical to that agreement; nothing renders this
 * module except the internal Markdown copy (02-partner-terms-EN.md).
 * The commission engine (phase 1) must implement exactly these numbers —
 * change them here, bump the version, and notify partners 30 days ahead.
 *
 * DRAFT until counsel has reviewed it (governing law, tax wording).
 *
 * Owner decisions 2026-10-16: 24-month cap; 30% first-payment discount; video
 * support from 50 cumulative paid accounts (the company has no capital to
 * pre-fund content — support is paid only out of revenue already earned);
 * free Premium for partners during the agreement; no business registration,
 * no invoice — a signed payment receipt instead, and tax is the partner's own
 * matter (payments are international transfers; we have no tax agent or
 * entity in the partner's country).
 */
import { BRAND_TM, OPERATOR_NAME, MARKETING_EMAIL } from '../config/legal';
import type { LegalDocContent } from './legalContent';
import programme from './partnerProgramme.json';

/** Bump on any material change; agreements reference the version they signed. */
export const PARTNER_TERMS_VERSION = '2026-10-16';

/** Programme numbers — the single place they are stated is partnerProgramme.json,
 *  which the billing function reads too (its copy google_cloud_function_billing/
 *  partnerProgramme.json is kept identical by tests/partner-ledger.unit.mjs).
 *  The commission ledger and the statements compute from the same file, so a
 *  number on paper can never drift from the number that is paid. */
export const PARTNER_PROGRAMME = programme as Readonly<{
  commissionRate: number;
  commissionMonths: number;
  firstPaymentDiscountPct: number;
  payoutThresholdEur: number;
  payoutByDayOfMonth: number;
  videoSupportEur: number;
  videoSupportMinPaidAccounts: number;
  noticeDays: number;
}>;

const P = PARTNER_PROGRAMME;

export const PARTNER_TERMS: LegalDocContent = {
  title: 'Creator Partner Programme Terms',
  updated: PARTNER_TERMS_VERSION,
  intro: `These terms govern the ${BRAND_TM} Creator Partner Programme, operated by ${OPERATOR_NAME}. They apply to every creator who has signed a partner agreement with us, and form part of that agreement. Joining is by invitation and written agreement only.`,
  sections: [
    {
      h: '1. Your partner code',
      p: [
        `You receive a personal discount code. New customers who use your code at checkout get ${P.firstPaymentDiscountPct}% off their first Premium payment.`,
        'Your code is for your own channels and audience. Do not publish it on coupon or discount-aggregator sites, and do not bid on our brand name in paid search. If a code is misused or leaks, we may replace or suspend it; commission already earned is not affected.',
      ],
    },
    {
      h: '2. Qualifying subscriptions',
      p: [
        'A subscription qualifies when a new customer (an account that has never had a paid subscription) pays for Premium with your code. We may later add a personal tracking link; if we do, we will tell you how it counts.',
        'A free trial on its own does not qualify; only completed payments do. Your own accounts, accounts of your employer or business, and accounts of people in your household do not qualify.',
      ],
    },
    {
      h: '3. Commission',
      p: [
        `You earn ${Math.round(P.commissionRate * 100)}% of the Net Receipts of every completed payment on a qualifying subscription, for up to ${P.commissionMonths} months from that subscription's first paid payment, or until the subscription ends, whichever comes first.`,
        'Net Receipts means the amount we receive for that payment from Paddle, our merchant of record: the price paid excluding VAT and sales tax, after any discount, and after the Paddle transaction fee. Commission is calculated in euros (EUR).',
        'All Premium plans and billing terms count (monthly and annual, individual and team). Plan changes follow the payments actually made.',
      ],
    },
    {
      h: '4. Refunds and chargebacks',
      p: [
        'If a payment is refunded or charged back, the commission on that payment is reversed and deducted from your balance. A negative balance is offset against future commission only; we will not ask you to repay it, except in cases of fraud or a breach of these terms.',
      ],
    },
    {
      h: '5. Monthly statement',
      p: [
        'At the start of every month we email you a statement for the previous month: new and active paying subscriptions from your code, cancellations, your cumulative paying accounts, commission earned, deductions, video support and your balance, with a line-by-line CSV.',
        'Statements contain aggregated figures only. We never share the names, email addresses, companies or any other personal data of the customers you referred.',
      ],
    },
    {
      h: '6. Payment',
      p: [
        `Balances close at the end of each calendar month. A balance of €${P.payoutThresholdEur} or more is paid by the ${P.payoutByDayOfMonth}th of the following month, by international bank transfer or Wise, in EUR, from our account in the Republic of Korea.`,
        `A balance below €${P.payoutThresholdEur} is carried forward and never expires. On your request we will pay a smaller balance at any time; the actual transfer cost of that payment is then deducted from it.`,
        'We do not require you to be a registered business, and we do not require an invoice from you. After each payment we send you a short payment receipt; you sign it and return it to us (a scan or photo is enough). The signed receipt is our record of the payment.',
        'Costs charged by your own bank, including currency conversion, are yours.',
      ],
    },
    {
      h: '7. Taxes',
      p: [
        'Payments are made gross: we do not deduct or withhold any tax or social contribution in your country, and we do not file anything with the tax authorities of your country — we have no establishment, tax agent or representative there.',
        'Declaring this income and paying any tax, VAT or social contribution due on it is your own responsibility, under the rules of the country where you live or are established. We are not responsible for your tax affairs. If you need a statement of the amounts paid to you in a year, we will provide one on request.',
      ],
    },
    {
      h: '8. Premium access for partners',
      p: [
        `While your agreement is in force, your own ${BRAND_TM} account has Premium access free of charge, so you can use and show every feature in your content. It is for your own use only (one person, the usual device limits) and ends when the agreement ends; the account then continues on the free Standard plan.`,
      ],
    },
    {
      h: '9. Video production support',
      p: [
        `Once you reach ${P.videoSupportMinPaidAccounts} cumulative paying accounts (accounts with at least one completed payment that was not fully refunded or charged back), we pay €${P.videoSupportEur} per video about ${BRAND_TM}, for at most one video per calendar quarter.`,
        'The video must follow the Video Guidelines we send you, and is paid after it is published and we have confirmed it meets them. The amount is added to your statement balance. An unused quarter does not carry over.',
      ],
    },
    {
      h: '10. Advertising disclosure and accuracy',
      p: [
        'Content that features your code, your link or our support is advertising. You must label it as such under the law of the country where you publish (for example "Werbung" or "Anzeige" in Germany, "#ad" in the United Kingdom, "Publicité" or "Collaboration commerciale" in France).',
        'Describe the service accurately. In particular, do not state or imply that any product is eligible for public funding, that our data is an official registry, or that you speak for us. Use our name and logo only as we provide them.',
      ],
    },
    {
      h: '11. Relationship',
      p: [
        'You act as an independent creator, not as our employee, agent or representative. The programme is not exclusive on either side.',
        'Independence of the data: you will not accept payment from anyone, in connection with content that features HeatPump DB, for ranking or favouring a particular manufacturer or product, and you will not present our data in a misleading way.',
      ],
    },
    {
      h: '12. Changes and ending the agreement',
      p: [
        `Either side may end the agreement with ${P.noticeDays} days' notice by email. We may end it immediately for fraud or a serious breach of these terms.`,
        `We may change these terms with ${P.noticeDays} days' notice by email. A change never reduces the rate or the ${P.commissionMonths}-month period for subscriptions that already qualified before it takes effect.`,
        `After the agreement ends, commission continues on subscriptions that qualified before the end date, for the rest of their ${P.commissionMonths}-month period, unless the agreement was ended for fraud or a serious breach. Your remaining balance is paid out; if it is below €${P.payoutThresholdEur}, the actual transfer cost is deducted.`,
      ],
    },
    {
      h: '13. Data protection',
      p: [
        'Each side is responsible for the personal data it processes. We process your contact and payment details only to run the programme and to meet accounting obligations.',
      ],
    },
    {
      h: '14. Liability and governing law',
      p: [
        'To the extent permitted by law, neither side is liable for indirect or consequential loss. Nothing in these terms excludes liability that cannot be excluded by law.',
        'These terms and the partner agreement are governed by the laws of the Republic of Korea, without prejudice to mandatory rules of the country where you are established.',
      ],
    },
    {
      h: 'Contact',
      p: [`Programme questions: ${MARKETING_EMAIL}.`],
    },
  ],
};
