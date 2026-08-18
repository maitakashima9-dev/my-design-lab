import { requireUser, jsonResponse, errorResponse } from '../../../_lib/auth.js';

// メッセージを取り消す（自分が送ったメッセージのみ）
export async function onRequestPost({ request, env, params }) {
  const { user, error } = await requireUser(request, env.DB);
  if (error) return error;

  const messageId = Number(params.messageId);
  const msg = await env.DB.prepare(
    'SELECT id, student_id, sender_role FROM chat_messages WHERE id = ?'
  ).bind(messageId).first();
  if (!msg) return errorResponse('メッセージが見つかりません', 404);

  const isOwn = user.role === 'admin' ? msg.sender_role === 'me' : (msg.sender_role === 'them' && msg.student_id === user.id);
  if (!isOwn) return errorResponse('このメッセージは取り消せません', 403);

  await env.DB.prepare('UPDATE chat_messages SET deleted = 1 WHERE id = ?').bind(messageId).run();
  return jsonResponse({ ok: true });
}
