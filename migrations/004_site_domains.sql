-- Admin-managed domains, editable slug lists and the slug review queue.
-- Additive and idempotent: nothing is dropped here, so a failed deploy can be rolled back to the previous release.
-- The APP_URL host is seeded as the default domain by the app on first start (it needs the environment, not SQL).

CREATE TABLE IF NOT EXISTS site_domains (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hostname VARCHAR(191) NOT NULL UNIQUE,
  label VARCHAR(80) NULL,
  status ENUM('pending','active','disabled') NOT NULL DEFAULT 'pending',
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  -- NULL unless is_default = 1; the UNIQUE key below lets the database itself guarantee at most one default.
  default_key TINYINT GENERATED ALWAYS AS (CASE WHEN is_default = 1 THEN 1 ELSE NULL END) STORED,
  note VARCHAR(255) NULL,
  last_check_at DATETIME NULL,
  last_check_ok TINYINT(1) NULL,
  last_check_error VARCHAR(500) NULL,
  override_by BIGINT UNSIGNED NULL,
  activated_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_default (default_key),
  INDEX (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS slug_lists (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kind ENUM('reserved','brand','sensitive') NOT NULL,
  value VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_kind_value (kind, value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO slug_lists (kind, value) VALUES
  ('reserved','www'),('reserved','mail'),('reserved','smtp'),('reserved','ftp'),('reserved','ns1'),('reserved','ns2'),
  ('reserved','cdn'),('reserved','app'),('reserved','support'),('reserved','help'),('reserved','status'),('reserved','security'),
  ('reserved','abuse'),('reserved','postmaster'),('reserved','webmaster'),('reserved','root'),('reserved','administrator'),
  ('reserved','official'),('reserved','verify'),('reserved','confirm'),('reserved','account'),('reserved','accounts'),
  ('reserved','wallet'),('reserved','payment'),('reserved','payments'),('reserved','checkout'),('reserved','invoice'),
  ('reserved','signin'),('reserved','signup'),('reserved','logout'),('reserved','reset'),('reserved','password'),
  ('brand','paypal'),('brand','google'),('brand','facebook'),('brand','instagram'),('brand','whatsapp'),('brand','apple'),
  ('brand','microsoft'),('brand','amazon'),('brand','netflix'),('brand','binance'),('brand','stripe'),('brand','bank'),
  ('sensitive','login'),('sensitive','signin'),('sensitive','verify'),('sensitive','secure'),('sensitive','security'),
  ('sensitive','support'),('sensitive','account'),('sensitive','update'),('sensitive','wallet'),('sensitive','payment'),
  ('sensitive','billing'),('sensitive','recovery'),('sensitive','reset'),('sensitive','password');

-- Review queue and periodic safety re-check state. Existing rows default to "none" / "ok", so nothing changes for them.
ALTER TABLE links
  ADD COLUMN review_status ENUM('none','pending','approved','rejected') NOT NULL DEFAULT 'none',
  ADD COLUMN review_reason VARCHAR(191) NULL,
  ADD COLUMN safety_status ENUM('ok','flagged') NOT NULL DEFAULT 'ok',
  ADD COLUMN safety_note VARCHAR(191) NULL,
  ADD COLUMN checked_at DATETIME NULL,
  ADD INDEX idx_links_review (review_status),
  ADD INDEX idx_links_checked (checked_at);

ALTER TABLE pages
  ADD COLUMN review_status ENUM('none','pending','approved','rejected') NOT NULL DEFAULT 'none',
  ADD COLUMN review_reason VARCHAR(191) NULL,
  ADD INDEX idx_pages_review (review_status);

-- Reports: remember who handled them and what was done.
ALTER TABLE reports
  ADD COLUMN resolved_by BIGINT UNSIGNED NULL,
  ADD COLUMN resolved_at DATETIME NULL,
  ADD INDEX idx_reports_status (status, created_at),
  ADD INDEX idx_reports_slug (target_slug, status);

-- Hot-path indexes: the unique-visitor lookup in click logging, and audit filtering.
ALTER TABLE clicks ADD INDEX idx_clicks_visitor (entity_type, entity_id, visitor_hash);
ALTER TABLE audit_log ADD INDEX idx_audit_action (action, created_at);

-- Carry old user-owned domains over as PENDING admin domains so the admin can decide what to keep.
-- The old table only exists when Phase 2 was installed, hence the information_schema guard.
SET @has_old := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'domains');
SET @sql_old := IF(@has_old > 0,
  'INSERT IGNORE INTO site_domains (hostname, status, note) SELECT DISTINCT hostname, ''pending'', ''Imported from a user-owned domain'' FROM domains',
  'SELECT 1');
PREPARE stmt_old FROM @sql_old;
EXECUTE stmt_old;
DEALLOCATE PREPARE stmt_old;
