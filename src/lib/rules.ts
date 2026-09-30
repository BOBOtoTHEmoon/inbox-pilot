import type { AutomationRule } from '@/types';

export type TriggerType = AutomationRule['trigger_type'];

export const TRIGGERS: {
  type: TriggerType;
  title: string;
  help: string;
  example: string;
}[] = [
  {
    type: 'keyword',
    title: 'Mentions certain words',
    help: 'Close spellings count too, so "prize" still matches "price".',
    example: 'How much is this?',
  },
  {
    type: 'first_message',
    title: 'Messages you for the first time',
    help: 'A welcome for new customers.',
    example: 'Hi, good afternoon',
  },
  {
    type: 'after_hours',
    title: 'Messages outside business hours',
    help: 'Uses the hours you set in Settings.',
    example: 'Hello, are you open?',
  },
  {
    type: 'story_reply',
    title: 'Replies to your story',
    help: 'When someone reacts to or answers one of your stories.',
    example: 'This is so nice 😍',
  },
  {
    type: 'comment',
    title: 'Comments on your post',
    help: 'They get a private DM. Leave the words empty to reply to every comment.',
    example: 'Price please',
  },
];

// Specific answers win over general ones when more than one rule matches
export const PRIORITY: Record<TriggerType, number> = {
  keyword: 50,
  story_reply: 40,
  comment: 40,
  first_message: 30,
  after_hours: 10,
};

export const REPEAT_OPTIONS = [
  { minutes: 60, label: 'At most once an hour' },
  { minutes: 1440, label: 'At most once a day' },
  { minutes: 0, label: 'Every time' },
];

export function repeatLabel(minutes: number) {
  const exact = REPEAT_OPTIONS.find((o) => o.minutes === minutes);
  if (exact) return exact.label;
  if (minutes < 60) return `At most once every ${minutes} minutes`;
  return `At most once every ${Math.round(minutes / 60)} hours`;
}

export function ruleKeywords(rule: Pick<AutomationRule, 'trigger_config'>): string[] {
  return ((rule.trigger_config as any)?.keywords || []).filter((k: string) => k && k.trim());
}

function quoteList(words: string[], max = 3) {
  const shown = words.slice(0, max).map((w) => `"${w}"`);
  const rest = words.length - shown.length;
  if (rest > 0) return `${shown.join(', ')} or ${rest} more`;
  if (shown.length <= 1) return shown.join('');
  return `${shown.slice(0, -1).join(', ')} or ${shown[shown.length - 1]}`;
}

// "When someone says "price" or "how much""
export function describeTrigger(rule: Pick<AutomationRule, 'trigger_type' | 'trigger_config'>): string {
  const words = ruleKeywords(rule);
  switch (rule.trigger_type) {
    case 'keyword':
      return words.length ? `When someone says ${quoteList(words)}` : 'When someone mentions your words';
    case 'first_message':
      return 'When someone messages you for the first time';
    case 'after_hours':
      return 'When someone messages outside business hours';
    case 'story_reply':
      return words.length ? `When someone replies to your story with ${quoteList(words)}` : 'When someone replies to your story';
    case 'comment':
      return words.length ? `When someone comments ${quoteList(words)} on a post` : 'When someone comments on a post';
    default:
      return 'When a message arrives';
  }
}

export function ruleUseCount(rule: AutomationRule): number {
  return (rule as any).triggered_count ?? rule.stats?.triggered_count ?? 0;
}

export interface RuleDraft {
  name: string;
  trigger_type: TriggerType;
  keywords: string[];
  reply: string;
  cooldown_minutes: number;
}

// Ready-made starting points, shown when there are no rules yet
export const PRESETS: RuleDraft[] = [
  {
    name: 'Price questions',
    trigger_type: 'keyword',
    keywords: ['price', 'how much', 'cost'],
    reply:
      "Hi! Thanks for reaching out. Which piece are you looking at? Send a screenshot and we'll share the price and available sizes.",
    cooldown_minutes: 60,
  },
  {
    name: 'Delivery questions',
    trigger_type: 'keyword',
    keywords: ['delivery', 'deliver', 'shipping', 'how long'],
    reply:
      'We deliver across Nigeria. Lagos orders usually arrive in 1 to 2 working days, and other states in 3 to 5. Tell us your area and we will confirm the fee.',
    cooldown_minutes: 1440,
  },
  {
    name: 'Outside business hours',
    trigger_type: 'after_hours',
    keywords: [],
    reply: "Thanks for your message! We're closed right now, and we'll reply first thing when we open.",
    cooldown_minutes: 1440,
  },
  {
    name: 'Welcome new customers',
    trigger_type: 'first_message',
    keywords: [],
    reply: 'Welcome! Thanks for messaging us. How can we help you today?',
    cooldown_minutes: 1440,
  },
  {
    name: 'Story replies',
    trigger_type: 'story_reply',
    keywords: [],
    reply: 'Thank you! Want the details on anything you saw in our story?',
    cooldown_minutes: 1440,
  },
];

export function draftFromRule(rule: AutomationRule): RuleDraft {
  return {
    name: rule.name,
    trigger_type: rule.trigger_type,
    keywords: ruleKeywords(rule),
    reply: (rule.response as any)?.content || '',
    cooldown_minutes: rule.cooldown_minutes ?? 60,
  };
}

// What gets saved to the database
export function ruleFromDraft(d: RuleDraft): Partial<AutomationRule> {
  const trigger_config: any = { type: d.trigger_type };
  if (d.trigger_type === 'keyword') {
    trigger_config.keywords = d.keywords;
    trigger_config.match_mode = 'fuzzy';
  } else if (d.trigger_type === 'comment') {
    trigger_config.keywords = d.keywords;
    trigger_config.post_ids = null;
  } else if (d.trigger_type === 'story_reply') {
    trigger_config.keywords = d.keywords.length ? d.keywords : null;
  }

  const fallbackName =
    TRIGGERS.find((t) => t.type === d.trigger_type)?.title || 'Auto-reply';

  return {
    name: d.name.trim() || (d.keywords[0] ? `Reply to "${d.keywords[0]}"` : fallbackName),
    trigger_type: d.trigger_type,
    trigger_config,
    response_type: 'single',
    response: { content: d.reply.trim(), message_type: 'text' } as any,
    priority: PRIORITY[d.trigger_type],
    cooldown_minutes: d.cooldown_minutes,
  };
}