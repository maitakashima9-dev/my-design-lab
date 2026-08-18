import { requireUser, jsonResponse } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const { user, error } = await requireUser(request, env.DB);
  if (error) return error;

  const { results: items } = await env.DB.prepare(
    'SELECT id, text, sort_order FROM checklist_items ORDER BY sort_order ASC'
  ).all();
  const { results: progress } = await env.DB.prepare(
    'SELECT item_id, done FROM checklist_progress WHERE user_id = ?'
  ).bind(user.id).all();
  const doneMap = new Map(progress.map(p => [p.item_id, !!p.done]));

  const checklist = items.map(i => ({ id: i.id, text: i.text, done: doneMap.get(i.id) || false }));
  return jsonResponse({ checklist });
}
