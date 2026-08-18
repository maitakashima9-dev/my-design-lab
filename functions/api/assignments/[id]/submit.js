import { requireUser, jsonResponse, errorResponse } from '../../../_lib/auth.js';

export async function onRequestPost({ request, env, params }) {
  const { user, error } = await requireUser(request, env.DB);
  if (error) return error;
  if (user.role !== 'student') return errorResponse('受講生のみ提出できます', 403);
  const assignmentId = Number(params.id);

  await env.DB.prepare(
    `INSERT INTO analysis_submissions (assignment_id, student_id, submitted_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(assignment_id, student_id) DO UPDATE SET submitted_at = datetime('now')`
  ).bind(assignmentId, user.id).run();

  return jsonResponse({ ok: true });
}
