import { requireUser, jsonResponse } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const { error } = await requireUser(request, env.DB);
  if (error) return error;

  const { results } = await env.DB.prepare(
    'SELECT id, date, text FROM announcements ORDER BY id DESC LIMIT 20'
  ).all();
  return jsonResponse({ announcements: results });
}
