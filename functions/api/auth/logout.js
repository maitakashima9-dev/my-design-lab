import { clearSessionCookieHeader, jsonResponse } from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/(?:^|;\s*)session=([^;]+)/);
  if (match) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(match[1]).run();
  }
  const res = jsonResponse({ ok: true });
  res.headers.set('Set-Cookie', clearSessionCookieHeader());
  return res;
}
