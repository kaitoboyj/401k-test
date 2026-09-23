const { jsonResponse, corsHeaders, getAdminSession, getSupabase } = require('./_shared/utils');

exports.handler = async function (event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const session = getAdminSession(event);
  if (!session) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  try {
    const pathParts = event.path.split('/');
    const action = pathParts.pop();
    const id = pathParts.pop();

    const supabase = getSupabase();

    if (action === 'clear-all') {
      const body = event.body ? JSON.parse(event.body) : {};
      if (!body.confirm) {
        return jsonResponse(400, { error: 'Confirm flag required' });
      }

      const { count, error: cErr } = await supabase
        .from('applications')
        .select('id', { count: 'exact', head: true });
      if (cErr) throw cErr;
      if (body.count !== undefined && Number(body.count) !== Number(count)) {
        return jsonResponse(400, { error: `Count mismatch: expected ${body.count}, got ${count}` });
      }

      const { data: allUploads, error: upErr } = await supabase
        .from('application_uploads')
        .select('storage_object_path');
      if (!upErr && allUploads?.length) {
        for (const u of allUploads) {
          try {
            await supabase.storage.from('application-uploads').remove([u.storage_object_path]);
          } catch {}
        }
      }

      const { error: delErr } = await supabase.from('applications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (delErr) throw delErr;
      return jsonResponse(200, { success: true, deleted: count });
    }

    if (!id || id === 'admin-delete') {
      return jsonResponse(400, { error: 'Missing application id' });
    }

    const { data: uploads, error: upErr } = await supabase
      .from('application_uploads')
      .select('storage_object_path')
      .eq('application_id', id);
    if (!upErr && uploads?.length) {
      for (const u of uploads) {
        try {
          await supabase.storage.from('application-uploads').remove([u.storage_object_path]);
        } catch {}
      }
    }

    const { error } = await supabase.from('applications').delete().eq('id', id);
    if (error) throw error;
    return jsonResponse(200, { success: true });
  } catch (err) {
    console.error('admin-delete error:', err);
    return jsonResponse(500, { error: 'Internal server error', message: err.message });
  }
};
