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
    const supabase = getSupabase();
    const params = event.queryStringParameters || {};
    const q = (params.q || '').trim();
    const sort = params.sort || 'newest';
    const page = parseInt(params.page || '0', 10);
    const limit = Math.min(parseInt(params.limit || '100', 10), 500);

    let query = supabase
      .from('applications')
      .select(`
        id,
        user_id,
        app_id_short,
        status,
        ip,
        created_at,
        updated_at,
        personal,
        banking,
        business,
        id_verify,
        kaccess,
        application_uploads(count)
      `, { count: 'exact' });

    if (q) {
      query = query.or(`
        app_id_short.ilike.%${q}%,
        personal->>first_name.ilike.%${q}%,
        personal->>last_name.ilike.%${q}%,
        personal->>email.ilike.%${q}%,
        banking->>bankName.ilike.%${q}%,
        business->>businessName.ilike.%${q}%
      `);
    }

    if (sort === 'oldest') {
      query = query.order('created_at', { ascending: true });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    query = query.range(page * limit, (page + 1) * limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    const rows = (data || []).map((r) => ({
      id: r.id,
      user_id: r.user_id,
      app_id_short: r.app_id_short,
      status: r.status,
      ip: r.ip,
      created_at: r.created_at,
      updated_at: r.updated_at,
      personal: r.personal,
      banking: r.banking,
      business: r.business,
      id_verify: r.id_verify,
      kaccess: r.kaccess,
      uploads_count: r.application_uploads?.[0]?.count || 0,
    }));

    return jsonResponse(200, {
      success: true,
      applications: rows,
      total: count ?? rows.length,
      page,
      limit,
    });
  } catch (err) {
    console.error('admin-applications error:', err);
    return jsonResponse(500, { error: 'Internal server error', message: err.message });
  }
};
