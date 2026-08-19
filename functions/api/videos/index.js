import { requireUser, requireAdmin, jsonResponse, errorResponse } from '../../_lib/auth.js';
import { addAnnouncement } from '../../_lib/announce.js';

export async function onRequestGet({ request, env }) {
  const { error } = await requireUser(request, env.DB);
  if (error) return error;

  const { results } = await env.DB.prepare(
    'SELECT id, cat, title, date, dur, video_url, thumb_key, is_new FROM videos ORDER BY date DESC, id DESC'
  ).all();
  const videos = results.map(v => ({
    id: v.id, cat: v.cat, title: v.title, date: v.date, dur: v.dur,
    videoUrl: v.video_url, thumb: v.thumb_key ? `/api/files/${v.thumb_key}` : null, isNew: !!v.is_new,
  }));
  return jsonResponse({ videos });
}

export async function onRequestPost({ request, env }) {
  const { error } = await requireAdmin(request, env.DB);
  if (error) return error;

  let body;
  try { body = await request.json(); } catch (e) { return errorResponse('リクエストの形式が正しくありません', 400); }
  const { cat, title, dur, videoUrl, thumbKey } = body;
  if (!cat || !title) return errorResponse('カテゴリとタイトルを入力してください', 400);

  const result = await env.DB.prepare(
    `INSERT INTO videos (cat, title, date, dur, video_url, thumb_key, is_new)
     VALUES (?, ?, date('now'), ?, ?, ?, 1)`
  ).bind(cat, title, dur || '--:--', videoUrl || null, thumbKey || null).run();

  await addAnnouncement(env.DB, `新着動画：「${title}」を公開しました`);

  return jsonResponse({ id: result.meta.last_row_id }, 201);
}
