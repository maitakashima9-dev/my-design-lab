import { requireAdmin, jsonResponse, errorResponse } from '../../../_lib/auth.js';

export async function onRequestPut({ request, env, params }) {
  const { error } = await requireAdmin(request, env.DB);
  if (error) return error;
  const id = Number(params.id);

  let body;
  try { body = await request.json(); } catch (e) { return errorResponse('リクエストの形式が正しくありません', 400); }
  const { title, label, desc, fileKey, fileName, fileSize, thumbKey } = body;
  if (!label || !desc) return errorResponse('課題ラベルと説明文を入力してください', 400);

  const sets = ['title = ?', 'label = ?', 'desc = ?'];
  const vals = [title || label, label, desc];
  if (fileKey) { sets.push('file_key = ?', 'file_name = ?', 'file_size = ?'); vals.push(fileKey, fileName || '', fileSize || '--'); }
  if (thumbKey) { sets.push('thumb_key = ?'); vals.push(thumbKey); }
  vals.push(id);

  await env.DB.prepare(`UPDATE photo_tasks SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  return jsonResponse({ ok: true });
}

export async function onRequestDelete({ request, env, params }) {
  const { error } = await requireAdmin(request, env.DB);
  if (error) return error;
  const id = Number(params.id);
  await env.DB.prepare('DELETE FROM photo_tasks WHERE id = ?').bind(id).run();
  return jsonResponse({ ok: true });
}
