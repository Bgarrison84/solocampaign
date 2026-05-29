-- WR-04: add UNIQUE constraint on (campaign_id, session_number) so the DB
-- itself enforces monotonicity regardless of how sessionsRepo.create is called.
-- SQLite does not support ALTER TABLE ADD CONSTRAINT, so we use CREATE UNIQUE INDEX.
CREATE UNIQUE INDEX IF NOT EXISTS `sessions_campaign_session_number_unique` ON `sessions` (`campaign_id`, `session_number`);
