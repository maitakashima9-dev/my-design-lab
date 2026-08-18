import { requireUser, jsonResponse, errorResponse } from '../../_lib/auth.js';

// チャットのやり取りを取得する。受講生は自分のスレッドのみ、管理者は ?studentId= で指定する。
export async function onRequestGet({ request, env }) {
  const { user, error } = await requireUser(request, env.DB);
  if (error) return error;

  const url = new URL(request.url);
  let studentId = user.id;
  if (user.role === 'admin') {
    const q = url.searchParams.get('studentId');
    if (!q) return errorResponse('studentId を指定してください', 400);
    studentId = Number(q);
  }

  const { results } = await env.DB.prepare(
    `SELECT id, sender_role, text, file_key, file_name, file_size, created_at
     FROM chat_messages WHERE student_id = ? AND deleted = 0 ORDER BY id ASC`
  ).bind(studentId).all();

  const messages = results.map(m => ({
    id: m.id,
    from: m.sender_role,
    text: m.text,
    file: m.file_key ? { key: m.file_key, name: m.file_name, size: m.file_size, url: `/api/files/${m.file_key}` } : null,
    time: m.created_at,
  }));
  return jsonResponse({ messages });
}

// メッセージを送信する
export async function onRequestPost({ request, env }) {
  const { user, error } = await requireUser(request, env.DB);
  if (error) return error;

  let body;
  try { body = await request.json(); } catch (e) { return errorResponse('リクエストの形式が正しくありません', 400); }

  let studentId = user.id;
  const senderRole = user.role === 'admin' ? 'me' : 'them';
  if (user.role === 'admin') {
    if (!body.studentId) return errorResponse('studentId を指定してください', 400);
    studentId = Number(body.studentId);
  }

  const text = (body.text || '').trim();
  const fileKey = body.fileKey || null;
  if (!text && !fileKey) return errorResponse('メッセージまたはファイルを入力してください', 400);

  const result = await env.DB.prepare(
    `INSERT INTO chat_messages (student_id, sender_role, text, file_key, file_name, file_size)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(studentId, senderRole, text || null, fileKey, body.fileName || null, body.fileSize || null).run();

  return jsonResponse({ id: result.meta.last_row_id }, 201);
}
