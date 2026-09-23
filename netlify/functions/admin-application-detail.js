const { jsonResponse, corsHeaders, getAdminSession, getSupabase } = require('./_shared/utils');

exports.handler = async function (event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const session = getAdminSession(event);
  if (!session) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  try {
    const id = event.path.split('/').pop();
    if (!id || id === 'admin-application-detail') {
      return jsonResponse(400, { error: 'Missing application id' });
    }

    const supabase = getSupabase();

    const { data: app, error: appErr } = await supabase
      .from('applications')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (appErr) throw appErr;
    if (!app) return jsonResponse(404, { error: 'Application not found' });

    const { data: uploads, error: upErr } = await supabase
      .from('application_uploads')
      .select('*')
      .eq('application_id', id)
      .order('created_at', { ascending: true });

    if (upErr) throw upErr;

    const uploadsWithUrls = [];
    for (const u of uploads || []) {
      let signedUrl = '';
      try {
        const { data } = await supabase.storage
          .from('application-uploads')
          .createSignedUrl(u.storage_object_path, 60 * 60);
        signedUrl = data?.signedUrl || '';
      } catch (e) {
        console.warn('signed url failed for', u.storage_object_path, e.message);
      }
      uploadsWithUrls.push({
        ...u,
        signed_url: signedUrl,
      });
    }

    return jsonResponse(200, {
      success: true,
      application: app,
      uploads: uploadsWithUrls,
    });
  } catch (err) {
    console.error('admin-application-detail error:', err);
    return jsonResponse(500, { error: 'Internal server error', message: err.message });
  }
};
