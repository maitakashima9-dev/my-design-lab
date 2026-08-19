import { requireAdmin, jsonResponse, errorResponse } from '../../_lib/auth.js';

const MAX_IMAGES = 10;

export async function onRequestPut({ request, env, params }) {
  const { error } = await requireAdmin(request, env.DB);
  if (error) return error;
  const id = Number(params.id);

  let body;
  try { body = await request.json(); } catch (e) { return errorResponse('リクエストの形式が正しくありません', 400); }
  const { title, comment, imageKeys, linkUrl } = body;
  if (!title || !comment) return errorResponse('タイトルと解説コメントを入力してください', 400);

  await env.DB.prepare('UPDATE zukan_items SET title = ?, comment = ?, link_url = ? WHERE id = ?')
    .bind(title, comment, linkUrl || null, id).run();

  if (Array.isArray(imageKeys)) {
    const keys = imageKeys.filter(Boolean);
    if (!keys.length) return errorResponse('画像を1枚以上選んでください', 400);
    if (keys.length > MAX_IMAGES) return errorResponse(`画像は最大${MAX_IMAGES}枚までです`, 400);
    await env.DB.prepare('DELETE FROM zukan_images WHERE zukan_item_id = ?').bind(id).run();
    for (let i = 0; i < keys.length; i++) {
      await env.DB.prepare(
        `INSERT INTO zukan_images (zukan_item_id, image_key, sort_order) VALUES (?, ?, ?)`
      ).bind(id, keys[i], i).run();
    }
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
