-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for fuzzy text matching

-- ── BUSINESSES ──
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  instagram_account_id TEXT UNIQUE,
  instagram_username TEXT,
  instagram_access_token TEXT, -- encrypt in app layer
  shopify_store_url TEXT,
  shopify_access_token TEXT,
  klaviyo_api_key TEXT,
  timezone TEXT DEFAULT 'Africa/Lagos',
  business_hours_start TIME DEFAULT '09:00',
  business_hours_end TIME DEFAULT '18:00',
  away_message TEXT DEFAULT 'Thanks for reaching out! We''ll get back to you during business hours.',
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── CONVERSATIONS ──
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  instagram_conversation_id TEXT,
  customer_instagram_id TEXT NOT NULL,
  customer_username TEXT,
  customer_name TEXT,
  customer_profile_pic TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'snoozed')),
  assigned_to TEXT DEFAULT 'bot' CHECK (assigned_to IN ('bot', 'human')),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_preview TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  tags TEXT[] DEFAULT '{}',
  customer_email TEXT,
  customer_phone TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(business_id, customer_instagram_id)
);

-- ── MESSAGES ──
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  instagram_message_id TEXT,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'bot', 'human')),
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'product_card', 'quick_reply', 'template')),
  attachments JSONB DEFAULT '[]',
  quick_replies JSONB,
  automation_rule_id UUID,
  delivered BOOLEAN DEFAULT TRUE,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── AUTOMATION RULES ──
CREATE TABLE automation_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('keyword', 'comment', 'story_reply', 'first_message', 'after_hours')),
  trigger_config JSONB NOT NULL,
  response_type TEXT DEFAULT 'single' CHECK (response_type IN ('single', 'flow')),
  response JSONB, -- for single responses
  flow_id UUID, -- for multi-step flows
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0,
  cooldown_minutes INTEGER DEFAULT 5,
  triggered_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── CONVERSATION FLOWS ──
CREATE TABLE conversation_flows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key for automation_rules.flow_id
ALTER TABLE automation_rules
  ADD CONSTRAINT fk_flow FOREIGN KEY (flow_id) REFERENCES conversation_flows(id) ON DELETE SET NULL;

-- ── FLOW STATE (tracks where each user is in a flow) ──
CREATE TABLE flow_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  flow_id UUID NOT NULL REFERENCES conversation_flows(id) ON DELETE CASCADE,
  current_step_id TEXT NOT NULL,
  collected_data JSONB DEFAULT '{}', -- emails, phones, selections
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  UNIQUE(conversation_id, flow_id)
);

-- ── REPLY TEMPLATES ──
CREATE TABLE reply_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  shortcut TEXT NOT NULL, -- "/price", "/delivery"
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  variables TEXT[] DEFAULT '{}',
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(business_id, shortcut)
);

-- ── SHOPIFY PRODUCTS (synced) ──
CREATE TABLE shopify_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  shopify_product_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  price TEXT NOT NULL,
  compare_at_price TEXT,
  currency TEXT DEFAULT 'NGN',
  image_url TEXT,
  product_url TEXT,
  variants JSONB DEFAULT '[]',
  inventory_quantity INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(business_id, shopify_product_id)
);

-- ── ANALYTICS EVENTS ──
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  automation_rule_id UUID REFERENCES automation_rules(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── COOLDOWN TRACKING ──
CREATE TABLE automation_cooldowns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  automation_rule_id UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  customer_instagram_id TEXT NOT NULL,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(automation_rule_id, customer_instagram_id)
);


-- ============================================
-- INDEXES
-- ============================================

-- Conversations: lookup by business + customer
CREATE INDEX idx_conversations_business ON conversations(business_id);
CREATE INDEX idx_conversations_customer ON conversations(business_id, customer_instagram_id);
CREATE INDEX idx_conversations_status ON conversations(business_id, status);
CREATE INDEX idx_conversations_last_message ON conversations(business_id, last_message_at DESC);

-- Messages: lookup by conversation, ordered by time
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_business ON messages(business_id, created_at DESC);

-- Automation rules: lookup active rules by business
CREATE INDEX idx_rules_business_active ON automation_rules(business_id, is_active, priority DESC);

-- Analytics: time-series queries
CREATE INDEX idx_analytics_business_time ON analytics_events(business_id, created_at DESC);
CREATE INDEX idx_analytics_type ON analytics_events(business_id, event_type, created_at DESC);

