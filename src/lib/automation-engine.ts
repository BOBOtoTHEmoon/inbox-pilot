// ============================================
// AUTOMATION ENGINE
// Matches incoming messages to rules & executes
// ============================================

import { supabaseAdmin } from './supabase';
import { sendInstagramMessage } from './instagram';
import type {
  AutomationRule,
  AutomationResponse,
  KeywordTrigger,
  Conversation,
  FlowStep,
} from '@/types';

interface IncomingMessage {
  senderIgId: string;
  text: string;
  businessId: string;
  conversationId: string;
  isFirstMessage: boolean;
  timestamp: number;
}

interface MatchResult {
  rule: AutomationRule;
  response: AutomationResponse;
}

// ── Main entry point ──
export async function processIncomingMessage(
  message: IncomingMessage,
  business: {
    id: string;
    instagram_account_id: string;
    instagram_access_token: string;
    timezone: string;
    business_hours_start: string;
    business_hours_end: string;
    away_message: string | null;
  }
): Promise<{ handled: boolean; ruleId?: string }> {
  // 1. Check if user is in an active flow
  const flowResult = await checkActiveFlow(message);
  if (flowResult.handled) {
    return { handled: true, ruleId: flowResult.ruleId };
  }

  // 2. Get all active automation rules for this business, ordered by priority
  const { data: rules } = await supabaseAdmin
    .from('automation_rules')
    .select('*')
    .eq('business_id', message.businessId)
    .eq('is_active', true)
    .order('priority', { ascending: false });

  if (!rules || rules.length === 0) {
    return { handled: false };
  }

  // 3. Check each rule for a match
  for (const rule of rules as AutomationRule[]) {
    const isMatch = await matchRule(rule, message, business);

    if (isMatch) {
      // 4. Check cooldown
      const onCooldown = await checkCooldown(rule.id, message.senderIgId, rule.cooldown_minutes);
      if (onCooldown) continue;

      // 5. Execute the response
      const response = rule.response_type === 'flow'
        ? await startFlow(rule.flow_id!, message)
        : rule.response;

      if (response) {
        await executeResponse(response, message, business, rule.id);

        // 6. Set cooldown
        await setCooldown(rule.id, message.senderIgId, message.businessId);

        // 7. Log analytics
        await logAnalyticsEvent(message.businessId, 'automation_triggered', {
          conversation_id: message.conversationId,
          automation_rule_id: rule.id,
          metadata: { rule_name: rule.name, trigger_type: rule.trigger_type },
        });

        return { handled: true, ruleId: rule.id };
      }
    }
  }

  return { handled: false };
}

// ── Rule Matching ──

async function matchRule(
  rule: AutomationRule,
  message: IncomingMessage,
  business: {
    timezone: string;
    business_hours_start: string;
    business_hours_end: string;
  }
): Promise<boolean> {
  switch (rule.trigger_type) {
    case 'keyword':
      return matchKeywords(rule.trigger_config as KeywordTrigger, message.text);

    case 'first_message':
      return message.isFirstMessage;

    case 'after_hours':
      return isAfterHours(business);

    case 'story_reply':
      // Story replies come with a specific attachment type
      // For now, match any message if no keywords specified
      const storyConfig = rule.trigger_config as { keywords: string[] | null };
      if (!storyConfig.keywords) return true;
      return matchKeywords(
        { type: 'keyword', keywords: storyConfig.keywords, match_mode: 'contains' },
        message.text
      );

    default:
      return false;
  }
}

