-- 資料ダウンロードのパスワード保護（設定しない場合はNULL/空のまま）
ALTER TABLE files ADD COLUMN access_password TEXT;
