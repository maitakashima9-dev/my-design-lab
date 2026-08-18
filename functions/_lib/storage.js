// R2ファイルストレージ用の共通ヘルパー

export function makeStorageKey(prefix, fileName) {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now();
  const safeName = String(fileName || 'file').replace(/[^\w.\-ぁ-んァ-ヶー一-龠]/g, '_');
  return `${prefix}/${time}-${rand}-${safeName}`;
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
