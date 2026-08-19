import { requireUser, requireAdmin, jsonResponse, errorResponse } from '../../_lib/auth.js';

const MAX_IMAGES = 10;

export async function onRequestGet({ request, env }) {
  const { error } = await requireUser(request, env.DB);
  if (error) return error;

  const { results: items } = await env.DB.prepare(
    'SELECT id, title, tag, thumb_key FROM gallery_items ORDER BY sort_order ASC, id ASC'
  ).all();
  const { results: images } = await env.DB.prepare(
    'SELECT gallery_item_id, image_key FROM gallery_images ORDER BY gallery_item_id ASC, sort_order ASC, id ASC'
  ).all();

  const imagesByItem = {};
  images.forEach(img => {
    (imagesByItem[img.gallery_item_id] = imagesByItem[img.gallery_item_id] || []).push(`/api/files/${img.image_key}`);
  });

  const out = items.map(g => {
    const imgs = imagesByItem[g.id] || [];
    // 旧データ（画像テーブル移行前にthumb_keyだけで登録されたもの）はそのまま使う
    const thumb = imgs[0] || (g.thumb_key ? `/api/files/${g.thumb_key}` : null);
    return { id: g.id, title: g.title, tag: g.tag, thumb, images: imgs };
  });
  return jsonResponse({ items: out });
}

export async function onRequestPost({ request, env }) {
  const { error } = await requireAdmin(request, env.DB);
  if (error) return error;

  let body;
  try { body = await request.json(); } catch (e) { return errorResponse('リクエストの形式が正しくありません', 400); }
  const { title, tag, imageKeys } = body;
  if (!title || !tag) return errorResponse('タイトルとタグを入力してください', 400);
  const keys = Array.isArray(imageKeys) ? imageKeys.filter(Boolean) : [];
  if (!keys.length) return errorResponse('画像を1枚以上選んでください', 400);
  if (keys.length > MAX_IMAGES) return errorResponse(`画像は最大${MAX_IMAGES}枚までです`, 400);

  const countRow = await env.DB.prepare('SELECT COUNT(*) as c FROM gallery_items').first();
  const result = await env.DB.prepare(
    `INSERT INTO gallery_items (title, tag, sort_order) VALUES (?, ?, ?)`
  ).bind(title, tag, countRow.c).run();
  const itemId = result.meta.last_row_id;

  for (let i = 0; i < keys.length; i++) {
    await env.DB.prepare(
      `INSERT INTO gallery_images (gallery_item_id, image_key, sort_order) VALUES (?, ?, ?)`
    ).bind(itemId, keys[i], i).run();
  }

  return jsonResponse({ id: itemId }, 201);
}
