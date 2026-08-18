import { requireAdmin, createPasswordRecord, jsonResponse, errorResponse } from '../../_lib/auth.js';

const COLORS = ['#c53654', '#36a2c5', '#e6d068'];
function randomTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  const arr = new Uint8Array(10);
  crypto.getRandomValues(arr);
  for (let i = 0; i < arr.length; i++) out += chars[arr[i] % chars.length];
  return out;
}

// 受講生一覧を取得する（管理画面用）
export async function onRequestGet({ request, env }) {
  const { error } = await requireAdmin(request, env.DB);
  if (error) return error;

  const { results } = await env.DB.prepare(
    "SELECT id, email, name, initial, color, joined_at FROM users WHERE role = 'student' ORDER BY joined_at DESC"
  ).all();
  return jsonResponse({ students: results });
}

// 新しい受講生アカウントを発行する（管理者のみ）。仮パスワードを生成して返すので、
// まいさんが受講生本人へ個別に伝える運用を想定しています。
export async function onRequestPost({ request, env }) {
  const { error } = await requireAdmin(request, env.DB);
  if (error) return error;

  let body;
  try { body = await request.json(); } catch (e) { return errorResponse('リクエストの形式が正しくありません', 400); }
  const email = (body.email || '').trim().toLowerCase();
  const name = (body.name || '').trim();
  if (!email || !name) return errorResponse('メールアドレスと氏名を入力してください', 400);

  const existing = await env.DB.prepare('SELECT id FROM users WHERE lower(email) = ?').bind(email).first();
  if (existing) return errorResponse('このメールアドレスは既に登録されています', 409);

  const tempPassword = randomTempPassword();
  const { salt, hash } = await createPasswordRecord(tempPassword);
  const initial = name.slice(0, 1);
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];

  const result = await env.DB.prepare(
    `INSERT INTO users (email, password_hash, salt, role, name, initial, color, joined_at)
     VALUES (?, ?, ?, 'student', ?, ?, ?, date('now'))`
  ).bind(email, hash, salt, name, initial, color).run();

  return jsonResponse({
    student: { id: result.meta.last_row_id, email, name, initial, color },
    tempPassword,
  });
}
