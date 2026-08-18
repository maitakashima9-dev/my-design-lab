import { requireUser, jsonResponse, errorResponse } from '../../_lib/auth.js';

// 日報一覧を取得する。受講生は自分の日報のみ、管理者は ?studentId= で指定した受講生の日報を見る。
export async function onRequestGet({ request, env }) {
  const { user, error } = await requireUser(request, env.DB);
  if (error) return error;

  const url = new URL(request.url);
  let targetId = user.id;
  if (user.role === 'admin') {
    const q = url.searchParams.get('studentId');
    if (q) targetId = Number(q);
  }

  const { results } = await env.DB.prepare(
    'SELECT id, date, title, content, created_at FROM reports WHERE user_id = ? ORDER BY date DESC, id DESC'
  ).bind(targetId).all();

  return jsonResponse({ reports: results });
}

// 日報を提出する（受講生のみ・本人分のみ）
export async function onRequestPost({ request, env }) {
  const { user, error } = await requireUser(request, env.DB);
  if (error) return error;

  let body;
  try { body = await request.json(); } catch (e) { return errorResponse('リクエストの形式が正しくありません', 400); }
  const title = (body.title || '').trim();
  const content = (body.content || '').trim();
  if (!title || !content) return errorResponse('タイトルと内容を入力してください', 400);

  const result = await env.DB.prepare(
    `INSERT INTO reports (user_id, date, title, content) VALUES (?, date('now'), ?, ?)`
  ).bind(user.id, title, content).run();

  return jsonResponse({ id: result.meta.last_row_id }, 201);
}
