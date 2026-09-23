const { jsonResponse, corsHeaders, timingSafeEqual, signAdminSession, checkAdminPasswordEnv } = require('./_shared/utils');

exports.handler = async function (event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const expected = checkAdminPasswordEnv();
    const body = event.body ? JSON.parse(event.body) : {};
    const password = body.password || '';

    if (!timingSafeEqual(password, expected)) {
      return jsonResponse(401, { error: 'Incorrect password' });
    }

    const token = signAdminSession();
    return jsonResponse(200, {
      success: true,
      token: token,
      expiresIn: 24 * 60 * 60,
    }, {
      'Set-Cookie': `admin_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${24 * 60 * 60}`,
    });
  } catch (err) {
    console.error('admin-login error:', err);
    const msg = err && err.message && err.message.startsWith('[NETLIFY FUNCTION CONFIG ERROR]')
      ? err.message
      : 'Internal server error';
    return jsonResponse(500, { error: msg });
  }
};
