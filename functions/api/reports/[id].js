import { requireUser, jsonResponse, errorResponse } from '../../_lib/auth.js';

export async function onRequestPut({ request, env, params }) {
  const { user, error } = await requireUser(request, env.DB);
  if (error) return error;
  const id = Number(params.id);

  const row = await env.DB.prepare('SELECT user_id FROM reports WHERE id = ?').bind(id).first();
  if (!row) return errorResponse('日報が見つかりません', 404);
  if (row.user_id !== user.id) return errorResponse('自分の日報のみ編集できます', 403);

  let body;
  try { body = await request.json(); } catch (e) { return errorResponse('リクエストの形式が正しくありません', 400); }
  const title = (body.title || '').trim();
  const content = (body.content || '').trim();
  if (!title || !content) return errorResponse('タイトルと内容を入力してください', 400);

  await env.DB.prepare('UPDATE reports SET title = ?, content = ? WHERE id = ?').bind(title, content, id).run();
  return jsonResponse({ ok: true });
}

export async function onRequestDelete({ request, env, params }) {
  const { user, error } = await requireUser(request, env.DB);
  if (error) return error;
  const id = Number(params.id);

  const row = await env.DB.prepare('SELECT user_id FROM reports WHERE id = ?').bind(id).first();
  if (!row) return errorResponse('日報が見つかりません', 404);
  if (row.user_id !== user.id && user.role !== 'admin') return errorResponse('自分の日報のみ削除できます', 403);

  await env.DB.prepare('DELETE FROM reports WHERE id = ?').bind(id).run();
  return jsonResponse({ ok: true });
}
