import { supabaseAdmin } from '@/lib/supabase';
import { shopForBusiness, ShopifyError } from '@/lib/shopify-admin';
import { normalizePhone } from '@/lib/phone';

export class ValidationError extends Error {}

const PAYMENTS = ['cash', 'transfer', 'card'] as const;
type Payment = (typeof PAYMENTS)[number];

export interface SaleInput {
  items: { variantId: string; quantity: number }[];
  customer: { name: string; phone: string } | null;
  staffId: string | null;
  paymentMethod: Payment;
  discount: number;
  note: string | null;
}

export function validateSale(body: any): SaleInput {
  const items = Array.isArray(body?.items) ? body.items : [];
  if (items.length === 0) throw new ValidationError('Add at least one item to the sale.');
  if (items.length > 50) throw new ValidationError('Too many items in one sale.');

  const merged = new Map<string, number>();
  items.forEach((it: any, i: number) => {
    const variantId = String(it?.variantId || '');
    const quantity = Number(it?.quantity);
    if (!variantId.startsWith('gid://shopify/ProductVariant/')) {
      throw new ValidationError(`Item ${i + 1} is not a valid product.`);
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      throw new ValidationError(`Item ${i + 1} has an invalid quantity.`);
    }
    merged.set(variantId, (merged.get(variantId) || 0) + quantity);
  });

  const paymentMethod = String(body?.paymentMethod || '').toLowerCase() as Payment;
  if (!PAYMENTS.includes(paymentMethod)) throw new ValidationError('Choose how the customer paid.');

  const discount = body?.discount ? Number(body.discount) : 0;
  if (!Number.isFinite(discount) || discount < 0) throw new ValidationError('The discount must be zero or more.');

  const phone = normalizePhone(body?.customer?.phone);
  const name = String(body?.customer?.name || '').trim().slice(0, 200);

  return {
    items: Array.from(merged, ([variantId, quantity]) => ({ variantId, quantity })),
    customer: phone ? { name: name || 'Walk-in customer', phone } : null,
    staffId: body?.staffId ? String(body.staffId) : null,
    paymentMethod,
    discount: Math.round(discount),
    note: body?.note ? String(body.note).slice(0, 1000) : null,
  };
}

// ── Reading prices from Shopify ──

interface LiveVariant {
  id: string;
  title: string;
  price: string;
  inventoryPolicy: 'DENY' | 'CONTINUE';
  inventoryQuantity: number | null;
  selectedOptions: { name: string; value: string }[];
  image: { url: string } | null;
  inventoryItem: { id: string } | null;
  product: { id: string; title: string; featuredImage: { url: string } | null };
}

const VARIANTS_QUERY = /* GraphQL */ `
  query SaleVariants($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        title
        price
        inventoryPolicy
        inventoryQuantity
        selectedOptions { name value }
        image { url }
        inventoryItem { id }
        product { id title featuredImage { url } }
      }
    }
  }
`;

// ── Stock changes ──

const LEVELS_QUERY = /* GraphQL */ `
  query CurrentLevels($ids: [ID!]!, $locationId: ID!) {
    nodes(ids: $ids) {
      ... on InventoryItem {
        id
        inventoryLevel(locationId: $locationId) {
          quantities(names: ["available"]) { name quantity }
        }
      }
    }
  }
`;

const ADJUST_MUTATION = /* GraphQL */ `
  mutation AdjustStock($input: InventoryAdjustQuantitiesInput!, $key: String!) {
    inventoryAdjustQuantities(input: $input) @idempotent(key: $key) {
      inventoryAdjustmentGroup { createdAt }
      userErrors { field message code }
    }
  }
`;

type Shop = Awaited<ReturnType<typeof shopForBusiness>>;

