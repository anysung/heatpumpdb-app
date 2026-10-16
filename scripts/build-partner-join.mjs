#!/usr/bin/env node
/**
 * build-partner-join.mjs — the "I want to join" page of the creator partner
 * programme, on the EU hub: heatpumpdb.eu/partners/join/?p=<partner id>&l=<lang>
 *
 * Every offer PDF carries a button with its own partner id (the outreach
 * tracker row). The creator types the address that should receive the partner
 * agreement and the media kit; the billing function's /partnerInterest records
 * it and alerts the marketing inbox. Nothing is mailed to the typed address
 * automatically — the owner confirms the request and sends the agreement.
 *
 * Plan: Claude Code/influencer-marketing/01-program-plan.md (marketing folder).
 * noindex: the page only makes sense with a partner id from an offer.
 *
 * Run:  node scripts/build-partner-join.mjs     (part of `npm run build:hub`)
 * Out:  hub-landing/partners/join/index.html
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'hub-landing', 'partners', 'join');
const FN_URL = 'https://europe-west1-gen-lang-client-0324244302.cloudfunctions.net/accountBilling/partnerInterest';

const T = {
  ko: { title: '크리에이터 파트너 참여 신청', lead: '계약서와 광고 소재(로고·화면·소개 영상)를 받으실 이메일 주소를 입력해 주세요. 확인 후 이 주소로 보내드립니다.', email: '이메일 주소', name: '이름 또는 채널명 (선택)', submit: '확인', sending: '보내는 중…', ok: '신청이 접수되었습니다. 곧 입력하신 주소로 계약서와 광고 소재를 보내드리겠습니다.', badLink: '링크가 올바르지 않습니다. 받으신 소개 자료의 버튼으로 다시 열어 주세요.', err: '전송하지 못했습니다. 잠시 후 다시 시도하시거나 marketing@heatpumpdb.eu로 메일 주세요.', note: '이 주소는 파트너 연락용으로만 사용합니다.' },
  en: { title: 'Join the creator partner programme', lead: 'Enter the email address where you would like to receive the partner agreement and the media kit (logo, screenshots, intro video). We will send them to this address after a quick check.', email: 'Email address', name: 'Name or channel (optional)', submit: 'Confirm', sending: 'Sending…', ok: 'Thank you — we have your request. The agreement and the media kit will reach this address shortly.', badLink: 'This link is incomplete. Please open it again from the button in the partner pack you received.', err: 'Something went wrong. Please try again in a moment, or write to marketing@heatpumpdb.eu.', note: 'We use this address only to work with you as a partner.' },
  de: { title: 'Teilnahme am Creator-Partnerprogramm', lead: 'Geben Sie die E-Mail-Adresse ein, an die wir den Partnervertrag und das Werbematerial (Logo, Screenshots, Vorstellungsvideo) senden sollen. Nach einer kurzen Prüfung erhalten Sie beides an diese Adresse.', email: 'E-Mail-Adresse', name: 'Name oder Kanal (optional)', submit: 'Bestätigen', sending: 'Wird gesendet…', ok: 'Vielen Dank – Ihre Anfrage ist eingegangen. Vertrag und Werbematerial kommen in Kürze an diese Adresse.', badLink: 'Dieser Link ist unvollständig. Bitte öffnen Sie ihn erneut über den Button in Ihren Partnerunterlagen.', err: 'Das hat leider nicht geklappt. Bitte versuchen Sie es gleich noch einmal oder schreiben Sie an marketing@heatpumpdb.eu.', note: 'Wir verwenden diese Adresse nur für die Partnerschaft.' },
  fr: { title: 'Rejoindre le programme partenaires', lead: 'Indiquez l’adresse e-mail à laquelle vous souhaitez recevoir le contrat de partenariat et le kit média (logo, captures d’écran, vidéo de présentation). Nous vous les enverrons après une brève vérification.', email: 'Adresse e-mail', name: 'Nom ou chaîne (facultatif)', submit: 'Confirmer', sending: 'Envoi…', ok: 'Merci, votre demande est bien reçue. Le contrat et le kit média arriveront très bientôt à cette adresse.', badLink: 'Ce lien est incomplet. Ouvrez-le de nouveau depuis le bouton de la présentation reçue.', err: 'L’envoi a échoué. Réessayez dans un instant ou écrivez à marketing@heatpumpdb.eu.', note: 'Nous utilisons cette adresse uniquement pour le partenariat.' },
  pl: { title: 'Dołącz do programu partnerskiego', lead: 'Podaj adres e-mail, na który mamy wysłać umowę partnerską i materiały reklamowe (logo, zrzuty ekranu, film prezentacyjny). Po krótkiej weryfikacji wyślemy je na ten adres.', email: 'Adres e-mail', name: 'Imię lub kanał (opcjonalnie)', submit: 'Potwierdź', sending: 'Wysyłanie…', ok: 'Dziękujemy, zgłoszenie zostało przyjęte. Umowa i materiały wkrótce trafią na ten adres.', badLink: 'Ten link jest niekompletny. Otwórz go ponownie przyciskiem z otrzymanej prezentacji.', err: 'Nie udało się wysłać. Spróbuj ponownie za chwilę lub napisz na marketing@heatpumpdb.eu.', note: 'Adresu używamy wyłącznie do współpracy partnerskiej.' },
  it: { title: 'Partecipa al programma partner', lead: 'Inserisca l’indirizzo e-mail a cui desidera ricevere il contratto di partnership e il media kit (logo, schermate, video di presentazione). Glieli invieremo dopo una breve verifica.', email: 'Indirizzo e-mail', name: 'Nome o canale (facoltativo)', submit: 'Conferma', sending: 'Invio…', ok: 'Grazie, la richiesta è stata ricevuta. Il contratto e il media kit arriveranno a breve a questo indirizzo.', badLink: 'Questo link è incompleto. Lo riapra dal pulsante della presentazione ricevuta.', err: 'Invio non riuscito. Riprovi tra poco oppure scriva a marketing@heatpumpdb.eu.', note: 'Usiamo questo indirizzo solo per la collaborazione.' },
};

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Partner programme · HeatPump DB</title>
<link rel="icon" href="/favicon.ico?v=2026-08" sizes="any">
<style>
  :root { --ink:#0f172a; --mut:#5b6a7f; --line:#e4e9f0; --blue:#0b6bcb; --bg:#f6f8fb; }
  * { box-sizing:border-box; margin:0; }
  body { background:var(--bg); color:var(--ink); font:16px/1.6 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","Apple SD Gothic Neo",sans-serif; }
  .top { background:#0b1626; }
  .top .in { max-width:560px; margin:0 auto; padding:16px; }
  .top a { color:#fff; font-weight:700; text-decoration:none; }
  .top a em { color:#e2412e; font-style:normal; }
  main { max-width:560px; margin:0 auto; padding:32px 16px 60px; }
  .card { background:#fff; border:1px solid var(--line); border-radius:14px; padding:28px 24px; }
  h1 { font-size:24px; letter-spacing:-.3px; margin-bottom:8px; }
  p.lead { color:#334155; margin-bottom:22px; }
  label { display:block; font-size:14px; font-weight:600; margin:14px 0 6px; }
  input { width:100%; font:inherit; padding:12px 14px; border:1px solid #cfd8e3; border-radius:10px; background:#fff; }
  input:focus { outline:2px solid var(--blue); border-color:var(--blue); }
  .hp { position:absolute; left:-9999px; }
  button { margin-top:22px; width:100%; font:inherit; font-weight:700; color:#fff; background:var(--blue); border:0; border-radius:10px; padding:13px; cursor:pointer; }
  button[disabled] { opacity:.6; cursor:default; }
  .msg { margin-top:16px; padding:12px 14px; border-radius:10px; display:none; }
  .msg.ok { display:block; background:#effaf3; color:#0f6b3a; border:1px solid #cdebd8; }
  .msg.err { display:block; background:#fdf0ef; color:#a12a1d; border:1px solid #f4cdc8; }
  .note { margin-top:14px; font-size:13px; color:var(--mut); }
</style>
</head>
<body>
<div class="top"><div class="in"><a href="/">HeatPump <em>DB</em></a></div></div>
<main><div class="card">
  <h1 id="t-title"></h1>
  <p class="lead" id="t-lead"></p>
  <form id="f" novalidate>
    <label for="email" id="t-email"></label>
    <input id="email" type="email" autocomplete="email" required>
    <label for="name" id="t-name"></label>
    <input id="name" type="text" autocomplete="name">
    <input class="hp" id="website" tabindex="-1" autocomplete="off" aria-hidden="true">
    <button id="go" type="submit"></button>
  </form>
  <div class="msg" id="msg" role="status"></div>
  <p class="note" id="t-note"></p>
</div></main>
<script>
(function () {
  var T = ${JSON.stringify(T)};
  var q = new URLSearchParams(location.search);
  var lang = (q.get('l') || '').toLowerCase();
  if (!T[lang]) lang = (navigator.language || 'en').slice(0, 2).toLowerCase();
  if (!T[lang]) lang = 'en';
  var t = T[lang], pid = (q.get('p') || '').toLowerCase();
  document.documentElement.lang = lang;
  ['title', 'lead', 'email', 'name', 'note'].forEach(function (k) { document.getElementById('t-' + k).textContent = t[k]; });
  var go = document.getElementById('go'), msg = document.getElementById('msg'), f = document.getElementById('f');
  go.textContent = t.submit;
  function show(kind, text) { msg.className = 'msg ' + kind; msg.textContent = text; }
  if (!/^[a-z0-9-]{2,60}$/.test(pid)) { show('err', t.badLink); go.disabled = true; return; }
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = document.getElementById('email').value.trim();
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(email)) { document.getElementById('email').focus(); return; }
    go.disabled = true; go.textContent = t.sending;
    fetch(${JSON.stringify(FN_URL)}, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid: pid, email: email, name: document.getElementById('name').value.trim(), lang: lang, website: document.getElementById('website').value })
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return r.ok && j.ok; }); })
      .then(function (ok) {
        if (ok) { f.style.display = 'none'; show('ok', t.ok); }
        else { go.disabled = false; go.textContent = t.submit; show('err', t.err); }
      })
      .catch(function () { go.disabled = false; go.textContent = t.submit; show('err', t.err); });
  });
})();
</script>
</body>
</html>
`;

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'index.html'), html);
console.log('  /partners/join/  partner interest form (' + Object.keys(T).join(', ') + ')');
