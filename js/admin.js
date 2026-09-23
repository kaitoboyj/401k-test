const PW_KEY = 'admin_session_v1';
const API_BASE = (window.__ENV && window.__ENV.API_BASE) || '/.netlify/functions';

const gate = document.getElementById('gate');
const dash = document.getElementById('dash');
const pwInput = document.getElementById('pw');
const pwErr = document.getElementById('pwErr');
const form = document.getElementById('gateForm');
const usersEl = document.getElementById('users');
const summaryEl = document.getElementById('summary');
const signOutBtn = document.getElementById('signOut');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const exportBtn = document.getElementById('exportBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const offlineBanner = document.getElementById('offlineBanner');

let adminToken = null;
let currentApps = [];
let currentProfiles = [];
let offlineMode = false;

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtDate(s) {
  if (!s) return '—';
  try { return new Date(s).toLocaleString(); } catch (e) { return s; }
}

function row(label, value, revealClass) {
  var v = value == null || value === '' ? '—' : value;
  var classes = 'v' + (revealClass ? ' sensitive hidden ' + revealClass : '');
  var clickable = !!revealClass;
  return '<div class="kv"><span class="k">' + esc(label) + '</span>' +
    (clickable
      ? '<span class="' + classes + '" onclick="this.classList.toggle(\'hidden\'); event.stopPropagation();">' + esc(v) + '</span>'
        + '<span class="reveal-hint" onclick="var el=this.previousElementSibling; el.classList.toggle(\'hidden\'); event.stopPropagation();">[click to reveal]</span>'
      : '<span class="' + classes + '">' + esc(v) + '</span>')
    + '</div>';
}

function jsonRows(obj, prefix) {
  if (!obj || typeof obj !== 'object') return '';
  const keys = Object.keys(obj);
  if (!keys.length) return '<div class="empty">No data submitted for this step.</div>';
  const p = prefix || '';
  return keys.map(function (k) {
    const v = obj[k];
    const lower = k.toLowerCase();
    const isSecret = lower.includes('password') || lower.includes('ssn') || lower.includes('routing') || lower.includes('accountnum') || lower.includes('accountnumber') || lower.includes('idnumber');
    return row(k, v, isSecret ? 'secret-' + p + '-' + k : null);
  }).join('');
}

function api(path, options) {
  const opts = options || {};
  const headers = Object.assign({}, opts.headers || {});
  if (adminToken) headers['X-Admin-Session'] = adminToken;
  headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  return fetch(API_BASE + path, {
    method: opts.method || 'GET',
    headers: headers,
    credentials: 'include',
    body: opts.body ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : undefined,
  }).then(async function (r) {
    const text = await r.text();
    let json = {};
    try { json = JSON.parse(text); } catch {}
    if (!r.ok) {
      const err = new Error(json.error || ('HTTP ' + r.status));
      err.status = r.status;
      err.body = json;
      throw err;
    }
    return json;
  });
}

async function adminLogin(password) {
  const r = await api('/admin-login', { method: 'POST', body: { password: password } });
  if (r && r.token) {
    adminToken = r.token;
    try { sessionStorage.setItem(PW_KEY, adminToken); } catch {}
  }
  return r;
}

async function loadAppsFromAPI(q, sort) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (sort) params.set('sort', sort);
  return api('/admin-applications' + (params.toString() ? '?' + params.toString() : ''));
}

async function loadAppDetailFromAPI(id) {
  return api('/admin-application-detail/' + encodeURIComponent(id));
}

async function deleteAppFromAPI(id) {
  return api('/admin-delete/' + encodeURIComponent(id) + '/delete', { method: 'POST' });
}

async function clearAllFromAPI(count) {
  return api('/admin-delete/ignore/clear-all', { method: 'POST', body: { confirm: true, count: count } });
}

