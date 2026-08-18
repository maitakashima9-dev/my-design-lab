import { requireAdmin, jsonResponse, errorResponse } from '../../_lib/auth.js';

export async function onRequestPut({ request, env, params }) {
  const { error } = await requireAdmin(request, env.DB);
  if (error) return error;
  const id = Number(params.id);

  let body;
  try { body = await request.json(); } catch (e) { return errorResponse('リクエストの形式が正しくありません', 400); }
  const { name, type } = body;
  if (!name || !type) return errorResponse('ファイル名と種類を入力してください', 400);

  if (Object.prototype.hasOwnProperty.call(body, 'password')) {
    const pw = body.password || null;
    await env.DB.prepare('UPDATE files SET name = ?, type = ?, access_password = ? WHERE id = ?')
      .bind(name, type, pw, id).run();
  } else {
    await env.DB.prepare('UPDATE files SET name = ?, type = ? WHERE id = ?').bind(name, type, id).run();
  }
  return jsonResponse({ ok: true });
}

export async function onRequestDelete({ request, env, params }) {
  const { error } = await requireAdmin(request, env.DB);
  if (error) return error;
  const id = Number(params.id);
  await env.DB.prepare('DELETE FROM files WHERE id = ?').bind(id).run();
  return jsonResponse({ ok: true });
}
