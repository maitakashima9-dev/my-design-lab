import { requireUser, requireAdmin, jsonResponse, errorResponse } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const { error } = await requireUser(request, env.DB);
  if (error) return error;

  const { results } = await env.DB.prepare(
    'SELECT id, date, text FROM announcements ORDER BY id DESC LIMIT 20'
  ).all();
  return jsonResponse({ announcements: results });
}

// お知らせを手動で追加する（管理者のみ）
export async function onRequestPost({ request, env }) {
  const { error } = await requireAdmin(request, env.DB);
  if (error) return error;

  let body;
  try { body = await request.json(); } catch (e) { return errorResponse('リクエストの形式が正しくありません', 400); }
  const text = (body.text || '').trim();
  if (!text) return errorResponse('お知らせの内容を入力してください', 400);

  const result = await env.DB.prepare(
    `INSERT INTO announcements (date, text) VALUES (strftime('%m/%d', 'now'), ?)`
  ).bind(text).run();
  return jsonResponse({ id: result.meta.last_row_id }, 201);
}
