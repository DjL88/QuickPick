# LTx Picker

> **Fun, standalone retail picking application compatible with Deliverect's Generic Picking API**, built as a high-performance mobile-first Progressive Web App (PWA) with **Altie AI** cold-chain route sequencing, multi-modal barcode & photo picking, and non-idempotent outbox guarantees.

---

## 🛒 Architecture Overview

LTx Picker replaces Deliverect Quest with an Android-optimized, staff-focused experience:

```
                  ┌───────────────────────────────────────────────┐
                  │          Deliverect Picking Ecosystem         │
                  └───────┬───────────────────────────────▲───────┘
                          │ Inbound Webhooks              │ Outbound Mutations
                          │ (Signed HMAC-SHA256)          │ (OAuth2 Bearer Token)
                          ▼                               │
               ┌──────────────────────┐         ┌─────────┴─────────┐
               │ /picking/order       │         │ Outbox Worker     │
               │ /order/:id/update    │         │ (2xx Freeze,      │
               └──────────┬───────────┘         │  5xx/429 Backoff) │
                          │                     └─────────▲─────────┘
                          │ Async Parsing &               │
                          ▼ SHA256 Dedupe                 │
               ┌──────────────────────────────────────────┴─────────┐
               │               apps/server (Node/Express)           │
               │   • HMAC Verification (constant-time)              │
               │   • Altie AI Cold-Chain Flow Optimizer             │
               │   • Server-Sent Events (SSE) Live Sync             │
               │   • Local Deliverect Mock Simulator Integration    │
               └──────────────────────────┬─────────────────────────┘
                                          │
                                          │ Live Events & REST API
                                          ▼
               ┌────────────────────────────────────────────────────┐
               │            apps/picker (React + Vite PWA)          │
               │   • Mobile-First Android Material 3 Aesthetic      │
               │   • Tinder-Style Swipe-to-Pick or Sequenced List   │
               │   • Laser Scanner + Camera Barcode + Altie Photo   │
               │   • itemUnavailableActions Policy Matrix Enforcer  │
               │   • IndexedDB Offline Queue & Background Sync      │
               └────────────────────────────────────────────────────┘
```

### Monorepo Structure

- **`packages/contracts`**: Pure TypeScript contracts for Deliverect picking payloads, webhooks, outbox mutations, and staff presence.
- **`packages/mock-deliverect`**: Standalone mock server simulating Deliverect Generic Picking endpoints, OAuth2 tokens, signed HMAC webhooks, and chaos monkey (429/500/latency).
- **`apps/server`**: Node/Express full-stack backend handling inbound webhooks, SHA-256 deduplication, HMAC checking, reliable Outbox queue, and Altie AI product recognition.
- **`src` (`apps/picker`)**: Mobile-first React 19 PWA with Tinder-style swipe cards, laser/camera barcode scanning, Altie AI vision, and offline IndexedDB queue.
- **`tests`**: Vitest + Supertest suite covering HMAC validation, deduplication, outbox retry guarantees, happy path, and action matrix rules.

---

## ⚙️ Environment Variables

Configure these in `.env` (refer to `.env.example`):

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | Local server port | `3000` |
| `DELIVERECT_BASE_URL` | Deliverect outbound API base URL | `https://api.staging.deliverect.io` or `http://localhost:3000/mock-deliverect` |
| `OAUTH_CLIENT_ID` | OAuth2 Client ID for Generic Picking | `ltx-picker-client-id` |
| `OAUTH_CLIENT_SECRET` | OAuth2 Client Secret | `ltx-picker-secret-key` |
| `OAUTH_AUDIENCE` | OAuth2 audience parameter (if required by tenant) | `https://api.deliverect.io` |
| `HMAC_HEADER` | Primary header for inbound webhook HMAC signature | `x-deliverect-hmac-sha256` *(also accepts `x-server-authorization-hmac-sha256`)* |
| `HMAC_SECRET` | Global fallback HMAC secret | `loc_london_flagship` |
| `ORDER_WEBHOOK_PUBLIC_URL`| Public callback URL for `/updateOrderItems` callback | `http://localhost:3000/picking/order/{id}/update` |
| `GEMINI_API_KEY` | Google Gemini API key for Altie AI vision product recognition | Injected by AI Studio |

---

## 📝 Deliverect Contract Assumptions & Configurable Fields

Because Deliverect implementations vary across retail staging tenants, LTx Picker keeps every uncertain field tolerant and configurable:

1. **HMAC Header Flexibility**:
   - Default header: `X-Deliverect-Hmac-Sha256` (case-insensitive).
   - Alternate header automatically accepted: `x-server-authorization-hmac-sha256`.
   - Algorithm: Hex encoded HMAC-SHA256 computed on the exact byte sequence of the raw HTTP request body.
