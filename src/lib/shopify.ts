// ============================================
// SHOPIFY INTEGRATION
// Product sync + order lookup
// ============================================

import { supabaseAdmin } from './supabase';

interface ShopifyConfig {
  storeUrl: string; // e.g. "auraupstore.myshopify.com"
  accessToken: string;
}

// ── Fetch all products from Shopify ──
export async function syncShopifyProducts(
  businessId: string,
  config: ShopifyConfig
) {
  const products = await fetchAllProducts(config);

  // Upsert products into Supabase
  const upsertData = products.map((product: any) => ({
    business_id: businessId,
    shopify_product_id: String(product.id),
    title: product.title,
    description: product.body_html?.replace(/<[^>]*>/g, '') || '',
    price: product.variants[0]?.price || '0',
    compare_at_price: product.variants[0]?.compare_at_price || null,
    currency: 'NGN',
    image_url: product.image?.src || product.images?.[0]?.src || null,
    product_url: `https://${config.storeUrl}/products/${product.handle}`,
    variants: product.variants.map((v: any) => ({
      id: String(v.id),
      title: v.title,
      price: v.price,
      inventory_quantity: v.inventory_quantity || 0,
      option1: v.option1,
      option2: v.option2,
    })),
    inventory_quantity: product.variants.reduce(
      (sum: number, v: any) => sum + (v.inventory_quantity || 0),
      0
    ),
    status: product.status || 'active',
    synced_at: new Date().toISOString(),
  }));

  const { error } = await supabaseAdmin
    .from('shopify_products')
    .upsert(upsertData, {
      onConflict: 'business_id,shopify_product_id',
    });

  if (error) {
    console.error('[Shopify] Product sync error:', error);
    throw error;
  }

  console.log(`[Shopify] Synced ${products.length} products for business ${businessId}`);
  return products.length;
}

async function fetchAllProducts(config: ShopifyConfig) {
  const allProducts: any[] = [];
  let url = `https://${config.storeUrl}/admin/api/2024-10/products.json?limit=250&status=active`;

  while (url) {
    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': config.accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Shopify API error: ${error}`);
    }

    const data = await response.json();
    allProducts.push(...data.products);

    // Check for pagination
    const linkHeader = response.headers.get('link');
    if (linkHeader && linkHeader.includes('rel="next"')) {
      const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      url = nextMatch ? nextMatch[1] : '';
    } else {
      url = '';
    }
  }

  return allProducts;
}

// ── Look up an order by order number or email ──
export async function lookupShopifyOrder(
  config: ShopifyConfig,
  query: { orderNumber?: string; email?: string }
): Promise<any | null> {
  let url: string;

  if (query.orderNumber) {
    // Strip # prefix if present
    const num = query.orderNumber.replace('#', '');
    url = `https://${config.storeUrl}/admin/api/2024-10/orders.json?name=%23${num}&status=any&limit=1`;
  } else if (query.email) {
    url = `https://${config.storeUrl}/admin/api/2024-10/orders.json?email=${encodeURIComponent(query.email)}&status=any&limit=5`;
  } else {
    return null;
  }

  const response = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': config.accessToken,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) return null;

  const data = await response.json();
  if (!data.orders || data.orders.length === 0) return null;

  const order = data.orders[0];

  // Get fulfillment/tracking info
  let trackingNumber = null;
  let trackingUrl = null;

  if (order.fulfillments && order.fulfillments.length > 0) {
    const fulfillment = order.fulfillments[order.fulfillments.length - 1];
    trackingNumber = fulfillment.tracking_number;
    trackingUrl = fulfillment.tracking_url;
  }

  return {
    id: String(order.id),
    order_number: order.name, // "#1001"
    email: order.email,
    fulfillment_status: order.fulfillment_status || 'unfulfilled',
    financial_status: order.financial_status,
    tracking_number: trackingNumber,
    tracking_url: trackingUrl,
    total_price: order.total_price,
    currency: order.currency,
    line_items: order.line_items.map((item: any) => ({
      title: item.title,
      quantity: item.quantity,
      price: item.price,
    })),
    created_at: order.created_at,
  };
}

// ── Format order status as a friendly DM message ──
export function formatOrderStatusMessage(order: any): string {
  const statusEmoji: Record<string, string> = {
    fulfilled: '✅',
    unfulfilled: '📦',
    partial: '⏳',
    paid: '💰',
    pending: '⏳',
    refunded: '↩️',
  };

  const items = order.line_items
    .map((item: any) => `• ${item.title} x${item.quantity}`)
    .join('\n');

  let message = `📋 Order ${order.order_number}\n\n`;
  message += `Items:\n${items}\n\n`;
  message += `Total: ${order.currency} ${order.total_price}\n`;
  message += `Payment: ${statusEmoji[order.financial_status] || '❓'} ${order.financial_status}\n`;
  message += `Delivery: ${statusEmoji[order.fulfillment_status] || '❓'} ${order.fulfillment_status}\n`;

  if (order.tracking_number) {
    message += `\nTracking: ${order.tracking_number}`;
    if (order.tracking_url) {
      message += `\n🔗 Track here: ${order.tracking_url}`;
    }
  } else if (order.fulfillment_status === 'unfulfilled') {
    message += `\nYour order is being prepared! We'll send tracking info once it ships.`;
  }

  return message;
}

// ── Search products by keyword ──
export async function searchProducts(
  businessId: string,
  query: string
): Promise<any[]> {
  const { data } = await supabaseAdmin
    .from('shopify_products')
    .select('*')
    .eq('business_id', businessId)
    .eq('status', 'active')
    .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
    .limit(5);

  return data || [];
}

// ── Format product as DM message ──
export function formatProductMessage(product: any): string {
  let message = `${product.title}\n`;

  if (product.compare_at_price) {
    message += `💰 ₦${product.price} (was ₦${product.compare_at_price})\n`;
  } else {
    message += `💰 ₦${product.price}\n`;
  }

  if (product.inventory_quantity <= 0) {
    message += `⚠️ Currently out of stock\n`;
  } else if (product.inventory_quantity < 5) {
    message += `🔥 Only ${product.inventory_quantity} left!\n`;
  }

  message += `\n🔗 Shop now: ${product.product_url}`;

  return message;
}
