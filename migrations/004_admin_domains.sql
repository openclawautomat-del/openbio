-- Admin-managed domains. Replaces the old user-owned `domains` table
-- (user_id, verify_token, verified_at). No link or user row ever referenced
-- that table, so it is safe to drop and recreate. Idempotent: safe on
-- fresh installs where 003_phase2 was skipped too.
CREATE TABLE IF NOT EXISTS admin_domains (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hostname VARCHAR(191) NOT NULL UNIQUE,
  status ENUM('pending','active','disabled') NOT NULL DEFAULT 'pending',
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  last_check_at DATETIME NULL,
  last_check_error VARCHAR(400) NULL,
  note VARCHAR(200) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Old user-owned domain rows, if the table exists, are simply dropped:
-- they carried no data other than verification tokens.
SET @has_old_domains := (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'domains');
PREPARE drop_old FROM 'DROP TABLE IF EXISTS domains';
EXECUTE drop_old;

-- Reserved slugs: server-side list, editable by the super admin.
CREATE TABLE IF NOT EXISTS reserved_slugs (
  slug VARCHAR(64) NOT NULL PRIMARY KEY,
  source ENUM('seed','manual') NOT NULL DEFAULT 'seed'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO reserved_slugs (slug, source) VALUES
  ('www','seed'),('mail','seed'),('smtp','seed'),('ftp','seed'),('ns1','seed'),('ns2','seed'),
  ('cdn','seed'),('app','seed'),('support','seed'),('help','seed'),('status','seed'),('security','seed'),
  ('abuse','seed'),('postmaster','seed'),('webmaster','seed'),('root','seed'),('administrator','seed'),
  ('official','seed'),('verify','seed'),('confirm','seed'),('account','seed'),('accounts','seed'),
  ('wallet','seed'),('payments','seed'),('payment','seed'),('checkout','seed'),('invoice','seed'),
  ('signin','seed'),('signup','seed'),('logout','seed'),('reset','seed'),('password','seed');

-- Anti-phishing: protected brands and sensitive words (defaults; admin-editable via settings).
CREATE TABLE IF NOT EXISTS slug_lists (
  list VARCHAR(24) NOT NULL,
  value VARCHAR(191) NOT NULL,
  PRIMARY KEY (list, value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO slug_lists (list, value) VALUES
  ('brand','paypal'),('brand','google'),('brand','facebook'),('brand','instagram'),('brand','whatsapp'),
  ('brand','apple'),('brand','microsoft'),('brand','amazon'),('brand','netflix'),('brand','binance'),
  ('brand','stripe'),('brand','bank'),
  ('sensitive','login'),('sensitive','signin'),('sensitive','verify'),('sensitive','secure'),
  ('sensitive','security'),('sensitive','support'),('sensitive','account'),('sensitive','update'),
  ('sensitive','wallet'),('sensitive','payment'),('sensitive','billing'),('sensitive','recovery'),
  ('sensitive','reset'),('sensitive','password');

-- New: links held in the review queue until an admin approves.
ALTER TABLE links
  ADD COLUMN pending_review TINYINT(1) NOT NULL DEFAULT 0,
  ADD KEY idx_links_pending (pending_review),
  ADD KEY idx_links_target_host (user_id, enabled, moderated, pending_review);

-- Click logging stays a hot path: indexes keep aggregates cheap as tables grow.
CREATE INDEX idx_clicks_created ON clicks (created_at);
CREATE INDEX idx_clicks_visitor ON clicks (entity_type, entity_id, visitor_hash);
