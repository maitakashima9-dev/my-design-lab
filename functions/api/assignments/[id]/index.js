import { requireAdmin, jsonResponse, errorResponse } from '../../../_lib/auth.js';

export async function onRequestPut({ request, env, params }) {
  const { error } = await requireAdmin(request, env.DB);
  if (error) return error;
  const id = Number(params.id);

  let body;
  try { body = await request.json(); } catch (e) { return errorResponse('リクエストの形式が正しくありません', 400); }
  const { title, label, desc, url, thumbKey } = body;
  if (!label || !url) return errorResponse('LP名とURLを入力してください', 400);

  if (thumbKey) {
    await env.DB.prepare('UPDATE assignments SET title = ?, label = ?, desc = ?, url = ?, thumb_key = ? WHERE id = ?')
      .bind(title || label, label, desc || '', url, thumbKey, id).run();
  } else {
    await env.DB.prepare('UPDATE assignments SET title = ?, label = ?, desc = ?, url = ? WHERE id = ?')
      .bind(title || label, label, desc || '', url, id).run();
  }
  return jsonResponse({ ok: true });
}

export async function onRequestDelete({ request, env, params }) {
  const { error } = await requireAdmin(request, env.DB);
  if (error) return error;
  const id = Number(params.id);
  await env.DB.prepare('DELETE FROM assignments WHERE id = ?').bind(id).run();
  return jsonResponse({ ok: true });
}
