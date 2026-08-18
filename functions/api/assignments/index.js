import { requireUser, requireAdmin, jsonResponse, errorResponse } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const { user, error } = await requireUser(request, env.DB);
  if (error) return error;

  const { results } = await env.DB.prepare(
    'SELECT id, title, label, desc, url, thumb_key, seed FROM assignments ORDER BY id ASC'
  ).all();

  const targetId = user.role === 'student' ? user.id : null;
  let submittedSet = new Set();
  if (targetId) {
    const { results: sub } = await env.DB.prepare(
      'SELECT assignment_id FROM analysis_submissions WHERE student_id = ?'
    ).bind(targetId).all();
    submittedSet = new Set(sub.map(r => r.assignment_id));
  }

  const assignments = results.map(a => ({
    id: a.id, title: a.title, label: a.label, desc: a.desc, url: a.url,
    thumb: a.thumb_key ? `/api/files/${a.thumb_key}` : null, seed: a.seed,
    submitted: targetId ? submittedSet.has(a.id) : undefined,
  }));
  return jsonResponse({ assignments });
}

export async function onRequestPost({ request, env }) {
  const { error } = await requireAdmin(request, env.DB);
  if (error) return error;

  let body;
  try { body = await request.json(); } catch (e) { return errorResponse('リクエストの形式が正しくありません', 400); }
  const { title, label, desc, url, thumbKey } = body;
  if (!label || !url) return errorResponse('LP名とURLを入力してください', 400);

  const countRow = await env.DB.prepare('SELECT COUNT(*) as c FROM assignments').first();
  const finalTitle = (title || '').trim() || `課題${countRow.c + 1}`;

  const result = await env.DB.prepare(
    `INSERT INTO assignments (title, label, desc, url, thumb_key, seed) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(finalTitle, label, desc || '', url, thumbKey || null, countRow.c % 3).run();

  return jsonResponse({ id: result.meta.last_row_id }, 201);
}