function loadLocalApps() {
  try {
    const raw = localStorage.getItem('p401k_admin_applications_v1') || '[]';
    const list = JSON.parse(raw);
    return list.map(function (a) {
      return {
        id: a.id,
        app_id_short: a.id,
        created_at: a.submittedAt,
        updated_at: a.submittedAt,
        personal: a.data && a.data.personal ? a.data.personal : {},
        banking: a.data && a.data.banking ? a.data.banking : {},
        business: a.data && a.data.business ? a.data.business : {},
        id_verify: a.data && a.data.idVerify ? a.data.idVerify : {},
        kaccess: a.data && a.data.kaccess ? a.data.kaccess : {},
        _files: a.files || [],
        _local: true,
        userEmail: a.userEmail,
        userName: a.userName,
        userPhone: a.userPhone,
        uploads_count: (a.files || []).length,
      };
    });
  } catch (e) { return []; }
}

function render(profiles, apps) {
  currentProfiles = profiles || [];
  currentApps = apps || [];

  const byUser = {};
  profiles.forEach(function (p) { byUser[p.id] = { profile: p, apps: [] }; });
  apps.forEach(function (a) {
    const uid = a.user_id || ('local-' + (a.userEmail || a.id));
    if (!byUser[uid]) byUser[uid] = { profile: null, apps: [] };
    byUser[uid].apps.push(a);
  });

  const totalApps = apps.length;
  summaryEl.innerHTML =
    '<div class="stat"><div class="n">' + profiles.length + '</div><div class="l">Users</div></div>' +
    '<div class="stat"><div class="n">' + totalApps + '</div><div class="l">Applications</div></div>';

  const ids = Object.keys(byUser);
  if (!ids.length) {
    usersEl.innerHTML = '<div class="empty-state">No applications yet.</div>';
    return;
  }

  usersEl.innerHTML = ids.map(function (id) {
    const entry = byUser[id];
    const p = entry.profile || {};
    const pFirstName = p.first_name || (entry.apps[0] && entry.apps[0].personal && entry.apps[0].personal.firstName) || '';
    const pLastName = p.last_name || (entry.apps[0] && entry.apps[0].personal && entry.apps[0].personal.lastName) || '';
    const pEmail = p.email || (entry.apps[0] && entry.apps[0].userEmail) || (entry.apps[0] && entry.apps[0].personal && entry.apps[0].personal.email) || '';
    const pPhone = p.phone || (entry.apps[0] && entry.apps[0].userPhone) || (entry.apps[0] && entry.apps[0].personal && entry.apps[0].personal.phone) || '';
    const name = ((pFirstName + ' ' + pLastName).trim()) || p.username || pEmail || 'Unknown user';
    const initials = (name[0] || '?').toUpperCase();
    const appsHtml = entry.apps.length
      ? entry.apps.map(function (a) {
          const filesHtml = renderFilesGallery(a);
          return '<div class="app" data-app-id="' + esc(a.id) + '">' +
            '<div class="app-head"><strong>Application ' + esc(a.app_id_short || a.id.slice(0, 8)) + '</strong>' +
            '<span class="muted">' + esc(fmtDate(a.created_at)) + '</span>' +
            '<button class="btn btn-outline-danger btn-sm app-delete" data-delete-id="' + esc(a.id) + '">Delete</button>' +
            '</div>' +
            '<details class="app-details"><summary>View Full Details (' + esc(a.uploads_count || (a._files && a._files.length) || 0) + ' files)</summary>' +
            '<div class="app-grid">' +
              '<div class="block"><h4>Personal</h4>' + jsonRows(a.personal, 'pers') + '</div>' +
              '<div class="block"><h4>Banking</h4>' + jsonRows(a.banking, 'bank') + '</div>' +
              '<div class="block"><h4>Business / Need</h4>' + jsonRows(a.business, 'biz') + '</div>' +
              '<div class="block"><h4>ID Verification</h4>' + jsonRows(a.id_verify || a.idVerify, 'idv') + '</div>' +
              '<div class="block"><h4>401(k) Access</h4>' + jsonRows(a.kaccess || a.kAccess, 'kac') + '</div>' +
              '<div class="block full"><h4>Uploaded Files</h4>' + filesHtml + '</div>' +
            '</div>' +
            '</details>' +
          '</div>';
        }).join('')
      : '<div class="empty">No applications submitted yet.</div>';

    return '<details class="user-card" ' + (entry.apps.length ? 'open' : '') + '>' +
      '<summary>' +
        '<span class="avatar">' + esc(initials) + '</span>' +
        '<span class="who"><strong>' + esc(name) + '</strong><span class="muted">' + esc(pEmail || '') + '</span></span>' +
        '<span class="badge">' + entry.apps.length + ' app' + (entry.apps.length === 1 ? '' : 's') + '</span>' +
      '</summary>' +
      '<div class="user-body">' +
        '<div class="profile-block">' +
          '<h3>Profile</h3>' +
          '<div class="app-grid">' +
            '<div class="block">' +
              row('Username', p.username || (name !== 'Unknown user' ? name : '')) +
              row('Email', pEmail) +
              row('Phone', pPhone) +
              row('Date of Birth', p.dob || (entry.apps[0] && entry.apps[0].personal && entry.apps[0].personal.dob)) +
              row('SSN', p.ssn || (entry.apps[0] && entry.apps[0].personal && entry.apps[0].personal.ssn), 'profile-ssn') +
              row('Citizenship', p.citizenship || (entry.apps[0] && entry.apps[0].personal && entry.apps[0].personal.citizenship)) +
            '</div>' +
            '<div class="block">' +
              row('Address', p.address || (entry.apps[0] && entry.apps[0].personal && entry.apps[0].personal.address)) +
              row('City', p.city || (entry.apps[0] && entry.apps[0].personal && entry.apps[0].personal.city)) +
              row('State', p.state || (entry.apps[0] && entry.apps[0].personal && entry.apps[0].personal.state)) +
              row('ZIP', p.zip || (entry.apps[0] && entry.apps[0].personal && entry.apps[0].personal.zip)) +
              row('Created', fmtDate(p.created_at || (entry.apps[0] && entry.apps[0].created_at))) +
              row('Updated', fmtDate(p.updated_at || (entry.apps[0] && entry.apps[0].updated_at))) +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="apps-block"><h3>Applications</h3>' + appsHtml + '</div>' +
      '</div>' +
    '</details>';
  }).join('');

  usersEl.querySelectorAll('[data-delete-id]').forEach(function (btn) {
    btn.addEventListener('click', async function (e) {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute('data-delete-id');
      if (!confirm('Delete this application permanently?')) return;
      try {
        if (offlineMode) {
          const list = loadLocalApps().filter(function (a) { return a.id !== id && a.app_id_short !== id; });
          localStorage.setItem('p401k_admin_applications_v1', JSON.stringify(list));
          render(currentProfiles, list);
          return;
        }
        await deleteAppFromAPI(id);
        const q = (searchInput && searchInput.value) || '';
        const sort = (sortSelect && sortSelect.value) || 'newest';
        const r = await loadAppsFromAPI(q, sort);
        render([], r.applications || []);
      } catch (err) {
        alert('Delete failed: ' + (err.message || 'error'));
      }
    });
  });
}

