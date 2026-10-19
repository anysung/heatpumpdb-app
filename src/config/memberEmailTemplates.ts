/**
 * memberEmailTemplates — starting points for a message to a member.
 *
 * A template is a DRAFT, never a send. Every one of these opens in an editable
 * composer because the facts differ per case and the admin is the one who
 * knows them.
 *
 * WHAT A SUSPENSION NOTICE SAYS, AND WHAT IT WITHHOLDS
 * It states that a review found an irregularity and that access is suspended
 * while that stands — and it does not itemise what was seen. That is deliberate
 * (owner decision, 2026-08-23): describing the signal teaches the next person
 * how to avoid it, and a reader with nothing to hide simply replies, which is
 * the outcome the appeal line is there to produce. What it must never do is
 * claim a specific finding we could not stand behind if asked, so the wording
 * stays at the level we can defend: a review, an irregularity, a decision.
 *
 * THE MULTI-EDITION PARAGRAPH IS NOT PART OF THE REASON
 * One account per national edition exists for the operational integrity of the
 * service, not to ration access, and a member who wants two editions is told
 * plainly to register each with its own address. It sits in the notice as
 * guidance, deliberately separate from the suspension: presenting it as the
 * cause would tell a reader who used two addresses that they were punished for
 * following the very rule we are quoting.
 *
 * The data-protection paragraph is a different matter and belongs in the
 * suspension notice: it restates the Data-use term the member already accepted
 * at registration, in the conditional. It never counts our defences or names
 * them — a reader who learns how many layers there are, or that published rows
 * carry markers of a particular kind, has learned how to work around them.
 *
 * LANGUAGE (owner 2026-10-19): a member is written to in the language of
 * their market — DE German, FR French, PL Polish, IT Italian, GB English. The
 * composer opens in that language. The everyday support templates (SUPPORT_*
 * below) exist in all five. The case-by-case notices above them stay English
 * only, because their wording is a legal position; the composer flags them so
 * an admin translates them deliberately rather than by accident.
 */
import { User } from '../types';
import { COUNTRY_PROFILES } from './countryProfiles';
import { translations } from '../translations';
import type { MemberEmailKind } from '../services/memberMailService';

export type MemberMailLang = 'en' | 'de' | 'fr' | 'pl' | 'it';
export const MEMBER_MAIL_LANGS: MemberMailLang[] = ['en', 'de', 'fr', 'pl', 'it'];

/** Mirrors MARKET_LANG in the billing function. No market → English. */
export const memberMailLangOf = (u: User): MemberMailLang =>
  ({ DE: 'de', FR: 'fr', PL: 'pl', IT: 'it', GB: 'en' } as Record<string, MemberMailLang>)[u.country ?? ''] ?? 'en';

/** Mirrors MARKET_SITE in the billing function — the site the member signs in on. */
const MARKET_SITE: Record<string, string> = {
  DE: 'https://www.heatpumpdb.de', GB: 'https://www.heatpumpdb.uk', FR: 'https://www.heatpumpdb.fr',
  PL: 'https://www.heatpumpdb.pl', IT: 'https://www.heatpumpdb.it',
};
const siteOf = (u: User): string => MARKET_SITE[u.country ?? ''] ?? 'https://www.heatpumpdb.de';

export interface MemberEmailTemplate {
  id: string;
  /** Admin-facing name in the composer's picker. */
  label: string;
  kind: MemberEmailKind;
  /** What an admin must fill in before sending — shown as a checklist. */
  fillIn?: string[];
  /** Languages the template is written in. Absent = English only. */
  langs?: MemberMailLang[];
  build: (user: User, lang: MemberMailLang) => { subject: string; body: string };
}

/** "— France edition", never "— FR edition": the member reads a market name. */
const editionOf = (u: User): string => {
  const name = u.country ? COUNTRY_PROFILES[u.country as keyof typeof COUNTRY_PROFILES]?.name : null;
  return name ? ` — ${name} edition` : '';
};

const salutation = (u: User): string => {
  const last = (u.lastName ?? '').trim();
  const first = (u.firstName ?? '').trim();
  if (last) return `Dear ${first ? `${first} ${last}` : last},`;
  return first ? `Dear ${first},` : 'Dear customer,';
};

/* No sign-off here. The server appends the signature — a letterhead in the HTML
   part, the same lines as text in the plain part — so a template cannot ship a
   second one, and an admin cannot delete it by editing the body. */
const signOff = 'Regards,';

/** The paragraph that restates the accepted Data-use term. Conditional, and
 *  specific about nothing: it is a reminder of the contract, not a threat and
 *  not a description of our controls. */
