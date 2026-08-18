import { requireAdmin, jsonResponse } from '../../../_lib/auth.js';

// 管理者向け：受講生ごとの提出状況一覧
export async function onRequestGet({ request, env, params }) {
  const { error } = await requireAdmin(request, env.DB);
  if (error) return error;
  const taskId = Number(params.id);

  const { results: students } = await env.DB.prepare(
    "SELECT id, name FROM users WHERE role = 'student'"
  ).all();
  const { results: submitted } = await env.DB.prepare(
    'SELECT student_id FROM photo_submissions WHERE task_id = ?'
  ).bind(taskId).all();
  const submittedSet = new Set(submitted.map(r => r.student_id));

  const statuses = students.map(s => ({ id: s.id, name: s.name, submitted: submittedSet.has(s.id) }));
  return jsonResponse({ statuses, submittedCount: submittedSet.size, total: students.length });
}
