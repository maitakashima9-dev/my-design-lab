import { requireAdmin, jsonResponse } from '../../_lib/auth.js';

export async function onRequestDelete({ request, env, params }) {
  const { error } = await requireAdmin(request, env.DB);
  if (error) return error;
  const id = Number(params.id);
  await env.DB.prepare('DELETE FROM announcements WHERE id = ?').bind(id).run();
  return jsonResponse({ ok: true });
}
