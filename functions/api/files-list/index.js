// 資料ダウンロード一覧のCRUD。
// 注意: ファイル本体の配信は /api/files/[[key]].js（R2オブジェクト配信用）が担当するため、
// こちらのメタデータ一覧APIは URL の衝突を避けて /api/files-list に置いている。
import { requireUser, requireAdmin, jsonResponse, errorResponse } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const { error } = await requireUser(request, env.DB);
  if (error) return error;

  const { results } = await env.DB.prepare(
    'SELECT id, name, type, size, storage_key, date FROM files ORDER BY date DESC, id DESC'
  ).all();
  const files = results.map(f => ({
    id: f.id, name: f.name, type: f.type, size: f.size, date: f.date,
    url: `/api/files/${f.storage_key}`,
  }));
  return jsonResponse({ files });
}

export async function onRequestPost({ request, env }) {
  const { error } = await requireAdmin(request, env.DB);
  if (error) return error;

  let body;
  try { body = await request.json(); } catch (e) { return errorResponse('リクエストの形式が正しくありません', 400); }
  const { name, type, size, storageKey } = body;
  if (!name || !type || !storageKey) return errorResponse('ファイル名・種類・アップロードしたファイルが必要です', 400);

  const result = await env.DB.prepare(
    `INSERT INTO files (name, type, size, storage_key, date) VALUES (?, ?, ?, ?, date('now'))`
  ).bind(name, type, size || '--', storageKey).run();

  return jsonResponse({ id: result.meta.last_row_id }, 201);
}
