// R2ファイルストレージ用の共通ヘルパー

// R2に保存するキー（ファイルパス）を作る。
// 元のファイル名（特に日本語のファイル名）はここでは使わず、拡張子だけを残す。
// 日本語などの記号を含んだキーをそのままURLに使うと、本番環境で画像が
// 見つからなくなる（404）不具合があったため、キー自体は必ず安全な半角英数字だけで構成する。
// 元のファイル名は別途 name として保存し、ダウンロード時の表示名にのみ使う。
export function makeStorageKey(prefix, fileName) {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now();
  const name = String(fileName || 'file');
  const extMatch = name.match(/\.([a-zA-Z0-9]{1,8})$/);
  const ext = extMatch ? '.' + extMatch[1].toLowerCase() : '';
  return `${prefix}/${time}-${rand}${ext}`;
}

// multipart/form-data から送られてきたファイルをR2に保存する
export async function saveUploadedFile(bucket, prefix, file) {
  if (!file || typeof file.arrayBuffer !== 'function') return null;
  const key = makeStorageKey(prefix, file.name);
  const buf = await file.arrayBuffer();
  await bucket.put(key, buf, {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
  });
  return { key, name: file.name, size: formatBytes(buf.byteLength) };
}

export function formatBytes(bytes) {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / 1024 / 1024).toFixed(1) + 'MB';
}