-- Cooldowns: check if user was recently triggered
CREATE INDEX idx_cooldowns_lookup ON automation_cooldowns(automation_rule_id, customer_instagram_id);

-- Full-text search on messages
CREATE INDEX idx_messages_content_trgm ON messages USING gin(content gin_trgm_ops);


-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE reply_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_cooldowns ENABLE ROW LEVEL SECURITY;

-- Policy: users can only access their own business data
CREATE POLICY "Users access own business" ON businesses
  FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "Users access own conversations" ON conversations
  FOR ALL USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Users access own messages" ON messages
  FOR ALL USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Users access own rules" ON automation_rules
  FOR ALL USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Users access own flows" ON conversation_flows
  FOR ALL USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Users access own flow states" ON flow_states
  FOR ALL USING (conversation_id IN (
    SELECT id FROM conversations WHERE business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  ));

CREATE POLICY "Users access own templates" ON reply_templates
  FOR ALL USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Users access own products" ON shopify_products
  FOR ALL USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Users access own analytics" ON analytics_events
  FOR ALL USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

CREATE POLICY "Users access own cooldowns" ON automation_cooldowns
  FOR ALL USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- Service role bypass for webhook API routes (server-side)
-- These use supabase service_role key, which bypasses RLS


-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_businesses_updated
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_conversations_updated
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_rules_updated
  BEFORE UPDATE ON automation_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_flows_updated
  BEFORE UPDATE ON conversation_flows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_templates_updated
  BEFORE UPDATE ON reply_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Increment automation trigger count
CREATE OR REPLACE FUNCTION increment_trigger_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE automation_rules
  SET triggered_count = triggered_count + 1,
      last_triggered_at = NOW()
  WHERE id = NEW.automation_rule_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update conversation on new message
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET last_message_at = NEW.created_at,
      last_message_preview = LEFT(NEW.content, 100),
      is_read = CASE WHEN NEW.sender_type = 'customer' THEN FALSE ELSE is_read END,
      updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_message_update_conversation
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();


-- ============================================
-- SEED DATA: Default AuraUp automation rules
-- ============================================

-- NOTE: Run after creating the business entry for AuraUp
-- These are example rules Ebuka can customize

/*
-- Pricing inquiry auto-reply
INSERT INTO automation_rules (business_id, name, trigger_type, trigger_config, response_type, response, priority, cooldown_minutes)
VALUES (
  '<AURAUP_BUSINESS_ID>',
  'Pricing Inquiry',
  'keyword',
  '{"type": "keyword", "keywords": ["price", "how much", "cost", "pricing", "amount"], "match_mode": "fuzzy"}',
  'single',
  '{"content": "Hey! 👋 Thanks for your interest in AuraUp.\n\nWhich piece caught your eye? Check out our full collection with prices here:\n🔗 auraupstore.com/collections/all\n\nOr tell me which item you''re looking at and I''ll send you the details!", "message_type": "text"}',
  10,
  30
);

-- Delivery info auto-reply
INSERT INTO automation_rules (business_id, name, trigger_type, trigger_config, response_type, response, priority, cooldown_minutes)
VALUES (
  '<AURAUP_BUSINESS_ID>',
  'Delivery Info',
  'keyword',
  '{"type": "keyword", "keywords": ["delivery", "deliver", "shipping", "ship", "how long"], "match_mode": "fuzzy"}',
  'single',
  '{"content": "📦 Delivery Info:\n\nWe deliver nationwide across Nigeria!\n• Lagos: 1-2 business days\n• Other states: 3-5 business days\n\nDelivery fee depends on your location. Drop your area and I''ll give you an exact quote!\n\n🔗 Shop now: auraupstore.com", "message_type": "text"}',
  9,
  30
);

-- After hours auto-reply
INSERT INTO automation_rules (business_id, name, trigger_type, trigger_config, response_type, response, priority, cooldown_minutes)
VALUES (
  '<AURAUP_BUSINESS_ID>',
  'After Hours',
  'after_hours',
  '{"type": "after_hours"}',
  'single',
  '{"content": "Hey! 👋 Thanks for reaching out to AuraUp.\n\nWe''re currently offline but we''ll get back to you first thing in the morning.\n\nIn the meantime, feel free to browse our collection:\n🔗 auraupstore.com\n\nQuiet Strength in Motion. 🖤", "message_type": "text"}',
  100,
  60
);
*/
