import { requireAdmin, jsonResponse } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const { error } = await requireAdmin(request, env.DB);
  if (error) return error;

  const [studentCount, todaySubmitted, fileCount, articleThisMonth] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'student'").first(),
    env.DB.prepare("SELECT COUNT(DISTINCT user_id) as c FROM reports WHERE date = date('now')").first(),
    env.DB.prepare('SELECT COUNT(*) as c FROM files').first(),
    env.DB.prepare("SELECT COUNT(*) as c FROM articles WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')").first(),
  ]);

  const total = studentCount.c || 0;
  const submitRate = total > 0 ? Math.round((todaySubmitted.c / total) * 100) : 0;

  return jsonResponse({
    studentCount: total,
    todaySubmitRate: submitRate,
    fileCount: fileCount.c || 0,
    articleThisMonth: articleThisMonth.c || 0,
  });
}
