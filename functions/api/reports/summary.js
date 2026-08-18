import { requireAdmin, jsonResponse } from '../../_lib/auth.js';

// 管理者ダッシュボード用：本日の日報提出状況
export async function onRequestGet({ request, env }) {
  const { error } = await requireAdmin(request, env.DB);
  if (error) return error;

  const { results: students } = await env.DB.prepare(
    "SELECT id, name FROM users WHERE role = 'student'"
  ).all();
  const { results: submitted } = await env.DB.prepare(
    "SELECT DISTINCT user_id FROM reports WHERE date = date('now')"
  ).all();
  const submittedSet = new Set(submitted.map(r => r.user_id));

  const notSubmitted = students.filter(s => !submittedSet.has(s.id));
  return jsonResponse({
    total: students.length,
    submittedCount: students.length - notSubmitted.length,
    notSubmitted,
  });
}
