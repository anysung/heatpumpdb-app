/**
 * The four public policies, in the three UI languages.
 *
 * Plain data, no country branches: DE/GB/FR (and any market added later) render
 * the same documents from the same keys.
 *
 * The documents address customers as the SERVICE (SERVICE_NAME) and give one
 * contact (SUPPORT_EMAIL). Registered address, register number, VAT/tax number
 * and a responsible-person name are intentionally not shown — and the wording
 * never draws attention to their absence: there are no "to be completed"
 * placeholders. Nothing here is invented.
 */
import { Language } from '../types';
import { PRIVACY_VERSION, SERVICE_NAME, SUPPORT_EMAIL, TERMS_VERSION } from '../config/legal';

export type LegalSection = { h: string; p: string[] };
export type LegalDocContent = { title: string; updated: string; intro?: string; sections: LegalSection[] };

const ver = { terms: TERMS_VERSION, privacy: PRIVACY_VERSION };

/* ── English ────────────────────────────────────────────────────────────── */

const EN = {
  privacy: {
    title: 'Privacy Policy',
    updated: ver.privacy,
    intro:
      'HeatPump DataBase is a web-based professional database service for the European heat-pump industry. This policy explains what we process when you use the service, and why. We collect the minimum needed to run a professional account.',
    sections: [
      { h: 'Who we are', p: [`${SERVICE_NAME} is a professional, web-based database service for the European heat-pump industry, and is the controller for the personal data described here. You can reach us at ${SUPPORT_EMAIL}.`] },
      {
        h: 'Account information we collect',
        p: [
          'When you register we collect: first name, last name, email address and a password (stored only as a hash by Firebase Authentication — we never see it).',
          'We do not ask for a job role, how you heard about us, or any other personal detail that is not needed to operate the account.',
        ],
      },
      {
        h: 'Company information we collect',
        p: [
          'Required: company name and company type. Optional: company city and company website. If you select "Other" as your company type, we store the short description you enter.',
          'Individual professionals and sole traders enter their own name or registered trading name as the company name.',
          'Your registration country is taken automatically from the country edition you sign up on. We do not ask you for it.',
        ],
      },
      {
        h: 'Purpose of processing',
        p: [
          'Providing the database service and your account; identifying professional users; operating team subscriptions (seats, invitations); billing through our payment provider; answering support inquiries; securing the service against misuse and unauthorised data extraction.',
        ],
      },
      {
        h: 'Legal basis',
        p: [
          'Performance of a contract (Art. 6(1)(b) GDPR) for the account, the subscription and support; legitimate interests (Art. 6(1)(f) GDPR) for security, fraud prevention and protection of the database; legal obligations (Art. 6(1)(c) GDPR) for accounting and tax records held by our payment provider.',
        ],
      },
      {
        h: 'Processors and services we use',
        p: [
          'Firebase Authentication (Google) — sign-in and password handling.',
          'Firebase Firestore, Cloud Storage and Hosting (Google) — account data, product datasets and delivery of the application.',
          'Firebase App Check with reCAPTCHA Enterprise (Google) — verifies that requests come from our application and blocks automated extraction.',
          'Paddle — our payment provider and merchant of record. Paddle collects and processes your payment data; we never receive or store card details.',
        ],
      },
      {
        h: 'Billing and merchant of record',
        p: [
          'Subscriptions are sold on the web through Paddle, which acts as merchant of record. Paddle handles payment, invoicing and applicable VAT and is the controller for the payment data it collects. We store only what we need to link your account to your subscription and to support you.',
        ],
      },
      {
        h: 'Support inquiries',
        p: [
          'Inquiries you send from the Account page are stored with your account so our support team can answer and so you can read the reply in the app.',
        ],
      },
      {
        h: 'Security and fraud prevention',
        p: [
          'Accounts are personal and may not be shared. We log account activity to detect account sharing and unauthorised extraction of the database. Product data is served only to signed-in, approved accounts.',
        ],
      },
      {
        h: 'Data retention',
        p: [
          'Account and company data are kept while your account exists. After deletion we retain only what we must for legal, accounting or evidence purposes; billing records are retained by Paddle for statutory periods.',
        ],
      },
      {
        h: 'Account deletion',
        p: [
          'You can request deletion at any time from the Account page. Deleting your HeatPump DataBase account does not cancel a subscription — billing must be cancelled separately through Manage billing.',
        ],
      },
      {
        h: 'Your rights',
        p: [
          'Under the GDPR you may request access, rectification, erasure, restriction, portability, and object to processing based on legitimate interests. You may also lodge a complaint with a supervisory authority.',
        ],
      },
      {
        h: 'International processing',
        p: [
          'Our providers may process data outside the EEA. Where that happens, transfers rely on the safeguards those providers offer (including EU Standard Contractual Clauses).',
        ],
      },
      { h: 'Contact', p: [`Use New inquiry on the Account page, or email ${SUPPORT_EMAIL}.`] },
    ],
  },
  terms: {
    title: 'Terms of Use',
    updated: ver.terms,
    intro: `These terms govern your use of ${SERVICE_NAME}, a professional web-based B2B database service. Please read them before you register.`,
    sections: [
      { h: 'The service', p: [`${SERVICE_NAME} is a professional, web-based subscription service for the European heat-pump industry. Subscriptions are purchased on the web and billed by Paddle.`] },
      { h: 'Account eligibility', p: ['Accounts are intended for professional use (manufacturers, wholesalers, installers, engineers, consultancies, housing, public sector, sole traders and comparable roles). New accounts are reviewed before activation.'] },
      { h: 'Account responsibility', p: ['You are responsible for your credentials and for everything done under your account. Keep your password confidential.'] },
      {
        h: 'One account per person',
        p: [
          'Each account is strictly personal and may be used by one individual only. Sharing an account is a breach of these terms and may lead to closure without prior notice and without a refund for the remaining period.',
          'Companies with several users must use a Team plan, which provides one account per person.',
        ],
      },
      {
        h: 'Team plans, seats and owners',
        p: [
          'Team 3 provides three seats and Team 5 provides five seats, in each case including the purchaser. The purchaser becomes the team owner and is responsible for the subscription, for billing and for who occupies the seats.',
          'Active members plus open invitations may never exceed the seat limit. The owner may remove a member at any time; the removed person immediately loses access to the team subscription but keeps their personal account.',
          'A team member may leave the team at any time. Leaving frees the seat and does not cancel the team subscription.',
        ],
      },
      {
        h: 'Free trial',
        p: [
          'Every subscription starts with a 7-day free trial. A valid payment method is required to start the trial. Nothing is charged during the trial.',
          'If you do not cancel before the trial ends, the first payment is taken and the subscription begins.',
        ],
      },
      {
        h: 'Billing, renewal and changes',
        p: [
          'Subscriptions are offered on monthly, 6-month and annual billing terms and renew automatically at the end of each period until cancelled.',
          'Plan and billing term are fixed for the paid period. Changes do not take effect mid-term: a change you request applies from the next renewal, and the new conditions begin only once the current period has ended.',
          'You may cancel at any time. Cancellation stops the next renewal; access continues until the end of the period you have paid for.',
        ],
      },
      { h: 'Payments', p: ['Payments are processed by Paddle, which acts as merchant of record and issues invoices including any applicable VAT.'] },
      {
        h: 'Acceptable use and database protection',
        p: [
          'The database is protected under European database law. You may use the data only in the presentation forms this application offers (in particular the search, comparison views and generated data sheets), and only for your own professional purposes.',
          'Scraping, bulk extraction, automated collection, reproduction, redistribution, use for AI training, and any commercial re-use of the database or a substantial part of it are prohibited without prior written consent.',
          'Attempts to circumvent technical protection measures, or to access the datasets outside the application, lead to account closure and may result in civil and criminal liability.',
        ],
      },
      { h: 'Service availability', p: ['We aim for high availability but do not guarantee uninterrupted service. Maintenance, updates and third-party outages may interrupt access.'] },
      {
        h: 'Data accuracy',
        p: [
          'Product data originates from public registries and manufacturer sources and is provided for professional information only. Eligibility for public funding is decided solely by the responsible authority. Always verify against the official source before making commercial or technical decisions.',
        ],
      },
      { h: 'Liability', p: ['To the extent permitted by law, we are not liable for indirect or consequential loss, or for decisions taken on the basis of the data provided. Nothing in these terms excludes liability that cannot be excluded by law.'] },
      { h: 'Termination and suspension', p: ['We may suspend or close accounts that breach these terms, in particular account sharing and unauthorised data extraction. You may stop using the service at any time and request deletion of your account.'] },
      { h: 'Contact', p: [`Questions about these terms: ${SUPPORT_EMAIL}, or New inquiry on the Account page.`] },
    ],
  },
  refund: {
    title: 'Refund and Cancellation Policy',
    updated: ver.terms,
    intro: `This policy explains what happens when you cancel your ${SERVICE_NAME} subscription, and when a refund is or is not due. Paddle is our merchant of record and handles all payments.`,
    sections: [
      { h: 'During the free trial', p: ['Every subscription begins with a 7-day free trial. Nothing is charged during the trial. Cancel before the trial ends and no payment is taken.'] },
      { h: 'After the trial', p: ['If you do not cancel before the trial ends, the first payment is taken and the paid period begins.'] },
      {
        h: 'Cancelling a paid subscription',
        p: [
          'You may cancel at any time. Cancellation stops the next renewal — it does not end the current period.',
          'Access continues until the end of the period you have already paid for.',
        ],
      },
      { h: 'Unused time', p: ['We do not automatically refund unused time on a period that has already been paid for.'] },
      {
        h: 'How to cancel',
        p: [
          'Cancel through Manage billing on the Account page.',
          'Deleting your HeatPump DataBase account does NOT cancel your subscription. Billing is handled separately and must be cancelled through Manage billing.',
        ],
      },
      { h: 'Exceptional refunds', p: [`If you believe your case is exceptional (for example a duplicate charge), send a New inquiry from the Account page or email ${SUPPORT_EMAIL}, and we will review it with Paddle.`] },
      { h: 'Merchant of record', p: ['Paddle is the merchant of record for all subscriptions. Invoices and VAT receipts are issued by Paddle.'] },
    ],
  },
  imprint: {
    title: 'Imprint',
    updated: ver.terms,
    sections: [
      { h: 'Service', p: [SERVICE_NAME] },
      { h: 'Contact', p: [SUPPORT_EMAIL] },
    ],
  },
};