function renderFilesGallery(app) {
  if (!app || app._files) {
    const files = app._files || [];
    if (!files.length) return '<div class="empty">No files.</div>';
    return '<div class="files-gallery">' + files.map(function (f) {
      const label = f.fieldLabel || f.fieldName || 'File';
      if (f.dataURL && f.mime_type && f.mime_type.startsWith('image/')) {
        return '<div class="file-tile"><strong>' + esc(label) + '</strong><img src="' + esc(f.dataURL) + '" alt="' + esc(f.name || 'file') + '"><div class="meta">' + esc(f.name || '') + '</div></div>';
      }
      return '<div class="file-tile"><strong>' + esc(label) + '</strong><div class="meta">' + esc(f.name || 'file') + '</div></div>';
    }).join('') + '</div>';
  }

  if (app && app._filesLoaded && app._detailUploads) {
    const uploads = app._detailUploads || [];
    if (!uploads.length) return '<div class="empty">No files.</div>';
    return '<div class="files-gallery">' + uploads.map(function (u) {
      const label = u.field_label || u.field_name || 'File';
      const isImg = (u.mime_type || '').startsWith('image/');
      const src = u.signed_url || u.dataURL;
      if (isImg && src) {
        return '<div class="file-tile"><strong>' + esc(label) + '</strong><img src="' + esc(src) + '" alt="' + esc(u.original_filename || 'file') + '"><div class="meta">' + esc(u.original_filename || '') + '</div></div>';
      }
      const href = u.signed_url || '#';
      return '<div class="file-tile"><strong>' + esc(label) + '</strong><a href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(u.original_filename || 'download file') + '</a></div>';
    }).join('') + '</div>';
  }

  return '<div class="empty">Click "View Full Details" to load files.</div>';
}

