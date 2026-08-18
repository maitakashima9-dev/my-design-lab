import { requireAdmin, jsonResponse, errorResponse } from '../../_lib/auth.js';

export async function onRequestDelete({ request, env, params }) {
  const { error } = await requireAdmin(request, env.DB);
  if (error) return error;
  const id = Number(params.id);

  const target = await env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(id).first();
  if (!target) return errorResponse('対象の受講生が見つかりません', 404);
  if (target.role !== 'student') return errorResponse('受講生アカウントのみ削除できます', 400);

  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  return jsonResponse({ ok: true });
}
