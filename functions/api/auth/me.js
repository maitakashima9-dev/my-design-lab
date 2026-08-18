import { getCurrentUser, jsonResponse } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const user = await getCurrentUser(request, env.DB);
  if (!user) return jsonResponse({ user: null });
  return jsonResponse({
    user: {
      id: user.id, email: user.email, role: user.role, name: user.name,
      initial: user.initial, color: user.color, joinedAt: user.joined_at,
    },
  });
}