/* ── German ─────────────────────────────────────────────────────────────── */

const DE = {
  privacy: {
    title: 'Datenschutzerklärung',
    updated: ver.privacy,
    intro:
      'HeatPump DataBase ist ein webbasierter, professioneller Datenbankdienst für die europäische Wärmepumpenbranche. Diese Erklärung beschreibt, welche Daten wir bei der Nutzung verarbeiten und warum. Wir erheben nur das Minimum, das für ein professionelles Konto erforderlich ist.',
    sections: [
      { h: 'Wer wir sind', p: [`${SERVICE_NAME} ist ein professioneller, webbasierter Datenbankdienst für die europäische Wärmepumpenbranche und Verantwortlicher für die hier beschriebenen personenbezogenen Daten. Sie erreichen uns unter ${SUPPORT_EMAIL}.`] },
      {
        h: 'Kontodaten',
        p: [
          'Bei der Registrierung erheben wir: Vorname, Nachname, E-Mail-Adresse und ein Passwort (wird ausschließlich als Hash von Firebase Authentication gespeichert — wir sehen es nie).',
          'Wir fragen weder nach einer Funktion/Position noch danach, wie Sie auf uns aufmerksam wurden, noch nach anderen persönlichen Angaben, die für den Betrieb des Kontos nicht erforderlich sind.',
        ],
      },
      {
        h: 'Unternehmensdaten',
        p: [
          'Erforderlich: Firmenname und Unternehmensart. Optional: Ort und Website. Bei Auswahl von „Sonstige“ speichern wir die von Ihnen eingegebene Kurzbeschreibung.',
          'Einzelunternehmer und selbstständige Fachleute tragen ihren eigenen Namen bzw. ihre eingetragene Geschäftsbezeichnung als Firmennamen ein.',
          'Das Registrierungsland wird automatisch aus der Länderausgabe übernommen, in der Sie sich registrieren. Wir fragen es nicht ab.',
        ],
      },
      {
        h: 'Zwecke der Verarbeitung',
        p: [
          'Bereitstellung des Datenbankdienstes und Ihres Kontos; Identifikation professioneller Nutzer; Betrieb von Team-Abonnements (Plätze, Einladungen); Abrechnung über unseren Zahlungsdienstleister; Beantwortung von Supportanfragen; Absicherung gegen Missbrauch und unbefugte Datenentnahme.',
        ],
      },
      {
        h: 'Rechtsgrundlagen',
        p: [
          'Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO) für Konto, Abonnement und Support; berechtigte Interessen (Art. 6 Abs. 1 lit. f DSGVO) für Sicherheit, Missbrauchsprävention und Schutz der Datenbank; rechtliche Verpflichtungen (Art. 6 Abs. 1 lit. c DSGVO) für die beim Zahlungsdienstleister geführten Buchhaltungs- und Steuerunterlagen.',
        ],
      },
      {
        h: 'Eingesetzte Dienste',
        p: [
          'Firebase Authentication (Google) — Anmeldung und Passwortverwaltung.',
          'Firebase Firestore, Cloud Storage und Hosting (Google) — Kontodaten, Produktdatensätze und Auslieferung der Anwendung.',
          'Firebase App Check mit reCAPTCHA Enterprise (Google) — stellt sicher, dass Anfragen aus unserer Anwendung stammen, und blockiert automatisierte Datenentnahme.',
          'Paddle — Zahlungsdienstleister und Merchant of Record. Paddle erhebt und verarbeitet Ihre Zahlungsdaten; wir erhalten und speichern keine Kartendaten.',
        ],
      },
      {
        h: 'Abrechnung und Merchant of Record',
        p: [
          'Abonnements werden im Web über Paddle verkauft. Paddle tritt als Merchant of Record auf, wickelt Zahlung, Rechnungsstellung und die anwendbare Umsatzsteuer ab und ist für die dabei erhobenen Zahlungsdaten verantwortlich. Wir speichern nur, was zur Zuordnung Ihres Abonnements zu Ihrem Konto und für den Support erforderlich ist.',
        ],
      },
      { h: 'Supportanfragen', p: ['Anfragen, die Sie über die Kontoseite senden, werden Ihrem Konto zugeordnet gespeichert, damit unser Support antworten kann und Sie die Antwort in der App lesen können.'] },
      {
        h: 'Sicherheit und Missbrauchsprävention',
        p: ['Konten sind personengebunden und dürfen nicht geteilt werden. Wir protokollieren Kontoaktivität, um Kontoteilung und unbefugte Datenentnahme zu erkennen. Produktdaten werden nur an angemeldete, freigegebene Konten ausgeliefert.'],
      },
      {
        h: 'Speicherdauer',
        p: ['Konto- und Unternehmensdaten werden für die Dauer des Kontos gespeichert. Nach Löschung bewahren wir nur auf, was aus rechtlichen, buchhalterischen oder Nachweisgründen erforderlich ist; Abrechnungsunterlagen werden von Paddle für die gesetzlichen Fristen aufbewahrt.'],
      },
      {
        h: 'Kontolöschung',
        p: ['Sie können die Löschung jederzeit auf der Kontoseite beantragen. Die Löschung Ihres HeatPump-DataBase-Kontos kündigt kein Abonnement — die Abrechnung muss separat über „Abrechnung verwalten“ gekündigt werden.'],
      },
      {
        h: 'Ihre Rechte',
        p: ['Nach der DSGVO können Sie Auskunft, Berichtigung, Löschung, Einschränkung und Datenübertragbarkeit verlangen sowie der auf berechtigten Interessen beruhenden Verarbeitung widersprechen. Zudem steht Ihnen ein Beschwerderecht bei einer Aufsichtsbehörde zu.'],
      },
      {
        h: 'Internationale Verarbeitung',
        p: ['Unsere Dienstleister können Daten außerhalb des EWR verarbeiten. Übermittlungen stützen sich in diesem Fall auf die Garantien dieser Anbieter (u. a. EU-Standardvertragsklauseln).'],
      },
      { h: 'Kontakt', p: [`Nutzen Sie „Neue Anfrage“ auf der Kontoseite oder schreiben Sie an ${SUPPORT_EMAIL}.`] },
    ],
  },
  terms: {
    title: 'Nutzungsbedingungen',
    updated: ver.terms,
    intro: `Diese Bedingungen regeln die Nutzung von ${SERVICE_NAME}, einem professionellen, webbasierten B2B-Datenbankdienst. Bitte lesen Sie sie vor der Registrierung.`,
    sections: [
      { h: 'Der Dienst', p: [`${SERVICE_NAME} ist ein professioneller, webbasierter Abonnementdienst für die europäische Wärmepumpenbranche. Abonnements werden im Web erworben und über Paddle abgerechnet.`] },
      { h: 'Zulässige Nutzer', p: ['Konten sind für die professionelle Nutzung bestimmt (Hersteller, Großhandel, Installateure, Planung/Ingenieurbüros, Wohnungswirtschaft, öffentliche Hand, Einzelunternehmer und vergleichbare Rollen). Neue Konten werden vor der Freischaltung geprüft.'] },
      { h: 'Verantwortung für das Konto', p: ['Sie sind für Ihre Zugangsdaten und für alle unter Ihrem Konto vorgenommenen Handlungen verantwortlich. Halten Sie Ihr Passwort geheim.'] },
      {
        h: 'Ein Konto pro Person',
        p: [
          'Jedes Konto ist streng personengebunden und darf nur von einer Person genutzt werden. Die gemeinsame Nutzung stellt einen Vertragsverstoß dar und kann ohne Vorankündigung zur Schließung des Kontos führen — ohne Erstattung des verbleibenden Zeitraums.',
          'Unternehmen mit mehreren Nutzern benötigen einen Team-Tarif, der ein Konto pro Person bereitstellt.',
        ],
      },
      {
        h: 'Team-Tarife, Plätze und Team-Inhaber',
        p: [
          'Team 3 umfasst drei, Team 5 fünf Plätze — jeweils einschließlich des Käufers. Der Käufer wird Team-Inhaber und ist für Abonnement, Abrechnung und die Belegung der Plätze verantwortlich.',
          'Aktive Mitglieder zuzüglich offener Einladungen dürfen die Platzanzahl nie überschreiten. Der Inhaber kann Mitglieder jederzeit entfernen; die entfernte Person verliert sofort den Zugang zum Team-Abonnement, behält aber ihr persönliches Konto.',
          'Ein Teammitglied kann das Team jederzeit verlassen. Dadurch wird ein Platz frei; das Team-Abonnement wird nicht gekündigt.',
        ],
      },
      {
        h: 'Kostenlose Testphase',
        p: [
          'Jedes Abonnement beginnt mit einer 7-tägigen kostenlosen Testphase. Für den Start ist eine gültige Zahlungsmethode erforderlich. Während der Testphase erfolgt keine Abbuchung.',
          'Wird nicht vor Ablauf der Testphase gekündigt, erfolgt die erste Zahlung und das Abonnement beginnt.',
        ],
      },
      {
        h: 'Abrechnung, Verlängerung und Änderungen',
        p: [
          'Abonnements werden monatlich, halbjährlich oder jährlich abgerechnet und verlängern sich automatisch, bis sie gekündigt werden.',
          'Tarif und Abrechnungszeitraum sind für die bezahlte Periode fest. Änderungen werden nicht mitten im Zeitraum wirksam: Eine gewünschte Änderung gilt ab der nächsten Verlängerung; die neuen Konditionen beginnen erst nach Ablauf der laufenden Periode.',
          'Sie können jederzeit kündigen. Die Kündigung stoppt die nächste Verlängerung; der Zugang bleibt bis zum Ende der bezahlten Periode bestehen.',
        ],
      },
      { h: 'Zahlungen', p: ['Zahlungen werden von Paddle abgewickelt. Paddle ist Merchant of Record und stellt Rechnungen einschließlich anwendbarer Umsatzsteuer aus.'] },
      {
        h: 'Zulässige Nutzung und Datenbankschutz',
        p: [
          'Die Datenbank ist nach europäischem Datenbankrecht geschützt. Die Nutzung der Daten ist ausschließlich in den von dieser Anwendung angebotenen Darstellungsformen (insbesondere Suche, Vergleiche und generierte Datenblätter) und für eigene berufliche Zwecke gestattet.',
          'Scraping, Massenextraktion, automatisierte Erhebung, Vervielfältigung, Weiterverbreitung, Nutzung für KI-Training sowie jede kommerzielle Weiterverwendung der Datenbank oder wesentlicher Teile davon sind ohne vorherige schriftliche Zustimmung untersagt.',
          'Versuche, technische Schutzmaßnahmen zu umgehen oder außerhalb der Anwendung auf die Datensätze zuzugreifen, führen zur Kontoschließung und können zivil- und strafrechtliche Folgen haben.',
        ],
      },
      { h: 'Verfügbarkeit', p: ['Wir streben eine hohe Verfügbarkeit an, garantieren jedoch keinen unterbrechungsfreien Betrieb. Wartung, Updates und Störungen bei Drittanbietern können den Zugang beeinträchtigen.'] },
      {
        h: 'Datenrichtigkeit',
        p: ['Produktdaten stammen aus öffentlichen Registern und Herstellerquellen und dienen ausschließlich der beruflichen Information. Über die Förderfähigkeit entscheidet allein die zuständige Behörde. Prüfen Sie vor geschäftlichen oder technischen Entscheidungen stets die amtliche Quelle.'],
      },
      { h: 'Haftung', p: ['Soweit gesetzlich zulässig, haften wir nicht für mittelbare Schäden oder Folgeschäden oder für Entscheidungen, die auf Grundlage der bereitgestellten Daten getroffen werden. Gesetzlich zwingende Haftung bleibt unberührt.'] },
      { h: 'Kündigung und Sperrung', p: ['Wir können Konten sperren oder schließen, die gegen diese Bedingungen verstoßen — insbesondere bei Kontoteilung und unbefugter Datenentnahme. Sie können die Nutzung jederzeit beenden und die Löschung Ihres Kontos beantragen.'] },
      { h: 'Kontakt', p: [`Fragen zu diesen Bedingungen: ${SUPPORT_EMAIL} oder „Neue Anfrage“ auf der Kontoseite.`] },
    ],
  },
  refund: {
    title: 'Widerrufs- und Kündigungsregelung',
    updated: ver.terms,
    intro: `Diese Regelung erläutert, was bei der Kündigung Ihres ${SERVICE_NAME}-Abonnements geschieht und wann eine Erstattung erfolgt bzw. nicht erfolgt. Paddle ist unser Merchant of Record und wickelt alle Zahlungen ab.`,
    sections: [
      { h: 'Während der Testphase', p: ['Jedes Abonnement beginnt mit einer 7-tägigen kostenlosen Testphase. Während der Testphase erfolgt keine Abbuchung. Bei Kündigung vor Ablauf der Testphase wird nichts berechnet.'] },
      { h: 'Nach der Testphase', p: ['Wird nicht vor Ablauf der Testphase gekündigt, erfolgt die erste Zahlung und die bezahlte Periode beginnt.'] },
      {
        h: 'Kündigung eines bezahlten Abonnements',
        p: [
          'Sie können jederzeit kündigen. Die Kündigung stoppt die nächste Verlängerung — die laufende Periode endet dadurch nicht vorzeitig.',
          'Der Zugang bleibt bis zum Ende der bereits bezahlten Periode bestehen.',
        ],
      },
      { h: 'Nicht genutzte Zeit', p: ['Für nicht genutzte Zeit einer bereits bezahlten Periode erfolgt keine automatische anteilige Erstattung.'] },
      {
        h: 'So kündigen Sie',
        p: [
          'Kündigen Sie über „Abrechnung verwalten“ auf der Kontoseite.',
          'Das Löschen Ihres HeatPump-DataBase-Kontos kündigt das Abonnement NICHT. Die Abrechnung wird separat geführt und muss über „Abrechnung verwalten“ gekündigt werden.',
        ],
      },
      { h: 'Ausnahmefälle', p: [`Wenn Sie Ihren Fall für außergewöhnlich halten (z. B. Doppelbuchung), senden Sie eine „Neue Anfrage“ über die Kontoseite oder schreiben Sie an ${SUPPORT_EMAIL} — wir prüfen den Fall gemeinsam mit Paddle.`] },
      { h: 'Merchant of Record', p: ['Paddle ist Merchant of Record für alle Abonnements. Rechnungen und Umsatzsteuerbelege werden von Paddle ausgestellt.'] },
    ],
  },
  imprint: {
    title: 'Impressum',
    updated: ver.terms,
    sections: [
      { h: 'Dienst', p: [SERVICE_NAME] },
      { h: 'Kontakt', p: [SUPPORT_EMAIL] },
    ],
  },
};