export async function adjustStock(
  shop: Shop,
  changes: { inventoryItemId: string; delta: number }[],
  reference: string,
  idempotencyKey: string,
  attempt = 0
): Promise<void> {
  const usable = changes.filter((c) => c.inventoryItemId && c.delta !== 0);
  if (!usable.length) return;

  const locationId = shop.connection.location_id;
  if (!locationId) {
    throw new ShopifyError('Choose the shop location in Settings, under Shopify, so stock comes off the right place.');
  }

  const levels = await shop.graphql<{
    nodes: ({ id: string; inventoryLevel: { quantities: { name: string; quantity: number }[] } | null } | null)[];
  }>(LEVELS_QUERY, { ids: [...new Set(usable.map((c) => c.inventoryItemId))], locationId });

  const current = new Map<string, number>();
  for (const node of levels.nodes) {
    const available = node?.inventoryLevel?.quantities.find((q) => q.name === 'available');
    if (node && available) current.set(node.id, available.quantity);
  }

  const unstocked = usable.filter((c) => !current.has(c.inventoryItemId));
  if (unstocked.length) {
    throw new ShopifyError(
      `${unstocked.length} item(s) are not stocked at the shop location. In Shopify, open the product and turn on that location for those variants.`
    );
  }

  const data = await shop.graphql<{
    inventoryAdjustQuantities: { userErrors: { message: string; code?: string }[] };
  }>(ADJUST_MUTATION, {
    key: idempotencyKey,
    input: {
      reason: 'correction',
      name: 'available',
      referenceDocumentUri: `logistics://inboxpilot/sale/${reference}`,
      changes: usable.map((c) => ({
        delta: c.delta,
        inventoryItemId: c.inventoryItemId,
        locationId,
        // What we expect is there now. Shopify rejects the batch if it moved.
        changeFromQuantity: current.get(c.inventoryItemId),
      })),
    },
  });

  const errors = data.inventoryAdjustQuantities.userErrors || [];
  const stale = errors.some((e) => e.code === 'CHANGE_FROM_QUANTITY_STALE' || /stale/i.test(e.message));
  if (stale && attempt < 2) {
    await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    return adjustStock(shop, changes, reference, idempotencyKey, attempt + 1);
  }
  if (errors.length) {
    throw new ShopifyError(`Shopify refused the stock change: ${errors.map((e) => e.message).join('; ')}`);
  }
}

// Keep our catalogue copy in step after a sale or a void, so the screen shows the new stock.
// direction -1 takes stock off (a sale), +1 puts it back (a void).
async function changeLocalStock(
  businessId: string,
  lines: { external_variant_id: string; quantity: number }[],
  direction: 1 | -1
) {
  for (const line of lines) {
    const { data } = await supabaseAdmin
      .from('product_variants')
      .select('id, stock')
      .eq('business_id', businessId)
      .eq('external_id', line.external_variant_id)
      .maybeSingle();
    if (data) {
      await supabaseAdmin
        .from('product_variants')
        .update({ stock: data.stock + direction * line.quantity })
        .eq('id', data.id);
    }
  }
}

// ── Pushing a saved sale's stock to Shopify ──

export async function pushSaleStock(businessId: string, saleId: string) {
  const { data: sale } = await supabaseAdmin
    .from('sales')
    .select('id, sale_number, inventory_synced, sale_items(inventory_item_id, quantity, external_variant_id)')
    .eq('id', saleId)
    .eq('business_id', businessId)
    .maybeSingle();
  if (!sale || sale.inventory_synced) return { ok: true };

  try {
    const shop = await shopForBusiness(businessId);
    // Pre-orders come off stock too: it goes negative, which is how Shopify
    // records stock still owed to a customer.
    await adjustStock(
      shop,
      (sale.sale_items as any[])
        .filter((l) => l.inventory_item_id)
        .map((l) => ({ inventoryItemId: l.inventory_item_id, delta: -l.quantity })),
      String(sale.sale_number),
      sale.id
    );
    await supabaseAdmin.from('sales').update({ inventory_synced: true, inventory_error: null }).eq('id', sale.id);
        await changeLocalStock(businessId, sale.sale_items as any[], -1);
    return { ok: true };
  } catch (err: any) {
    const message = String(err?.message || err);
    await supabaseAdmin.from('sales').update({ inventory_error: message }).eq('id', sale.id);
    return { ok: false, error: message };
  }
}

export async function retryUnsynced(businessId: string) {
  const { data } = await supabaseAdmin
    .from('sales')
    .select('id')
    .eq('business_id', businessId)
    .eq('status', 'completed')
    .eq('inventory_synced', false)
    .order('created_at')
    .limit(20);
  const results = [];
  for (const s of data || []) results.push(await pushSaleStock(businessId, s.id));
  return { tried: results.length, fixed: results.filter((r) => r.ok).length };
}

// ── Creating a sale ──

