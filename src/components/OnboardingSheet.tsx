/**
 * OnboardingSheet — the PROFILE STEP every account completes at its first
 * sign-in (owner, 2026-09-27).
 *
 * WHY IT IS REQUIRED NOW
 * With the Free tier the product is free for everyone, so the one thing we
 * ask in return is who is using it. Signing up stays minimal (Google / Apple /
 * email + consent); this sheet then asks — once, after the account exists —
 * for the name, company and company type (required) plus address, job role,
 * website and a secondary email (optional). It shows whenever the required
 * fields are missing, so accounts created before this step complete it at
 * their next sign-in. It cannot be skipped; signing out is the way out.
 *
 *  · Team MEMBERS only give their name — the company is the team's (the owner
 *    maintains it on the organization record).
 *  · Admin roles are never asked.
 *
 * Still NOT asked: how they found us — the `?ref=` token records that
 * (services/signupRef.ts), and a second answer would only disagree with it.
 */
import React, { useState } from 'react';
import { User, Language } from '../types';
import { COMPANY_TYPES, COMPANY_TYPE_OTHER_MAX, normalizeCompanyType } from '../config/companyTypes';
import { COMPANY_TYPE_LABELS_I18N } from '../config/companyTypeLabels';
import { JOB_ROLES, jobRoleLabel } from '../config/jobRoles';
import { updateMyProfile } from '../services/authService';
import { isAdminRole } from '../services/accountCountry';
import { normalizeWebsite, trim } from '../utils/profile';

/** Copy lives here rather than in either dictionary: this sheet is shown from
 *  the auth surface AND from inside the app, which carry different `t`. */
