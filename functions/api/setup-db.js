// 初回セットアップ専用（1回使ったらファイルごと削除してください）
// ブラウザで /api/setup-db?key=mydesignlab-setup-2026&mode=init を開く → 次に mode=seed を開く

const INIT_SQL = `
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','student')),
  name TEXT NOT NULL,
  initial TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#c53654',
  joined_at TEXT NOT NULL DEFAULT (date('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK(sender_role IN ('me','them')),
  text TEXT,
  file_key TEXT,
  file_name TEXT,
  file_size TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cat TEXT NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  body TEXT NOT NULL,
  rich_body INTEGER NOT NULL DEFAULT 1,
  thumb_key TEXT,
  date TEXT NOT NULL DEFAULT (date('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE read_articles (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  read_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, article_id)
);
CREATE TABLE bookmarks (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, article_id)
);
CREATE TABLE videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cat TEXT NOT NULL,
  title TEXT NOT NULL,
  date TEXT NOT NULL DEFAULT (date('now')),
  dur TEXT NOT NULL DEFAULT '--:--',
  video_url TEXT,
  thumb_key TEXT,
  is_new INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  size TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  date TEXT NOT NULL DEFAULT (date('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE checklist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE checklist_progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  done INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, item_id)
);
CREATE TABLE assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  label TEXT NOT NULL,
  desc TEXT NOT NULL DEFAULT '',
  url TEXT,
  thumb_key TEXT,
  seed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE analysis_answers (
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  q_key TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (assignment_id, student_id, q_key)
);
CREATE TABLE analysis_submissions (
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (assignment_id, student_id)
);
CREATE TABLE photo_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  label TEXT NOT NULL,
  desc TEXT NOT NULL DEFAULT '',
  file_key TEXT,
  file_name TEXT NOT NULL DEFAULT '',
  file_size TEXT NOT NULL DEFAULT '',
  thumb_key TEXT,
  seed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE photo_submissions (
  task_id INTEGER NOT NULL REFERENCES photo_tasks(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  size TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (task_id, student_id)
);
CREATE INDEX idx_reports_user ON reports(user_id);
CREATE INDEX idx_chat_student ON chat_messages(student_id);
CREATE INDEX idx_articles_cat ON articles(cat);
`;

