/**
 * partnerMailCopy — the creator-partner mails, in the partner's language
 * (EN / DE / FR / PL / IT). Plain text; the function wraps it in the letterhead.
 *
 * These go to individual creators about money, so the wording is factual and
 * matches the terms (src/legal/partnerTerms.ts): aggregated figures only, the
 * €50 threshold, carry-forward, the signed receipt. Amounts are formatted in
 * the reader's locale.
 */

const LOCALE = { en: 'en-GB', de: 'de-DE', fr: 'fr-FR', pl: 'pl-PL', it: 'it-IT' };
const langOf = (l) => (LOCALE[l] ? l : 'en');

const eur = (cents, lang) => new Intl.NumberFormat(LOCALE[langOf(lang)], { style: 'currency', currency: 'EUR' })
  .format((cents || 0) / 100);

const monthName = (ym, lang) => {
  const [y, m] = ym.split('-').map(Number);
  return new Intl.DateTimeFormat(LOCALE[langOf(lang)], { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, 15)));
};

const dateLong = (isoDate, lang) => new Intl.DateTimeFormat(LOCALE[langOf(lang)], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  .format(new Date(`${String(isoDate).slice(0, 10)}T12:00:00Z`));

const T = {
  en: {
    hello: (n) => (n ? `Dear ${n},` : 'Hello,'),
    sign: 'Kind regards\nHeatPump DB Partner Team',
    stSubject: (m, code) => `HeatPump DB partner statement — ${m} (${code})`,
    stIntro: (m) => `Your partner statement for ${m} is attached as a PDF, together with the line-by-line CSV.`,
    rows: {
      newPaying: 'New paying subscriptions', activePaying: 'Active paying subscriptions',
      cumulative: (n, min) => `Cumulative paying accounts: ${n} (video support from ${min})`,
      commission: 'Commission this month', deductions: 'Deductions (refunds and chargebacks)',
      video: 'Video support', paid: 'Paid out this month', closing: 'Balance at month end',
    },
    payoutDue: (amt, date) => `We will pay ${amt} by ${date}.`,
    carry: (min) => `The balance is below ${min} and carries forward; it never expires. On request we pay a smaller balance at any time — the actual transfer cost is then deducted.`,
    pending: (n) => `${n} payment(s) are still being settled by our payment provider. They are marked as pending and will be completed on a later statement.`,
    privacy: 'Statements contain aggregated figures only — never the names or contact details of the customers you referred.',
    rcSubject: (code) => `Payment sent — HeatPump DB Partner Programme (${code})`,
    rcBody: (amt, date, ref) => `We sent ${amt} to your account on ${date}${ref ? ` (reference: ${ref})` : ''}.\n\nPlease sign the attached payment receipt and return it by replying to this email — a scan or a photo is enough. The signed receipt is our record of the payment.`,
    anSubject: (y, code) => `Amounts paid in ${y} — HeatPump DB Partner Programme (${code})`,
    anBody: (y) => `As requested, the statement of all amounts we paid to you in ${y} is attached.`,
  },
  de: {
    hello: (n) => (n ? `Guten Tag ${n},` : 'Guten Tag,'),
    sign: 'Mit freundlichen Grüßen\nHeatPump DB Partner-Team',
    stSubject: (m, code) => `HeatPump DB Partner-Abrechnung — ${m} (${code})`,
    stIntro: (m) => `anbei Ihre Partner-Abrechnung für ${m} als PDF, zusammen mit der Einzelaufstellung als CSV.`,
    rows: {
      newPaying: 'Neue zahlende Abonnements', activePaying: 'Aktive zahlende Abonnements',
      cumulative: (n, min) => `Zahlende Konten insgesamt: ${n} (Videounterstützung ab ${min})`,
      commission: 'Provision in diesem Monat', deductions: 'Abzüge (Erstattungen und Rückbuchungen)',
      video: 'Videounterstützung', paid: 'In diesem Monat ausgezahlt', closing: 'Saldo zum Monatsende',
    },
    payoutDue: (amt, date) => `Wir überweisen ${amt} bis zum ${date}.`,
    carry: (min) => `Der Saldo liegt unter ${min} und wird vorgetragen; er verfällt nicht. Auf Wunsch zahlen wir einen kleineren Saldo jederzeit aus — die tatsächlichen Überweisungskosten werden dann abgezogen.`,
    pending: (n) => `${n} Zahlung(en) werden von unserem Zahlungsanbieter noch abgerechnet. Sie sind als ausstehend markiert und werden in einer späteren Abrechnung abgeschlossen.`,
    privacy: 'Abrechnungen enthalten nur zusammengefasste Zahlen — niemals Namen oder Kontaktdaten der von Ihnen geworbenen Kunden.',
    rcSubject: (code) => `Zahlung überwiesen — HeatPump DB Partnerprogramm (${code})`,
    rcBody: (amt, date, ref) => `wir haben am ${date} ${amt} auf Ihr Konto überwiesen${ref ? ` (Referenz: ${ref})` : ''}.\n\nBitte unterschreiben Sie die beigefügte Zahlungsbestätigung und senden Sie sie als Antwort auf diese E-Mail zurück — ein Scan oder Foto genügt. Die unterschriebene Bestätigung ist unser Nachweis der Zahlung.`,
    anSubject: (y, code) => `Auszahlungen ${y} — HeatPump DB Partnerprogramm (${code})`,
    anBody: (y) => `wie gewünscht erhalten Sie anbei die Aufstellung aller Beträge, die wir Ihnen ${y} ausgezahlt haben.`,
  },
  fr: {
    hello: (n) => (n ? `Bonjour ${n},` : 'Bonjour,'),
    sign: 'Cordialement\nL’équipe Partenaires HeatPump DB',
    stSubject: (m, code) => `Relevé partenaire HeatPump DB — ${m} (${code})`,
    stIntro: (m) => `Vous trouverez ci-joint votre relevé partenaire de ${m} en PDF, ainsi que le détail ligne par ligne en CSV.`,
    rows: {
      newPaying: 'Nouveaux abonnements payants', activePaying: 'Abonnements payants actifs',
      cumulative: (n, min) => `Comptes payants cumulés : ${n} (soutien vidéo à partir de ${min})`,
      commission: 'Commission du mois', deductions: 'Déductions (remboursements et rétrofacturations)',
      video: 'Soutien vidéo', paid: 'Versé ce mois-ci', closing: 'Solde en fin de mois',
    },
    payoutDue: (amt, date) => `Nous vous verserons ${amt} au plus tard le ${date}.`,
    carry: (min) => `Le solde est inférieur à ${min} et est reporté ; il n’expire jamais. Sur demande, nous versons un solde inférieur à tout moment — les frais de virement réels sont alors déduits.`,
    pending: (n) => `${n} paiement(s) sont encore en cours de règlement par notre prestataire de paiement. Ils sont marqués « en attente » et seront finalisés dans un relevé ultérieur.`,
    privacy: 'Les relevés ne contiennent que des chiffres agrégés — jamais les noms ni les coordonnées des clients que vous avez recommandés.',
    rcSubject: (code) => `Paiement effectué — Programme partenaires HeatPump DB (${code})`,
    rcBody: (amt, date, ref) => `Nous avons versé ${amt} sur votre compte le ${date}${ref ? ` (référence : ${ref})` : ''}.\n\nMerci de signer le reçu de paiement ci-joint et de nous le renvoyer en répondant à cet e-mail — un scan ou une photo suffit. Le reçu signé est notre justificatif du paiement.`,
    anSubject: (y, code) => `Montants versés en ${y} — Programme partenaires HeatPump DB (${code})`,
    anBody: (y) => `Comme demandé, vous trouverez ci-joint le relevé de tous les montants que nous vous avons versés en ${y}.`,
  },
  pl: {
    hello: (n) => (n ? `Dzień dobry ${n},` : 'Dzień dobry,'),
    sign: 'Z wyrazami szacunku\nZespół Partnerski HeatPump DB',
    stSubject: (m, code) => `Zestawienie partnerskie HeatPump DB — ${m} (${code})`,
    stIntro: (m) => `w załączniku przesyłamy Państwu zestawienie partnerskie za ${m} w formacie PDF wraz ze szczegółowym plikiem CSV.`,
    rows: {
      newPaying: 'Nowe płatne subskrypcje', activePaying: 'Aktywne płatne subskrypcje',
      cumulative: (n, min) => `Łączna liczba płacących kont: ${n} (wsparcie wideo od ${min})`,
      commission: 'Prowizja w tym miesiącu', deductions: 'Potrącenia (zwroty i obciążenia zwrotne)',
      video: 'Wsparcie wideo', paid: 'Wypłacono w tym miesiącu', closing: 'Saldo na koniec miesiąca',
    },
    payoutDue: (amt, date) => `Wypłacimy ${amt} do ${date}.`,
    carry: (min) => `Saldo jest niższe niż ${min} i przechodzi na kolejny miesiąc; nie wygasa. Na prośbę wypłacimy mniejsze saldo w dowolnym momencie — rzeczywisty koszt przelewu zostanie wtedy potrącony.`,
    pending: (n) => `Płatności w trakcie rozliczania przez naszego operatora płatności: ${n}. Są oznaczone jako oczekujące i zostaną uzupełnione w jednym z kolejnych zestawień.`,
    privacy: 'Zestawienia zawierają wyłącznie dane zbiorcze — nigdy nazwisk ani danych kontaktowych klientów poleconych przez Państwa.',
    rcSubject: (code) => `Płatność wysłana — Program partnerski HeatPump DB (${code})`,
    rcBody: (amt, date, ref) => `w dniu ${date} przelaliśmy ${amt} na Państwa konto${ref ? ` (referencja: ${ref})` : ''}.\n\nProsimy o podpisanie załączonego potwierdzenia płatności i odesłanie go w odpowiedzi na tę wiadomość — wystarczy skan lub zdjęcie. Podpisane potwierdzenie jest naszym dowodem płatności.`,
    anSubject: (y, code) => `Kwoty wypłacone w ${y} — Program partnerski HeatPump DB (${code})`,
    anBody: (y) => `zgodnie z prośbą w załączniku przesyłamy zestawienie wszystkich kwot wypłaconych w ${y} r.`,
  },
  it: {
    hello: (n) => (n ? `Buongiorno ${n},` : 'Buongiorno,'),
    sign: 'Cordiali saluti\nIl team Partner di HeatPump DB',
    stSubject: (m, code) => `Rendiconto partner HeatPump DB — ${m} (${code})`,
    stIntro: (m) => `in allegato trova il rendiconto partner di ${m} in PDF, insieme al dettaglio riga per riga in CSV.`,
    rows: {
      newPaying: 'Nuovi abbonamenti a pagamento', activePaying: 'Abbonamenti a pagamento attivi',
      cumulative: (n, min) => `Account paganti cumulativi: ${n} (supporto video da ${min})`,
      commission: 'Commissione del mese', deductions: 'Detrazioni (rimborsi e chargeback)',
      video: 'Supporto video', paid: 'Pagato questo mese', closing: 'Saldo a fine mese',
    },
    payoutDue: (amt, date) => `Le verseremo ${amt} entro il ${date}.`,
    carry: (min) => `Il saldo è inferiore a ${min} e viene riportato; non scade mai. Su richiesta paghiamo un saldo inferiore in qualsiasi momento — il costo effettivo del bonifico viene allora detratto.`,
    pending: (n) => `${n} pagamento/i sono ancora in fase di regolamento presso il nostro fornitore di pagamenti. Sono indicati come in sospeso e verranno completati in un rendiconto successivo.`,
    privacy: 'I rendiconti contengono solo dati aggregati — mai i nomi o i recapiti dei clienti che ha presentato.',
    rcSubject: (code) => `Pagamento inviato — Programma partner HeatPump DB (${code})`,
    rcBody: (amt, date, ref) => `il ${date} abbiamo inviato ${amt} sul suo conto${ref ? ` (riferimento: ${ref})` : ''}.\n\nLa preghiamo di firmare la ricevuta di pagamento allegata e di rispedircela rispondendo a questa email — basta una scansione o una foto. La ricevuta firmata è la nostra prova del pagamento.`,
    anSubject: (y, code) => `Importi pagati nel ${y} — Programma partner HeatPump DB (${code})`,
    anBody: (y) => `come richiesto, in allegato trova il riepilogo di tutti gli importi che le abbiamo pagato nel ${y}.`,
  },
};

/** Statement mail (subject + text) from a partnerStatements doc. */
function statementMail(st, { name = '', code = '', lang = 'en', programme }) {
  const L = T[langOf(lang)];
  const m = monthName(st.month, lang);
  const r = L.rows;
  const lines = [
    `${r.newPaying}: ${st.newPaying}`,
    `${r.activePaying}: ${st.activePaying}`,
    r.cumulative(st.cumulativePaying, programme.videoSupportMinPaidAccounts),
    `${r.commission}: ${eur(st.commissionCents, lang)}`,
    ...(st.clawbackCents ? [`${r.deductions}: ${eur(st.clawbackCents, lang)}`] : []),
    ...(st.videoSupportCents ? [`${r.video}: ${eur(st.videoSupportCents, lang)}`] : []),
    ...((st.payoutCents || st.payoutFeeCents) ? [`${r.paid}: ${eur((st.payoutCents || 0) + (st.payoutFeeCents || 0), lang)}`] : []),
    `${r.closing}: ${eur(st.closingCents, lang)}`,
  ];
  const payout = st.payoutDue
    ? L.payoutDue(eur(st.closingCents, lang), dateLong(st.payoutDueBy, lang))
    : L.carry(eur(programme.payoutThresholdEur * 100, lang));
  const text = [
    L.hello(name), '', L.stIntro(m), '', ...lines, '', payout,
    ...(st.pendingCount ? ['', L.pending(st.pendingCount)] : []),
    '', L.privacy, '', L.sign,
  ].join('\n');
  return { subject: L.stSubject(m, code), text };
}

function receiptMail({ name = '', code = '', lang = 'en', amountCents, date, reference }) {
  const L = T[langOf(lang)];
  return {
    subject: L.rcSubject(code),
    text: [L.hello(name), '', L.rcBody(eur(amountCents, lang), dateLong(date, lang), reference), '', L.sign].join('\n'),
  };
}

function annualMail({ name = '', code = '', lang = 'en', year }) {
  const L = T[langOf(lang)];
  return { subject: L.anSubject(year, code), text: [L.hello(name), '', L.anBody(year), '', L.sign].join('\n') };
}

module.exports = { statementMail, receiptMail, annualMail, eur, monthName, LANGS: Object.keys(T) };
