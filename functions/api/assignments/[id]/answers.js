import { requireUser, jsonResponse, errorResponse } from '../../../_lib/auth.js';

// 回答を取得する。受講生は自分の分のみ、管理者は ?studentId= で指定する。
export async function onRequestGet({ request, env, params }) {
  const { user, error } = await requireUser(request, env.DB);
  if (error) return error;
  const assignmentId = Number(params.id);

  let studentId = user.id;
  if (user.role === 'admin') {
    const url = new URL(request.url);
    const q = url.searchParams.get('studentId');
    if (!q) return errorResponse('studentId を指定してください', 400);
    studentId = Number(q);
  }

  const { results } = await env.DB.prepare(
    'SELECT q_key, value FROM analysis_answers WHERE assignment_id = ? AND student_id = ?'
  ).bind(assignmentId, studentId).all();
  const submitted = await env.DB.prepare(
    'SELECT 1 FROM analysis_submissions WHERE assignment_id = ? AND student_id = ?'
  ).bind(assignmentId, studentId).first();

  const answers = {};
  results.forEach(r => { answers[r.q_key] = r.value; });
  return jsonResponse({ answers, submitted: !!submitted });
}

// 1問分の回答を保存する（下書き保存・自動保存の両方で使用。受講生のみ、自分の回答のみ）
export async function onRequestPost({ request, env, params }) {
  const { user, error } = await requireUser(request, env.DB);
  if (error) return error;
  if (user.role !== 'student') return errorResponse('受講生のみ回答できます', 403);
  const assignmentId = Number(params.id);

  let body;
  try { body = await request.json(); } catch (e) { return errorResponse('リクエストの形式が正しくありません', 400); }
  const qKey = body.qKey;
  const value = body.value || '';
  if (!qKey) return errorResponse('qKey を指定してください', 400);

  await env.DB.prepare(
    `INSERT INTO analysis_answers (assignment_id, student_id, q_key, value, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(assignment_id, student_id, q_key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  ).bind(assignmentId, user.id, qKey, value).run();

  return jsonResponse({ ok: true });
}