const SEED_SQL = `
INSERT INTO users (email, password_hash, salt, role, name, initial, color, joined_at) VALUES
('mai@example.com', '1d4cddd706d48a4b050936dc4826a552f100145b3ee0fea2e4d56826a1ae42f4', '4a4d5e323ae4551ad042a549e7fd9a25', 'admin', 'まい', 'ま', '#c53654', '2026-01-01'),
('yamada@example.com', '1a20bc891cf998c0286be94cc80ce2d65eba05b70fa3d0115124ed9c328374bb', '4599f60c457bf2338097fd801234eec2', 'student', '山田 花子', '山', '#c53654', '2026-04-01'),
('sato@example.com', '965bd9e054ebef35ba7cf0a9fc1ed64e1cb36675676353fc860333eb9273ac54', '84c6ba74df7e3c59cd150bf9645e8cbf', 'student', '佐藤 大輔', '佐', '#36a2c5', '2026-05-12'),
('suzuki@example.com', '728a1a523ae8e2f6136d1165e3238fb8e27c7a9124ea749ce5b4e95d2d535d8a', '84fb30b6d38e6cb955c4b8658cc1580b', 'student', '鈴木 愛', '鈴', '#e6d068', '2026-03-20'),
('takahashi@example.com', '788f3d6f42447d66383263a635519242a607c7f659f9bb59296eeba0883b68a3', 'e0ccba54b44539c593bbb8d623aa7ffc', 'student', '高橋 誠', '高', '#c53654', '2026-06-08');

INSERT INTO articles (cat, title, excerpt, body, rich_body, date) VALUES
('LPデザイン', '初心者が陥りがちなLPデザイン3つの失敗', '情報の詰め込みすぎ、余白不足、CTAの埋没――よくある失敗パターンと直し方をまとめました。', '通販LPを作り始めたばかりの頃によく見かける失敗が3つあります。1つ目は情報を詰め込みすぎること、2つ目は余白が足りず窮屈に見えること、3つ目はCTA（購入ボタンなど）が他の要素に埋もれてしまうことです。これらを避けるだけでも、LPの読みやすさと成約率は大きく変わります。', 0, '2026-08-10'),
('LPデザイン', '売れるLPのファーストビュー設計、7つのチェックポイント', '最初の1画面で離脱されないために確認すべきポイントを整理しました。', 'ファーストビューはユーザーが最初の数秒で「読むかどうか」を判断する重要な場所です。商品名・ベネフィット・信頼要素・視線誘導などをチェックリスト化しておくと、抜け漏れなく設計できます。', 0, '2026-08-05'),
('写真・補正', '商品写真の色味を実物に近づける補正の基本', '撮影データそのままでは伝わらない色を、実物に近づけるための補正手順を紹介します。', '撮影した写真は、照明の色温度やカメラの設定によって実物と色味がずれることがよくあります。まずはホワイトバランスを整え、次に彩度を上げすぎない範囲で商品の色を実物に近づけます。通販LPでは「届いた商品が写真と違う」というクレームに直結するため、盛りすぎない補正を心がけてください。', 0, '2026-08-15'),
('写真・補正', '光の向きを合わせて自然な合成に見せるコツ', '商品カットと背景・装飾を合成するとき、違和感が出る一番の原因は光の向きのズレです。', '合成写真が不自然に見える最大の原因は、素材ごとに光の向きが揃っていないことです。合成する前に、それぞれの素材にどの方向から光が当たっているかを確認し、影の向き・濃さ・ぼかし具合を揃えましょう。', 0, '2026-07-10'),
('クライアントワーク', '初回ヒアリングで必ず聞いている10の質問', '認識のズレを防ぐために、初回ヒアリングで毎回聞いている質問リストを公開します。', '初回ヒアリングでの質問が甘いと、後工程で認識のズレが発覚し手戻りが発生します。ターゲット・競合・過去の販売実績・NGな表現など、最低限確認しておきたい項目をリスト化しています。', 0, '2026-08-08'),
('LPライティング', 'キャッチコピーが思いつかないときの言葉の探し方', 'ゼロから絞り出すのではなく、既にある言葉を「集めて選ぶ」方法を紹介します。', 'キャッチコピーはゼロから発想しようとすると詰まりがちです。レビューやSNSの声、競合の訴求、ヒアリング内容から言葉の候補をたくさん集め、その中から一番刺さるものを選ぶという順番で考えると進めやすくなります。', 0, '2026-08-12');

INSERT INTO videos (cat, title, date, dur, video_url, is_new) VALUES
('LPデザイン', 'オリエンテーション：講座の進め方', '2026-04-01', '12:30', '', 0),
('LPデザイン', 'LP構成の作り方 完全講義（前編）', '2026-08-10', '38:20', '', 1),
('LPライティング', '売れるコピーの型10選', '2026-07-20', '24:10', '', 0);

INSERT INTO announcements (date, text) VALUES
('08/20', '資料ダウンロードにPSDデータを追加しました'),
('08/14', '新着記事：クライアントワークカテゴリに新着記事を追加しました'),
('08/10', '新着動画：『LP構成の作り方 完全講義』前後編を公開しました');

INSERT INTO checklist_items (text, sort_order) VALUES
('オリエンテーション動画を見る', 0),
('LPデザインの基礎記事を読む', 1),
('初めてのLP模写を提出する', 2),
('チャットで添削をもらう', 3),
('案件獲得ロードマップの記事を読む', 4);

INSERT INTO assignments (title, label, desc, url, seed) VALUES
('課題①', '化粧品LP', '美容液の通販LPを分析します。価格の見せ方と保証の打ち出し方に注目してみてください。', 'https://example.com/lp/cosmetics', 0),
('課題②', 'サプリメントLP', '腸活サプリの通販LPを分析します。定期購入への誘導の流れに注目してみてください。', 'https://example.com/lp/supplement', 1);

INSERT INTO photo_tasks (title, label, desc, file_name, file_size, seed) VALUES
('補正課題①', '商品写真の色補正', '配布するコスメ商品の撮って出し写真を、実物に近い色味へ補正してください。ホワイトバランスと彩度の調整を意識してみましょう。', '補正課題①_元データ.psd', '56.4MB', 0);
`;

function splitStatements(sql) {
  return sql
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);
}

