import { requireUser, requireAdmin, jsonResponse, errorResponse } from '../../_lib/auth.js';

// 記事一覧を取得する（ログイン済みなら受講生・管理者どちらでも閲覧可）
export async function onRequestGet({ request, env }) {
  const { user, error } = await requireUser(request, env.DB);
  if (error) return error;

  const { results } = await env.DB.prepare(
    'SELECT id, cat, title, excerpt, body, rich_body, thumb_key, date FROM articles ORDER BY date DESC, id DESC'
  ).all();

  const [{ results: bookmarks }, { results: reads }] = await Promise.all([
    env.DB.prepare('SELECT article_id FROM bookmarks WHERE user_id = ?').bind(user.id).all(),
    env.DB.prepare('SELECT article_id FROM read_articles WHERE user_id = ?').bind(user.id).all(),
  ]);
  const bookmarkSet = new Set(bookmarks.map(r => r.article_id));
  const readSet = new Set(reads.map(r => r.article_id));

  const articles = results.map(a => ({
    id: a.id, cat: a.cat, title: a.title, excerpt: a.excerpt, body: a.body,
    richBody: !!a.rich_body, thumb: a.thumb_key ? `/api/files/${a.thumb_key}` : null, date: a.date,
    bookmarked: bookmarkSet.has(a.id), read: readSet.has(a.id),
  }));
  return jsonResponse({ articles });
}

// 記事を新規追加する（管理者のみ）
export async function onRequestPost({ request, env }) {
  const { error } = await requireAdmin(request, env.DB);
  if (error) return error;

  let body;
  try { body = await request.json(); } catch (e) { return errorResponse('リクエストの形式が正しくありません', 400); }
  const { cat, title, excerpt, articleBody, richBody, thumbKey } = body;
  if (!cat || !title || !excerpt || !articleBody) {
    return errorResponse('カテゴリ・タイトル・抜粋・本文を入力してください', 400);
  }

  const result = await env.DB.prepare(
    `INSERT INTO articles (cat, title, excerpt, body, rich_body, thumb_key, date)
     VALUES (?, ?, ?, ?, ?, ?, date('now'))`
  ).bind(cat, title, excerpt, articleBody, richBody ? 1 : 0, thumbKey || null).run();

  return jsonResponse({ id: result.meta.last_row_id }, 201);
}
