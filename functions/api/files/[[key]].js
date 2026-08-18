import { getCurrentUser } from '../../_lib/auth.js';

// R2に保存したファイルを配信する（サムネイル画像・PSD・提出物など共通）
// URL例: /api/files/thumbs/1755000000-ab12cd34-sample.png
export async function onRequestGet({ request, env, params }) {
  const user = await getCurrentUser(request, env.DB);
  if (!user) return new Response('ログインが必要です', { status: 401 });

  const keyParts = Array.isArray(params.key) ? params.key : [params.key];
  const key = keyParts.join('/');
  const obj = await env.FILES.get(key);
  if (!obj) return new Response('ファイルが見つかりません', { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('Cache-Control', 'private, max-age=3600');
  return new Response(obj.body, { headers });
}