async function hashPasswordLocal(password, saltHex) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
  const saltBytes = new Uint8Array(saltHex.length / 2);
  for (let i = 0; i < saltBytes.length; i++) saltBytes[i] = parseInt(saltHex.substr(i * 2, 2), 16);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256);
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function randomHexLocal(byteLen) {
  const arr = new Uint8Array(byteLen);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

const MIGRATE2_SQL = `
CREATE TABLE gallery_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  tag TEXT NOT NULL,
  thumb_key TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE zukan_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  comment TEXT NOT NULL,
  thumb_key TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO gallery_items (title, tag, sort_order) VALUES
('化粧品LP／美容液', '化粧品', 0),
('サプリメントLP／腸活商材', '健康食品', 1),
('ペット用品LP／消臭グッズ', 'ペット用品', 2),
('アパレルLP／機能性インナー', 'アパレル', 3),
('家電LP／調理家電', '家電', 4),
('日用品LP／洗剤', '日用品', 5);
INSERT INTO zukan_items (title, comment, sort_order) VALUES
('化粧品LP', '配色を2色に絞ることで高級感を演出。CTAだけ差し色の赤にして視線を誘導しています。', 0),
('サプリメントLP', 'ビフォーアフターの見せ方が秀逸。数字を大きく見せることで説得力を出しています。', 1),
('ペット用品LP', '口コミ写真を実名で入れることで信頼を獲得。文字量を絞り、写真の情報量で語らせています。', 2),
('家電LP', '機能訴求と感情訴求のバランスが良い一例。価格の見せ方（分割表示）も丁寧です。', 3);
`;

const MIGRATE3_SQL = `
ALTER TABLE files ADD COLUMN access_password TEXT;
`;

const MIGRATE4_SQL = `
CREATE TABLE gallery_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gallery_item_id INTEGER NOT NULL REFERENCES gallery_items(id) ON DELETE CASCADE,
  image_key TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE zukan_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  zukan_item_id INTEGER NOT NULL REFERENCES zukan_items(id) ON DELETE CASCADE,
  image_key TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
ALTER TABLE zukan_items ADD COLUMN link_url TEXT;
CREATE INDEX idx_gallery_images_item ON gallery_images(gallery_item_id);
CREATE INDEX idx_zukan_images_item ON zukan_images(zukan_item_id);
`;

const DEMO_PASSWORDS = {
  'mai@example.com': 'mailab-admin-2026',
  'yamada@example.com': 'student-2026',
  'sato@example.com': 'student-2026',
  'suzuki@example.com': 'student-2026',
  'takahashi@example.com': 'student-2026',
};

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (url.searchParams.get('key') !== 'mydesignlab-setup-2026') {
    return new Response('forbidden', { status: 403 });
  }
  const mode = url.searchParams.get('mode') || 'init';

  if (mode === 'migrate2') {
    const results = [];
    for (const stmt of splitStatements(MIGRATE2_SQL)) {
      try {
        await env.DB.prepare(stmt).run();
        results.push({ ok: true });
      } catch (e) {
        results.push({ ok: false, error: String(e), stmt: stmt.slice(0, 60) });
      }
    }
    return new Response(JSON.stringify(results, null, 2), { headers: { 'content-type': 'application/json' } });
  }

  if (mode === 'migrate3') {
    const results = [];
    for (const stmt of splitStatements(MIGRATE3_SQL)) {
      try {
        await env.DB.prepare(stmt).run();
        results.push({ ok: true });
      } catch (e) {
        results.push({ ok: false, error: String(e), stmt: stmt.slice(0, 60) });
      }
    }
    return new Response(JSON.stringify(results, null, 2), { headers: { 'content-type': 'application/json' } });
  }

  if (mode === 'migrate4') {
    const results = [];
    for (const stmt of splitStatements(MIGRATE4_SQL)) {
      try {
        await env.DB.prepare(stmt).run();
        results.push({ ok: true });
      } catch (e) {
        results.push({ ok: false, error: String(e), stmt: stmt.slice(0, 60) });
      }
    }
    return new Response(JSON.stringify(results, null, 2), { headers: { 'content-type': 'application/json' } });
  }

  if (mode === 'resetpw') {
    const results = [];
    for (const [email, pw] of Object.entries(DEMO_PASSWORDS)) {
      const salt = randomHexLocal(16);
      const hash = await hashPasswordLocal(pw, salt);
      const res = await env.DB.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE email = ?')
        .bind(hash, salt, email).run();
      results.push({ email, changes: res.meta.changes });
    }
    return new Response(JSON.stringify(results, null, 2), { headers: { 'content-type': 'application/json' } });
  }

  const sql = mode === 'seed' ? SEED_SQL : INIT_SQL;
  const statements = splitStatements(sql);
  const results = [];
  for (const stmt of statements) {
    try {
      await env.DB.prepare(stmt).run();
      results.push({ ok: true });
    } catch (e) {
      results.push({ ok: false, error: String(e), stmt: stmt.slice(0, 60) });
    }
  }
  return new Response(JSON.stringify(results, null, 2), { headers: { 'content-type': 'application/json' } });
}
