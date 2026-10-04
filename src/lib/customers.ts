import { supabaseAdmin } from '@/lib/supabase';
import { normalizePhone } from '@/lib/phone';

interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  instagram_id: string | null;
  instagram_username: string | null;
  profile_pic: string | null;
}

const COLUMNS = 'id, name, phone, email, instagram_id, instagram_username, profile_pic';

async function findBy(businessId: string, column: string, value: string | null) {
  if (!value) return null;
  const { data } = await supabaseAdmin
    .from('customers')
    .select(COLUMNS)
    .eq('business_id', businessId)
    .eq(column, value)
    .maybeSingle();
  return (data as CustomerRow) || null;
}

// Move everything from one customer record onto another, then remove the empty one
async function fold(fromId: string, intoId: string) {
  if (fromId === intoId) return;
  await supabaseAdmin.from('customers').update({ instagram_id: null }).eq('id', fromId);
  await supabaseAdmin.from('conversations').update({ customer_id: intoId }).eq('customer_id', fromId);
  await supabaseAdmin.from('sales').update({ customer_id: intoId }).eq('customer_id', fromId);
  await supabaseAdmin.from('customers').delete().eq('id', fromId);
}

export async function linkConversation(conversationId: string) {
  const { data: conv } = await supabaseAdmin
    .from('conversations')
    .select('id, business_id, customer_id, customer_instagram_id, customer_username, customer_name, customer_profile_pic, customer_phone, customer_email')
    .eq('id', conversationId)
    .maybeSingle();
  if (!conv) return null;

  const businessId = conv.business_id as string;
  const phone = normalizePhone(conv.customer_phone);
  const username = conv.customer_username && conv.customer_username !== 'unknown' ? conv.customer_username : null;
  const displayName = conv.customer_name || username || 'Instagram user';

  // Who is this? Phone first (it joins DMs to shop purchases), then Instagram
  let target =
    (await findBy(businessId, 'phone', phone)) ||
    (await findBy(businessId, 'instagram_id', conv.customer_instagram_id));
  if (!target && conv.customer_id) {
    const { data } = await supabaseAdmin.from('customers').select(COLUMNS).eq('id', conv.customer_id).maybeSingle();
    target = (data as CustomerRow) || null;
  }

  if (!target) {
    const { data, error } = await supabaseAdmin
      .from('customers')
      .insert({
        business_id: businessId,
        name: displayName,
        phone,
        email: conv.customer_email || null,
        instagram_id: conv.customer_instagram_id,
        instagram_username: username,
        profile_pic: conv.customer_profile_pic,
      })
      .select(COLUMNS)
      .single();
    if (error) {
      console.error('[customers] create failed', error.message);
      return null;
    }
    target = data as CustomerRow;
  } else {
    // Two records for one person (an Instagram-only one and a shop one): fold them together
    if (conv.customer_id && conv.customer_id !== target.id) await fold(conv.customer_id, target.id);
    const instagramOwner = await findBy(businessId, 'instagram_id', conv.customer_instagram_id);
    if (instagramOwner && instagramOwner.id !== target.id) {
      await fold(instagramOwner.id, target.id);
      target.instagram_id = null;
    }
  }

  // Fill in whatever this record is missing, never overwriting what is there
  const updates: Partial<CustomerRow> & { updated_at?: string } = {};
  if (!target.phone && phone) updates.phone = phone;
  if (!target.email && conv.customer_email) updates.email = conv.customer_email;
  if (!target.instagram_id && conv.customer_instagram_id) updates.instagram_id = conv.customer_instagram_id;
  if (!target.instagram_username && username) updates.instagram_username = username;
  if (conv.customer_profile_pic && target.profile_pic !== conv.customer_profile_pic) updates.profile_pic = conv.customer_profile_pic;
  if ((target.name === 'Walk-in customer' || !target.name) && displayName) updates.name = displayName;
  if (Object.keys(updates).length) {
    updates.updated_at = new Date().toISOString();
    const { error } = await supabaseAdmin.from('customers').update(updates).eq('id', target.id);
    if (error) console.error('[customers] update failed', error.message);
  }

  if (conv.customer_id !== target.id) {
    await supabaseAdmin.from('conversations').update({ customer_id: target.id }).eq('id', conv.id);
  }
  return target.id;
}

// Link every conversation that has no customer yet (for example, imported DMs)
export async function linkAll(businessId: string, limit = 200) {
  const { data } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('business_id', businessId)
    .is('customer_id', null)
    .limit(limit);
  let linked = 0;
  for (const c of data || []) {
    if (await linkConversation(c.id)) linked++;
  }
  return { linked };
}