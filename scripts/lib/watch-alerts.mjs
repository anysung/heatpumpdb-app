/**
 * watch-alerts.mjs — WHO gets a watchlist change alert, and WHAT it says.
 *
 * Pure (no I/O, caller passes nowMs) so tests/watch-alerts.unit.mjs can pin it.
 * The cost of a mistake is asymmetric, as with the trial reminders: a missed
 * alert is a lost nicety, a wrong one mails a Standard, suspended or test
 * account about a Premium feature. Every doubt resolves to "do not mail".
 */
import { changesById, mfrSlug, SPEC_FIELDS } from './dataset-diff.mjs';

export const LANGS = ['en', 'de', 'fr', 'pl', 'it'];
export const MARKET_LANG = { DE: 'de', GB: 'en', FR: 'fr', PL: 'pl', IT: 'it' };
export const MARKET_SITE = {
  DE: 'https://www.heatpumpdb.de',
  GB: 'https://www.heatpumpdb.uk',
  FR: 'https://www.heatpumpdb.fr',
  PL: 'https://www.heatpumpdb.pl',
  IT: 'https://www.heatpumpdb.it',
};
const ADMIN_ROLES = ['owner', 'admin', 'support', 'ops'];
/** Mail at most this many changed models per message; the rest is "and N more". */
export const MAX_LINES = 25;

export function tsMillis(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') { const t = Date.parse(v); return Number.isFinite(t) ? t : null; }
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return null;
}

export const isTestEmail = (email) =>
  /(^|[._+-])(e2e|test|qa)([._+-]|@)|@example\.(com|org|net)$|@(test|invalid|localhost)$|\+test@/i.test(String(email ?? ''));

/**
 * Why this account must NOT get an alert, or null when it may.
 * Premium mirrors src/config/entitlement.ts tierOf(): the account's or its
 * team's accessUntilTs window is open, a live grant, or NO window anywhere
 * (legacy accounts are not window-gated).
 */