2. **Per-Location HMAC Secrets**:
   - Deliverect often configures distinct secrets per retail store location.
   - If no per-store secret is registered, LTx Picker defaults to using `locationId` (Deliverect's standard staging convention).
3. **Webhook Deduplication**:
   - The inbound webhook endpoint hashes the raw body using `sha256(rawBody)`.
   - Subsequent arrivals with identical hashes respond with `200 OK` fast (`status: "ignored_duplicate"`) without duplicating order state.
4. **Outbound Non-Idempotent Protection**:
   - Outbound mutations are strictly non-idempotent.
   - Every mutation is assigned an idempotency key: `orderId + ':' + (itemId || 'order') + ':' + action + ':' + sha256(payload)`.
   - **2xx Freeze**: Once a mutation receives a 2xx from Deliverect, it is frozen in `SENT` state and will **never** be re-transmitted.
   - **Retry Policy**: 5xx server errors and 429 rate limits are retried with exponential backoff and jitter up to 5 attempts. 4xx client errors (400, 404, 412) are marked terminal and presented to the picker.
5. **Rules from `itemUnavailableActions` Matrix**:
   - `ITEM_AMENDMENT`: Picker may adjust item quantity.
   - `ITEM_REMOVE`: Picker may remove item with reason (`OUT_OF_STOCK`, `DAMAGED`, `EXPIRED`, `CUSTOMER_REQUEST`).
   - `ITEM_SUBSTITUTION` / `ITEM_SUBSTITUTION_CATALOG`: Picker may substitute item via suggested matches or catalog search.
   - `CANCEL_ORDER`: If a critical item is missing, the picker is offered the option to reject/cancel the entire order.
   - **Absent Field Policy**: If Deliverect omits `itemUnavailableActions`, LTx Picker allows adjust/remove/replace but displays an amber warning banner. When replacement is explicitly disallowed, substitution actions are disabled.
6. **Delivery Courier Assignment**:
   - `POST /picking/order/{orderId}/couriers` requires non-negative count (`>= 0`). A negative count triggers HTTP 412 (Precondition Failed).

---

## 🚀 Running the App & Mock Simulator

### Start Development Server
```bash
npm run dev
```
Runs the Express full-stack server and mounts Vite PWA middleware on `http://localhost:3000`.

### Run Automated Tests
```bash
npm test
```
Executes vitest test suite covering:
- Inbound HMAC verification (valid vs invalid vs custom header)
- SHA-256 webhook deduplication
- Outbox 2xx freeze & 5xx/429 retry backoff
- Full happy path flow (Start → Pick → Replace → Adjust → Couriers → Done)
- Allowed actions policy matrix

### Using the Deliverect Test Harness
Tap the **Simulator** button in the top navigation bar to:
1. **Inject Retail Orders**: Push realistic orders with weighted produce, age-restricted drinks, and mixed cold-chain categories.
2. **Test Deduplication**: Send duplicate payloads to verify instant 200 deduplication.
3. **Trigger Chaos Monkey**: Toggle HTTP 429 rate limiting or 500 server errors to watch the Outbox handle backoff in real time.
4. **Inspect Outbox**: View live mutation records, idempotency keys, and Deliverect acknowledgements.
5. **Flush Offline Queue**: Sync IndexedDB mutations queued while offline.

---

## 📦 Multi-Quantity Step-by-Step Declaration

For retail accuracy, orders with item quantities greater than 1 (`quantity > 1`):
- **Step-by-Step Declaration**: Pickers must declare or scan each unit individually (e.g. 3 loaves of sourdough requires 3 scans or 3 swipe-picks).
- **Tactile & Auditory Progression**: Each unit scanned plays an ascending pitch tone (`playUnitScanStep`) and triggers mobile haptic vibration (`navigator.vibrate(35)`).
- **Clear Visual Feedback**: Large, unmistakable `QTY: X` badges with live unit progress pills (`[✓ Unit 1] [✓ Unit 2] [○ Unit 3]`) display remaining units.
- **Bulk Override**: Staff can select "Declare All" when bulk scanning pallets or cartons.

---

## 🍕 Companion Ordering Project: `github.com/djl88/david-victor`

LTx Picker includes built-in support for customer orders originating from the companion ordering repo [`djl88/david-victor`](https://github.com/djl88/david-victor):
- **In-App Storefront**: Tap **"DV Store"** in the navigation bar to configure and place orders directly into the picking queue.
- **Direct Webhook Ingestion**: External orders from `djl88/david-victor` can be posted directly to:
  ```
  POST /api/david-victor/order
  POST /picking/order/david-victor
  ```
- **Automatic Sequence**: Incoming orders are automatically routed through Altie AI for cold-chain sequencing (Ambient → Chilled → Frozen) and trigger real-time audio and push alerts to active store pickers.

---

## 📱 Android-Centric Design & Enterprise Scanner Ergonomics

Designed specifically around Android mobile devices and enterprise handheld terminals:
- **Zebra TC57 / Honeywell CT40 Support**: Hardware keystroke listeners capture laser scanner input with normalization of leading zeros and EAN-13/UPC-A parity checks.
- **Android Device View Mode**: Tap the **"Android View"** toggle in the header on desktop browsers to simulate an Android enterprise handheld device with status bar, front camera punch-hole, and navigation gesture bar.
- **Android PWA Manifest**: Includes maskable 192x192 and 512x512 icons, theme color `#0d3944`, and full offline IndexedDB mutation sync.

