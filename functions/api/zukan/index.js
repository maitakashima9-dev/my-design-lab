import { requireUser, requireAdmin, jsonResponse, errorResponse } from '../../_lib/auth.js';

const MAX_IMAGES = 10;

export async function onRequestGet({ request, env }) {
  const { error } = await requireUser(request, env.DB);
  if (error) return error;

  const { results: items } = await env.DB.prepare(
    'SELECT id, title, comment, thumb_key, link_url FROM zukan_items ORDER BY sort_order ASC, id ASC'
  ).all();
  const { results: images } = await env.DB.prepare(
    'SELECT zukan_item_id, image_key FROM zukan_images ORDER BY zukan_item_id ASC, sort_order ASC, id ASC'
  ).all();

  const imagesByItem = {};
  images.forEach(img => {
    (imagesByItem[img.zukan_item_id] = imagesByItem[img.zukan_item_id] || []).push(`/api/files/${img.image_key}`);
  });

  const out = items.map(z => {
    const imgs = imagesByItem[z.id] || [];
    const thumb = imgs[0] || (z.thumb_key ? `/api/files/${z.thumb_key}` : null);
    return { id: z.id, title: z.title, comment: z.comment, thumb, images: imgs, linkUrl: z.link_url || null };
  });
  return jsonResponse({ items: out });
}

export async function onRequestPost({ request, env }) {
  const { error } = await requireAdmin(request, env.DB);
  if (error) return error;

  let body;
  try { body = await request.json(); } catch (e) { return errorResponse('リクエストの形式が正しくありません', 400); }
  const { title, comment, imageKeys, linkUrl } = body;
  if (!title || !comment) return errorResponse('タイトルと解説コメントを入力してください', 400);
  const keys = Array.isArray(imageKeys) ? imageKeys.filter(Boolean) : [];
  if (!keys.length) return errorResponse('画像を1枚以上選んでください', 400);
  if (keys.length > MAX_IMAGES) return errorResponse(`画像は最大${MAX_IMAGES}枚までです`, 400);

  const countRow = await env.DB.prepare('SELECT COUNT(*) as c FROM zukan_items').first();
  const result = await env.DB.prepare(
    `INSERT INTO zukan_items (title, comment, sort_order, link_url) VALUES (?, ?, ?, ?)`
  ).bind(title, comment, countRow.c, linkUrl || null).run();
  const itemId = result.meta.last_row_id;

  for (let i = 0; i < keys.length; i++) {
    await env.DB.prepare(
      `INSERT INTO zukan_images (zukan_item_id, image_key, sort_order) VALUES (?, ?, ?)`
    ).bind(itemId, keys[i], i).run();
  }

  return jsonResponse({ id: itemId }, 201);
}