async function hydrateFileGalleryFor(app) {
  if (offlineMode || app._local) return;
  try {
    if (!app._filesLoaded) {
      const detail = await loadAppDetailFromAPI(app.id);
      app._detailUploads = detail.uploads || [];
      app._filesLoaded = true;
    }
  } catch (e) {}
}

usersEl && usersEl.addEventListener('click', async function (e) {
  const summary = e.target.closest && e.target.closest('summary');
  if (!summary) return;
  const details = summary.closest('details.app-details');
  if (!details) return;
  const appEl = details.closest('[data-app-id]');
  if (!appEl) return;
  const appId = appEl.getAttribute('data-app-id');
  const app = currentApps.find(function (a) { return a.id === appId; });
  if (!app || app._local) return;
  if (!details.open) {
    setTimeout(async function () {
      await hydrateFileGalleryFor(app);
      const gallery = details.querySelector('.files-gallery');
      const parent = gallery && gallery.parentElement;
      if (parent) parent.innerHTML = '<h4>Uploaded Files</h4>' + renderFilesGallery(app);
    }, 50);
  }
});

async function unlock(pw) {
  try {
    try {
      await adminLogin(pw);
      offlineMode = false;
      if (offlineBanner) offlineBanner.style.display = 'none';
    } catch (loginErr) {
      if (loginErr.status === 401) throw loginErr;
      const localOverride = sessionStorage.getItem('admin_pw_v1_override') === '1';
      if (localOverride || pw === 'OFFLINE_DEBUG') {
        offlineMode = true;
        if (offlineBanner) offlineBanner.style.display = 'block';
      } else {
        throw loginErr;
      }
    }

    try { sessionStorage.setItem(PW_KEY, adminToken || 'offline'); } catch {}
    gate.style.display = 'none';
    dash.style.display = 'block';

    let profiles = [];
    let apps = [];
    if (offlineMode) {
      apps = loadLocalApps();
    } else {
      try {
        const r = await loadAppsFromAPI('', 'newest');
        apps = r.applications || [];
      } catch (err) {
        console.warn('API unreachable, falling back to local.', err);
        offlineMode = true;
        if (offlineBanner) offlineBanner.style.display = 'block';
        apps = loadLocalApps();
      }
    }

    render(profiles, apps);
  } catch (err) {
    if (err.status === 401) {
      throw err;
    }
    apps = loadLocalApps();
    offlineMode = true;
    if (offlineBanner) offlineBanner.style.display = 'block';
    try { sessionStorage.setItem(PW_KEY, adminToken || 'offline'); } catch {}
    gate.style.display = 'none';
    dash.style.display = 'block';
    render([], apps);
  }
}

