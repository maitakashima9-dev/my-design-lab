import { requireUser } from '../../../_lib/auth.js';

// 資料ダウンロード本体の配信。パスワードが設定されている資料は ?password= の一致を必須にする。
export async function onRequestGet({ request, env, params }) {
  const { error } = await requireUser(request, env.DB);
  if (error) return error;
  const id = Number(params.id);

  const row = await env.DB.prepare('SELECT name, storage_key, access_password FROM files WHERE id = ?').bind(id).first();
  if (!row) return new Response('資料が見つかりません', { status: 404 });

  if (row.access_password) {
    const url = new URL(request.url);
    const given = url.searchParams.get('password') || '';
    if (given !== row.access_password) {
      return new Response('パスワードが違います', { status: 403 });
    }
  }

  const obj = await env.FILES.get(row.storage_key);
  if (!obj) return new Response('ファイルが見つかりません', { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(row.name)}"`);
  headers.set('Cache-Control', 'private, max-age=0, no-store');
  return new Response(obj.body, { headers });
}