export function skipRecipient(user, org, nowMs) {
  if (!user) return 'no-profile';
  const status = user.status ?? (user.isActive ? 'active' : '');
  if (status !== 'active') return 'not-active';
  if (ADMIN_ROLES.includes(String(user.role ?? 'user'))) return 'admin';
  const email = String(user.email ?? '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return 'no-email';
  if (isTestEmail(email)) return 'test-email';

  const own = tsMillis(user.accessUntilTs);
  const inOrg = !!org && !!user.orgId && (org.memberUids ?? []).includes(user.uid ?? user.id ?? '');
  const team = inOrg ? tsMillis(org.accessUntilTs) : null;
  const grantEnd = user.grant && !user.grant.revokedAt ? tsMillis(user.grant.endsAt) : null;
  const grantOpen = grantEnd != null && nowMs < grantEnd;
  if (own === null && team === null) return null;                  // legacy — not window-gated
  if ((own !== null && nowMs < own) || (team !== null && nowMs < team) || grantOpen) return null;
  return 'standard';
}

/**
 * The changed items one user watches, per market.
 * `watches`: [{ type:'model'|'manufacturer', market, key, label }]
 * `diffs`:   { [market]: diff-document } (skipped markets simply absent)
 * → [{ market, id, mfr, model, kinds, via: 'model'|'manufacturer' }]
 */
export function selectChanges(watches, diffs) {
  const out = [];
  const seen = new Set();
  const indexes = {};
  const idx = (m) => (indexes[m] ??= diffs[m] && !diffs[m].suspect ? changesById(diffs[m]) : null);
  for (const w of watches ?? []) {
    const m = String(w.market ?? '').toUpperCase();
    const ix = idx(m);
    if (!ix) continue;
    if (w.type === 'model') {
      const c = ix.get(String(w.key));
      if (c && !seen.has(`${m}|${c.id}`)) { seen.add(`${m}|${c.id}`); out.push({ market: m, ...c, via: 'model' }); }
    } else if (w.type === 'manufacturer') {
      for (const c of ix.values()) {
        if (mfrSlug(c.mfr) !== w.key || seen.has(`${m}|${c.id}`)) continue;
        seen.add(`${m}|${c.id}`);
        out.push({ market: m, ...c, via: 'manufacturer' });
      }
    }
  }
  // Watched models first (explicit interest), then by manufacturer/model.
  return out.sort((a, b) => (a.via === b.via ? 0 : a.via === 'model' ? -1 : 1)
    || a.mfr.localeCompare(b.mfr) || a.model.localeCompare(b.model));
}

/* ── Copy ─────────────────────────────────────────────────────────────────── */

const REGISTRY = { DE: 'BAFA', GB: 'PEL', FR: 'ADEME', PL: 'ZUM', IT: 'GSE' };

const FIELD = {
  scop: { en: 'SCOP', de: 'SCOP', fr: 'SCOP', pl: 'SCOP', it: 'SCOP' },
  power_55C_kw: { en: 'capacity 55 °C', de: 'Leistung 55 °C', fr: 'puissance 55 °C', pl: 'moc 55 °C', it: 'potenza 55 °C' },
  power_35C_kw: { en: 'capacity 35 °C', de: 'Leistung 35 °C', fr: 'puissance 35 °C', pl: 'moc 35 °C', it: 'potenza 35 °C' },
  efficiency_35C_percent: { en: 'ηs 35 °C', de: 'ηs 35 °C', fr: 'ηs 35 °C', pl: 'ηs 35 °C', it: 'ηs 35 °C' },
  efficiency_55C_percent: { en: 'ηs 55 °C', de: 'ηs 55 °C', fr: 'ηs 55 °C', pl: 'ηs 55 °C', it: 'ηs 55 °C' },
  cop_A7W35: { en: 'COP A7/W35' }, cop_A2W35: { en: 'COP A2/W35' },
  cop_AMinus7W35: { en: 'COP A-7/W35' }, cop_A10W35: { en: 'COP A10/W35' },
  noise_outdoor_dB: { en: 'sound power', de: 'Schallleistung', fr: 'puissance acoustique', pl: 'moc akustyczna', it: 'potenza sonora' },
  refrigerant: { en: 'refrigerant', de: 'Kältemittel', fr: 'fluide frigorigène', pl: 'czynnik chłodniczy', it: 'refrigerante' },
};
const fieldLabel = (f, L) => FIELD[f]?.[L] ?? FIELD[f]?.en ?? f;

const COPY = {
  en: {
    subject: (n, month) => `Your watchlist: ${n} ${n === 1 ? 'change' : 'changes'} in the ${month} data update`,
    greet: (name) => (name ? `Dear ${name},` : 'Hello,'),
    intro: (month) => `The ${month} data update changed models on your HeatPump DB watchlist:`,
    added: 'new in the catalogue', removed: 'removed from the catalogue',
    specs: (f) => `specification updated: ${f}`,
    listing: (reg, from, to) => `${reg} status: ${from} → ${to}`,
    ref: (reg) => `${reg} reference changed`,
    states: { listed: 'listed', verification_required: 'verification required', not_listed: 'not listed' },
    more: (n) => `…and ${n} more.`,
    via: 'watched manufacturer',
    cta: 'Open my watchlist',
    outro: (url) => `Details and the current values: ${url}\n\nYou receive this because you watch these models or manufacturers. You can switch these emails off on the Watchlist page.`,
  },
  de: {
    subject: (n, month) => `Ihre Merkliste: ${n} ${n === 1 ? 'Änderung' : 'Änderungen'} im Datenupdate ${month}`,
    greet: (name) => (name ? `Guten Tag ${name},` : 'Guten Tag,'),
    intro: (month) => `Das Datenupdate ${month} hat Modelle auf Ihrer HeatPump DB Merkliste geändert:`,
    added: 'neu im Katalog', removed: 'aus dem Katalog entfernt',
    specs: (f) => `Technische Daten aktualisiert: ${f}`,
    listing: (reg, from, to) => `${reg}-Status: ${from} → ${to}`,
    ref: (reg) => `${reg}-Referenz geändert`,
    states: { listed: 'gelistet', verification_required: 'Prüfung erforderlich', not_listed: 'nicht gelistet' },
    more: (n) => `…und ${n} weitere.`,
    via: 'beobachteter Hersteller',
    cta: 'Merkliste öffnen',
    outro: (url) => `Details und aktuelle Werte: ${url}\n\nSie erhalten diese Nachricht, weil Sie diese Modelle oder Hersteller beobachten. Sie können diese E-Mails auf der Seite Merkliste abschalten.`,
  },
  fr: {
    subject: (n, month) => `Votre liste de suivi : ${n} ${n === 1 ? 'modification' : 'modifications'} dans la mise à jour ${month}`,
    greet: (name) => (name ? `Bonjour ${name},` : 'Bonjour,'),
    intro: (month) => `La mise à jour des données de ${month} a modifié des modèles de votre liste de suivi HeatPump DB :`,
    added: 'nouveau dans le catalogue', removed: 'retiré du catalogue',
    specs: (f) => `caractéristiques mises à jour : ${f}`,
    listing: (reg, from, to) => `statut ${reg} : ${from} → ${to}`,
    ref: (reg) => `référence ${reg} modifiée`,
    states: { listed: 'agréé', verification_required: 'vérification requise', not_listed: 'non listé' },
    more: (n) => `…et ${n} de plus.`,
    via: 'fabricant suivi',
    cta: 'Ouvrir ma liste de suivi',
    outro: (url) => `Détails et valeurs actuelles : ${url}\n\nVous recevez ce message parce que vous suivez ces modèles ou fabricants. Vous pouvez désactiver ces e-mails sur la page Liste de suivi.`,
  },
  pl: {
    subject: (n, month) => `Twoja lista obserwowanych: ${n} ${n === 1 ? 'zmiana' : 'zmian(y)'} w aktualizacji danych ${month}`,
    greet: (name) => (name ? `Dzień dobry ${name},` : 'Dzień dobry,'),
    intro: (month) => `Aktualizacja danych ${month} zmieniła modele z Twojej listy obserwowanych w HeatPump DB:`,
    added: 'nowość w katalogu', removed: 'usunięty z katalogu',
    specs: (f) => `zaktualizowane dane techniczne: ${f}`,
    listing: (reg, from, to) => `status ${reg}: ${from} → ${to}`,
    ref: (reg) => `zmieniono odniesienie ${reg}`,
    states: { listed: 'na liście', verification_required: 'wymagana weryfikacja', not_listed: 'poza listą' },
    more: (n) => `…i ${n} więcej.`,
    via: 'obserwowany producent',
    cta: 'Otwórz listę obserwowanych',
    outro: (url) => `Szczegóły i aktualne wartości: ${url}\n\nOtrzymujesz tę wiadomość, ponieważ obserwujesz te modele lub producentów. Możesz wyłączyć te e-maile na stronie listy obserwowanych.`,
  },
  it: {
    subject: (n, month) => `La tua watchlist: ${n} ${n === 1 ? 'modifica' : 'modifiche'} nell'aggiornamento dati di ${month}`,
    greet: (name) => (name ? `Buongiorno ${name},` : 'Buongiorno,'),
    intro: (month) => `L'aggiornamento dati di ${month} ha modificato modelli della tua watchlist HeatPump DB:`,
    added: 'nuovo nel catalogo', removed: 'rimosso dal catalogo',
    specs: (f) => `dati tecnici aggiornati: ${f}`,
    listing: (reg, from, to) => `stato ${reg}: ${from} → ${to}`,
    ref: (reg) => `riferimento ${reg} modificato`,
    states: { listed: 'nel catalogo', verification_required: 'verifica richiesta', not_listed: 'non elencato' },
    more: (n) => `…e altri ${n}.`,
    via: 'produttore seguito',
    cta: 'Apri la mia watchlist',
    outro: (url) => `Dettagli e valori attuali: ${url}\n\nRicevi questo messaggio perché segui questi modelli o produttori. Puoi disattivare queste e-mail nella pagina Watchlist.`,
  },
};

const LOCALE = { en: 'en-GB', de: 'de-DE', fr: 'fr-FR', pl: 'pl-PL', it: 'it-IT' };
export const monthLabel = (month, L) => {
  const [y, m] = String(month).split('-').map(Number);
  if (!y || !m) return String(month);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString(LOCALE[L] ?? 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

export const langFor = (settingsLang, country) => {
  const l = String(settingsLang ?? '').toLowerCase();
  if (String(country).toUpperCase() === 'GB') return 'en';           // the GB edition is English-only
  return LANGS.includes(l) ? l : (MARKET_LANG[String(country ?? '').toUpperCase()] ?? 'en');
};

function describe(kind, market, L) {
  const c = COPY[L];
  const reg = REGISTRY[market] ?? '';
  if (kind.kind === 'added') return c.added;
  if (kind.kind === 'removed') return c.removed;
  if (kind.kind === 'specs') return c.specs(kind.fields.filter(f => SPEC_FIELDS.includes(f)).map(f => fieldLabel(f, L)).join(', '));
  if (kind.kind === 'listing') {
    if (kind.field === 'agrement_number' || kind.field === 'nf_pac_reference') return c.ref(kind.field === 'nf_pac_reference' ? 'NF PAC' : reg);
    return c.listing(reg, c.states[kind.from] ?? kind.from, c.states[kind.to] ?? kind.to);
  }
  return '';
}

/** { lang, subject, body, cta:{label,url} } — body carries the URL too (the
 *  letterhead contract: a client that strips the button can still copy it). */
export function buildAlertMail({ lang, name, month, items, site }) {
  const L = LANGS.includes(lang) ? lang : 'en';
  const c = COPY[L];
  const url = `${site}/?open=watchlist`;
  const ml = monthLabel(month, L);
  const shown = items.slice(0, MAX_LINES);
  const lines = shown.map(it => {
    const what = it.kinds.map(k => describe(k, it.market, L)).filter(Boolean).join('; ');
    return `• ${it.mfr} ${it.model} — ${what}${it.via === 'manufacturer' ? ` (${c.via})` : ''}`;
  });
  if (items.length > shown.length) lines.push(c.more(items.length - shown.length));
  const body = `${c.greet(name)}\n\n${c.intro(ml)}\n\n${lines.join('\n')}\n\n{{CTA}}\n\n${c.outro(url)}`;
  return { lang: L, subject: c.subject(items.length, ml), body, cta: { label: c.cta, url } };
}
