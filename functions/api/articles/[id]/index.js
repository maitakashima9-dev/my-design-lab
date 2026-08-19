import { requireAdmin, jsonResponse, errorResponse } from '../../../_lib/auth.js';
import { addAnnouncement } from '../../../_lib/announce.js';

export async function onRequestPut({ request, env, params }) {
  const { error } = await requireAdmin(request, env.DB);
  if (error) return error;
  const id = Number(params.id);

  let body;
  try { body = await request.json(); } catch (e) { return errorResponse('リクエストの形式が正しくありません', 400); }
  const { cat, title, excerpt, articleBody, richBody, thumbKey } = body;
  if (!cat || !title || !excerpt || !articleBody) {
    return errorResponse('カテゴリ・タイトル・抜粋・本文を入力してください', 400);
  }

  if (thumbKey) {
    await env.DB.prepare(
      `UPDATE articles SET cat = ?, title = ?, excerpt = ?, body = ?, rich_body = ?, thumb_key = ? WHERE id = ?`
    ).bind(cat, title, excerpt, articleBody, richBody ? 1 : 0, thumbKey, id).run();
  } else {
    await env.DB.prepare(
      `UPDATE articles SET cat = ?, title = ?, excerpt = ?, body = ?, rich_body = ? WHERE id = ?`
    ).bind(cat, title, excerpt, articleBody, richBody ? 1 : 0, id).run();
  }
  await addAnnouncement(env.DB, `記事を更新しました：「${title}」`);
  return jsonResponse({ ok: true });
}

export async function onRequestDelete({ request, env, params }) {
  const { error } = await requireAdmin(request, env.DB);
  if (error) return error;
  const id = Number(params.id);
  await env.DB.prepare('DELETE FROM articles WHERE id = ?').bind(id).run();
  return jsonResponse({ ok: true });
}
