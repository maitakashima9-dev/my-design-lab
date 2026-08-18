// 認証まわりの共通ヘルパー（Cloudflare Pages Functions用）
// ファイル名がアンダースコアで始まるフォルダ内のファイルはルーティング対象にならないため、
// ここに置いた関数は他のAPIファイルから import して共有できます。

const PBKDF2_ITERATIONS = 100000;
const SESSION_DAYS = 30;

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}
function randomHex(byteLen) {
  const arr = new Uint8Array(byteLen);
  crypto.getRandomValues(arr);
  return bytesToHex(arr);
}

// パスワード＋ソルトからPBKDF2-SHA256でハッシュ値を計算する
export async function hashPassword(password, saltHex) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBytes(saltHex), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return bytesToHex(new Uint8Array(bits));
}

// 新規ユーザー作成時に呼ぶ：ランダムなソルトを生成し、パスワードをハッシュ化する
export async function createPasswordRecord(password) {
  const salt = randomHex(16);
  const hash = await hashPassword(password, salt);
  return { salt, hash };
}

// ログイン時：入力されたパスワードが保存されているハッシュと一致するか確認する
export async function verifyPassword(password, saltHex, storedHashHex) {
  const computed = await hashPassword(password, saltHex);
  if (computed.length !== storedHashHex.length) return false;
  // タイミング攻撃を避けるため定数時間で比較する
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ storedHashHex.charCodeAt(i);
  }
  return diff === 0;
}

// ログイン成功時にセッションを発行してCookieヘッダーを返す
export async function createSession(db, userId) {
  const token = randomHex(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(token, userId, expires).run();
  return token;
}

export function sessionCookieHeader(token, maxAgeSeconds) {
  const parts = [
    `session=${token}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  return parts.join('; ');
}

export function clearSessionCookieHeader() {
  return 'session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}

function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  const match = header.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return match ? match[1] : null;
}

// 現在ログイン中のユーザー情報を取得する（未ログインなら null）
export async function getCurrentUser(request, db) {
  const token = getCookie(request, 'session');
  if (!token) return null;
  const row = await db.prepare(
    `SELECT u.id, u.email, u.role, u.name, u.initial, u.color, u.joined_at, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ?`
  ).bind(token).first();
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) return null;
  return row;
}

export function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function errorResponse(message, status) {
  return jsonResponse({ error: message }, status || 400);
}

// ログイン必須のAPIで使う。未ログインなら401レスポンスを返し、呼び出し元でそのままreturnする。
export async function requireUser(request, db) {
  const user = await getCurrentUser(request, db);
  if (!user) return { error: errorResponse('ログインが必要です', 401) };
  return { user };
}

// 管理者専用のAPIで使う
export async function requireAdmin(request, db) {
  const { user, error } = await requireUser(request, db);
  if (error) return { error };
  if (user.role !== 'admin') return { error: errorResponse('管理者のみ実行できます', 403) };
  return { user };
}
