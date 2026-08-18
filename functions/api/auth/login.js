import { verifyPassword, createSession, sessionCookieHeader, jsonResponse, errorResponse } from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return errorResponse('リクエストの形式が正しくありません', 400);
  }
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  if (!email || !password) return errorResponse('メールアドレスとパスワードを入力してください', 400);

  const user = await env.DB.prepare(
    'SELECT id, email, password_hash, salt, role, name, initial, color, joined_at FROM users WHERE lower(email) = ?'
  ).bind(email).first();

  if (!user) return errorResponse('メールアドレスまたはパスワードが違います', 401);

  const ok = await verifyPassword(password, user.salt, user.password_hash);
  if (!ok) return errorResponse('メールアドレスまたはパスワードが違います', 401);

  const token = await createSession(env.DB, user.id);
  const res = jsonResponse({
    user: {
      id: user.id, email: user.email, role: user.role, name: user.name,
      initial: user.initial, color: user.color, joinedAt: user.joined_at,
    },
  });
  res.headers.set('Set-Cookie', sessionCookieHeader(token, 60 * 60 * 24 * 30));
  return res;
}
