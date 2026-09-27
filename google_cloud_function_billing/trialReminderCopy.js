/**
 * trialReminderCopy - the trial reminder messages, per language and stage.
 * Separate from index.js so the wording can be tested without Firestore.
 */

/** Short by design: a few sentences and one link convert better than a page.
 *
 *  FREE + PREMIUM (2026-09-27): the trial is a PREMIUM trial. When it ends
 *  the account continues on the Free plan — nothing closes, nothing is
 *  blocked. Never write "access ends / stops / is no longer accessible" here
 *  (tests/trial-reminders.unit.mjs guards the wording in every language). */
const TRIAL_COPY = {
  en: {
    two_days_left: (n, url) => ({
      subject: 'Your HeatPump DB Premium trial ends in 2 days',
      body: `Your Premium trial ends on ${n}. After that your account continues on the Free plan — no action is needed and nothing is charged.\n\nOn Free you keep product search, basic specifications, the subsidies pages and news. Full specifications, product comparison, the commercial range (over 23 kW), PDF data sheets and the Special Report are part of Premium.\n\nTo keep the full feature set without a gap, choose a plan here:\n${url}`,
    }),
    last_day: (n, url) => ({
      subject: 'Last day of your HeatPump DB Premium trial',
      body: `Your Premium trial ends today (${n}). Your account then continues on the Free plan, with product search, basic specifications, the subsidies pages and news.\n\nFull specifications, product comparison, the commercial range (over 23 kW), PDF data sheets and the Special Report need Premium. To keep them, choose a plan here:\n${url}\n\nNothing is charged unless you do.`,
    }),
    expired: (n, url) => ({
      subject: 'Your HeatPump DB account is now on the Free plan',
      body: `Your Premium trial ended on ${n}, and your account has moved to the Free plan. Product search, basic specifications, the subsidies pages and news remain available to you.\n\nFull specifications, product comparison, the commercial range (over 23 kW), PDF data sheets and the Special Report need Premium. You can upgrade at any time here:\n${url}\n\nIf you would rather tell us what was missing, reply to this message. We read every answer.`,
    }),
  },
  de: {
    two_days_left: (n, url) => ({
      subject: 'Ihr HeatPump DB Premium-Test endet in 2 Tagen',
      body: `Ihr Premium-Test endet am ${n}. Danach läuft Ihr Konto im kostenlosen Free-Tarif weiter — Sie müssen nichts tun, und es wird nichts berechnet.\n\nIm Free-Tarif bleiben Produktsuche, Basisdaten, die Förderseiten und die News verfügbar. Vollständige technische Daten, der Produktvergleich, das Gewerbesegment (über 23 kW), PDF-Datenblätter und der Special Report gehören zu Premium.\n\nUm ohne Lücke mit allen Funktionen weiterzuarbeiten, wählen Sie hier einen Tarif:\n${url}`,
    }),
    last_day: (n, url) => ({
      subject: 'Letzter Tag Ihres HeatPump DB Premium-Tests',
      body: `Ihr Premium-Test endet heute (${n}). Danach läuft Ihr Konto im kostenlosen Free-Tarif weiter, mit Produktsuche, Basisdaten, den Förderseiten und den News.\n\nVollständige technische Daten, der Produktvergleich, das Gewerbesegment (über 23 kW), PDF-Datenblätter und der Special Report erfordern Premium. Um sie zu behalten, wählen Sie hier einen Tarif:\n${url}\n\nEs wird nichts berechnet, solange Sie das nicht tun.`,
    }),
    expired: (n, url) => ({
      subject: 'Ihr HeatPump DB Konto läuft jetzt im Free-Tarif',
      body: `Ihr Premium-Test endete am ${n}; Ihr Konto läuft jetzt im kostenlosen Free-Tarif. Produktsuche, Basisdaten, die Förderseiten und die News stehen Ihnen weiterhin zur Verfügung.\n\nVollständige technische Daten, der Produktvergleich, das Gewerbesegment (über 23 kW), PDF-Datenblätter und der Special Report erfordern Premium. Ein Upgrade ist jederzeit hier möglich:\n${url}\n\nWenn Sie uns lieber sagen möchten, was gefehlt hat: antworten Sie einfach auf diese Nachricht. Wir lesen jede Antwort.`,
    }),
  },
  fr: {
    two_days_left: (n, url) => ({
      subject: 'Votre essai Premium HeatPump DB se termine dans 2 jours',
      body: `Votre essai Premium se termine le ${n}. Ensuite, votre compte continue avec la formule gratuite (Free) — aucune action n'est nécessaire et rien n'est facturé.\n\nAvec Free, vous conservez la recherche de produits, les caractéristiques de base, les pages sur les aides et les actualités. Les caractéristiques complètes, la comparaison de produits, la gamme tertiaire (plus de 23 kW), les fiches techniques PDF et le Special Report font partie de Premium.\n\nPour garder toutes les fonctionnalités sans interruption, choisissez une formule ici :\n${url}`,
    }),
    last_day: (n, url) => ({
      subject: 'Dernier jour de votre essai Premium HeatPump DB',
      body: `Votre essai Premium se termine aujourd'hui (${n}). Votre compte continue ensuite avec la formule gratuite (Free) : recherche de produits, caractéristiques de base, pages sur les aides et actualités.\n\nLes caractéristiques complètes, la comparaison de produits, la gamme tertiaire (plus de 23 kW), les fiches techniques PDF et le Special Report nécessitent Premium. Pour les conserver, choisissez une formule ici :\n${url}\n\nRien n'est facturé sans votre action.`,
    }),
    expired: (n, url) => ({
      subject: 'Votre compte HeatPump DB est passé à la formule gratuite',
      body: `Votre essai Premium s'est terminé le ${n} et votre compte est passé à la formule gratuite (Free). La recherche de produits, les caractéristiques de base, les pages sur les aides et les actualités restent disponibles.\n\nLes caractéristiques complètes, la comparaison de produits, la gamme tertiaire (plus de 23 kW), les fiches techniques PDF et le Special Report nécessitent Premium. Vous pouvez passer à Premium à tout moment ici :\n${url}\n\nSi vous préférez nous dire ce qui manquait, répondez à ce message. Nous lisons chaque réponse.`,
    }),
  },
  pl: {
    two_days_left: (n, url) => ({
      subject: 'Twój okres próbny Premium w HeatPump DB kończy się za 2 dni',
      body: `Okres próbny Premium kończy się ${n}. Potem Twoje konto działa dalej w bezpłatnym planie Free — nie musisz nic robić i nic nie zostanie pobrane.\n\nW planie Free zachowujesz wyszukiwarkę produktów, podstawowe dane techniczne, strony o dotacjach i aktualności. Pełne dane techniczne, porównywanie produktów, segment komercyjny (powyżej 23 kW), karty katalogowe PDF i Special Report należą do planu Premium.\n\nAby bez przerwy korzystać ze wszystkich funkcji, wybierz plan tutaj:\n${url}`,
    }),
    last_day: (n, url) => ({
      subject: 'Ostatni dzień okresu próbnego Premium w HeatPump DB',
      body: `Okres próbny Premium kończy się dziś (${n}). Potem Twoje konto działa dalej w bezpłatnym planie Free: wyszukiwarka produktów, podstawowe dane techniczne, strony o dotacjach i aktualności.\n\nPełne dane techniczne, porównywanie produktów, segment komercyjny (powyżej 23 kW), karty katalogowe PDF i Special Report wymagają planu Premium. Aby je zachować, wybierz plan tutaj:\n${url}\n\nNic nie zostanie pobrane, dopóki tego nie zrobisz.`,
    }),
    expired: (n, url) => ({
      subject: 'Twoje konto HeatPump DB działa teraz w planie Free',
      body: `Okres próbny Premium zakończył się ${n}, a Twoje konto działa teraz w bezpłatnym planie Free. Wyszukiwarka produktów, podstawowe dane techniczne, strony o dotacjach i aktualności pozostają dostępne.\n\nPełne dane techniczne, porównywanie produktów, segment komercyjny (powyżej 23 kW), karty katalogowe PDF i Special Report wymagają planu Premium. Możesz przejść na Premium w każdej chwili tutaj:\n${url}\n\nJeśli wolisz powiedzieć nam, czego zabrakło — odpowiedz na tę wiadomość. Czytamy każdą odpowiedź.`,
    }),
  },
  it: {
    two_days_left: (n, url) => ({
      subject: 'La tua prova Premium di HeatPump DB termina fra 2 giorni',
      body: `La prova Premium termina il ${n}. Dopo quella data il tuo account prosegue con il piano gratuito Free — non devi fare nulla e non verrà addebitato niente.\n\nCon Free restano disponibili la ricerca prodotti, i dati tecnici di base, le pagine sugli incentivi e le notizie. I dati tecnici completi, il confronto prodotti, la gamma commerciale (oltre 23 kW), le schede tecniche PDF e lo Special Report fanno parte di Premium.\n\nPer mantenere tutte le funzioni senza interruzioni, scegli un piano qui:\n${url}`,
    }),
    last_day: (n, url) => ({
      subject: 'Ultimo giorno della tua prova Premium di HeatPump DB',
      body: `La prova Premium termina oggi (${n}). Il tuo account prosegue poi con il piano gratuito Free: ricerca prodotti, dati tecnici di base, pagine sugli incentivi e notizie.\n\nI dati tecnici completi, il confronto prodotti, la gamma commerciale (oltre 23 kW), le schede tecniche PDF e lo Special Report richiedono Premium. Per mantenerli, scegli un piano qui:\n${url}\n\nNulla viene addebitato se non lo fai.`,
    }),
    expired: (n, url) => ({
      subject: 'Il tuo account HeatPump DB è ora sul piano Free',
      body: `La prova Premium è terminata il ${n} e il tuo account è passato al piano gratuito Free. La ricerca prodotti, i dati tecnici di base, le pagine sugli incentivi e le notizie restano disponibili.\n\nI dati tecnici completi, il confronto prodotti, la gamma commerciale (oltre 23 kW), le schede tecniche PDF e lo Special Report richiedono Premium. Puoi passare a Premium in qualsiasi momento qui:\n${url}\n\nSe preferisci dirci cosa mancava, rispondi a questo messaggio. Leggiamo ogni risposta.`,
    }),
  },
};

module.exports = { TRIAL_COPY };
