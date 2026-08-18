import { requireUser, requireAdmin, jsonResponse, errorResponse } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const { user, error } = await requireUser(request, env.DB);
  if (error) return error;

  const { results } = await env.DB.prepare(
    'SELECT id, title, label, desc, file_key, file_name, file_size, thumb_key, seed FROM photo_tasks ORDER BY id ASC'
  ).all();

  let submittedSet = new Set();
  if (user.role === 'student') {
    const { results: sub } = await env.DB.prepare(
      'SELECT task_id FROM photo_submissions WHERE student_id = ?'
    ).bind(user.id).all();
    submittedSet = new Set(sub.map(r => r.task_id));
  }

  const tasks = results.map(t => ({
    id: t.id, title: t.title, label: t.label, desc: t.desc,
    fileName: t.file_name, fileSize: t.file_size,
    fileUrl: t.file_key ? `/api/files/${t.file_key}` : null,
    thumb: t.thumb_key ? `/api/files/${t.thumb_key}` : null,
    seed: t.seed,
    submitted: user.role === 'student' ? submittedSet.has(t.id) : undefined,
  }));
  return jsonResponse({ tasks });
}

export async function onRequestPost({ request, env }) {
  const { error } = await requireAdmin(request, env.DB);
  if (error) return error;

  let body;
  try { body = await request.json(); } catch (e) { return errorResponse('リクエストの形式が正しくありません', 400); }
  const { title, label, desc, fileKey, fileName, fileSize, thumbKey } = body;
  if (!label || !desc) return errorResponse('課題ラベルと説明文を入力してください', 400);

  const countRow = await env.DB.prepare('SELECT COUNT(*) as c FROM photo_tasks').first();
  const finalTitle = (title || '').trim() || `補正課題${countRow.c + 1}`;

  const result = await env.DB.prepare(
    `INSERT INTO photo_tasks (title, label, desc, file_key, file_name, file_size, thumb_key, seed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(finalTitle, label, desc, fileKey || null, fileName || 'サンプルデータ.psd', fileSize || '--', thumbKey || null, countRow.c % 3).run();

  return jsonResponse({ id: result.meta.last_row_id }, 201);
}