async function upsertCustomer(businessId: string, customer: SaleInput['customer']) {
  if (!customer) return null;
  const { data: existing } = await supabaseAdmin
    .from('customers')
    .select('id, name')
    .eq('business_id', businessId)
    .eq('phone', customer.phone)
    .maybeSingle();

  if (existing) {
    // Keep the newest real name, but never replace a name with "Walk-in"
    if (customer.name !== 'Walk-in customer' && customer.name !== existing.name) {
      await supabaseAdmin
        .from('customers')
        .update({ name: customer.name, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    }
    return existing.id as string;
  }

  const { data, error } = await supabaseAdmin
    .from('customers')
    .insert({ business_id: businessId, name: customer.name, phone: customer.phone })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function createSale(businessId: string, userId: string, input: SaleInput) {
  const shop = await shopForBusiness(businessId);
  const preorderTags = (shop.connection.preorder_tags || []).map((t) => t.toLowerCase());

  // 1. Real prices and details from Shopify
  const live = await shop.graphql<{ nodes: (LiveVariant | null)[] }>(VARIANTS_QUERY, {
    ids: input.items.map((i) => i.variantId),
  });
  const byId = new Map<string, LiveVariant>();
  live.nodes.forEach((n) => n && byId.set(n.id, n));

  const missing = input.items.filter((i) => !byId.has(i.variantId));
  if (missing.length) {
    throw new ValidationError('Some items no longer exist in Shopify. Refresh the products and try again.');
  }

  // Tags for pre-order detection come from our catalogue copy
  const { data: tagRows } = await supabaseAdmin
    .from('products')
    .select('external_id, tags')
    .eq('business_id', businessId)
    .in('external_id', [...new Set(input.items.map((i) => byId.get(i.variantId)!.product.id))]);
  const taggedPreorder = new Set(
    (tagRows || [])
      .filter((r: any) => (r.tags || []).some((t: string) => preorderTags.includes(t.toLowerCase())))
      .map((r: any) => r.external_id)
  );

  const lines = input.items.map(({ variantId, quantity }) => {
    const v = byId.get(variantId)!;
    const unitPrice = Number.parseFloat(v.price) || 0;
    const stock = v.inventoryQuantity ?? 0;
    const options = v.selectedOptions.filter((o) => o.value.trim().toLowerCase() !== 'default title');
    return {
      business_id: businessId,
      external_product_id: v.product.id,
      external_variant_id: v.id,
      inventory_item_id: v.inventoryItem?.id || null,
      title: v.product.title,
      variant_label: options.map((o) => o.value).join(' / ') || null,
      image_url: v.image?.url || v.product.featuredImage?.url || null,
      unit_price: unitPrice,
      quantity,
      line_total: unitPrice * quantity,
      is_preorder: taggedPreorder.has(v.product.id) || (v.inventoryPolicy === 'CONTINUE' && stock <= 0),
    };
  });

  const subtotal = lines.reduce((s, l) => s + l.line_total, 0);
  if (input.discount > subtotal) throw new ValidationError('The discount cannot be more than the total.');
  const total = subtotal - input.discount;

  // 2. Save the sale first, so nothing is lost if Shopify is down
  const customerId = await upsertCustomer(businessId, input.customer);
  const { data: saleNumber, error: numberError } = await supabaseAdmin.rpc('next_sale_number', { b: businessId });
  if (numberError) throw numberError;

  const { data: sale, error: saleError } = await supabaseAdmin
    .from('sales')
    .insert({
      business_id: businessId,
      sale_number: saleNumber,
      channel: 'store',
      customer_id: customerId,
      staff_id: input.staffId,
      subtotal,
      discount: input.discount,
      total,
      payment_method: input.paymentMethod,
      note: input.note,
      created_by: userId,
    })
    .select('*')
    .single();
  if (saleError) throw saleError;

  const { error: itemsError } = await supabaseAdmin
    .from('sale_items')
    .insert(lines.map((l) => ({ ...l, sale_id: sale.id })));
  if (itemsError) {
    // Without its items the sale is meaningless: remove it and report the problem
    await supabaseAdmin.from('sales').delete().eq('id', sale.id);
    throw itemsError;
  }

  // 3. Take the stock off in Shopify. A failure here is reported, not fatal.
  const stock = await pushSaleStock(businessId, sale.id);

  return { sale: { ...sale, inventory_synced: stock.ok, inventory_error: stock.ok ? null : stock.error }, items: lines };
}


// ── Voiding a sale ──

export async function voidSale(businessId: string, saleId: string, reason: string | null) {
  const { data: sale } = await supabaseAdmin
    .from('sales')
    .select('id, sale_number, status, inventory_synced, void_key, sale_items(inventory_item_id, quantity, external_variant_id)')
    .eq('id', saleId)
    .eq('business_id', businessId)
    .maybeSingle();
  if (!sale) throw new ValidationError('Sale not found.');
  if (sale.status === 'voided') return { ok: true, alreadyVoided: true };

  if (sale.inventory_synced) {
    const voidKey = sale.void_key || crypto.randomUUID();
    if (!sale.void_key) {
      await supabaseAdmin.from('sales').update({ void_key: voidKey }).eq('id', sale.id);
    }
    const shop = await shopForBusiness(businessId);
    await adjustStock(
      shop,
      (sale.sale_items as any[])
        .filter((l) => l.inventory_item_id)
        .map((l) => ({ inventoryItemId: l.inventory_item_id, delta: l.quantity })),
      `${sale.sale_number}-void`,
      voidKey
    );
    await changeLocalStock(businessId, sale.sale_items as any[], 1);
  }

  // A sale that never reached Shopify had no stock taken, so there is nothing to put back
  const { error } = await supabaseAdmin
    .from('sales')
    .update({
      status: 'voided',
      voided_at: new Date().toISOString(),
      void_reason: reason ? reason.slice(0, 300) : null,
      inventory_synced: true,
      inventory_error: null,
    })
    .eq('id', sale.id);
  if (error) throw error;
  return { ok: true };
}