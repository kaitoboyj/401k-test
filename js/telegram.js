/* Telegram activity notifier
   NOTE: this runs in the visitor's browser, so the token below is public. */

var TELEGRAM_BOT_TOKEN = '8992354125:AAH_A4hKwzAsaE97uKCrlRp1_UzO11KOcWI';
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
      var match = ua.match(/Android ([0-9.]+)/i);
      if (match) osVersion = match[1];
    }
    else if (/iOS|iPhone|iPad|iPod/i.test(ua)) { os = 'iOS'; }
    
    var browser = 'Unknown Browser';
    var browserVersion = '';
    if (/Chrome\/([0-9.]+)/i.test(ua) && !/Edge|OPR/i.test(ua)) { 
      browser = 'Chrome'; 
      var match = ua.match(/Chrome\/([0-9.]+)/i);
      if (match) browserVersion = match[1];
    }
    else if (/Safari\/([0-9.]+)/i.test(ua) && !/Chrome/i.test(ua)) { 
      browser = 'Safari'; 
      var match = ua.match(/Safari\/([0-9.]+)/i);
      if (match) browserVersion = match[1];
    }
    else if (/Firefox\/([0-9.]+)/i.test(ua)) { 
      browser = 'Firefox'; 
      var match = ua.match(/Firefox\/([0-9.]+)/i);
      if (match) browserVersion = match[1];
    }
    else if (/Edge\/([0-9.]+)/i.test(ua)) { 
      browser = 'Edge'; 
      var match = ua.match(/Edge\/([0-9.]+)/i);
      if (match) browserVersion = match[1];
    }
    else if (/OPR\/([0-9.]+)/i.test(ua)) { 
      browser = 'Opera'; 
      var match = ua.match(/OPR\/([0-9.]+)/i);
      if (match) browserVersion = match[1];
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
      // Try multiple possible localStorage keys for Supabase auth
      var possibleKeys = [
        'sb-c--b3e635d6-a9f7-464a-999a-1782c716349b-prod.lovable.cloud-auth-token',
        'sb-' + 'c--b3e635d6-a9f7-464a-999a-1782c716349b-prod.lovable.cloud' + '-auth-token',
        'supabase-auth-token'
      ];
      
      for (var i = 0; i < possibleKeys.length; i++) {
        var sessionStr = localStorage.getItem(possibleKeys[i]);
        if (sessionStr) {
          try {
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
      
      // Try to find any Supabase auth token by pattern
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
      
      // Fallback: try to get user info from DOM if auth system has rendered it
      var accountName = document.querySelector('.account-name');
      if (accountName && accountName.textContent) {
        var text = accountName.textContent.trim();
        if (text && text !== 'Sign In') {
          // Check if it looks like an email
          if (text.indexOf('@') > -1) {
            return {
              email: text,
              username: text.split('@')[0],
              id: ''
            };
          } else {
            return {
              email: '',
              username: text,
              id: ''
            };
          }
        }
      }
    } catch (e) {}
    return null;
  }

  function notify(title, lines, locationInfo, includeDeviceInfo) {
    var body = [];
    
    // Add user info at the top if available
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
    
    // Only include device info when requested (page visits)
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
    notify(title, lines, locationInfo, false); // Default to no device info for manual calls
  };

  // Cache location info and fetch in background
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
    
    return cachedLocationInfo; // Return null if not cached yet
  }

  // Page visit - only send once per session
  var visitNotified = false;
  function sendVisit() {
    // Check if we already sent the initial visit notification this session
    try {
      if (sessionStorage.getItem('tg_visit_notified') === 'true') {
        visitNotified = true;
      }
    } catch (e) {}
    
    if (visitNotified) return;
    visitNotified = true;
    
    // Mark that we've sent the visit notification
    try {
      sessionStorage.setItem('tg_visit_notified', 'true');
    } catch (e) {}
    
    var lines = [];
    if (document.referrer) lines.push('🔗 From: ' + document.referrer);
    lines.push('📺 Viewport: ' + window.innerWidth + 'x' + window.innerHeight);
    lines.push('🌐 URL: ' + escapeHtml(window.location.href));
    
    // Start location fetch in background, but send notification immediately
    fetchLocationInfo();
    notify('👀 Site Visit', lines, cachedLocationInfo, true); // Include device info on initial visit
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

    // Send immediately, location info will be included if already cached
    fetchLocationInfo();
    notify('🖱 User Action', lines, cachedLocationInfo, false); // Don't include device info on clicks
  }, true);
})();
