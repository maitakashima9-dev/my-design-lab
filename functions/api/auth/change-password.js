import { requireUser, verifyPassword, createPasswordRecord, jsonResponse, errorResponse } from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  const { user, error } = await requireUser(request, env.DB);
  if (error) return error;

  let body;
  try { body = await request.json(); } catch (e) { return errorResponse('リクエストの形式が正しくありません', 400); }
  const currentPassword = body.currentPassword || '';
  const newPassword = body.newPassword || '';
  if (!currentPassword || !newPassword) return errorResponse('現在のパスワードと新しいパスワードを入力してください', 400);
  if (newPassword.length < 8) return errorResponse('新しいパスワードは8文字以上にしてください', 400);

  const row = await env.DB.prepare('SELECT password_hash, salt FROM users WHERE id = ?').bind(user.id).first();
  const ok = await verifyPassword(currentPassword, row.salt, row.password_hash);
  if (!ok) return errorResponse('現在のパスワードが正しくありません', 401);

  const { salt, hash } = await createPasswordRecord(newPassword);
  await env.DB.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').bind(hash, salt, user.id).run();

  return jsonResponse({ ok: true });
}