/* ── French ─────────────────────────────────────────────────────────────── */

const FR = {
  privacy: {
    title: 'Politique de confidentialité',
    updated: ver.privacy,
    intro:
      "HeatPump DataBase est un service de base de données professionnel sur le web, destiné à la filière européenne des pompes à chaleur. Cette politique explique quelles données nous traitons et pourquoi. Nous ne collectons que le minimum nécessaire au fonctionnement d'un compte professionnel.",
    sections: [
      { h: 'Qui sommes-nous', p: [`${SERVICE_NAME} est un service de base de données professionnel sur le web destiné à la filière européenne des pompes à chaleur, et le responsable du traitement des données décrites ici. Vous pouvez nous joindre à ${SUPPORT_EMAIL}.`] },
      {
        h: 'Données de compte',
        p: [
          "Lors de l'inscription, nous collectons : prénom, nom, adresse e-mail et un mot de passe (stocké uniquement sous forme de hachage par Firebase Authentication — nous ne le voyons jamais).",
          "Nous ne demandons ni fonction, ni la façon dont vous nous avez connus, ni aucune autre donnée personnelle non nécessaire au fonctionnement du compte.",
        ],
      },
      {
        h: "Données d'entreprise",
        p: [
          "Obligatoire : nom de l'entreprise et type d'entreprise. Facultatif : ville et site web. Si vous choisissez « Autre », nous enregistrons la brève précision que vous saisissez.",
          "Les professionnels indépendants et auto-entrepreneurs saisissent leur propre nom ou leur nom commercial enregistré comme nom d'entreprise.",
          "Le pays d'inscription est repris automatiquement de l'édition nationale sur laquelle vous vous inscrivez. Nous ne vous le demandons pas.",
        ],
      },
      {
        h: 'Finalités du traitement',
        p: [
          "Fourniture du service et de votre compte ; identification des utilisateurs professionnels ; gestion des abonnements d'équipe (sièges, invitations) ; facturation via notre prestataire de paiement ; réponse aux demandes d'assistance ; sécurisation du service contre les abus et l'extraction non autorisée de données.",
        ],
      },
      {
        h: 'Bases légales',
        p: [
          "Exécution du contrat (art. 6-1-b RGPD) pour le compte, l'abonnement et l'assistance ; intérêts légitimes (art. 6-1-f RGPD) pour la sécurité, la prévention de la fraude et la protection de la base de données ; obligations légales (art. 6-1-c RGPD) pour les documents comptables et fiscaux conservés par notre prestataire de paiement.",
        ],
      },
      {
        h: 'Services utilisés',
        p: [
          'Firebase Authentication (Google) — connexion et gestion des mots de passe.',
          "Firebase Firestore, Cloud Storage et Hosting (Google) — données de compte, jeux de données produits et diffusion de l'application.",
          "Firebase App Check avec reCAPTCHA Enterprise (Google) — vérifie que les requêtes proviennent de notre application et bloque l'extraction automatisée.",
          "Paddle — notre prestataire de paiement et marchand officiel (merchant of record). Paddle collecte et traite vos données de paiement ; nous ne recevons ni ne conservons aucune donnée de carte.",
        ],
      },
      {
        h: 'Facturation et marchand officiel',
        p: [
          "Les abonnements sont vendus sur le web via Paddle, qui agit en tant que marchand officiel. Paddle gère le paiement, la facturation et la TVA applicable et est responsable des données de paiement qu'il collecte. Nous ne conservons que ce qui est nécessaire pour relier votre abonnement à votre compte et pour vous assister.",
        ],
      },
      { h: "Demandes d'assistance", p: ["Les demandes envoyées depuis la page Compte sont enregistrées avec votre compte afin que notre équipe puisse y répondre et que vous puissiez lire la réponse dans l'application."] },
      {
        h: 'Sécurité et prévention des abus',
        p: ["Les comptes sont personnels et ne peuvent pas être partagés. Nous journalisons l'activité des comptes afin de détecter le partage de compte et l'extraction non autorisée de la base. Les données produits ne sont servies qu'aux comptes connectés et approuvés."],
      },
      {
        h: 'Durée de conservation',
        p: ["Les données de compte et d'entreprise sont conservées pendant la durée de vie du compte. Après suppression, nous ne conservons que ce qui est requis à des fins légales, comptables ou probatoires ; les documents de facturation sont conservés par Paddle pendant les durées légales."],
      },
      {
        h: 'Suppression du compte',
        p: ["Vous pouvez demander la suppression à tout moment depuis la page Compte. La suppression de votre compte HeatPump DataBase n'annule pas l'abonnement — la facturation doit être résiliée séparément via « Gérer la facturation »."],
      },
      {
        h: 'Vos droits',
        p: ["Conformément au RGPD, vous pouvez demander l'accès, la rectification, l'effacement, la limitation et la portabilité, et vous opposer aux traitements fondés sur l'intérêt légitime. Vous pouvez également introduire une réclamation auprès d'une autorité de contrôle."],
      },
      {
        h: 'Traitements internationaux',
        p: ["Nos prestataires peuvent traiter des données en dehors de l'EEE. Le cas échéant, les transferts s'appuient sur les garanties offertes par ces prestataires (notamment les clauses contractuelles types de l'UE)."],
      },
      { h: 'Contact', p: [`Utilisez « Nouvelle demande » sur la page Compte, ou écrivez à ${SUPPORT_EMAIL}.`] },
    ],
  },
  terms: {
    title: "Conditions d'utilisation",
    updated: ver.terms,
    intro: `Ces conditions régissent l'utilisation de ${SERVICE_NAME}, service professionnel de base de données B2B sur le web. Merci de les lire avant de vous inscrire.`,
    sections: [
      { h: 'Le service', p: [`${SERVICE_NAME} est un service d'abonnement professionnel sur le web pour la filière européenne des pompes à chaleur. Les abonnements sont souscrits sur le web et facturés par Paddle.`] },
      { h: 'Éligibilité des comptes', p: ["Les comptes sont destinés à un usage professionnel (fabricants, grossistes, installateurs, bureaux d'études, promoteurs, bailleurs, secteur public, indépendants et fonctions comparables). Les nouveaux comptes sont vérifiés avant activation."] },
      { h: 'Responsabilité du compte', p: ['Vous êtes responsable de vos identifiants et de tout ce qui est fait depuis votre compte. Gardez votre mot de passe confidentiel.'] },
      {
        h: 'Un compte par personne',
        p: [
          "Chaque compte est strictement personnel et ne peut être utilisé que par une seule personne. Le partage d'un compte constitue une violation des présentes conditions et peut entraîner sa fermeture sans préavis et sans remboursement de la période restante.",
          "Les entreprises comptant plusieurs utilisateurs doivent souscrire une formule Équipe, qui fournit un compte par personne.",
        ],
      },
      {
        h: 'Formules Équipe, sièges et propriétaire',
        p: [
          "Team 3 comprend trois sièges et Team 5 cinq sièges, acheteur inclus. L'acheteur devient propriétaire de l'équipe et est responsable de l'abonnement, de la facturation et de l'occupation des sièges.",
          "Les membres actifs et les invitations en attente ne peuvent jamais dépasser le nombre de sièges. Le propriétaire peut retirer un membre à tout moment ; la personne retirée perd immédiatement l'accès à l'abonnement d'équipe mais conserve son compte personnel.",
          "Un membre peut quitter l'équipe à tout moment. Cela libère un siège et n'annule pas l'abonnement d'équipe.",
        ],
      },
      {
        h: "Essai gratuit",
        p: [
          "Chaque abonnement commence par un essai gratuit de 7 jours. Un moyen de paiement valide est requis pour démarrer l'essai. Aucun débit n'a lieu pendant l'essai.",
          "Sans résiliation avant la fin de l'essai, le premier paiement est prélevé et l'abonnement débute.",
        ],
      },
      {
        h: 'Facturation, renouvellement et modifications',
        p: [
          "Les abonnements sont proposés en formules mensuelle, semestrielle et annuelle et se renouvellent automatiquement jusqu'à résiliation.",
          "La formule et la période de facturation sont fixes pendant la période payée. Les modifications ne prennent pas effet en cours de période : une modification demandée s'applique au renouvellement suivant, et les nouvelles conditions ne débutent qu'après la fin de la période en cours.",
          "Vous pouvez résilier à tout moment. La résiliation arrête le renouvellement suivant ; l'accès continue jusqu'à la fin de la période payée.",
        ],
      },
      { h: 'Paiements', p: ["Les paiements sont traités par Paddle, marchand officiel, qui émet les factures incluant la TVA applicable."] },
      {
        h: 'Usage autorisé et protection de la base de données',
        p: [
          "La base est protégée par le droit européen des bases de données. Vous ne pouvez utiliser les données que dans les formes de présentation proposées par l'application (recherche, comparaisons et fiches techniques générées) et pour vos propres besoins professionnels.",
          "Le scraping, l'extraction massive, la collecte automatisée, la reproduction, la redistribution, l'utilisation pour l'entraînement d'IA et toute réutilisation commerciale de la base ou d'une partie substantielle sont interdits sans accord écrit préalable.",
          "Toute tentative de contourner les mesures techniques de protection ou d'accéder aux jeux de données en dehors de l'application entraîne la fermeture du compte et peut engager la responsabilité civile et pénale.",
        ],
      },
      { h: 'Disponibilité', p: ["Nous visons une haute disponibilité sans garantir un service ininterrompu. Maintenance, mises à jour et pannes de tiers peuvent interrompre l'accès."] },
      {
        h: 'Exactitude des données',
        p: ["Les données produits proviennent de registres publics et de sources fabricants et sont fournies à titre d'information professionnelle. L'éligibilité aux aides est décidée exclusivement par l'autorité compétente. Vérifiez toujours la source officielle avant toute décision commerciale ou technique."],
      },
      { h: 'Responsabilité', p: ["Dans la limite permise par la loi, nous ne sommes pas responsables des dommages indirects ou consécutifs, ni des décisions prises sur la base des données fournies. Les responsabilités que la loi interdit d'exclure demeurent."] },
      { h: 'Résiliation et suspension', p: ["Nous pouvons suspendre ou fermer les comptes qui violent ces conditions, en particulier le partage de compte et l'extraction non autorisée. Vous pouvez cesser d'utiliser le service à tout moment et demander la suppression de votre compte."] },
      { h: 'Contact', p: [`Questions sur ces conditions : ${SUPPORT_EMAIL}, ou « Nouvelle demande » sur la page Compte.`] },
    ],
  },
  refund: {
    title: 'Politique de remboursement et de résiliation',
    updated: ver.terms,
    intro: `Cette politique explique ce qui se passe lorsque vous résiliez votre abonnement ${SERVICE_NAME}, et quand un remboursement est dû ou non. Paddle est notre marchand officiel et gère tous les paiements.`,
    sections: [
      { h: "Pendant l'essai gratuit", p: ["Chaque abonnement commence par un essai gratuit de 7 jours. Aucun débit n'a lieu pendant l'essai. Résiliez avant la fin de l'essai et aucun paiement n'est prélevé."] },
      { h: "Après l'essai", p: ["Sans résiliation avant la fin de l'essai, le premier paiement est prélevé et la période payée commence."] },
      {
        h: "Résilier un abonnement payant",
        p: [
          "Vous pouvez résilier à tout moment. La résiliation arrête le renouvellement suivant — elle ne met pas fin à la période en cours.",
          "L'accès continue jusqu'à la fin de la période déjà payée.",
        ],
      },
      { h: 'Temps non utilisé', p: ["Nous ne remboursons pas automatiquement le temps non utilisé d'une période déjà payée."] },
      {
        h: 'Comment résilier',
        p: [
          "Résiliez via « Gérer la facturation » sur la page Compte.",
          "La suppression de votre compte HeatPump DataBase N'ANNULE PAS votre abonnement. La facturation est gérée séparément et doit être résiliée via « Gérer la facturation ».",
        ],
      },
      { h: 'Cas exceptionnels', p: [`Si votre situation est exceptionnelle (par exemple un double débit), envoyez une « Nouvelle demande » depuis la page Compte ou écrivez à ${SUPPORT_EMAIL} ; nous l'examinerons avec Paddle.`] },
      { h: 'Marchand officiel', p: ["Paddle est le marchand officiel de tous les abonnements. Les factures et justificatifs de TVA sont émis par Paddle."] },
    ],
  },
  imprint: {
    title: 'Mentions légales',
    updated: ver.terms,
    sections: [
      { h: 'Service', p: [SERVICE_NAME] },
      { h: 'Contact', p: [SUPPORT_EMAIL] },
    ],
  },
};

export const LEGAL_CONTENT: Record<Language, Record<'privacy' | 'terms' | 'refund' | 'imprint', LegalDocContent>> = {
  en: EN,
  de: DE,
  fr: FR,
};
