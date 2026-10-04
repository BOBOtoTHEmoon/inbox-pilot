import { supabaseAdmin } from '@/lib/supabase';

const MODEL = process.env.ANTHROPIC_LABEL_MODEL || 'claude-haiku-4-5-20251001';
const LABELS = ['ready_to_buy', 'interested', 'support', 'browsing'] as const;
export type AiLabel = (typeof LABELS)[number];

const SYSTEM_PROMPT = `You sort customer conversations for a shop's inbox, so the team knows who to answer first.

Read the conversation and reply with JSON only, no other text:
{"label": "...", "summary": "..."}

label must be exactly one of:
- "ready_to_buy": they have decided and are trying to pay or order. Asking for account details or a payment link, confirming a size and colour to order, giving a delivery address, saying they have paid, asking to reserve or hold an item.
- "interested": weighing up a purchase. Asking about price, sizes, colours, stock, delivery fees or times, or comparing items.
- "support": about an order they already placed or an issue. Delivery status, a wrong or damaged item, returns, exchanges, complaints.
- "browsing": no clear buying intent. Compliments, emojis, story reactions, greetings with nothing else, unrelated chat, or haggling hard with no real interest.

summary: at most 14 words, plain English, what the person wants right now. Include the product, size, colour or place if they mentioned them. Do not include their name. Example: "Wants the Apex Hoodie in black, size L, delivered to Lekki."

If the conversation is unclear, choose "browsing" and summarise what was said.`;

interface MessageRow {
  sender_type: 'customer' | 'bot' | 'human';
  content: string;
  attachments: { type: string }[] | null;
  created_at: string;
}

function transcript(messages: MessageRow[]) {
  return messages
    .map((m) => {
      const who = m.sender_type === 'customer' ? 'Customer' : 'Shop';
      const media = (m.attachments || []).map((a) => `[${a.type.replace('_', ' ')}]`).join(' ');
      return `${who}: ${[m.content, media].filter(Boolean).join(' ')}`.trim();
    })
    .join('\n');
}

function parseReply(text: string): { label: AiLabel; summary: string } | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const data = JSON.parse(match[0]);
    const label = LABELS.includes(data.label) ? (data.label as AiLabel) : null;
    if (!label) return null;
    return { label, summary: String(data.summary || '').slice(0, 160) };
  } catch {
    return null;
  }
}

export function aiLabelsEnabled() {
  return !!process.env.ANTHROPIC_API_KEY;
}

// Label one conversation from its latest messages. Never throws: a failed label
// just leaves the conversation as it was.
export async function labelConversation(conversationId: string): Promise<boolean> {
  if (!aiLabelsEnabled()) return false;
  try {
    const { data: rows } = await supabaseAdmin
      .from('messages')
      .select('sender_type, content, attachments, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(20);
    const messages = ((rows || []) as MessageRow[]).reverse();
    if (!messages.some((m) => m.sender_type === 'customer')) return false;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 150,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Conversation, oldest first:\n\n${transcript(messages)}` }],
      }),
    });
    if (!res.ok) {
      console.error('[ai-labels] Claude error', res.status, await res.text());
      return false;
    }
    const json = await res.json();
    const text = (json.content || []).map((c: any) => (c.type === 'text' ? c.text : '')).join('');
    const parsed = parseReply(text);
    if (!parsed) return false;

    await supabaseAdmin
      .from('conversations')
      .update({ ai_label: parsed.label, ai_summary: parsed.summary, ai_labeled_at: new Date().toISOString() })
      .eq('id', conversationId);
    return true;
  } catch (err) {
    console.error('[ai-labels]', err);
    return false;
  }
}

// Label open conversations that have no label yet, or a label older than
// their latest customer message. Newest first, a few at a time.
export async function labelMissing(businessId: string, limit = 24) {
  if (!aiLabelsEnabled()) return { labelled: 0, enabled: false };

  const { data } = await supabaseAdmin
    .from('conversations')
    .select('id, ai_labeled_at, last_customer_message_at')
    .eq('business_id', businessId)
    .eq('status', 'open')
    .not('last_customer_message_at', 'is', null)
    .order('last_message_at', { ascending: false })
    .limit(100);

  const due = (data || [])
    .filter((c: any) => !c.ai_labeled_at || new Date(c.ai_labeled_at) < new Date(c.last_customer_message_at))
    .slice(0, limit);

  let labelled = 0;
  for (let i = 0; i < due.length; i += 4) {
    const results = await Promise.all(due.slice(i, i + 4).map((c: any) => labelConversation(c.id)));
    labelled += results.filter(Boolean).length;
  }
  return { labelled, remaining: Math.max(0, due.length - labelled), enabled: true };
}