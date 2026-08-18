import { requireUser, jsonResponse } from '../../../_lib/auth.js';

export async function onRequestPost({ request, env, params }) {
  const { user, error } = await requireUser(request, env.DB);
  if (error) return error;
  const itemId = Number(params.itemId);

  const existing = await env.DB.prepare(
    'SELECT done FROM checklist_progress WHERE user_id = ? AND item_id = ?'
  ).bind(user.id, itemId).first();

  const nextDone = existing ? (existing.done ? 0 : 1) : 1;
  await env.DB.prepare(
    `INSERT INTO checklist_progress (user_id, item_id, done) VALUES (?, ?, ?)
     ON CONFLICT(user_id, item_id) DO UPDATE SET done = excluded.done`
  ).bind(user.id, itemId, nextDone).run();

  return jsonResponse({ done: !!nextDone });
}