function matchKeywords(config: KeywordTrigger, text: string): boolean {
  const normalizedText = text.toLowerCase().trim();

  for (const keyword of config.keywords) {
    const normalizedKeyword = keyword.toLowerCase().trim();

    switch (config.match_mode) {
      case 'exact':
        if (normalizedText === normalizedKeyword) return true;
        break;

      case 'contains':
        if (normalizedText.includes(normalizedKeyword)) return true;
        break;

      case 'fuzzy':
        // Check contains first (fast path)
        if (normalizedText.includes(normalizedKeyword)) return true;

        // Check each word in the message against keyword
        const words = normalizedText.split(/\s+/);
        for (const word of words) {
          if (levenshteinDistance(word, normalizedKeyword) <= 2) return true;
        }

        // Check if message is a common variation
        // "howmuch" → "how much", "hw much" → "how much"
        const noSpaces = normalizedText.replace(/\s+/g, '');
        const keywordNoSpaces = normalizedKeyword.replace(/\s+/g, '');
        if (noSpaces.includes(keywordNoSpaces)) return true;
        if (levenshteinDistance(noSpaces, keywordNoSpaces) <= 2) return true;
        break;
    }
  }

  return false;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function isAfterHours(business: {
  timezone: string;
  business_hours_start: string;
  business_hours_end: string;
}): boolean {
  const now = new Date();

  // Get current time in business timezone
  const timeStr = now.toLocaleTimeString('en-US', {
    timeZone: business.timezone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });

  const [hours, minutes] = timeStr.split(':').map(Number);
  const currentMinutes = hours * 60 + minutes;

  const [startH, startM] = business.business_hours_start.split(':').map(Number);
  const startMinutes = startH * 60 + startM;

  const [endH, endM] = business.business_hours_end.split(':').map(Number);
  const endMinutes = endH * 60 + endM;

  return currentMinutes < startMinutes || currentMinutes > endMinutes;
}

// ── Response Execution ──

async function executeResponse(
  response: AutomationResponse,
  message: IncomingMessage,
  business: {
    id: string;
    instagram_account_id: string;
    instagram_access_token: string;
  },
  ruleId: string
) {
  // Optional delay before sending
  if (response.delay_seconds && response.delay_seconds > 0) {
    await new Promise((resolve) => setTimeout(resolve, response.delay_seconds! * 1000));
  }

  // Build the IG message payload
  const igMessage: Record<string, any> = {};

  if (response.content) {
    igMessage.text = response.content;
  }

  if (response.quick_replies && response.quick_replies.length > 0) {
    igMessage.quick_replies = response.quick_replies.map((qr) => ({
      content_type: 'text',
      title: qr.label,
      payload: qr.value,
    }));
  }

  // Send via Instagram API
  await sendInstagramMessage({
    recipientId: message.senderIgId,
    accessToken: business.instagram_access_token,
    igAccountId: business.instagram_account_id,
    message: igMessage,
  });

  // Save bot message to database
  await supabaseAdmin.from('messages').insert({
    conversation_id: message.conversationId,
    business_id: message.businessId,
    sender_type: 'bot',
    content: response.content || '[attachment]',
    message_type: response.message_type || 'text',
    attachments: response.attachments || [],
    quick_replies: response.quick_replies || null,
    automation_rule_id: ruleId,
  });

  // Log bot reply event
  await logAnalyticsEvent(message.businessId, 'bot_reply_sent', {
    conversation_id: message.conversationId,
    automation_rule_id: ruleId,
  });
}

// ── Flow Management ──

async function checkActiveFlow(
  message: IncomingMessage
): Promise<{ handled: boolean; ruleId?: string }> {
  // Check if this conversation has an active (incomplete) flow
  const { data: flowState } = await supabaseAdmin
    .from('flow_states')
    .select('*, conversation_flows(*)')
    .eq('conversation_id', message.conversationId)
    .is('completed_at', null)
    .single();

  if (!flowState) return { handled: false };

  const flow = flowState.conversation_flows;
  const steps = flow.steps as FlowStep[];
  const currentStep = steps.find((s) => s.id === flowState.current_step_id);

  if (!currentStep || !currentStep.wait_for_reply) {
    return { handled: false };
  }

  // Check if the reply matches any expected replies
  if (currentStep.expected_replies) {
    for (const expected of currentStep.expected_replies) {
      const isMatch = matchKeywords(
        { type: 'keyword', keywords: expected.keywords, match_mode: 'fuzzy' },
        message.text
      );

      if (isMatch) {
        const nextStep = steps.find((s) => s.id === expected.next_step_id);
        if (nextStep) {
          // Update flow state
          await supabaseAdmin
            .from('flow_states')
            .update({ current_step_id: nextStep.id })
            .eq('id', flowState.id);

          // Execute next step's message
          // (simplified — you'd pass proper business context)
          return { handled: true };
        }
      }
    }

    // No match — use fallback
    if (currentStep.fallback_step_id) {
      const fallback = steps.find((s) => s.id === currentStep.fallback_step_id);
      if (fallback) {
        await supabaseAdmin
          .from('flow_states')
          .update({ current_step_id: fallback.id })
          .eq('id', flowState.id);
        return { handled: true };
      }
    }
  }

  return { handled: false };
}

async function startFlow(
  flowId: string,
  message: IncomingMessage
): Promise<AutomationResponse | null> {
  const { data: flow } = await supabaseAdmin
    .from('conversation_flows')
    .select('*')
    .eq('id', flowId)
    .single();

  if (!flow || !flow.steps || flow.steps.length === 0) return null;

  const steps = flow.steps as FlowStep[];
  const firstStep = steps.sort((a, b) => a.order - b.order)[0];

  // Create flow state
  await supabaseAdmin.from('flow_states').upsert({
    conversation_id: message.conversationId,
    flow_id: flowId,
    current_step_id: firstStep.id,
    collected_data: {},
    started_at: new Date().toISOString(),
  });

  return firstStep.message;
}

// ── Cooldown Management ──

async function checkCooldown(
  ruleId: string,
  customerIgId: string,
  cooldownMinutes: number
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('automation_cooldowns')
    .select('triggered_at')
    .eq('automation_rule_id', ruleId)
    .eq('customer_instagram_id', customerIgId)
    .single();

  if (!data) return false;

  const triggeredAt = new Date(data.triggered_at);
  const cooldownEnd = new Date(triggeredAt.getTime() + cooldownMinutes * 60 * 1000);

  return new Date() < cooldownEnd;
}

async function setCooldown(ruleId: string, customerIgId: string, businessId: string) {
  await supabaseAdmin.from('automation_cooldowns').upsert(
    {
      automation_rule_id: ruleId,
      customer_instagram_id: customerIgId,
      business_id: businessId,
      triggered_at: new Date().toISOString(),
    },
    { onConflict: 'automation_rule_id,customer_instagram_id' }
  );
}

// ── Analytics Logging ──

async function logAnalyticsEvent(
  businessId: string,
  eventType: string,
  data: {
    conversation_id?: string;
    automation_rule_id?: string;
    metadata?: Record<string, any>;
  }
) {
  await supabaseAdmin.from('analytics_events').insert({
    business_id: businessId,
    event_type: eventType,
    conversation_id: data.conversation_id || null,
    automation_rule_id: data.automation_rule_id || null,
    metadata: data.metadata || {},
  });
}

export { logAnalyticsEvent, matchKeywords, isAfterHours };
