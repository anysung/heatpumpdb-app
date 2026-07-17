/**
 * LegalPage — the four policies, rendered WITHOUT a login.
 *
 * App.tsx routes /privacy, /terms, /refund-policy and /imprint here before the
 * auth gate, so the pages are reachable from a signup form, a checkout page or
 * a search engine on the same customer-facing domain. One component, all
 * markets: only the UI language differs.
 */
import React from 'react';
import { Language } from '../types';
import { LegalDoc, LEGAL_ROUTES, BRAND_TM } from '../config/legal';
import { LEGAL_CONTENT } from './legalContent';
import { BrandLogo, WavingFlag } from '../components/BrandLogo';
import { UI_LANGUAGES } from '../hpiq/market';

const FD = '"SF Pro Display", system-ui, -apple-system, "Inter", sans-serif';

/** Nav label for each policy, in each language. */
export const LEGAL_NAV: Record<Language, Record<LegalDoc, string>> = {
  en: { privacy: 'Privacy Policy', terms: 'Terms of Use', refund: 'Refund Policy', imprint: 'Legal Notice' },
  de: { privacy: 'Datenschutz', terms: 'Nutzungsbedingungen', refund: 'Widerruf & Kündigung', imprint: 'Impressum' },
  fr: { privacy: 'Confidentialité', terms: "Conditions d'utilisation", refund: 'Remboursement', imprint: 'Mentions légales' },
  pl: { privacy: 'Polityka prywatności', terms: 'Warunki korzystania', refund: 'Zasady zwrotów', imprint: 'Informacje o usługodawcy' },
};

/** Public footer copyright — brand mark only; identity details stay in the Legal Notice. */
const RIGHTS_RESERVED: Record<Language, string> = {
  en: 'All rights reserved.', de: 'Alle Rechte vorbehalten.', fr: 'Tous droits réservés.', pl: 'Wszelkie prawa zastrzeżone.',
};
const footerCopyright = (language: Language) =>
  `© ${new Date().getFullYear()} ${BRAND_TM}. ${RIGHTS_RESERVED[language]}`;

const BACK: Record<Language, string> = { en: 'Back to HeatPump DB', de: 'Zurück zu HeatPump DB', fr: 'Retour à HeatPump DB', pl: 'Powrót do HeatPump DB' };
const UPDATED: Record<Language, string> = { en: 'Version', de: 'Fassung', fr: 'Version', pl: 'Wersja' };

export const LegalPage: React.FC<{
  doc: LegalDoc;
  language: Language;
  setLanguage: (l: Language) => void;
}> = ({ doc, language, setLanguage }) => {
  const content = LEGAL_CONTENT[language][doc];

  return (
    <div style={{ minHeight: '100vh', background: '#fff', color: '#1d1d1f', display: 'flex', flexDirection: 'column' }}>
      {/* Header — brand + language, same lockup as the app */}
      <div style={{ borderBottom: '1px solid #e8e8ed', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <BrandLogo height={26} theme="light" animated={false} />
          <WavingFlag height={22} onLight animated={false} />
        </a>
        <span style={{ flex: 1 }} />
        {UI_LANGUAGES.length > 1 && (
          <div style={{ display: 'flex', border: '1px solid #e0e0e0', borderRadius: 999, overflow: 'hidden', fontSize: 12.5 }}>
            {UI_LANGUAGES.map(l => (
              <span
                key={l}
                onClick={() => setLanguage(l)}
                style={{
                  padding: '6px 14px', cursor: 'pointer',
                  ...(language === l ? { background: '#1d1d1f', color: '#fff', fontWeight: 600 } : { color: '#1d1d1f' }),
                }}
              >
                {l.toUpperCase()}
              </span>
            ))}
          </div>
        )}
        <a href="/" style={{ fontSize: 13, color: '#0066cc', textDecoration: 'none' }}>{BACK[language]} ›</a>
      </div>

      {/* Document */}
      <div style={{ flex: 1, maxWidth: 820, width: '100%', margin: '0 auto', padding: '44px 24px 56px', boxSizing: 'border-box' }} data-testid={`legal-${doc}`}>
        <h1 style={{ fontFamily: FD, fontSize: 34, fontWeight: 600, letterSpacing: '-0.4px', margin: '0 0 6px' }}>{content.title}</h1>
        <p style={{ fontSize: 12.5, color: '#9a9aa0', margin: '0 0 26px' }}>{UPDATED[language]} {content.updated}</p>
        {content.intro && (
          <p style={{ fontSize: 15, lineHeight: 1.7, color: '#333', margin: '0 0 30px' }}>{content.intro}</p>
        )}
        {content.sections.map(section => (
          <section key={section.h} style={{ marginBottom: 26 }}>
            <h2 style={{ fontFamily: FD, fontSize: 17, fontWeight: 600, margin: '0 0 8px' }}>{section.h}</h2>
            {section.p.map((para, i) => (
              <p key={i} style={{ fontSize: 14, lineHeight: 1.75, color: '#444', margin: '0 0 8px' }}>{para}</p>
            ))}
          </section>
        ))}
      </div>

      {/* Footer — the other policies, always reachable without a login */}
      <LegalFooter language={language} current={doc} showCopyright />
    </div>
  );
};

/**
 * Shared public policy links (Legal Notice, Terms, Privacy, Refund). Used on the
 * policy pages and the public auth screens, so the four legal pages are reachable
 * without a login. `showCopyright` adds the minimal brand copyright line for the
 * standalone policy pages; the auth screens carry their own copyright, so they
 * pass links only.
 */
export const LegalFooter: React.FC<{ language: Language; current?: LegalDoc; dark?: boolean; showCopyright?: boolean }> = ({ language, current, dark, showCopyright }) => (
  <div
    style={{
      borderTop: dark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e8e8ed',
      padding: '18px 24px',
      display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center',
      fontSize: 12.5,
    }}
  >
    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
      {(Object.keys(LEGAL_ROUTES) as LegalDoc[]).map(d => (
        <a
          key={d}
          href={LEGAL_ROUTES[d]}
          style={{
            color: d === current ? (dark ? '#fff' : '#1d1d1f') : dark ? 'rgba(255,255,255,0.55)' : '#7a7a7a',
            textDecoration: 'none',
            fontWeight: d === current ? 600 : 400,
          }}
        >
          {LEGAL_NAV[language][d]}
        </a>
      ))}
    </div>
    {showCopyright && (
      <span style={{ color: dark ? 'rgba(255,255,255,0.4)' : '#9a9aa0', fontSize: 11.5 }}>
        {footerCopyright(language)}
      </span>
    )}
  </div>
);