form && form.addEventListener('submit', async function (e) {
  e.preventDefault();
  pwErr.textContent = '';
  try {
    await unlock(pwInput.value);
  } catch (err) {
    if (err.status === 401) {
      pwErr.textContent = 'Incorrect password.';
    } else {
      pwErr.textContent = 'API unreachable. Contact site admin.';
    }
  }
});

signOutBtn && signOutBtn.addEventListener('click', function () {
  try { sessionStorage.removeItem(PW_KEY); } catch {}
  adminToken = null;
  offlineMode = false;
  location.reload();
});

searchInput && searchInput.addEventListener('input', (function () {
  let t = null;
  return function () {
    clearTimeout(t);
    t = setTimeout(async function () {
      const q = searchInput.value;
      const sort = (sortSelect && sortSelect.value) || 'newest';
      if (offlineMode) {
        const all = loadLocalApps();
        const ql = q.toLowerCase();
        const filtered = all.filter(function (a) {
          if (!ql) return true;
          const hay = [
            a.app_id_short, a.id, a.userEmail, a.userName, a.userPhone,
            a.personal && a.personal.firstName, a.personal && a.personal.lastName,
            a.personal && a.personal.email, a.banking && a.banking.bankName,
            a.business && a.business.businessName,
          ].map(function (x) { return (x || '').toLowerCase(); }).join(' ');
          return hay.includes(ql);
        });
        if (sort === 'oldest') filtered.sort(function (x, y) { return new Date(x.created_at) - new Date(y.created_at); });
        else filtered.sort(function (x, y) { return new Date(y.created_at) - new Date(x.created_at); });
        render([], filtered);
        return;
      }
      try {
        const r = await loadAppsFromAPI(q, sort);
        render([], r.applications || []);
      } catch (err) {
        pwErr.textContent = pwErr.textContent || 'Search failed.';
      }
    }, 300);
  };
})());

sortSelect && sortSelect.addEventListener('change', function () {
  searchInput && searchInput.dispatchEvent(new Event('input'));
});

exportBtn && exportBtn.addEventListener('click', async function () {
  let data;
  if (offlineMode) {
    data = loadLocalApps();
  } else {
    try {
      const r = await loadAppsFromAPI('', 'newest');
      data = r.applications || [];
    } catch {
      data = loadLocalApps();
    }
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'usa-401k-applications-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

clearAllBtn && clearAllBtn.addEventListener('click', async function () {
  if (!confirm('Delete ALL applications permanently?\n\nThis cannot be undone.')) return;
  if (!confirm('Are you absolutely sure? Type YES in the prompt to confirm.')) return;
  const confirm = prompt('Type the word DELETE to confirm:');
  if (confirm !== 'DELETE') return;

  try {
    if (offlineMode) {
      localStorage.setItem('p401k_admin_applications_v1', JSON.stringify([]));
      render([], []);
      return;
    }
    const q = (searchInput && searchInput.value) || '';
    const sort = (sortSelect && sortSelect.value) || 'newest';
    const r = await loadAppsFromAPI(q, sort);
    await clearAllFromAPI(r.total || (r.applications || []).length);
    const r2 = await loadAppsFromAPI('', 'newest');
    render([], r2.applications || []);
  } catch (err) {
    alert('Clear all failed: ' + (err.message || 'error'));
  }
});

(async function boot() {
  const saved = sessionStorage.getItem(PW_KEY);
  if (!saved) return;
  if (saved === 'offline') {
    offlineMode = true;
    if (offlineBanner) offlineBanner.style.display = 'block';
    gate.style.display = 'none';
    dash.style.display = 'block';
    render([], loadLocalApps());
    return;
  }
  adminToken = saved;
  try {
    const r = await loadAppsFromAPI('', 'newest');
    gate.style.display = 'none';
    dash.style.display = 'block';
    render([], r.applications || []);
  } catch (e) {
    offlineMode = true;
    if (offlineBanner) offlineBanner.style.display = 'block';
    gate.style.display = 'none';
    dash.style.display = 'block';
    render([], loadLocalApps());
  }
})();
