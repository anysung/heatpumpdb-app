/**
 * welcomeMailCopy - the welcome / Premium-trial activation notice sent once,
 * by finalizeSignup (activateAccount), when an account is activated WITH a
 * fresh trial. Separate from index.js so the wording can be tested without
 * Firestore or SMTP (tests/welcome-mail.unit.mjs).
 *
 * Owner decision 2026-09-28 (original wording, Korean): "가입을 축하합니다.
 * 현재 프리미엄 기능 15일 무료 사용권이 활성화 되었습니다. 앱 전체 기능을
 * 제한없이 사용 가능합니다. 15일 무료 사용 기간 종료 후 Standard 서비스는
 * 계속 사용 가능합니다." — plus the trial end date, and that no payment method
 * is needed and nothing is charged automatically.
 *
 * Naming: the free-of-charge tier is "Standard" — first mention with the
 * parenthetical (free / kostenlos / gratuit / bezpłatny / gratuito), never
 * "Free". The trial is a "15-day Premium trial".
 *
 * `{{CTA}}` marks where the letterhead places the button (see withCta in
 * index.js); the site URL also stays in the text for clients that strip it.
 */

const MONTHS = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  // Genitive — the form a Polish date takes ("do 12 października 2026").
  pl: ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'],
  it: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
};

/** Trial end date in the reader's language. Formatted by hand (not Intl) so
 *  the result does not depend on the runtime's ICU data, and so French and
 *  Italian get their ordinal first day ("1er octobre", "1º ottobre"). UTC,
 *  like the trial reminders. */
function formatTrialEnd(ms, lang) {
  const L = MONTHS[lang] ? lang : 'en';
  const d = new Date(ms);
  const day = d.getUTCDate(), month = MONTHS[L][d.getUTCMonth()], year = d.getUTCFullYear();
  if (L === 'de') return `${day}. ${month} ${year}`;
  if (L === 'fr') return `${day === 1 ? '1er' : day} ${month} ${year}`;
  if (L === 'it') return `${day === 1 ? '1º' : day} ${month} ${year}`;
  return `${day} ${month} ${year}`;
}

const WELCOME_COPY = {
  en: ({ days, date, site }) => ({
    subject: `Welcome to HeatPump DB — your ${days}-day Premium trial is active`,
    cta: 'Open HeatPump DB',
    body: `Congratulations on signing up.

Your free ${days}-day Premium trial is now active. You can use every feature of the app, without restrictions.

Your Premium trial runs until ${date}. When the ${days} free days are over, you can keep using the service on Standard (free).

No payment method is needed, and nothing is charged automatically. A subscription begins only if you choose a Premium plan yourself.

{{CTA}}
HeatPump DB: ${site}

If you have any questions, simply reply to this message.`,
  }),
  de: ({ days, date, site }) => ({
    subject: `Willkommen bei HeatPump DB — Ihr ${days}-tägiger Premium-Test ist aktiv`,
    cta: 'HeatPump DB öffnen',
    body: `herzlichen Glückwunsch zu Ihrer Registrierung.

Ab sofort ist Ihr kostenloser ${days}-tägiger Premium-Test aktiv. Sie können alle Funktionen der App ohne Einschränkungen nutzen.

Ihr Premium-Test läuft bis zum ${date}. Nach Ablauf der ${days} kostenlosen Tage können Sie den Dienst mit Standard (kostenlos) weiter nutzen.

Es ist keine Zahlungsmethode erforderlich, und es wird nichts automatisch berechnet. Ein Abonnement beginnt nur, wenn Sie selbst einen Premium-Tarif wählen.

{{CTA}}
HeatPump DB: ${site}

Bei Fragen antworten Sie einfach auf diese Nachricht.`,
  }),
  fr: ({ days, date, site }) => ({
    subject: `Bienvenue sur HeatPump DB — votre essai Premium de ${days} jours est actif`,
    cta: 'Ouvrir HeatPump DB',
    body: `Félicitations pour votre inscription.

Votre essai Premium gratuit de ${days} jours est désormais activé. Vous pouvez utiliser toutes les fonctionnalités de l'application, sans restriction.

Votre essai Premium court jusqu'au ${date}. À la fin de ces ${days} jours gratuits, vous pouvez continuer à utiliser le service Standard (gratuit).

Aucun moyen de paiement n'est nécessaire et rien n'est facturé automatiquement. Un abonnement ne commence que si vous choisissez vous-même une offre Premium.

{{CTA}}
HeatPump DB : ${site}

Pour toute question, répondez simplement à ce message.`,
  }),
  pl: ({ days, date, site }) => ({
    subject: `Witamy w HeatPump DB — Twój ${days}-dniowy okres próbny Premium jest aktywny`,
    cta: 'Otwórz HeatPump DB',
    body: `gratulujemy rejestracji.

Twój bezpłatny ${days}-dniowy okres próbny Premium jest już aktywny. Możesz korzystać ze wszystkich funkcji aplikacji bez ograniczeń.

Okres próbny Premium trwa do ${date}. Po zakończeniu ${days} bezpłatnych dni możesz nadal korzystać z usługi w planie Standard (bezpłatny).

Nie jest potrzebna żadna metoda płatności i nic nie zostanie pobrane automatycznie. Subskrypcja rozpoczyna się tylko wtedy, gdy samodzielnie wybierzesz plan Premium.

{{CTA}}
HeatPump DB: ${site}

Jeśli masz pytania, po prostu odpowiedz na tę wiadomość.`,
  }),
  it: ({ days, date, site }) => ({
    subject: `Ti diamo il benvenuto in HeatPump DB — la tua prova Premium di ${days} giorni è attiva`,
    cta: 'Apri HeatPump DB',
    body: `congratulazioni per la registrazione.

La tua prova Premium gratuita di ${days} giorni è ora attiva. Puoi usare tutte le funzioni dell'app senza limitazioni.

La prova Premium dura fino al ${date}. Al termine dei ${days} giorni gratuiti potrai continuare a usare il servizio Standard (gratuito).

Non serve alcun metodo di pagamento e nulla viene addebitato automaticamente. Un abbonamento inizia solo se scegli tu un piano Premium.

{{CTA}}
HeatPump DB: ${site}

Per qualsiasi domanda, rispondi semplicemente a questo messaggio.`,
  }),
};

const GREETING = { en: 'Dear', de: 'Guten Tag', fr: 'Bonjour', pl: 'Dzień dobry', it: 'Buongiorno' };

/**
 * The complete message: { lang, subject, body, cta: { label, url } }.
 * `lang` falls back to English for anything unknown; `name` is optional.
 */
function buildWelcomeMail({ lang, name, endsMs, site, days = 15 }) {
  const L = WELCOME_COPY[lang] ? lang : 'en';
  const date = formatTrialEnd(endsMs, L);
  const copy = WELCOME_COPY[L]({ days, date, site });
  const who = String(name || '').trim();
  const greeting = who ? `${GREETING[L]} ${who},` : `${GREETING[L]},`;
  return {
    lang: L, date, subject: copy.subject,
    body: `${greeting}\n\n${copy.body}`,
    cta: { label: copy.cta, url: site },
  };
}

/** Idempotency: a welcome mail is due only if none was ever claimed or sent
 *  for this account. The claim is written in a transaction BEFORE the send,
 *  so a retry, a double call or a later re-activation never mails twice. */
function welcomeMailDue(user) {
  const u = user || {};
  return !u.welcomeMailSentAt && !u.welcomeMailClaimedAt;
}

module.exports = { WELCOME_COPY, formatTrialEnd, buildWelcomeMail, welcomeMailDue };
