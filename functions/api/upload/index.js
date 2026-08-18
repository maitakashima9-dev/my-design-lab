import { requireUser, jsonResponse, errorResponse } from '../../_lib/auth.js';
import { saveUploadedFile } from '../../_lib/storage.js';

// 画像・PSDなどのファイルをR2にアップロードする共通エンドポイント。
// prefix: 'thumbs'（サムネイル画像）| 'materials'（資料ダウンロード）| 'psd'（課題データ）| 'submissions'（提出物）
export async function onRequestPost({ request, env }) {
  const { error } = await requireUser(request, env.DB);
  if (error) return error;

  const form = await request.formData();
  const file = form.get('file');
  const prefix = (form.get('prefix') || 'misc').toString().replace(/[^a-z]/g, '') || 'misc';
  if (!file) return errorResponse('ファイルが選択されていません', 400);

  const saved = await saveUploadedFile(env.FILES, prefix, file);
  if (!saved) return errorResponse('アップロードに失敗しました', 500);

  return jsonResponse({ key: saved.key, name: saved.name, size: saved.size, url: `/api/files/${saved.key}` });
}
