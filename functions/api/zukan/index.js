import { requireUser, requireAdmin, jsonResponse, errorResponse } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const { error } = await requireUser(request, env.DB);
  if (error) return error;

  const { results } = await env.DB.prepare(
    'SELECT id, title, comment, thumb_key FROM zukan_items ORDER BY sort_order ASC, id ASC'
  ).all();
  const items = results.map(z => ({
    id: z.id, title: z.title, comment: z.comment, thumb: z.thumb_key ? `/api/files/${z.thumb_key}` : null,
  }));
  return jsonResponse({ items });
}

export async function onRequestPost({ request, env }) {
  const { error } = await requireAdmin(request, env.DB);
  if (error) return error;

  let body;
  try { body = await request.json(); } catch (e) { return errorResponse('リクエストの形式が正しくありません', 400); }
  const { title, comment, thumbKey } = body;
  if (!title || !comment) return errorResponse('タイトルと解説コメントを入力してください', 400);

  const countRow = await env.DB.prepare('SELECT COUNT(*) as c FROM zukan_items').first();
  const result = await env.DB.prepare(
    `INSERT INTO zukan_items (title, comment, thumb_key, sort_order) VALUES (?, ?, ?, ?)`
  ).bind(title, comment, thumbKey || null, countRow.c).run();

  return jsonResponse({ id: result.meta.last_row_id }, 201);
}
