import { requireUser, jsonResponse } from '../../../_lib/auth.js';

// 既読/未読を切り替える
export async function onRequestPost({ request, env, params }) {
  const { user, error } = await requireUser(request, env.DB);
  if (error) return error;
  const articleId = Number(params.id);

  const existing = await env.DB.prepare(
    'SELECT 1 FROM read_articles WHERE user_id = ? AND article_id = ?'
  ).bind(user.id, articleId).first();

  if (existing) {
    await env.DB.prepare('DELETE FROM read_articles WHERE user_id = ? AND article_id = ?').bind(user.id, articleId).run();
    return jsonResponse({ read: false });
  } else {
    await env.DB.prepare('INSERT INTO read_articles (user_id, article_id) VALUES (?, ?)').bind(user.id, articleId).run();
    return jsonResponse({ read: true });
  }
}
