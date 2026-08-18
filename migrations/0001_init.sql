-- MY+DESIGN LAB. データベーススキーマ（Cloudflare D1 / SQLite）

-- ユーザー（受講生・管理者を1つのテーブルで管理し role で区別する）
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

-- ログインセッション（Cookieに入れるトークンと紐付け）
CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 日報
CREATE TABLE reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- チャットメッセージ（student_id = やり取りしている受講生, sender_role = 'me'(管理者) or 'them'(受講生)）
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

-- 記事コンテンツ
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

-- 記事の既読管理
CREATE TABLE read_articles (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  read_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, article_id)
);

-- 記事のブックマーク
CREATE TABLE bookmarks (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, article_id)
);

-- 動画コンテンツ
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

-- 資料ダウンロード（PDF/Excel/Sheet/PSDなど）
CREATE TABLE files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  size TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  date TEXT NOT NULL DEFAULT (date('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- お知らせ
CREATE TABLE announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- チェックリスト項目（共通マスタ）
CREATE TABLE checklist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- 受講生ごとのチェックリスト進捗
CREATE TABLE checklist_progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  done INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, item_id)
);

-- LP分析課題
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

-- LP分析課題の回答（質問キー s{セクション}q{問題番号} ごとに1レコード）
CREATE TABLE analysis_answers (
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  q_key TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (assignment_id, student_id, q_key)
);

-- LP分析課題の提出状態
CREATE TABLE analysis_submissions (
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (assignment_id, student_id)
);

-- 写真・補正課題
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

-- 写真・補正課題の提出物
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