const DATA_PARAGRAPH = `Data protection. The HeatPump DB product database is protected by copyright and database rights. Access is monitored, and the published data carries protective measures that allow unauthorised copying to be identified after the data has left our systems. Automated collection, bulk copying, redistribution or unauthorised commercial use of the data by means the service does not provide is not permitted, and may lead to legal liability under our Terms of Use and applicable law.`;

/** Formal guidance, not an accusation — see the note at the top of the file. */
const MULTI_EDITION = `Using more than one national edition. Our accounts are issued one per national edition. That is an operational rule — each edition serves a different market's data and correspondence — and it is not a limit on who may use the service. If you need access to more than one edition, register each with its own email address, and with registration details that identify you and your organisation accurately.`;

/** Names the address explicitly: a suspended member cannot open the in-app
 *  support thread, and "reply to this message" alone is easy to overlook. */
const APPEAL = (days = 14) =>
  `If you believe this decision is mistaken, reply to this message or write to support@heatpumpdb.eu within ${days} days, and we will review it.`;

/* ── Everyday support templates, in the member's language ─────────────────────
   The cases that come up again and again: a confirmation or reset email held
   by a company spam filter, a new device that cannot sign in, a profile left
   half-done, a trial that has ended. Written once in all five languages so the
   composer opens in the member's own language with nothing left to translate.
   Button labels are read from the auth translations, so the mail names the
   button exactly as the member sees it on the sign-in screen. */

type Per<T> = Record<MemberMailLang, T>;

const greet = (u: User, lang: MemberMailLang): string => {
  const name = [u.firstName, u.lastName].map(s => (s ?? '').trim()).filter(Boolean).join(' ');
  const g: Per<string> = name
    ? { en: `Dear ${name},`, de: `Guten Tag ${name},`, fr: `Bonjour ${name},`, pl: 'Dzień dobry,', it: `Gentile ${name},` }
    : { en: 'Dear customer,', de: 'Sehr geehrte Damen und Herren,', fr: 'Madame, Monsieur,', pl: 'Szanowni Państwo,', it: 'Gentile cliente,' };
  return g[lang];
};

const CLOSE: Per<string> = {
  en: 'Regards,', de: 'Mit freundlichen Grüßen', fr: 'Cordialement,', pl: 'Z poważaniem', it: 'Cordiali saluti,',
};

/** The sign-in screen's own label, so the instruction matches what is on screen. */
const authLabel = (lang: MemberMailLang, key: 'verifyResendBtn' | 'forgotPass'): string =>
  String((translations[lang] as Record<string, unknown>)[key] ?? (translations.en as Record<string, unknown>)[key]);

/** Subject line of the confirmation mail the billing function sends (VERIFY_COPY). */
const VERIFY_SUBJECT: Per<string> = {
  en: 'Confirm your email address — HeatPump DB',
  de: 'Bestätigen Sie Ihre E-Mail-Adresse — HeatPump DB',
  fr: 'Confirmez votre adresse e-mail — HeatPump DB',
  pl: 'Potwierdź swój adres e-mail — HeatPump DB',
  it: 'Conferma il tuo indirizzo e-mail — HeatPump DB',
};

const letter = (u: User, lang: MemberMailLang, subject: Per<string>, body: Per<string>) => ({
  subject: subject[lang],
  body: `${greet(u, lang)}\n\n${body[lang]}\n\n${CLOSE[lang]}`,
});

