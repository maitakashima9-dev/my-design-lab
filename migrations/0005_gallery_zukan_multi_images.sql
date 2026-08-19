-- ギャラリー・通販図鑑を複数画像対応にする（1事例につき最大10枚）。
-- サムネイルは別管理せず、登録した画像の1枚目を自動的にサムネイルとして扱う。
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
