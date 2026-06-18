# InboxPilot 🚀

Instagram DM automation and inbox management tool. Built for AuraUp, architected for multi-tenant SaaS.

## What It Does

- **Auto-Reply DMs** — Keyword matching (fuzzy/contains/exact) triggers instant replies
- **Comment-to-DM** — Customers comment a keyword → get a DM automatically
- **Shopify Integration** — Product cards in DMs, order status lookup
- **Live Inbox** — Real-time conversation view with bot/human handoff
- **Analytics Dashboard** — Message volume, automation rate, top triggers
- **After-Hours Mode** — Away messages outside business hours
- **Conversation Flows** — Multi-step automated conversations (e.g. collect email → send product)
- **Cooldown System** — Prevents spamming the same user

## Tech Stack

- **Frontend:** Next.js 15, React 19, Tailwind CSS v4, Recharts, Zustand
- **Backend:** Next.js API Routes, Supabase (Postgres + Realtime + Auth)
- **Integrations:** Instagram Graph API, Shopify Admin API, Klaviyo API
- **Deployment:** Vercel

## Setup

### 1. Clone & Install

```bash
git clone <repo-url>
cd inboxpilot
npm install
```

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run `supabase/schema.sql` in the SQL Editor
3. Enable Realtime on `conversations` and `messages` tables
4. Copy your project URL, anon key, and service role key

### 3. Meta Developer App (Instagram API)

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create a new app → select **Business** type
3. Add products: **Instagram** + **Webhooks**
4. Instagram → Basic Display: note the App ID and App Secret
5. Add your IG Business account as a test user (Settings → Roles → Test Users)
6. Webhooks → Subscribe to `messages` and `comments` fields
7. Set webhook URL: `https://your-app.vercel.app/api/webhooks/instagram`
8. Set verify token: `inboxpilot_verify_2024` (or whatever you set in .env)

### 4. Shopify Custom App

1. AuraUp admin → Settings → Apps → Develop apps → Create app
2. Scopes: `read_products`, `read_orders`
3. Install app and copy the Admin API access token

### 5. Environment Variables

```bash
cp .env.example .env.local
# Fill in all values
```

### 6. Run

```bash
npm run dev
```

### 7. Deploy to Vercel

```bash
npx vercel
# Add all env vars in Vercel dashboard
```

## Project Structure

```
src/
├── app/
│   ├── (auth)/login/          # Login page
│   ├── (dashboard)/           # Dashboard layout + pages
│   │   ├── inbox/             # DM inbox view
│   │   ├── automations/       # Rule management
│   │   ├── analytics/         # Stats & charts
│   │   └── settings/          # Config & integrations
│   └── api/
│       ├── webhooks/instagram/ # Meta webhook handler
│       ├── instagram/send/     # Send DM API
│       └── shopify/sync/       # Product sync
├── components/
│   ├── inbox/                 # ConversationList, MessageThread, Header
│   ├── automations/           # RuleCard, RuleEditor
│   └── ui/                    # Badge, Toggle, Spinner, Modal, EmptyState
├── hooks/                     # useConversations, useMessages, useAutomationRules, useAnalytics
├── lib/
│   ├── automation-engine.ts   # Core brain — matching + execution
│   ├── instagram.ts           # IG Graph API client
│   ├── shopify.ts             # Shopify product sync + order lookup
│   ├── supabase.ts            # DB clients (browser + admin)
│   └── store.ts               # Zustand global state
├── types/                     # Full TypeScript type system
└── utils/                     # Helpers (timestamps, parsers, formatters)
```

## AuraUp Default Rules (seed after setup)

1. **Pricing Inquiry** — keywords: price, how much, cost → product link
2. **Delivery Info** — keywords: delivery, shipping → delivery details  
3. **After Hours** — outside 9am-6pm WAT → away message
4. **Comment-to-DM** — comment "NEWDROP" → DM with latest collection

## Timeline

- Days 1-2: Meta app + webhook + auto-reply engine ✅
- Days 3-4: Dashboard (inbox, rules, editor) ✅
- Days 5-6: Shopify integration + analytics ✅
- Day 7: Polish, test with real DMs, deploy