const SUPPORT_TEMPLATES: MemberEmailTemplate[] = [
  {
    id: 'support_verify_email',
    label: 'Support — email not confirmed (spam / resend)',
    kind: 'support_reply',
    langs: MEMBER_MAIL_LANGS,
    build: (u, lang) => {
      const site = siteOf(u);
      const resend = authLabel(lang, 'verifyResendBtn');
      const q = VERIFY_SUBJECT[lang];
      return letter(u, lang, {
        en: 'HeatPump DB — your email address is not confirmed yet',
        de: 'HeatPump DB — Ihre E-Mail-Adresse ist noch nicht bestätigt',
        fr: "HeatPump DB — votre adresse e-mail n'est pas encore confirmée",
        pl: 'HeatPump DB — adres e-mail nie został jeszcze potwierdzony',
        it: "HeatPump DB — il Suo indirizzo e-mail non è ancora confermato",
      }, {
        en: `Thank you for creating a HeatPump DB account with this address (${u.email}). We sent you a confirmation email, but the address has not been confirmed yet, so the account cannot be activated.

Company mail systems sometimes file the confirmation email as spam or junk, or hold it in quarantine. Please try again as follows:

1. Look in your spam or junk folder for the email "${q}".
2. If you cannot find it, sign in at ${site} and click "${resend}".
3. Adding support@heatpumpdb.eu to your contacts or safe senders lets our next emails reach your inbox.

Each confirmation link can be used once. Please use the link in the most recent email. If no email arrives, simply reply to this message and we will help you directly.`,
        de: `vielen Dank, dass Sie mit dieser Adresse (${u.email}) ein HeatPump DB Konto erstellt haben. Wir haben Ihnen eine Bestätigungs-E-Mail gesendet, die Bestätigung Ihrer E-Mail-Adresse ist jedoch noch nicht abgeschlossen; das Konto kann deshalb noch nicht aktiviert werden.

In Firmen-E-Mail-Systemen wird die Bestätigungs-E-Mail gelegentlich als Spam bzw. Junk eingestuft oder in die Quarantäne verschoben. Bitte versuchen Sie es wie folgt erneut:

1. Suchen Sie in Ihrem Spam- bzw. Junk-Ordner nach der E-Mail „${q}“.
2. Falls Sie sie nicht finden, melden Sie sich unter ${site} an und klicken Sie auf „${resend}“.
3. Wenn Sie support@heatpumpdb.eu zu Ihren Kontakten bzw. sicheren Absendern hinzufügen, gelangen weitere E-Mails von uns direkt in Ihren Posteingang.

Jeder Bestätigungslink kann nur einmal verwendet werden. Bitte verwenden Sie den Link aus der zuletzt erhaltenen E-Mail. Sollte weiterhin keine E-Mail ankommen, antworten Sie einfach auf diese Nachricht — wir helfen Ihnen dann direkt weiter.`,
        fr: `Merci d'avoir créé un compte HeatPump DB avec cette adresse (${u.email}). Nous vous avons envoyé un e-mail de confirmation, mais l'adresse n'est pas encore confirmée : le compte ne peut donc pas être activé.

Les messageries d'entreprise classent parfois l'e-mail de confirmation dans les spams ou les courriers indésirables, ou le retiennent en quarantaine. Merci de réessayer comme suit :

1. Cherchez dans votre dossier spam ou courrier indésirable l'e-mail « ${q} ».
2. Si vous ne le trouvez pas, connectez-vous sur ${site} et cliquez sur « ${resend} ».
3. En ajoutant support@heatpumpdb.eu à vos contacts ou expéditeurs approuvés, nos prochains e-mails arriveront dans votre boîte de réception.

Chaque lien de confirmation n'est utilisable qu'une seule fois : utilisez le lien du message le plus récent. Si aucun e-mail n'arrive, répondez simplement à ce message et nous vous aiderons directement.`,
        pl: `Dziękujemy za założenie konta HeatPump DB na ten adres (${u.email}). Wysłaliśmy wiadomość z potwierdzeniem, ale adres nie został jeszcze potwierdzony, dlatego konto nie może zostać aktywowane.

Firmowe systemy pocztowe czasami klasyfikują tę wiadomość jako spam lub zatrzymują ją w kwarantannie. Prosimy spróbować ponownie w następujący sposób:

1. Prosimy sprawdzić folder spam lub wiadomości-śmieci i wyszukać wiadomość „${q}”.
2. Jeśli jej tam nie ma, prosimy zalogować się na ${site} i kliknąć „${resend}”.
3. Dodanie adresu support@heatpumpdb.eu do kontaktów lub zaufanych nadawców sprawi, że kolejne wiadomości od nas trafią do skrzynki odbiorczej.

Każdy link potwierdzający można wykorzystać tylko raz. Prosimy użyć linku z najnowszej wiadomości. Jeśli wiadomość nadal nie dociera, wystarczy odpowiedzieć na ten e-mail — pomożemy bezpośrednio.`,
        it: `La ringraziamo per aver creato un account HeatPump DB con questo indirizzo (${u.email}). Le abbiamo inviato un'e-mail di conferma, ma l'indirizzo non risulta ancora confermato, quindi l'account non può essere attivato.

I sistemi di posta aziendali a volte classificano l'e-mail di conferma come spam o posta indesiderata, oppure la trattengono in quarantena. La preghiamo di riprovare come segue:

1. Cerchi nella cartella spam o posta indesiderata l'e-mail «${q}».
2. Se non la trova, acceda a ${site} e clicchi su «${resend}».
3. Aggiungendo support@heatpumpdb.eu ai contatti o ai mittenti attendibili, le nostre prossime e-mail arriveranno nella posta in arrivo.

Ogni link di conferma può essere usato una sola volta: utilizzi il link dell'e-mail più recente. Se non riceve alcuna e-mail, risponda semplicemente a questo messaggio e La aiuteremo direttamente.`,
      });
    },
  },
  {
    id: 'support_devices_cleared',
    label: 'Support — devices reset, sign in again',
    kind: 'support_reply',
    langs: MEMBER_MAIL_LANGS,
    fillIn: ['Send AFTER pressing "Clear all devices" in Support tools'],
    build: (u, lang) => {
      const site = siteOf(u);
      return letter(u, lang, {
        en: 'HeatPump DB — you can sign in on your new device',
        de: 'HeatPump DB — Anmeldung auf Ihrem neuen Gerät ist wieder möglich',
        fr: 'HeatPump DB — vous pouvez vous connecter sur votre nouvel appareil',
        pl: 'HeatPump DB — można już zalogować się na nowym urządzeniu',
        it: 'HeatPump DB — ora può accedere dal nuovo dispositivo',
      }, {
        en: `We have reset the list of signed-in devices on your HeatPump DB account (${u.email}). You can now sign in on your new device at ${site}.

Each plan allows a limited number of devices to be signed in at the same time (Standard: one, Premium: three). The list is now empty, so devices you used before will ask you to sign in again.

Your plan, your settings and your saved data are unchanged.

If signing in still does not work, reply to this message and tell us which device and browser you are using.`,
        de: `wir haben die Liste der angemeldeten Geräte Ihres HeatPump DB Kontos (${u.email}) zurückgesetzt. Sie können sich jetzt unter ${site} auf Ihrem neuen Gerät anmelden.

Jeder Tarif erlaubt eine begrenzte Zahl gleichzeitig angemeldeter Geräte (Standard: eines, Premium: drei). Die Liste ist jetzt leer; auf bisher genutzten Geräten müssen Sie sich daher erneut anmelden.

Ihr Tarif, Ihre Einstellungen und Ihre gespeicherten Daten bleiben unverändert.

Sollte die Anmeldung weiterhin nicht funktionieren, antworten Sie bitte auf diese Nachricht und teilen Sie uns mit, welches Gerät und welchen Browser Sie verwenden.`,
        fr: `Nous avons réinitialisé la liste des appareils connectés à votre compte HeatPump DB (${u.email}). Vous pouvez désormais vous connecter sur votre nouvel appareil sur ${site}.

Chaque offre autorise un nombre limité d'appareils connectés simultanément (Standard : un, Premium : trois). La liste étant désormais vide, les appareils utilisés auparavant vous demanderont de vous reconnecter.

Votre offre, vos réglages et vos données enregistrées restent inchangés.

Si la connexion ne fonctionne toujours pas, répondez à ce message en nous indiquant l'appareil et le navigateur utilisés.`,
        pl: `Zresetowaliśmy listę zalogowanych urządzeń na koncie HeatPump DB (${u.email}). Można już zalogować się na nowym urządzeniu na stronie ${site}.

Każdy plan pozwala na ograniczoną liczbę urządzeń zalogowanych jednocześnie (Standard: jedno, Premium: trzy). Lista jest teraz pusta, dlatego na wcześniej używanych urządzeniach trzeba będzie zalogować się ponownie.

Plan, ustawienia i zapisane dane pozostają bez zmian.

Jeśli logowanie nadal nie działa, prosimy odpowiedzieć na tę wiadomość i podać, z jakiego urządzenia i przeglądarki Państwo korzystają.`,
        it: `Abbiamo azzerato l'elenco dei dispositivi connessi al Suo account HeatPump DB (${u.email}). Ora può accedere dal nuovo dispositivo su ${site}.

Ogni piano consente un numero limitato di dispositivi connessi contemporaneamente (Standard: uno, Premium: tre). L'elenco ora è vuoto, quindi sui dispositivi usati in precedenza Le verrà chiesto di accedere di nuovo.

Il Suo piano, le impostazioni e i dati salvati restano invariati.

Se l'accesso continua a non funzionare, risponda a questo messaggio indicando dispositivo e browser utilizzati.`,
      });
    },
  },
  {
    id: 'support_password_reset',
    label: 'Support — password reset email not received',
    kind: 'support_reply',
    langs: MEMBER_MAIL_LANGS,
    build: (u, lang) => {
      const site = siteOf(u);
      const forgot = authLabel(lang, 'forgotPass');
      return letter(u, lang, {
        en: 'HeatPump DB — resetting your password',
        de: 'HeatPump DB — Zurücksetzen Ihres Passworts',
        fr: 'HeatPump DB — réinitialiser votre mot de passe',
        pl: 'HeatPump DB — resetowanie hasła',
        it: 'HeatPump DB — reimpostare la password',
      }, {
        en: `This is about resetting the password of your HeatPump DB account (${u.email}).

Company mail systems sometimes file this email as spam or junk, or hold it in quarantine. Please try again as follows:

1. Look in your spam or junk folder for an email from support@heatpumpdb.eu.
2. If you cannot find it, open the sign-in screen at ${site}, click "${forgot}" and enter this address.
3. Adding support@heatpumpdb.eu to your contacts or safe senders lets our emails reach your inbox.

Each reset link can be used once — please use the link in the most recent email.

If you created the account with Google or Apple sign-in, you do not need a password: use the same button on the sign-in screen.

If no email arrives, reply to this message and we will help you directly.`,
        de: `es geht um das Zurücksetzen des Passworts für Ihr HeatPump DB Konto (${u.email}).

In Firmen-E-Mail-Systemen wird diese E-Mail gelegentlich als Spam bzw. Junk eingestuft oder in die Quarantäne verschoben. Bitte versuchen Sie es wie folgt erneut:

1. Suchen Sie in Ihrem Spam- bzw. Junk-Ordner nach einer E-Mail von support@heatpumpdb.eu.
2. Falls Sie sie nicht finden, öffnen Sie die Anmeldeseite unter ${site}, klicken Sie auf „${forgot}“ und geben Sie diese Adresse ein.
3. Wenn Sie support@heatpumpdb.eu zu Ihren Kontakten bzw. sicheren Absendern hinzufügen, gelangen unsere E-Mails direkt in Ihren Posteingang.

Jeder Link zum Zurücksetzen kann nur einmal verwendet werden — bitte verwenden Sie den Link aus der zuletzt erhaltenen E-Mail.

Wenn Sie das Konto mit der Google- oder Apple-Anmeldung erstellt haben, benötigen Sie kein Passwort: Verwenden Sie auf der Anmeldeseite einfach dieselbe Schaltfläche.

Sollte weiterhin keine E-Mail ankommen, antworten Sie einfach auf diese Nachricht — wir helfen Ihnen dann direkt weiter.`,
        fr: `Ce message concerne la réinitialisation du mot de passe de votre compte HeatPump DB (${u.email}).

Les messageries d'entreprise classent parfois cet e-mail dans les spams ou les courriers indésirables, ou le retiennent en quarantaine. Merci de réessayer comme suit :

1. Cherchez dans votre dossier spam ou courrier indésirable un e-mail de support@heatpumpdb.eu.
2. Si vous ne le trouvez pas, ouvrez l'écran de connexion sur ${site}, cliquez sur « ${forgot} » et saisissez cette adresse.
3. En ajoutant support@heatpumpdb.eu à vos contacts ou expéditeurs approuvés, nos e-mails arriveront dans votre boîte de réception.

Chaque lien de réinitialisation n'est utilisable qu'une seule fois : utilisez le lien du message le plus récent.

Si vous avez créé le compte avec la connexion Google ou Apple, aucun mot de passe n'est nécessaire : utilisez le même bouton sur l'écran de connexion.

Si aucun e-mail n'arrive, répondez simplement à ce message et nous vous aiderons directement.`,
        pl: `Ta wiadomość dotyczy resetowania hasła do konta HeatPump DB (${u.email}).

Firmowe systemy pocztowe czasami klasyfikują tę wiadomość jako spam lub zatrzymują ją w kwarantannie. Prosimy spróbować ponownie w następujący sposób:

1. Prosimy sprawdzić folder spam lub wiadomości-śmieci i wyszukać wiadomość od support@heatpumpdb.eu.
2. Jeśli jej tam nie ma, prosimy otworzyć ekran logowania na ${site}, kliknąć „${forgot}” i wpisać ten adres.
3. Dodanie adresu support@heatpumpdb.eu do kontaktów lub zaufanych nadawców sprawi, że nasze wiadomości trafią do skrzynki odbiorczej.

Każdy link resetujący można wykorzystać tylko raz — prosimy użyć linku z najnowszej wiadomości.

Jeśli konto zostało założone przez logowanie Google lub Apple, hasło nie jest potrzebne: wystarczy użyć tego samego przycisku na ekranie logowania.

Jeśli wiadomość nadal nie dociera, wystarczy odpowiedzieć na ten e-mail — pomożemy bezpośrednio.`,
        it: `Questo messaggio riguarda la reimpostazione della password del Suo account HeatPump DB (${u.email}).

I sistemi di posta aziendali a volte classificano questa e-mail come spam o posta indesiderata, oppure la trattengono in quarantena. La preghiamo di riprovare come segue:

1. Cerchi nella cartella spam o posta indesiderata un'e-mail da support@heatpumpdb.eu.
2. Se non la trova, apra la schermata di accesso su ${site}, clicchi su «${forgot}» e inserisca questo indirizzo.
3. Aggiungendo support@heatpumpdb.eu ai contatti o ai mittenti attendibili, le nostre e-mail arriveranno nella posta in arrivo.

Ogni link di reimpostazione può essere usato una sola volta: utilizzi il link dell'e-mail più recente.

Se ha creato l'account con l'accesso Google o Apple, non serve alcuna password: usi lo stesso pulsante nella schermata di accesso.

Se non riceve alcuna e-mail, risponda semplicemente a questo messaggio e La aiuteremo direttamente.`,
      });
    },
  },
  {
    id: 'support_profile_incomplete',
    label: 'Support — profile not completed',
    kind: 'support_reply',
    langs: MEMBER_MAIL_LANGS,
    build: (u, lang) => {
      const site = siteOf(u);
      return letter(u, lang, {
        en: 'HeatPump DB — one step left: your profile',
        de: 'HeatPump DB — ein Schritt fehlt noch: Ihr Profil',
        fr: 'HeatPump DB — une dernière étape : votre profil',
        pl: 'HeatPump DB — został jeszcze jeden krok: profil',
        it: 'HeatPump DB — manca un ultimo passo: il Suo profilo',
      }, {
        en: `Thank you for creating a HeatPump DB account (${u.email}). One step is still open: your profile.

HeatPump DB is a service for professionals, so we ask for your name, your company name and your company type before the account is ready to use. It takes about a minute: sign in at ${site} and the profile form opens by itself.

If something stopped you at that step, reply to this message and tell us what happened — we will sort it out.`,
        de: `vielen Dank, dass Sie ein HeatPump DB Konto erstellt haben (${u.email}). Ein Schritt ist noch offen: Ihr Profil.

HeatPump DB ist ein Dienst für Fachleute. Deshalb bitten wir um Ihren Namen, den Namen Ihres Unternehmens und die Unternehmensart, bevor das Konto genutzt werden kann. Das dauert etwa eine Minute: Melden Sie sich unter ${site} an, das Profilformular öffnet sich automatisch.

Falls Sie bei diesem Schritt nicht weitergekommen sind, antworten Sie bitte auf diese Nachricht und schildern Sie kurz, was passiert ist — wir kümmern uns darum.`,
        fr: `Merci d'avoir créé un compte HeatPump DB (${u.email}). Une étape reste à compléter : votre profil.

HeatPump DB est un service destiné aux professionnels : nous vous demandons donc votre nom, le nom de votre entreprise et son type avant que le compte soit utilisable. Cela prend environ une minute : connectez-vous sur ${site} et le formulaire de profil s'ouvre automatiquement.

Si quelque chose vous a bloqué à cette étape, répondez à ce message en nous décrivant ce qui s'est passé : nous nous en occupons.`,
        pl: `Dziękujemy za założenie konta HeatPump DB (${u.email}). Do wykonania pozostał jeszcze jeden krok: uzupełnienie profilu.

HeatPump DB jest serwisem dla profesjonalistów, dlatego zanim konto będzie gotowe do użytku, prosimy o podanie imienia i nazwiska, nazwy firmy oraz rodzaju firmy. Zajmuje to około minuty: wystarczy zalogować się na ${site}, a formularz profilu otworzy się automatycznie.

Jeśli na tym etapie coś poszło nie tak, prosimy odpowiedzieć na tę wiadomość i opisać, co się stało — zajmiemy się tym.`,
        it: `La ringraziamo per aver creato un account HeatPump DB (${u.email}). Resta un ultimo passo: il Suo profilo.

HeatPump DB è un servizio per professionisti: prima che l'account sia pronto all'uso, Le chiediamo quindi nome e cognome, il nome dell'azienda e il tipo di azienda. Ci vuole circa un minuto: acceda a ${site} e il modulo del profilo si aprirà automaticamente.

Se ha incontrato un problema in questo passaggio, risponda a questo messaggio descrivendo cosa è successo e ce ne occuperemo noi.`,
      });
    },
  },
  {
    id: 'support_trial_ended',
    label: 'Trial — ended, now on Standard',
    kind: 'trial',
    langs: MEMBER_MAIL_LANGS,
    build: (u, lang) => letter(u, lang, {
      en: 'HeatPump DB — your Premium trial has ended',
      de: 'HeatPump DB — Ihr Premium-Testzeitraum ist beendet',
      fr: 'HeatPump DB — votre essai Premium est terminé',
      pl: 'HeatPump DB — okres próbny Premium dobiegł końca',
      it: 'HeatPump DB — la prova Premium è terminata',
    }, {
      en: `Your Premium trial on HeatPump DB (${u.email}) has ended, and your account now continues on Standard, free of charge. Nothing has been charged, and nothing will be unless you choose a plan yourself.

On Standard, search, the residential catalogue with basic specifications, subsidies, news and market trends stay open, and your settings stay as you left them.

Full specifications, comparison, the commercial range and PDF data sheets are part of Premium, which you can choose in the app at any time.

If you have questions — about coverage, a particular manufacturer or what Premium contains — reply to this message and we will answer them directly.`,
      de: `Ihr Premium-Testzeitraum bei HeatPump DB (${u.email}) ist beendet; Ihr Konto läuft jetzt kostenlos im Standard-Tarif weiter. Es wurde nichts berechnet, und es wird auch nichts berechnet, solange Sie nicht selbst einen Tarif wählen.

Im Standard-Tarif bleiben die Suche, die Produkte für Wohngebäude mit den grundlegenden technischen Daten, Förderprogramme, News und Markttrends verfügbar, und Ihre Einstellungen bleiben unverändert.

Vollständige technische Daten, der Produktvergleich, das gewerbliche Segment und PDF-Datenblätter gehören zu Premium, das Sie jederzeit in der App wählen können.

Bei Fragen — zur Abdeckung, zu einem bestimmten Hersteller oder zum Umfang von Premium — antworten Sie einfach auf diese Nachricht; wir antworten Ihnen direkt.`,
      fr: `Votre essai Premium sur HeatPump DB (${u.email}) est terminé et votre compte continue désormais gratuitement en Standard. Rien ne vous a été facturé, et rien ne le sera tant que vous ne choisissez pas vous-même une offre.

En Standard, la recherche, le catalogue résidentiel avec les caractéristiques de base, les aides, l'actualité et les tendances du marché restent accessibles, et vos réglages restent inchangés.

Les caractéristiques complètes, la comparaison, la gamme tertiaire et les fiches techniques PDF font partie de Premium, que vous pouvez choisir à tout moment dans l'application.

Pour toute question — couverture, fabricant particulier ou contenu de Premium —, répondez simplement à ce message et nous vous répondrons directement.`,
      pl: `Okres próbny Premium w HeatPump DB (${u.email}) dobiegł końca, a konto działa teraz bezpłatnie w planie Standard. Nie pobrano żadnych opłat i nie zostaną one pobrane, dopóki sami Państwo nie wybiorą planu.

W planie Standard dostępne pozostają wyszukiwarka, katalog urządzeń do budynków mieszkalnych z podstawowymi danymi technicznymi, dotacje, aktualności i trendy rynkowe, a ustawienia pozostają bez zmian.

Pełne dane techniczne, porównywanie, segment komercyjny i karty katalogowe PDF są częścią planu Premium, który można wybrać w aplikacji w dowolnym momencie.

W razie pytań — o zakres danych, konkretnego producenta lub zawartość planu Premium — wystarczy odpowiedzieć na tę wiadomość, a odpowiemy bezpośrednio.`,
      it: `La Sua prova Premium su HeatPump DB (${u.email}) è terminata e l'account prosegue ora gratuitamente con il piano Standard. Non è stato addebitato nulla e nulla verrà addebitato finché non sarà Lei a scegliere un piano.

Con Standard restano disponibili la ricerca, il catalogo residenziale con le specifiche di base, gli incentivi, le notizie e i trend di mercato, e le Sue impostazioni restano invariate.

Specifiche complete, confronto, la gamma commerciale e le schede tecniche PDF fanno parte di Premium, che può scegliere nell'app in qualsiasi momento.

Per qualsiasi domanda — sulla copertura, su un produttore specifico o sui contenuti di Premium — risponda semplicemente a questo messaggio e Le risponderemo direttamente.`,
    }),
  },
];

