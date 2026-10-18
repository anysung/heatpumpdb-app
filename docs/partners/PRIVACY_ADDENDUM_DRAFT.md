# Privacy policy addendum — creator partner programme (DRAFT, 2026-10-18)

Status: **draft for owner approval — not published.** Publishing means adding the
section below to `src/legal/legalContent.ts` (privacy, all five languages) and
bumping `PRIVACY_VERSION` in `src/config/legal.ts`. Decide first whether the bump
should prompt existing members to re-accept (the consent stamp records the
version; the current flow does not force re-acceptance on a version change —
verify before publishing).

Why it is needed: since 2026-10-18 the app stores a creator's discount code on
the member profile (`partnerCode`, `partnerCodeAt`, `partnerRef`) and the
billing function records, per subscription, which creator code was used at
checkout (`partnerAttributions`, `paddleTransactions`). That is new processing
of member data and must be described.

Partners' own data (name, email, payment details, signed agreement, receipts)
is already covered by the partner terms §13 and the agreement; it is listed
here too so the policy is complete.

---

## Proposed section (EN) — "Creator partner codes"

**If you arrive through a creator's link or use a creator's discount code.**
Some creators who make videos about heat pumps are our partners. When you open
our site through a partner's link, or enter a partner's discount code, we store
that code with your account so that it can be applied when you later choose a
Premium plan — including on another device, after your trial. If you pay with
the code, we record that your subscription was referred by that partner and
the amounts we received for it, because we pay the partner a commission on
those payments.

**What the partner sees.** Partners receive aggregated figures only: the number
of new, active and cancelled subscriptions from their code and the commission
amounts. We never share your name, email address, company or any other
personal data with a partner. A statement line identifies a subscription only
by an anonymous number (for example "C-0007").

**Legal basis.** Performance of our contract with you (applying the discount
you chose) and our legitimate interest in paying our partners correctly and
preventing misuse of codes (Art. 6(1)(b) and (f) GDPR).

**Retention.** The code on your account is replaced when you follow another
partner link and is no longer used after your first payment. Records of which
payments earned a commission are kept for as long as commission can be due
(up to 24 months from the first payment) and afterwards for the periods
required by tax and accounting law.

**Creator partners.** If you are a partner, we process your name, contact
details, channel, payment details, the signed agreement, statements and signed
payment receipts to run the programme and to meet our accounting obligations
(Art. 6(1)(b) and (c) GDPR). They are stored in our access-restricted systems
and kept for the periods required by tax and accounting law after the last
payment.

---

## Checklist before publishing
- [ ] Owner approval of the EN text
- [ ] DE / FR / PL / IT translations (formal register, as the legal pages)
- [ ] `PRIVACY_VERSION` bump and its effect on consent stamps verified
- [ ] Hub legal pages rebuilt (`scripts/build-hub-legal.mjs`)
