// コンテンツ更新時に自動でお知らせを1件追加する共通ヘルパー。
export async function addAnnouncement(db, text) {
  const dateRow = await db.prepare("SELECT strftime('%m/%d', 'now') as d").first();
  await db.prepare('INSERT INTO announcements (date, text) VALUES (?, ?)').bind(dateRow.d, text).run();
}
