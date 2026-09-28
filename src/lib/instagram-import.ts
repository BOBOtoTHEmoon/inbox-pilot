import { supabaseAdmin } from '@/lib/supabase';
import { getInstagramProfile } from '@/lib/instagram';

const GRAPH = 'https://graph.instagram.com/v21.0';

interface IGMessage {
  id: string;
  created_time: string;
  message?: string;
  from?: { id: string; username?: string };
  to?: { data: { id: string; username?: string }[] };
}

interface ImportResult {
  conversations: number;
  messages: number;
  errors: string[];
}

async function igGet(path: string, token: string) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${GRAPH}${path}${sep}access_token=${token}`);
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || `Instagram API error on ${path}`);
  }
  return json;
}

// Get the messages of one conversation, with sender details
async function getConversationMessages(conversationId: string, token: string): Promise<IGMessage[]> {
  const conv = await igGet(
    `/${conversationId}?fields=messages{id,created_time,from,to,message}`,
    token
  );
  const messages: IGMessage[] = conv?.messages?.data || [];

  // If Instagram only returned message IDs, fetch each message's details
  const needDetails = messages.some((m) => !m.from);
  if (!needDetails) return messages;

  const detailed: IGMessage[] = [];
  for (const m of messages.slice(0, 20)) {
    try {
      detailed.push(await igGet(`/${m.id}?fields=id,created_time,from,to,message`, token));
    } catch {
      // Older messages can't be read through the API; skip them
    }
  }
  return detailed;
}

export async function importRecentConversations(
  businessId: string,
  maxConversations = 50
): Promise<ImportResult> {
  const result: ImportResult = { conversations: 0, messages: 0, errors: [] };

  const { data: business } = await supabaseAdmin
    .from('businesses')
    .select('id, instagram_account_id, instagram_username, instagram_access_token')
    .eq('id', businessId)
    .maybeSingle();

  if (!business?.instagram_access_token) {
    result.errors.push('Business has no Instagram connected');
    return result;
  }
  const token = business.instagram_access_token;

  // The business can appear under more than one ID, so collect them all
  const me = await igGet('/me?fields=id,user_id,username', token);
  const businessIds = new Set(
    [me.id, me.user_id, business.instagram_account_id].filter(Boolean).map(String)
  );
  const businessUsername = (me.username || business.instagram_username || '').toLowerCase();
  const isBusiness = (p?: { id: string; username?: string }) =>
    !!p && (businessIds.has(String(p.id)) || (p.username || '').toLowerCase() === businessUsername);

  // 1. List recent conversations (newest first), following pages if needed
  const conversationIds: string[] = [];
  let next: string | null = `${GRAPH}/me/conversations?platform=instagram&limit=25&access_token=${token}`;
  while (next && conversationIds.length < maxConversations) {
    const res: Response = await fetch(next);
    const page = await res.json();
    if (!res.ok) throw new Error(page?.error?.message || 'Could not list conversations');
    for (const c of page.data || []) {
      if (conversationIds.length < maxConversations) conversationIds.push(c.id);
    }
    next = page?.paging?.next || null;
  }

   // 2. Import one conversation
  const importOne = async (igConversationId: string) => {
    try {
      const messages = await getConversationMessages(igConversationId, token);
      if (messages.length === 0) return;

      // Work out who the customer is
      let customer: { id: string; username?: string } | undefined;
      for (const m of messages) {
        if (m.from && !isBusiness(m.from)) {
          customer = m.from;
          break;
        }
        const recipient = m.to?.data?.[0];
        if (recipient && !isBusiness(recipient)) {
          customer = recipient;
          break;
        }
      }
      if (!customer) return;

      // Find or create the conversation
      let { data: conversation } = await supabaseAdmin
        .from('conversations')
        .select('id, customer_username')
        .eq('business_id', business.id)
        .eq('customer_instagram_id', String(customer.id))
        .maybeSingle();

      if (!conversation) {
        const profile = await getInstagramProfile(String(customer.id), token);
        const { data: created, error } = await supabaseAdmin
          .from('conversations')
          .insert({
            business_id: business.id,
            instagram_conversation_id: igConversationId,
            customer_instagram_id: String(customer.id),
            customer_username:
              profile.username !== 'unknown' ? profile.username : customer.username || 'unknown',
            customer_name: profile.name || null,
            customer_profile_pic: profile.profile_picture_url || null,
            status: 'open',
            assigned_to: 'human',
          })
          .select('id, customer_username')
          .single();
        if (error) throw error;
        conversation = created;
      }

      // Save messages oldest first, so the conversation ends up with the right "last message"
      const rows = messages
        .filter((m) => m.id)
        .sort((a, b) => new Date(a.created_time).getTime() - new Date(b.created_time).getTime())
        .map((m) => ({
          conversation_id: conversation!.id,
          business_id: business.id,
          instagram_message_id: m.id,
          sender_type: isBusiness(m.from) ? 'human' : 'customer',
          content: m.message || '[attachment]',
          message_type: m.message ? 'text' : 'image',
          created_at: new Date(m.created_time).toISOString(),
        }));

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('messages')
        .upsert(rows, { onConflict: 'instagram_message_id', ignoreDuplicates: true })
        .select('id');
      if (insertError) throw insertError;

      // Older messages were just added, so recalculate the conversation's
      // "last message" details from what is actually saved
      const { data: latest } = await supabaseAdmin
        .from('messages')
        .select('content, sender_type, created_at')
        .eq('conversation_id', conversation!.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: latestFromCustomer } = await supabaseAdmin
        .from('messages')
        .select('created_at')
        .eq('conversation_id', conversation!.id)
        .eq('sender_type', 'customer')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      await supabaseAdmin
        .from('conversations')
        .update({
          last_message_at: latest?.created_at,
          last_message_preview: (latest?.content || '').slice(0, 100),
          last_sender_type: latest?.sender_type || null,
          last_customer_message_at: latestFromCustomer?.created_at || null,
          // Imported history counts as already seen
          is_read: true,
        })
        .eq('id', conversation!.id);

      result.conversations += 1;
      result.messages += inserted?.length || 0;
    } catch (err: any) {
      result.errors.push(`${igConversationId}: ${String(err?.message || err)}`);
    }
  };

  // 3. Run several conversations at a time, so big inboxes finish quickly
  const BATCH_SIZE = 6;
  for (let i = 0; i < conversationIds.length; i += BATCH_SIZE) {
    await Promise.all(conversationIds.slice(i, i + BATCH_SIZE).map(importOne));
  }

  if (result.errors.length > 0) {
    await supabaseAdmin.from('webhook_logs').insert({
      body: { import_result: result },
      error: `DM import had ${result.errors.length} error(s)`,
    });
  }

  return result;
}