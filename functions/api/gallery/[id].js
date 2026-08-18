import { requireAdmin, jsonResponse, errorResponse } from '../../_lib/auth.js';

export async function onRequestPut({ request, env, params }) {
  const { error } = await requireAdmin(request, env.DB);
  if (error) return error;
  const id = Number(params.id);

  let body;
  try { body = await request.json(); } catch (e) { return errorResponse('リクエストの形式が正しくありません', 400); }
  const { title, tag, thumbKey } = body;
  if (!title || !tag) return errorResponse('タイトルとタグを入力してください', 400);

  if (thumbKey) {
    await env.DB.prepare('UPDATE gallery_items SET title = ?, tag = ?, thumb_key = ? WHERE id = ?')
      .bind(title, tag, thumbKey, id).run();
  } else {
    await env.DB.prepare('UPDATE gallery_items SET title = ?, tag = ? WHERE id = ?')
      .bind(title, tag, id).run();
  }
  return jsonResponse({ ok: true });
}

export async function onRequestDelete({ request, env, params }) {
  const { error } = await requireAdmin(request, env.DB);
  if (error) return error;
  const id = Number(params.id);
  await env.DB.prepare('DELETE FROM gallery_items WHERE id = ?').bind(id).run();
  return jsonResponse({ ok: true });
}
