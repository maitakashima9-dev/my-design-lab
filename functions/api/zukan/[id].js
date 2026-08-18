import { requireAdmin, jsonResponse, errorResponse } from '../../_lib/auth.js';

export async function onRequestPut({ request, env, params }) {
  const { error } = await requireAdmin(request, env.DB);
  if (error) return error;
  const id = Number(params.id);

  let body;
  try { body = await request.json(); } catch (e) { return errorResponse('リクエストの形式が正しくありません', 400); }
  const { title, comment, thumbKey } = body;
  if (!title || !comment) return errorResponse('タイトルと解説コメントを入力してください', 400);

  if (thumbKey) {
    await env.DB.prepare('UPDATE zukan_items SET title = ?, comment = ?, thumb_key = ? WHERE id = ?')
      .bind(title, comment, thumbKey, id).run();
  } else {
    await env.DB.prepare('UPDATE zukan_items SET title = ?, comment = ? WHERE id = ?')
      .bind(title, comment, id).run();
  }
  return jsonResponse({ ok: true });
}

export async function onRequestDelete({ request, env, params }) {
  const { error } = await requireAdmin(request, env.DB);
  if (error) return error;
  const id = Number(params.id);
  await env.DB.prepare('DELETE FROM zukan_items WHERE id = ?').bind(id).run();
  return jsonResponse({ ok: true });
}