export const MEMBER_EMAIL_TEMPLATES: MemberEmailTemplate[] = [
  {
    id: 'blank',
    label: 'Blank message',
    kind: 'notice',
    build: (u) => ({
      subject: 'HeatPump DB',
      body: `${salutation(u)}

${signOff}`,
    }),
  },
  ...SUPPORT_TEMPLATES,
  {
    id: 'suspension_irregularity',
    label: 'Suspension — irregularity found in review',
    kind: 'suspension',
    fillIn: [
      'List every account being suspended, with its market — one line each',
      'Remove the billing line if the member did hold a paid subscription',
      'Do not add what the irregularity was; the appeal line is what opens that conversation',
    ],
    build: (u) => ({
      subject: 'HeatPump DB — your account has been suspended',
      body: `${salutation(u)}

The following HeatPump DB account has been suspended:

• ${u.email}${editionOf(u)}

Reason. A review of this registration identified an irregularity, and access is suspended while that remains unresolved. We are not able to set out the detail of what was identified.

${MULTI_EDITION}

${DATA_PARAGRAPH}

Billing. This account held no paid subscription. No payment was taken and no amount is owed.

${APPEAL()}

${signOff}`,
    }),
  },
  {
    id: 'verification_request',
    label: 'Registration details — verification request',
    kind: 'verification_request',
    fillIn: [
      'Name the field that cannot be verified (company name, website, city)',
      'Set the deadline you intend to hold to',
    ],
    build: (u) => ({
      subject: 'HeatPump DB — please confirm your registration details',
      body: `${salutation(u)}

We are reviewing the registration details on your HeatPump DB account (${u.email}) and are unable to verify the company information provided${u.companyName ? ` ("${u.companyName}")` : ''}.

HeatPump DB is a business service, and accounts are issued to identifiable businesses. Please reply with your company name, its website, and your role there.

If we do not hear from you within 14 days, the account will be deactivated. You can ask us to restore it at any time afterwards by replying with the same information.

${signOff}`,
    }),
  },
  {
    id: 'suspension_data_use',
    label: 'Suspension — data-use term',
    kind: 'suspension',
    fillIn: [
      'REQUIRED: state the observation this rests on (what was measured, when)',
      'Do not send this template without that observation — use the duplicate-account one instead',
    ],
    build: (u) => ({
      subject: 'HeatPump DB — your account has been suspended',
      body: `${salutation(u)}

Your HeatPump DB account (${u.email}) has been suspended under the Data-use term you accepted at registration.

Observation. [State here exactly what was observed and when — the volume, the pattern, the dates. If this cannot be stated concretely, this is not the right notice to send.]

${DATA_PARAGRAPH}

${APPEAL()}

${signOff}`,
    }),
  },
  {
    id: 'reactivation',
    label: 'Account restored',
    kind: 'reactivation',
    build: (u) => ({
      subject: 'HeatPump DB — your account has been restored',
      body: `${salutation(u)}

Your HeatPump DB account (${u.email}) has been restored and you can sign in again.

Thank you for clarifying the matter.

${signOff}`,
    }),
  },
  {
    id: 'trial_extended',
    label: 'Trial — extended',
    kind: 'trial',
    fillIn: ['the new end date'],
    build: (u) => ({
      subject: 'HeatPump DB — your Premium trial has been extended',
      body: `${salutation(u)}

We have extended the Premium trial, and the change applies to your account as well.

Premium — full specifications, comparison, the commercial range and PDF data sheets — is open again on your account until [DATE]. There is nothing for you to do — simply sign in as usual. No payment details are held and nothing is charged.

If something was missing during your first days, reply to this message. We read every answer.

${signOff}`,
    }),
  },
  {
    id: 'trial_ending',
    label: 'Trial — ending soon (personal note)',
    kind: 'trial',
    fillIn: ['the end date', 'anything specific this member searched for'],
    build: (u) => ({
      subject: 'HeatPump DB — your Premium trial ends on [DATE]',
      body: `${salutation(u)}

Your Premium trial runs until [DATE]. After that your account simply continues on Standard (free) — search, the residential catalogue with basic specifications, subsidies, news and market trends stay open, and your settings stay exactly as you left them. Nothing is charged unless you choose a plan yourself.

If you have questions before deciding — about coverage, a particular manufacturer, or what a data sheet contains — reply here and we will answer them directly.

${signOff}`,
    }),
  },
  {
    id: 'billing_followup',
    label: 'Billing — follow-up on a payment matter',
    kind: 'billing',
    fillIn: ['what happened', 'what you are asking the member to do, if anything'],
    build: (u) => ({
      subject: 'HeatPump DB — about your subscription',
      body: `${salutation(u)}

[Describe the matter plainly, in one or two sentences.]

[What happens next, and what — if anything — the member needs to do.]

Payments are handled by Paddle as our merchant of record; if you need an invoice or a receipt, we can arrange it from here.

${signOff}`,
    }),
  },
  {
    id: 'announcement',
    label: 'Announcement — new feature or market',
    kind: 'announcement',
    fillIn: ['what is new', 'why it matters to this member'],
    build: (u) => ({
      subject: 'HeatPump DB — [what is new]',
      body: `${salutation(u)}

[One sentence on what is new.]

[One or two sentences on what it changes for the reader — concretely, not in adjectives.]

${signOff}`,
    }),
  },
];
