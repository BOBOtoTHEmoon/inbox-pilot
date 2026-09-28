-- ============================================
-- 002: login ownership, message de-duplication, token expiry
-- Run once in the Supabase SQL Editor
-- ============================================

-- Track when the Instagram token expires (the weekly refresh updates it)
alter table businesses
  add column if not exists instagram_token_expires_at timestamptz;

-- One row per Instagram message: stops duplicates from webhook retries and echoes
alter table messages
  add constraint messages_instagram_message_id_key unique (instagram_message_id);
