// ============================================
// INBOXPILOT — TYPE DEFINITIONS
// ============================================

// ── Database Types (mirrors Supabase schema) ──

export interface Business {
  id: string;
  name: string;
  slug: string;
  instagram_account_id: string;
  instagram_username: string;
  instagram_access_token: string; // encrypted
  shopify_store_url: string | null;
  shopify_access_token: string | null; // encrypted
  klaviyo_api_key: string | null; // encrypted
  timezone: string;
  business_hours_start: string; // "09:00"
  business_hours_end: string; // "18:00"
  away_message: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  business_id: string;
  instagram_conversation_id: string;
  customer_instagram_id: string;
  customer_username: string;
  customer_name: string | null;
  customer_profile_pic: string | null;
  status: 'open' | 'closed' | 'snoozed';
  assigned_to: 'bot' | 'human';
  last_message_at: string;
  last_message_preview: string;
  is_read: boolean;
  tags: string[];
  customer_email: string | null;
  customer_phone: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  business_id: string;
  instagram_message_id: string | null;
  sender_type: 'customer' | 'bot' | 'human';
  content: string;
  message_type: 'text' | 'image' | 'product_card' | 'quick_reply' | 'template';
  attachments: MessageAttachment[];
  quick_replies: QuickReply[] | null;
  automation_rule_id: string | null; // which rule triggered this
  delivered: boolean;
  read: boolean;
  created_at: string;
}

export interface MessageAttachment {
  type: 'image' | 'video' | 'file' | 'product';
  url: string;
  title?: string;
  subtitle?: string;
  price?: string;
}

export interface QuickReply {
  label: string;
  value: string;
}

// ── Automation Types ──

export interface AutomationRule {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  trigger_type: 'keyword' | 'comment' | 'story_reply' | 'first_message' | 'after_hours';
  trigger_config: TriggerConfig;
  response_type: 'single' | 'flow';
  response: AutomationResponse | null; // for single responses
  flow_id: string | null; // for multi-step flows
  is_active: boolean;
  priority: number; // higher = checked first
  cooldown_minutes: number; // prevent re-triggering for same user
  stats: {
    triggered_count: number;
    last_triggered_at: string | null;
  };
  created_at: string;
  updated_at: string;
}

export type TriggerConfig =
  | KeywordTrigger
  | CommentTrigger
  | StoryReplyTrigger
  | FirstMessageTrigger
  | AfterHoursTrigger;

export interface KeywordTrigger {
  type: 'keyword';
  keywords: string[]; // ["price", "how much", "cost"]
  match_mode: 'exact' | 'contains' | 'fuzzy'; // fuzzy uses levenshtein
}

export interface CommentTrigger {
  type: 'comment';
  keywords: string[]; // comment must contain one of these
  post_ids: string[] | null; // null = all posts
}

export interface StoryReplyTrigger {
  type: 'story_reply';
  keywords: string[] | null; // null = any reply
}

export interface FirstMessageTrigger {
  type: 'first_message';
  // triggers on first ever DM from a user
}

export interface AfterHoursTrigger {
  type: 'after_hours';
  // triggers when message arrives outside business hours
}

export interface AutomationResponse {
  content: string;
  message_type: 'text' | 'image' | 'product_card' | 'quick_reply';
  attachments?: MessageAttachment[];
  quick_replies?: QuickReply[];
  delay_seconds?: number; // wait before sending
}

// ── Conversation Flow Types ──

export interface ConversationFlow {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  steps: FlowStep[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FlowStep {
  id: string;
  order: number;
  message: AutomationResponse;
  wait_for_reply: boolean;
  expected_replies?: {
    keywords: string[];
    next_step_id: string;
  }[];
  fallback_step_id?: string; // if no match
  action?: FlowAction;
}

export type FlowAction =
  | { type: 'collect_email'; field: string }
  | { type: 'collect_phone'; field: string }
  | { type: 'add_tag'; tag: string }
  | { type: 'assign_human' }
  | { type: 'send_product'; shopify_product_id: string }
  | { type: 'lookup_order' }
  | { type: 'add_to_klaviyo_list'; list_id: string };

// ── Saved Reply Templates ──

export interface ReplyTemplate {
  id: string;
  business_id: string;
  name: string;
  shortcut: string; // e.g. "/price" — type in inbox to insert
  content: string;
  category: string; // "pricing", "shipping", "returns", etc.
  variables: string[]; // ["customer_name", "product_name"]
  use_count: number;
  created_at: string;
  updated_at: string;
}

// ── Shopify Integration ──

export interface ShopifyProduct {
  id: string;
  business_id: string;
  shopify_product_id: string;
  title: string;
  description: string;
  price: string;
  compare_at_price: string | null;
  currency: string;
  image_url: string | null;
  product_url: string;
  variants: ShopifyVariant[];
  inventory_quantity: number;
  status: 'active' | 'draft' | 'archived';
  synced_at: string;
}

export interface ShopifyVariant {
  id: string;
  title: string;
  price: string;
  inventory_quantity: number;
  option1: string | null;
  option2: string | null;
}

export interface ShopifyOrder {
  id: string;
  order_number: string;
  email: string;
  fulfillment_status: 'fulfilled' | 'unfulfilled' | 'partial';
  financial_status: 'paid' | 'pending' | 'refunded';
  tracking_number: string | null;
  tracking_url: string | null;
  total_price: string;
  currency: string;
  line_items: {
    title: string;
    quantity: number;
    price: string;
  }[];
  created_at: string;
}

// ── Analytics Types ──

export interface AnalyticsEvent {
  id: string;
  business_id: string;
  event_type:
    | 'message_received'
    | 'bot_reply_sent'
    | 'human_reply_sent'
    | 'automation_triggered'
    | 'comment_to_dm'
    | 'email_collected'
    | 'order_lookup'
    | 'product_sent'
    | 'conversation_opened'
    | 'conversation_closed';
  conversation_id: string | null;
  automation_rule_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface AnalyticsSummary {
  period: 'today' | '7d' | '30d' | 'custom';
  total_messages_received: number;
  total_bot_replies: number;
  total_human_replies: number;
  avg_response_time_seconds: number;
  automation_rate: number; // % handled by bot
  top_keywords: { keyword: string; count: number }[];
  top_automations: { rule_name: string; triggered: number }[];
  conversations_opened: number;
  conversations_closed: number;
  emails_collected: number;
  products_sent: number;
  hourly_volume: { hour: number; count: number }[];
}

// ── Instagram Webhook Types ──

export interface IGWebhookEvent {
  object: 'instagram';
  entry: {
    id: string;
    time: number;
    messaging?: IGMessagingEvent[];
    changes?: IGChangeEvent[];
  }[];
}

export interface IGMessagingEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    attachments?: {
      type: string;
      payload: { url: string };
    }[];
    quick_reply?: { payload: string };
  };
  postback?: {
    mid: string;
    payload: string;
  };
}

export interface IGChangeEvent {
  field: 'comments' | 'live_comments';
  value: {
    id: string;
    text: string;
    from: { id: string; username: string };
    media: { id: string };
  };
}
