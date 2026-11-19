-- User-owned custom domains no longer exist. Rows were copied into site_domains (as pending) by 004.
-- Kept separate from 004 so the additive step can ship and be verified before anything is dropped.
DROP TABLE IF EXISTS domains;
