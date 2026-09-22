/* Telegram activity notifier
   NOTE: this runs in the visitor's browser, so the token below is public. */

var TELEGRAM_BOT_TOKEN = 'PASTE_BOT_TOKEN_HERE';
var TELEGRAM_CHAT_ID = '-1004482554358';

(function () {
  if (typeof window === 'undefined') return;

  function sessionId() {
    try {
      var id = sessionStorage.getItem('tg_session_id');
      if (!id) {
        id = Math.random().toString(36).slice(2, 8).toUpperCase();
        sessionStorage.setItem('tg_session_id', id);
      }
      return id;
    } catch (e) {
      return 'ANON';
    }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function send(text) {
    if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN.indexOf('PASTE_') === 0) return;
    try {
      fetch('https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: text,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        }),
        keepalive: true
      }).catch(function () {});
    } catch (e) {}
  }

  function page() {
    return window.location.pathname.split('/').pop() || 'index.html';
  }

  function notify(title, lines) {
    var body = ['<b>' + escapeHtml(title) + '</b>'];
    body.push('Page: ' + escapeHtml(page()));
    (lines || []).forEach(function (l) { body.push(escapeHtml(l)); });
    body.push('Visitor: ' + escapeHtml(sessionId()));
    body.push('Time: ' + escapeHtml(new Date().toLocaleString()));
    send(body.join('\n'));
  }

  window.telegramNotify = notify;

  // Page visit
  var visited = false;
  function sendVisit() {
    if (visited) return;
    visited = true;
    var lines = [];
    if (document.referrer) lines.push('From: ' + document.referrer);
    lines.push('Screen: ' + window.innerWidth + 'x' + window.innerHeight);
    notify('👀 Page visit', lines);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sendVisit);
  } else {
    sendVisit();
  }

  // Clicks
  var lastClick = 0;
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest
      ? e.target.closest('a, button, [role="button"], input[type="submit"], .answer-btn, .upload-area')
      : null;
    if (!el) return;

    var now = Date.now();
    if (now - lastClick < 400) return;
    lastClick = now;

    var label = (el.getAttribute('aria-label') || el.textContent || el.value || '').trim().replace(/\s+/g, ' ');
    if (label.length > 80) label = label.slice(0, 80) + '…';
    if (!label) label = el.tagName.toLowerCase();

    var lines = ['Clicked: ' + label];
    var href = el.getAttribute && el.getAttribute('href');
    if (href) lines.push('Link: ' + href);

    notify('🖱 Click', lines);
  }, true);
})();