type Copy = {
  title: string; sub: string; required: string; optional: string;
  name: string; namePh: string; companyName: string; companyType: string; other: string;
  role: string; street: string; postal: string; city: string; website: string; secondEmail: string; secondHint: string;
  choose: string; save: string; saving: string; signOut: string; missing: string; badEmail: string; badSite: string;
};
const COPY: Record<string, Copy> = {
  en: { title: 'Complete your profile', sub: 'Your free account is ready. Tell us who you are — fields marked * are required.',
        required: 'Required', optional: 'Optional',
        name: 'Your name *', namePh: 'e.g. Alex Schneider', companyName: 'Company name *', companyType: 'Type of company *', other: 'Please describe *',
        role: 'Your role', street: 'Street and number', postal: 'Postal code', city: 'City', website: 'Company website',
        secondEmail: 'Secondary email', secondHint: 'An extra contact address — it is never used to sign in.',
        choose: 'Select…', save: 'Save and continue', saving: 'Saving…', signOut: 'Sign out',
        missing: 'Please fill in the required fields.', badEmail: 'The secondary email does not look valid.', badSite: 'The website does not look valid.' },
  de: { title: 'Profil vervollständigen', sub: 'Ihr kostenloses Konto ist bereit. Sagen Sie uns, wer Sie sind — Felder mit * sind Pflichtfelder.',
        required: 'Pflichtangaben', optional: 'Optional',
        name: 'Ihr Name *', namePh: 'z. B. Alex Schneider', companyName: 'Firmenname *', companyType: 'Art des Unternehmens *', other: 'Bitte beschreiben *',
        role: 'Ihre Funktion', street: 'Straße und Hausnummer', postal: 'PLZ', city: 'Ort', website: 'Website des Unternehmens',
        secondEmail: 'Zweite E-Mail-Adresse', secondHint: 'Eine zusätzliche Kontaktadresse — sie wird nie zur Anmeldung verwendet.',
        choose: 'Bitte wählen…', save: 'Speichern und weiter', saving: 'Wird gespeichert…', signOut: 'Abmelden',
        missing: 'Bitte füllen Sie die Pflichtfelder aus.', badEmail: 'Die zweite E-Mail-Adresse scheint ungültig zu sein.', badSite: 'Die Website-Adresse scheint ungültig zu sein.' },
  fr: { title: 'Complétez votre profil', sub: 'Votre compte gratuit est prêt. Dites-nous qui vous êtes — les champs marqués * sont obligatoires.',
        required: 'Obligatoire', optional: 'Facultatif',
        name: 'Votre nom *', namePh: 'p. ex. Alex Schneider', companyName: 'Nom de l’entreprise *', companyType: 'Type d’entreprise *', other: 'Précisez *',
        role: 'Votre fonction', street: 'Rue et numéro', postal: 'Code postal', city: 'Ville', website: 'Site web de l’entreprise',
        secondEmail: 'E-mail secondaire', secondHint: 'Une adresse de contact supplémentaire — jamais utilisée pour la connexion.',
        choose: 'Sélectionner…', save: 'Enregistrer et continuer', saving: 'Enregistrement…', signOut: 'Se déconnecter',
        missing: 'Veuillez remplir les champs obligatoires.', badEmail: 'L’e-mail secondaire ne semble pas valide.', badSite: 'L’adresse du site ne semble pas valide.' },
  pl: { title: 'Uzupełnij profil', sub: 'Twoje bezpłatne konto jest gotowe. Powiedz nam, kim jesteś — pola oznaczone * są wymagane.',
        required: 'Wymagane', optional: 'Opcjonalne',
        name: 'Imię i nazwisko *', namePh: 'np. Alex Schneider', companyName: 'Nazwa firmy *', companyType: 'Typ firmy *', other: 'Opisz *',
        role: 'Twoja rola', street: 'Ulica i numer', postal: 'Kod pocztowy', city: 'Miejscowość', website: 'Strona internetowa firmy',
        secondEmail: 'Dodatkowy e-mail', secondHint: 'Dodatkowy adres kontaktowy — nigdy nie służy do logowania.',
        choose: 'Wybierz…', save: 'Zapisz i kontynuuj', saving: 'Zapisywanie…', signOut: 'Wyloguj',
        missing: 'Uzupełnij wymagane pola.', badEmail: 'Dodatkowy e-mail wygląda na nieprawidłowy.', badSite: 'Adres strony wygląda na nieprawidłowy.' },
  it: { title: 'Completa il profilo', sub: 'Il tuo account gratuito è pronto. Dicci chi sei — i campi con * sono obbligatori.',
        required: 'Obbligatori', optional: 'Facoltativi',
        name: 'Il tuo nome *', namePh: 'es. Alex Schneider', companyName: 'Ragione sociale *', companyType: 'Tipo di azienda *', other: 'Specifica *',
        role: 'Il tuo ruolo', street: 'Via e numero civico', postal: 'CAP', city: 'Città', website: 'Sito web aziendale',
        secondEmail: 'E-mail secondaria', secondHint: 'Un indirizzo di contatto aggiuntivo — non viene mai usato per l’accesso.',
        choose: 'Seleziona…', save: 'Salva e continua', saving: 'Salvataggio…', signOut: 'Esci',
        missing: 'Compila i campi obbligatori.', badEmail: 'L’e-mail secondaria non sembra valida.', badSite: 'L’indirizzo del sito non sembra valido.' },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** One display name in, first/last out — the same split the social sign-in
 *  uses, so a name typed here and a name from Google land in the same shape.
 *  No second name field exists anywhere: firstName/lastName stay the storage. */
export const splitName = (full: string): { firstName: string; lastName: string } => {
  const parts = trim(full).split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
};

/** Has the account got the name a team invitation needs? */
export const hasDisplayName = (u: User | null | undefined): boolean =>
  !!(u && trim(u.firstName ?? ''));

/**
 * The one thing a checkout is still allowed to stop for: a Team plan whose
 * buyer has no name yet.
 *
 * Everything else that used to be asked here — company, type, city — is gone
 * (owner, 2026-08-31). None of it reaches the invoice: Paddle is the merchant
 * of record, collects its own billing details and company name at checkout,
 * and we read them back from the webhook. Asking again was a form between a
 * decided buyer and their card for data we already get.
 *
 * A name is different, and only for teams: the invitation mail has to say who
 * is inviting. "Someone has added you to a team" is not an invitation anyone
 * accepts.
 */
export const nameNeededForCheckout = (u: User | null | undefined, isTeam: boolean): boolean =>
  isTeam && !hasDisplayName(u);

/** Team members inherit the company from the organization. */
const isTeamMember = (u: User): boolean => u.orgRole === 'member';

/**
 * Does this account still owe the profile step? Required: a name, and — for
 * everyone except team members — company name + type (+ description for
 * "other"). Admin roles are exempt.
 */
export const profileIncomplete = (u: User | null | undefined): boolean => {
  if (!u || isAdminRole(u.role)) return false;
  if (!hasDisplayName(u)) return true;
  if (isTeamMember(u)) return false;
  const type = normalizeCompanyType(u.companyType);
  if (!trim(u.companyName ?? '') || !type) return true;
  return type === 'other' && !trim(u.companyTypeOther ?? '');
};

export const OnboardingSheet: React.FC<{
  language: Language;
  user: User;
  onDone: (patch: Partial<User>) => void;
  /** The only way past the step without completing it. */
  onSignOut: () => void;
}> = ({ language, user, onDone, onSignOut }) => {
  const c = COPY[language] ?? COPY.en;
  const typeLabels = COMPANY_TYPE_LABELS_I18N[language] ?? COMPANY_TYPE_LABELS_I18N.en;
  const member = isTeamMember(user);

  const [name, setName] = useState([user.firstName, user.lastName].filter(Boolean).join(' '));
  const [companyName, setCompanyName] = useState(user.companyName ?? '');
  const [companyType, setCompanyType] = useState(normalizeCompanyType(user.companyType) ?? '');
  const [companyTypeOther, setCompanyTypeOther] = useState(user.companyTypeOther ?? '');
  const [jobRole, setJobRole] = useState(user.jobRole ?? '');
  const [street, setStreet] = useState(user.companyStreet ?? '');
  const [postal, setPostal] = useState(user.companyPostalCode ?? '');
  const [city, setCity] = useState(user.companyCity ?? '');
  const [website, setWebsite] = useState(user.companyWebsite ?? '');
  const [second, setSecond] = useState(user.secondaryEmail ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const requiredOk = !!trim(name) && (member || (
    !!trim(companyName) && !!companyType && (companyType !== 'other' || !!trim(companyTypeOther))));

  const save = async () => {
    if (busy) return;
    if (!requiredOk) { setErr(c.missing); return; }
    if (trim(second) && !EMAIL_RE.test(trim(second))) { setErr(c.badEmail); return; }
    const site = member ? '' : normalizeWebsite(website);
    if (site === null) { setErr(c.badSite); return; }
    setBusy(true); setErr('');
    try {
      const patch: Partial<User> = { ...splitName(name) };
      if (jobRole) patch.jobRole = jobRole as User['jobRole'];
      if (trim(second)) patch.secondaryEmail = trim(second);
      if (!member) {
        Object.assign(patch, {
          companyName: trim(companyName),
          companyType,
          companyTypeOther: companyType === 'other' ? trim(companyTypeOther).slice(0, COMPANY_TYPE_OTHER_MAX) : '',
        });
        // Optional fields: only written when given, so nothing existing is blanked.
        if (trim(street)) patch.companyStreet = trim(street);
        if (trim(postal)) patch.companyPostalCode = trim(postal);
        if (trim(city)) patch.companyCity = trim(city);
        if (site) patch.companyWebsite = site;
      }
      await updateMyProfile(user.id, patch as any);
      onDone(patch);
    } catch (e: any) {
      setErr(e?.message || 'save failed');
      setBusy(false);
    }
  };

  const field = 'w-full px-4 py-2.5 rounded-xl bg-[#0e1c18] border border-white/15 text-white outline-none transition focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/25';
  const label = 'block text-[11px] font-semibold uppercase tracking-wider text-white/60 mb-1.5';
  const group = 'text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-300/80';

  return (
    <div className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto" data-testid="profile-sheet">
      <div className="w-full max-w-lg bg-[#0b1713] border border-white/12 rounded-2xl shadow-2xl p-6 my-auto">
        <h2 className="text-xl font-bold text-white">{c.title}</h2>
        <p className="text-sm text-white/55 mt-1.5">{c.sub}</p>

        <div className="mt-5 space-y-3.5">
          <div className={group}>{c.required}</div>
          <div>
            <label className={label}>{c.name}</label>
            <input className={field} value={name} placeholder={c.namePh} onChange={e => setName(e.target.value)} autoFocus data-testid="profile-name" />
          </div>
          {!member && (
            <>
              <div>
                <label className={label}>{c.companyName}</label>
                <input className={field} value={companyName} onChange={e => setCompanyName(e.target.value)} data-testid="profile-company" />
              </div>
              <div>
                <label className={label}>{c.companyType}</label>
                <select className={field} value={companyType} onChange={e => setCompanyType(e.target.value)} data-testid="profile-company-type">
                  <option value="">{c.choose}</option>
                  {COMPANY_TYPES.map(code => <option key={code} value={code}>{typeLabels[code]}</option>)}
                </select>
                {companyType === 'other' && (
                  <input className={`${field} mt-2`} placeholder={c.other} maxLength={COMPANY_TYPE_OTHER_MAX}
                    value={companyTypeOther} onChange={e => setCompanyTypeOther(e.target.value)} />
                )}
              </div>
            </>
          )}

          <div className={`${group} pt-2`}>{c.optional}</div>
          <div>
            <label className={label}>{c.role}</label>
            <select className={field} value={jobRole} onChange={e => setJobRole(e.target.value)}>
              <option value="">{c.choose}</option>
              {JOB_ROLES.map(code => <option key={code} value={code}>{jobRoleLabel(code, language)}</option>)}
            </select>
          </div>
          {!member && (
            <>
              <div>
                <label className={label}>{c.street}</label>
                <input className={field} value={street} onChange={e => setStreet(e.target.value)} autoComplete="street-address" />
              </div>
              <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3">
                <div>
                  <label className={label}>{c.postal}</label>
                  <input className={field} value={postal} onChange={e => setPostal(e.target.value)} autoComplete="postal-code" />
                </div>
                <div>
                  <label className={label}>{c.city}</label>
                  <input className={field} value={city} onChange={e => setCity(e.target.value)} autoComplete="address-level2" />
                </div>
              </div>
              <div>
                <label className={label}>{c.website}</label>
                <input className={field} value={website} placeholder="example.com" onChange={e => setWebsite(e.target.value)} />
              </div>
            </>
          )}
          <div>
            <label className={label}>{c.secondEmail}</label>
            <input className={field} type="email" value={second} onChange={e => setSecond(e.target.value)} data-testid="profile-second-email" />
            <p className="text-[11px] text-white/40 mt-1.5">{c.secondHint}</p>
          </div>
        </div>

        {err && <p className="text-sm text-rose-300 mt-3">{err}</p>}

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={save}
            disabled={busy || !requiredOk}
            data-testid="profile-save"
            className="flex-1 py-3 px-4 rounded-xl font-bold text-[#04251d] bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 transition disabled:opacity-50"
          >
            {busy ? c.saving : c.save}
          </button>
          <button
            onClick={onSignOut}
            disabled={busy}
            className="py-3 px-5 rounded-xl font-semibold text-white/60 hover:text-white hover:bg-white/[0.07] transition"
          >
            {c.signOut}
          </button>
        </div>
      </div>
    </div>
  );
};


/* ── Name gate (Team checkout) ───────────────────────────────────────────── */

const GATE: Record<string, { title: string; body: string; ph: string; go: string; cancel: string; saving: string }> = {
  en: { title: 'One thing before checkout', body: 'Team invitations are sent in your name, so your colleagues can see who added them.',
        ph: 'e.g. Alex Schneider', go: 'Continue to checkout', cancel: 'Cancel', saving: 'Saving…' },
  de: { title: 'Eine Angabe fehlt noch', body: 'Team-Einladungen werden in Ihrem Namen versendet, damit Kolleginnen und Kollegen sehen, wer sie hinzugefügt hat.',
        ph: 'z. B. Alex Schneider', go: 'Weiter zur Zahlung', cancel: 'Abbrechen', saving: 'Wird gespeichert…' },
  fr: { title: 'Une information avant le paiement', body: 'Les invitations d’équipe sont envoyées en votre nom, afin que vos collègues sachent qui les a ajoutés.',
        ph: 'p. ex. Alex Schneider', go: 'Continuer vers le paiement', cancel: 'Annuler', saving: 'Enregistrement…' },
  pl: { title: 'Jeszcze jedna informacja', body: 'Zaproszenia do zespołu są wysyłane w Twoim imieniu, aby współpracownicy wiedzieli, kto ich dodał.',
        ph: 'np. Alex Schneider', go: 'Przejdź do płatności', cancel: 'Anuluj', saving: 'Zapisywanie…' },
  it: { title: 'Un dato prima del pagamento', body: 'Gli inviti al team vengono inviati a tuo nome, così i colleghi sanno chi li ha aggiunti.',
        ph: 'es. Alex Schneider', go: 'Continua al pagamento', cancel: 'Annulla', saving: 'Salvataggio…' },
};

export const TeamNameGate: React.FC<{
  language: Language;
  user: User;
  onSaved: (patch: Partial<User>) => void;
  onCancel: () => void;
}> = ({ language, user, onSaved, onCancel }) => {
  const c = GATE[language] ?? GATE.en;
  const [name, setName] = useState([user.firstName, user.lastName].filter(Boolean).join(' '));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const go = async () => {
    if (!trim(name)) return;
    setBusy(true); setErr('');
    try {
      const patch = splitName(name);
      await updateMyProfile(user.id, patch);
      onSaved(patch);
    } catch (e: any) { setErr(e?.message || 'save failed'); setBusy(false); }
  };

  const field = 'w-full px-4 py-3 rounded-xl bg-[#0e1c18] border border-white/15 text-white outline-none transition focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/25';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" data-testid="team-name-gate">
      <div className="w-full max-w-md bg-[#0b1713] border border-white/12 rounded-2xl shadow-2xl p-6">
        <h2 className="text-xl font-bold text-white">{c.title}</h2>
        <p className="text-sm text-white/60 mt-2 leading-relaxed">{c.body}</p>
        <input
          className={`${field} mt-5`}
          value={name}
          placeholder={c.ph}
          autoFocus
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') go(); }}
          data-testid="team-name-input"
        />
        {err && <p className="text-sm text-rose-300 mt-3">{err}</p>}
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={go}
            disabled={busy || !trim(name)}
            className="flex-1 py-3 px-4 rounded-xl font-bold text-[#04251d] bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 transition disabled:opacity-50"
            data-testid="team-name-continue"
          >
            {busy ? c.saving : c.go}
          </button>
          <button onClick={onCancel} disabled={busy} className="py-3 px-5 rounded-xl font-semibold text-white/70 hover:text-white hover:bg-white/[0.07] transition">
            {c.cancel}
          </button>
        </div>
      </div>
    </div>
  );
};
