import { requireAdmin, jsonResponse, errorResponse } from '../../_lib/auth.js';

export async function onRequestPut({ request, env, params }) {
  const { error } = await requireAdmin(request, env.DB);
  if (error) return error;
  const id = Number(params.id);

  let body;
  try { body = await request.json(); } catch (e) { return errorResponse('リクエストの形式が正しくありません', 400); }
  const { cat, title, dur, videoUrl, thumbKey } = body;
  if (!cat || !title) return errorResponse('カテゴリとタイトルを入力してください', 400);

  if (thumbKey) {
    await env.DB.prepare('UPDATE videos SET cat = ?, title = ?, dur = ?, video_url = ?, thumb_key = ? WHERE id = ?')
      .bind(cat, title, dur || '--:--', videoUrl || '', thumbKey, id).run();
  } else {
    await env.DB.prepare('UPDATE videos SET cat = ?, title = ?, dur = ?, video_url = ? WHERE id = ?')
      .bind(cat, title, dur || '--:--', videoUrl || '', id).run();
  }
  return jsonResponse({ ok: true });
}

export async function onRequestDelete({ request, env, params }) {
  const { error } = await requireAdmin(request, env.DB);
  if (error) return error;
  const id = Number(params.id);
  await env.DB.prepare('DELETE FROM videos WHERE id = ?').bind(id).run();
  return jsonResponse({ ok: true });
}
