import { supabaseAdmin } from '@/lib/supabase';
import { shopForBusiness, fetchShopLogo } from '@/lib/shopify-admin';

const PRODUCTS_QUERY = /* GraphQL */ `
  query CatalogProducts($cursor: String) {
    products(first: 12, after: $cursor, query: "status:active") {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        title
        handle
        productType
        tags
        featuredImage { url }
        collections(first: 5) { nodes { title } }
        variants(first: 60) {
          nodes {
            id
            title
            sku
            barcode
            price
            position
            availableForSale
            inventoryQuantity
            inventoryPolicy
            selectedOptions { name value }
            image { url }
            inventoryItem { id }
          }
        }
      }
    }
  }
`;

interface RawVariant {
  id: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  price: string;
  position: number;
  availableForSale: boolean;
  inventoryQuantity: number | null;
  inventoryPolicy: 'DENY' | 'CONTINUE';
  selectedOptions: { name: string; value: string }[];
  image: { url: string } | null;
  inventoryItem: { id: string } | null;
}

interface RawProduct {
  id: string;
  title: string;
  handle: string;
  productType: string | null;
  tags: string[];
  featuredImage: { url: string } | null;
  collections: { nodes: { title: string }[] };
  variants: { nodes: RawVariant[] };
}

interface RawPage {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: RawProduct[];
  };
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export async function syncCatalog(businessId: string) {
  const shop = await shopForBusiness(businessId);
  const preorderTags = (shop.connection.preorder_tags || []).map((t) => t.toLowerCase());
  const syncedAt = new Date().toISOString();

  // 1. Fetch every active product, page by page
  const raw: RawProduct[] = [];
  let cursor: string | null = null;
  let guard = 0;
  do {
    const page: RawPage = await shop.graphql<RawPage>(PRODUCTS_QUERY, { cursor });
    raw.push(...page.products.nodes);
    cursor = page.products.pageInfo.hasNextPage ? page.products.pageInfo.endCursor : null;
    guard++;
  } while (cursor && guard < 150);

  try {
    // 2. Save products
    const productRows = raw.map((p) => {
      const taggedPreorder = p.tags.some((t) => preorderTags.includes(t.toLowerCase()));
      const optionNames: string[] = [];
      for (const v of p.variants.nodes) {
        for (const o of v.selectedOptions) {
          if (o.value.trim().toLowerCase() !== 'default title' && !optionNames.includes(o.name)) {
            optionNames.push(o.name);
          }
        }
      }
      const collections = p.collections.nodes.map((c) => c.title);
      return {
        business_id: businessId,
        source: 'shopify',
        external_id: p.id,
        handle: p.handle,
        title: p.title,
        category: p.productType?.trim() || collections[0] || null,
        collections,
        image_url: p.featuredImage?.url || null,
        tags: p.tags,
        option_names: optionNames,
        is_preorder: taggedPreorder,
        status: 'active',
        synced_at: syncedAt,
      };
    });

    const idByExternal = new Map<string, string>();
    for (const rows of chunk(productRows, 200)) {
      const { data, error } = await supabaseAdmin
        .from('products')
        .upsert(rows, { onConflict: 'business_id,external_id' })
        .select('id, external_id');
      if (error) throw error;
      for (const r of data || []) idByExternal.set(r.external_id, r.id);
    }

    // 3. Save variants
    const variantRows = raw.flatMap((p) => {
      const taggedPreorder = p.tags.some((t) => preorderTags.includes(t.toLowerCase()));
      return p.variants.nodes.map((v) => {
        const stock = v.inventoryQuantity ?? 0;
        // Pre-order: tagged product, or Shopify keeps selling past zero
        const isPreorder =
          taggedPreorder || (v.inventoryPolicy === 'CONTINUE' && stock <= 0 && v.availableForSale);
        const options = v.selectedOptions.filter((o) => o.value.trim().toLowerCase() !== 'default title');
        return {
          business_id: businessId,
          product_id: idByExternal.get(p.id)!,
          external_id: v.id,
          inventory_item_id: v.inventoryItem?.id || null,
          sku: v.sku,
          barcode: v.barcode,
          title: v.title,
          label: options.map((o) => o.value).join(' / '),
          options,
          position: v.position,
          price: Number.parseFloat(v.price) || 0,
          stock,
          is_preorder: isPreorder,
          available: v.availableForSale,
          image_url: v.image?.url || null,
          synced_at: syncedAt,
        };
      });
    });

    for (const rows of chunk(variantRows, 300)) {
      const { error } = await supabaseAdmin
        .from('product_variants')
        .upsert(rows, { onConflict: 'business_id,external_id' });
      if (error) throw error;
    }

    // 4. Anything not seen in this sync was deleted or hidden in Shopify
    await supabaseAdmin
      .from('products')
      .update({ status: 'archived' })
      .eq('business_id', businessId)
      .lt('synced_at', syncedAt);
    await supabaseAdmin
      .from('product_variants')
      .delete()
      .eq('business_id', businessId)
      .lt('synced_at', syncedAt);

    await supabaseAdmin
      .from('shop_connections')
      .update({ last_synced_at: syncedAt, last_sync_error: null })
      .eq('business_id', businessId);

    // Use the Shopify logo on receipts unless the business has chosen its own
    const { data: biz } = await supabaseAdmin
      .from('businesses')
      .select('receipt_logo_url')
      .eq('id', businessId)
      .maybeSingle();
    if (biz && !biz.receipt_logo_url) {
      const logo = await fetchShopLogo(shop.graphql);
      if (logo) await supabaseAdmin.from('businesses').update({ receipt_logo_url: logo }).eq('id', businessId);
    }

    return { products: productRows.length, variants: variantRows.length, syncedAt };
  } catch (err: any) {
    await supabaseAdmin
      .from('shop_connections')
      .update({ last_sync_error: String(err?.message || err) })
      .eq('business_id', businessId);
    throw err;
  }
}