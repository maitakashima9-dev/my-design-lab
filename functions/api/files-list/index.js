// 資料ダウンロード一覧のCRUD。
// 注意: ファイル本体の配信は /api/files-list/[id]/download.js（パスワード確認つき）が担当するため、
// こちらのメタデータ一覧APIは実際のR2キーをクライアントに渡さない。
import { requireUser, requireAdmin, jsonResponse, errorResponse } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const { error } = await requireUser(request, env.DB);
  if (error) return error;

  const { results } = await env.DB.prepare(
    'SELECT id, name, type, size, date, access_password FROM files ORDER BY date DESC, id DESC'
  ).all();
  const files = results.map(f => ({
    id: f.id, name: f.name, type: f.type, size: f.size, date: f.date,
    hasPassword: !!f.access_password,
    downloadUrl: `/api/files-list/${f.id}/download`,
  }));
  return jsonResponse({ files });
}

export async function onRequestPost({ request, env }) {
  const { error } = await requireAdmin(request, env.DB);
  if (error) return error;

  let body;
  try { body = await request.json(); } catch (e) { return errorResponse('リクエストの形式が正しくありません', 400); }
  const { name, type, size, storageKey, password } = body;
  if (!name || !type || !storageKey) return errorResponse('ファイル名・種類・アップロードしたファイルが必要です', 400);

  const result = await env.DB.prepare(
    `INSERT INTO files (name, type, size, storage_key, date, access_password) VALUES (?, ?, ?, ?, date('now'), ?)`
  ).bind(name, type, size || '--', storageKey, password || null).run();

  return jsonResponse({ id: result.meta.last_row_id }, 201);
}
