import { requireUser, jsonResponse } from '../../../_lib/auth.js';

// ブックマークの追加/解除を切り替える
export async function onRequestPost({ request, env, params }) {
  const { user, error } = await requireUser(request, env.DB);
  if (error) return error;
  const articleId = Number(params.id);

  const existing = await env.DB.prepare(
    'SELECT 1 FROM bookmarks WHERE user_id = ? AND article_id = ?'
  ).bind(user.id, articleId).first();

  if (existing) {
    await env.DB.prepare('DELETE FROM bookmarks WHERE user_id = ? AND article_id = ?').bind(user.id, articleId).run();
    return jsonResponse({ bookmarked: false });
  } else {
    await env.DB.prepare('INSERT INTO bookmarks (user_id, article_id) VALUES (?, ?)').bind(user.id, articleId).run();
    return jsonResponse({ bookmarked: true });
  }
}
