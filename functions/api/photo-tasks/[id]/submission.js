import { requireUser, jsonResponse, errorResponse } from '../../../_lib/auth.js';

// 提出物を取得する。受講生は自分の分、管理者は ?studentId= で指定する。
export async function onRequestGet({ request, env, params }) {
  const { user, error } = await requireUser(request, env.DB);
  if (error) return error;
  const taskId = Number(params.id);

  let studentId = user.id;
  if (user.role === 'admin') {
    const url = new URL(request.url);
    const q = url.searchParams.get('studentId');
    if (!q) return errorResponse('studentId を指定してください', 400);
    studentId = Number(q);
  }

  const row = await env.DB.prepare(
    'SELECT file_key, file_name, size, comment, submitted_at FROM photo_submissions WHERE task_id = ? AND student_id = ?'
  ).bind(taskId, studentId).first();

  if (!row) return jsonResponse({ submission: null });
  return jsonResponse({
    submission: {
      fileName: row.file_name, size: row.size, comment: row.comment,
      submittedAt: row.submitted_at, fileUrl: `/api/files/${row.file_key}`,
    },
  });
}

// 完成データを提出する（受講生のみ、自分の提出のみ）
export async function onRequestPost({ request, env, params }) {
  const { user, error } = await requireUser(request, env.DB);
  if (error) return error;
  if (user.role !== 'student') return errorResponse('受講生のみ提出できます', 403);
  const taskId = Number(params.id);

  let body;
  try { body = await request.json(); } catch (e) { return errorResponse('リクエストの形式が正しくありません', 400); }
  const { fileKey, fileName, size, comment } = body;
  if (!fileKey || !fileName) return errorResponse('提出するファイルを選択してください', 400);

  await env.DB.prepare(
    `INSERT INTO photo_submissions (task_id, student_id, file_key, file_name, size, comment, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(task_id, student_id) DO UPDATE SET
       file_key = excluded.file_key, file_name = excluded.file_name,
       size = excluded.size, comment = excluded.comment, submitted_at = datetime('now')`
  ).bind(taskId, user.id, fileKey, fileName, size || '--', comment || '').run();

  return jsonResponse({ ok: true });
}
