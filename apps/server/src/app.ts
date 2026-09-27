/**
 * @file apps/server/src/app.ts
 * Express API server handling Deliverect Generic Picking webhooks,
 * Outbox orchestration, Altie AI routes, and picker endpoints.
 */

import express, { Request, Response, NextFunction } from 'express';
import { globalStore } from './store.js';
import { hashRawBody, verifyDeliverectHmac } from './crypto.js';
import { DeliverectClient } from './deliverectClient.js';
import { OutboxWorker } from './outbox.js';
import { altie } from './altie.js';
import {
  PickingOrder,
  PickingItem,
  OrderLifecycleWebhook,
  UpdateOrderItemAction,
  PickerUser
} from '../../../packages/contracts/src/index.js';
import { MockDeliverectServer } from '../../../packages/mock-deliverect/src/index.js';
import { createSampleGroceryOrders } from '../../../packages/mock-deliverect/src/orders.js';
import request from 'supertest';

export interface AppServerOptions {
  mockDeliverect?: MockDeliverectServer;
  deliverectClient?: DeliverectClient;
  hmacHeader?: string;
  defaultHmacSecret?: string;
}

export function createApp(options: AppServerOptions = {}) {
  const app = express();

  // Create or reuse Mock Deliverect Server
  const mockDeliverect = options.mockDeliverect || new MockDeliverectServer();

  // Create Deliverect client pointing to mock or env URL
  const deliverectClient =
    options.deliverectClient ||
    new DeliverectClient({
      baseUrl: process.env.DELIVERECT_BASE_URL || 'http://localhost:3000/mock-deliverect',
      clientId: process.env.OAUTH_CLIENT_ID || 'ltx-picker-client-id',
      clientSecret: process.env.OAUTH_CLIENT_SECRET || 'ltx-picker-secret-key',
      fetchHandler: async (url: string, init: any) => {
        if (url.includes('/mock-deliverect') || url.startsWith('http://localhost:3000/mock-deliverect')) {
          const parsed = new URL(url);
          const subPath = parsed.pathname.replace(/^\/mock-deliverect/, '') + parsed.search;
          const method = (init?.method || 'GET').toLowerCase();
          const reqBuilder = (request(mockDeliverect.app) as any)[method](subPath);
          if (init?.headers) {
            for (const [k, v] of Object.entries(init.headers)) {
              reqBuilder.set(k, v as string);
            }
          }
          if (init?.body) {
            reqBuilder.send(typeof init.body === 'string' ? JSON.parse(init.body) : init.body);
          }
          const resp = await reqBuilder;
          return new globalThis.Response(JSON.stringify(resp.body), {
            status: resp.status,
            headers: { 'content-type': 'application/json' },
          });
        }
        return fetch(url, init);
      },
    });

  const outboxWorker = new OutboxWorker(deliverectClient);
  outboxWorker.startBackgroundWorker(1500);

  const preferredHmacHeader = options.hmacHeader || process.env.HMAC_HEADER || 'x-deliverect-hmac-sha256';

  // Mount Mock Deliverect endpoints directly on /mock-deliverect for zero-config local simulation
  app.use('/mock-deliverect', mockDeliverect.app);

  // Preserve raw body for HMAC verification and sha256 deduplication
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf.toString('utf8');
      },
    })
  );

  // -------------------------------------------------------------
  // 1. INBOUND DELIVERECT WEBHOOKS
  // -------------------------------------------------------------

  /**
   * POST /picking/order
   * Inbound new retail order to pick (status SCHEDULED, pickerStatus NOT_STARTED).
   * Tolerant parser: _id, location, channelOrderId, channelOrderDisplayId, pickupTime/deliveryTime,
   * orderType, customer {name, phone?}, note, items.
   * HMAC verification + sha256(raw body) deduplication + fast 200 response.
   */
  app.post('/picking/order', (req: Request, res: Response) => {
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const bodyHash = hashRawBody(rawBody);

    // 1. Check deduplication first
    const isDuplicate = globalStore.checkAndRecordWebhookHash(bodyHash, req.body?._id);
    if (isDuplicate) {
      return res.status(200).json({
        status: 'ignored_duplicate',
        message: 'Order webhook already processed (sha256 match)',
        hash: bodyHash,
      });
    }

    // 2. Determine secret for location (staging often = locationId, or configured secret)
    const locationId = req.body?.location || 'loc_london_flagship';
    const secret =
      process.env.HMAC_SECRET ||
      globalStore.getHmacSecret(locationId) ||
      locationId;

    // 3. Verify HMAC (if HMAC headers are present or in strict verification mode)
    const hasHmacHeader =
      req.headers[preferredHmacHeader.toLowerCase()] ||
      req.headers['x-server-authorization-hmac-sha256'];

    if (hasHmacHeader) {
      const hmacResult = verifyDeliverectHmac(rawBody, req.headers, secret, preferredHmacHeader);
      if (!hmacResult.isValid) {
        return res.status(401).json({
          error: 'Unauthorized: Invalid HMAC signature',
          details: hmacResult.error,
        });
      }
    }

    // 4. Respond 200 fast to Deliverect
    res.status(200).json({
      status: 'received',
      orderId: req.body?._id,
      hash: bodyHash,
      message: 'Order received and queued for asynchronous processing',
    });

    // 5. Asynchronous tolerant parser and order enrichment
    setImmediate(() => {
      try {
        const raw = req.body || {};
        const orderId = raw._id || 'ord_' + Math.random().toString(36).substring(2, 9);
        const pickupTime = raw.pickupTime || raw.deliveryTime || new Date(Date.now() + 30 * 60 * 1000).toISOString();
        const dueAt = pickupTime;

        // Tolerant item parser
        const rawItems: any[] = Array.isArray(raw.items) ? raw.items : [];
        const parsedItems: PickingItem[] = rawItems.map((item: any, idx: number) => {
          return {
            _id: item._id || `item_${orderId}_${idx + 1}`,
            plu: String(item.plu || ''),
            name: String(item.name || 'Unnamed Grocery Item'),
            quantity: typeof item.quantity === 'number' ? item.quantity : 1,
            price: typeof item.price === 'number' ? item.price : 0,
            channelItemId: item.channelItemId,
            gtin: Array.isArray(item.gtin) ? item.gtin.map(String) : [],
            subItems: Array.isArray(item.subItems) ? item.subItems : [],
            modifiers: Array.isArray(item.modifiers) ? item.modifiers : [],
            itemUnavailableActions: Array.isArray(item.itemUnavailableActions)
              ? item.itemUnavailableActions
              : undefined, // absent field will trigger warning in UI
            department: item.department || 'General Grocery',
            aisle: item.aisle || `Aisle ${(idx % 5) + 1}`,
            shelf: item.shelf || 'Bay 1',
            sequence: idx + 1,
            temperature: item.temperature || 'AMBIENT',
            isWeight: !!item.isWeight,
            weightUnit: item.weightUnit || 'kg',
            expectedWeight: item.expectedWeight,
            ageRestricted: !!item.ageRestricted,
            minimumAge: item.minimumAge,
            imageUrl: item.imageUrl,
            status: 'PENDING',
          };
        });

        // Altie route optimization (Ambient -> Chilled -> Frozen, by aisle)
        const sequenced = altie.optimizePickingRoute(parsedItems);

        const order: PickingOrder = {
          _id: orderId,
          location: String(raw.location || 'loc_london_flagship'),
          channelOrderId: String(raw.channelOrderId || 'CH-' + Math.floor(100000 + Math.random() * 900000)),
          channelOrderDisplayId: String(raw.channelOrderDisplayId || '#ORD-' + orderId.slice(-4).toUpperCase()),
          pickupTime: raw.pickupTime,
          deliveryTime: raw.deliveryTime,
          orderType: raw.orderType || 'DELIVERY',
          customer: {
            name: raw.customer?.name || 'Customer',
            phone: raw.customer?.phone,
            email: raw.customer?.email,
          },
          note: raw.note,
          items: sequenced.sortedItems,
          status: raw.status || 'SCHEDULED',
          pickerStatus: 'NOT_STARTED',
          receivedAt: new Date().toISOString(),
          dueAt,
          slaStatus: altie.calculateSlaStatus(dueAt).status,
          rawPayload: raw,
        };

        globalStore.saveOrder(order, raw);
        globalStore.addAuditLog(order._id, 'INBOUND_WEBHOOK', 'New order parsed and queued', {
          itemCount: order.items.length,
          slaStatus: order.slaStatus,
          altieSummary: sequenced.pathSummary,
        });
      } catch (err: any) {
        console.error('Error during async webhook order parsing:', err);
      }
    });
  });

  /**
   * POST /picking/order/:orderId/update
   * Lifecycle events: CUSTOMER_APPROVAL_SUBSTITUTION | PARTNER_DONE_SUCCESSFUL | PARTNER_UPDATE_FAILED
   * Unknown types are stored and NOT rejected.
   */
  app.post('/picking/order/:orderId/update', (req: Request, res: Response) => {
    const { orderId } = req.params;
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    // Optional HMAC check if header sent
    const hasHmac =
      req.headers[preferredHmacHeader.toLowerCase()] ||
      req.headers['x-server-authorization-hmac-sha256'];

    if (hasHmac) {
      const order = globalStore.getOrder(orderId);
      const secret = order?.location
        ? globalStore.getHmacSecret(order.location)
        : process.env.HMAC_SECRET || 'loc_london_flagship';

      const hmacResult = verifyDeliverectHmac(rawBody, req.headers, secret, preferredHmacHeader);
      if (!hmacResult.isValid) {
        return res.status(401).json({ error: 'Invalid HMAC on update webhook' });
      }
    }

    const event: OrderLifecycleWebhook = {
      eventType: req.body?.eventType || 'UNKNOWN_EVENT',
      orderId,
      timestamp: req.body?.timestamp || new Date().toISOString(),
      location: req.body?.location,
      details: req.body?.details || req.body,
      rawPayload: req.body,
    };

    // Store event (never reject unknown events)
    globalStore.recordLifecycleEvent(event);

    res.status(200).json({
      status: 'received',
      orderId,
      eventType: event.eventType,
      message: 'Lifecycle event registered',
    });
  });

  // -------------------------------------------------------------
  // 2. PICKER APPLICATION API
  // -------------------------------------------------------------

  // List stores
  app.get('/api/stores', (_req: Request, res: Response) => {
    res.json({ stores: Array.from(globalStore.stores.values()) });
  });

  // List orders
  app.get('/api/orders', (req: Request, res: Response) => {
    const location = req.query.location as string;
    const status = req.query.status as string;
    const orders = globalStore.listOrders(location, status);

    // Refresh dynamic SLA status
    const enriched = orders.map((o) => ({
      ...o,
      slaStatus: altie.calculateSlaStatus(o.dueAt).status,
      minutesRemaining: altie.calculateSlaStatus(o.dueAt).minutesRemaining,
    }));

    res.json({ orders: enriched });
  });

  // Get single order detail
  app.get('/api/orders/:id', (req: Request, res: Response) => {
    const order = globalStore.getOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const sla = altie.calculateSlaStatus(order.dueAt);
    res.json({
      order: {
        ...order,
        slaStatus: sla.status,
        slaDetails: sla,
      },
      rawPayload: globalStore.getRawPayload(order._id),
      auditLogs: globalStore.getAuditLogs(order._id),
    });
  });

  // Start picking an order
  app.post('/api/orders/:id/start', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { pickerName, pickerId } = req.body || {};
    const order = globalStore.getOrder(id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Update order state
    globalStore.updateOrder(id, {
      pickerStatus: 'IN_PROGRESS',
      startedAt: order.startedAt || new Date().toISOString(),
      assignedPickerId: pickerId || 'staff_01',
      assignedPickerName: pickerName || 'Staff Member',
    });

    globalStore.addAuditLog(id, pickerName || 'Staff', 'Started picking order');

    // Queue outbound start call in outbox
    const outboxRecord = await outboxWorker.enqueue(
      id,
      undefined,
      'START',
      `/picking/order/${encodeURIComponent(id)}/start`,
      'POST',
      {}
    );

    res.json({
      status: 'success',
      orderId: id,
      pickerStatus: 'IN_PROGRESS',
      outboxRecord,
    });
  });

  // Single item pick
  app.post('/api/orders/:id/items/:itemId/pick', async (req: Request, res: Response) => {
    const { id, itemId } = req.params;
    const { pickedWeight, notes, pickerName } = req.body || {};
    const order = globalStore.getOrder(id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const item = order.items.find((i) => i._id === itemId);
    if (!item) return res.status(404).json({ error: 'Item not found in order' });

    item.status = 'PICKED';
    item.pickedQuantity = item.quantity;
    if (typeof pickedWeight === 'number') {
      item.pickedWeight = pickedWeight;
    }
    item.pickedAt = new Date().toISOString();
    item.pickedBy = pickerName || 'Picker';
    item.notes = notes;
    item.syncState = 'PENDING';

    globalStore.updateOrder(id, { items: [...order.items] });
    globalStore.addAuditLog(id, pickerName || 'Picker', `Picked item: ${item.name}`, {
      plu: item.plu,
      quantity: item.quantity,
      pickedWeight,
    });

    // Enqueue outbound pick call
    const outboxRecord = await outboxWorker.enqueue(
      id,
      itemId,
      'PICK',
      `/picking/order/${encodeURIComponent(id)}/item/${encodeURIComponent(itemId)}/pick`,
      'POST',
      {
        pickedWeight,
        isSubItem: false,
        timestamp: item.pickedAt,
        location: order.location,
        notes,
      }
    );

    res.json({
      status: 'success',
      item,
      outboxRecord,
    });
  });

  // Get suggested substitutes for an item
  app.get('/api/orders/:id/items/:itemId/substitutes', async (req: Request, res: Response) => {
    const { id, itemId } = req.params;
    const reason = (req.query.reason as string) || 'OUT_OF_STOCK';

    try {
      const resp = await deliverectClient.suggestSubstitute(id, itemId, reason);
      res.json(resp.data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Batch update mutations: POST /api/orders/:id/batch-update
  app.post('/api/orders/:id/batch-update', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { updates, callbackUrl, pickerName } = req.body as {
      updates: UpdateOrderItemAction[];
      callbackUrl?: string;
      pickerName?: string;
    };

    const order = globalStore.getOrder(id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'Updates must be a non-empty array' });
    }

    // Apply local updates to items
    for (const update of updates) {
      const item = order.items.find((i) => i._id === update.itemId);
      if (!item) continue;

      if (update.action === 'ADJUST') {
        const newQty = update.properties?.quantity;
        if (typeof newQty === 'number') {
          item.quantity = newQty;
          item.status = newQty === 0 ? 'REMOVED' : 'PENDING';
          globalStore.addAuditLog(id, pickerName || 'Picker', `Adjusted quantity of ${item.name} to ${newQty}`, {
            reason: update.reason,
          });
        }
      } else if (update.action === 'REPLACE') {
        const rep = update.properties?.replaceItem;
        if (rep) {
          item.status = 'REPLACED';
          item.replacement = {
            plu: rep.plu,
            name: rep.name || 'Substituted Item',
            price: rep.price || item.price,
            quantity: rep.quantity || item.quantity,
            reason: update.reason || 'OUT_OF_STOCK',
            subItems: rep.subItems,
            itemId: rep.itemId,
          };
          globalStore.addAuditLog(id, pickerName || 'Picker', `Replaced ${item.name} with ${rep.name || rep.plu}`, {
            plu: rep.plu,
            reason: update.reason,
          });
        }
      } else if (update.action === 'REMOVE') {
        item.status = 'REMOVED';
        item.removalReason = (update.reason as any) || 'OUT_OF_STOCK';
        globalStore.addAuditLog(id, pickerName || 'Picker', `Removed ${item.name}`, {
          reason: update.reason,
        });
      } else if (update.action === 'PICK') {
        item.status = 'PICKED';
        if (typeof update.properties?.pickedWeight === 'number') {
          item.pickedWeight = update.properties.pickedWeight;
        }
      }
      item.syncState = 'SYNCED';
    }

    globalStore.updateOrder(id, { items: [...order.items] });

    // Enqueue outbound updateOrderItems in outbox
    const outboxRecord = await outboxWorker.enqueue(
      id,
      undefined,
      'UPDATE_ORDER_ITEMS',
      `/picking/order/${encodeURIComponent(id)}/updateOrderItems`,
      'POST',
      {
        callbackUrl: callbackUrl || process.env.ORDER_WEBHOOK_PUBLIC_URL || 'http://localhost:3000/picking/order/' + id + '/update',
        updates,
      }
    );

    res.json({
      status: 'acknowledged',
      orderId: id,
      updatesApplied: updates.length,
      outboxRecord,
    });
  });

  // Finish order
  app.post('/api/orders/:id/finish', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { courierCount, courierNotes, pickerName } = req.body || {};
    const order = globalStore.getOrder(id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Update order
    globalStore.updateOrder(id, {
      pickerStatus: 'COMPLETED',
      completedAt: new Date().toISOString(),
      courierCount: typeof courierCount === 'number' ? courierCount : order.courierCount,
      courierNotes: courierNotes || order.courierNotes,
    });

    globalStore.addAuditLog(id, pickerName || 'Picker', 'Completed order picking', {
      courierCount,
    });

    // Enqueue courier update if provided
    if (typeof courierCount === 'number') {
      await outboxWorker.enqueue(
        id,
        undefined,
        'COURIERS',
        `/picking/order/${encodeURIComponent(id)}/couriers`,
        'POST',
        { count: courierCount, reason: courierNotes, updatedBy: pickerName || 'Picker' }
      );
    }

    // Enqueue done call
    const outboxRecord = await outboxWorker.enqueue(
      id,
      undefined,
      'DONE',
      `/picking/order/${encodeURIComponent(id)}/done`,
      'POST',
      {}
    );

    res.json({
      status: 'success',
      orderId: id,
      pickerStatus: 'COMPLETED',
      outboxRecord,
    });
  });

  // Reject order
  app.post('/api/orders/:id/reject', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { reason, reasonType, pickerName } = req.body || {};
    const order = globalStore.getOrder(id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    globalStore.updateOrder(id, {
      pickerStatus: 'REJECTED',
    });

    globalStore.addAuditLog(id, pickerName || 'Picker', `Rejected order: ${reason}`, {
      reasonType,
    });

    const outboxRecord = await outboxWorker.enqueue(
      id,
      undefined,
      'REJECT',
      `/picking/order/${encodeURIComponent(id)}/reject`,
      'POST',
      {
        location: order.location,
        reason: reason || 'Customer requested cancellation or missing critical items',
        reasonType: reasonType || 'STORE_CANCEL',
      }
    );

    res.json({
      status: 'success',
      orderId: id,
      pickerStatus: 'REJECTED',
      outboxRecord,
    });
  });

  // Update couriers count
  app.post('/api/orders/:id/couriers', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { count, reason, updatedBy } = req.body || {};

    if (typeof count !== 'number' || count < 0) {
      return res.status(412).json({
        error: 'Precondition Failed: courier count must be non-negative',
      });
    }

    const order = globalStore.getOrder(id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    globalStore.updateOrder(id, { courierCount: count });

    const outboxRecord = await outboxWorker.enqueue(
      id,
      undefined,
      'COURIERS',
      `/picking/order/${encodeURIComponent(id)}/couriers`,
      'POST',
      { count, reason, updatedBy }
    );

    res.json({
      status: 'success',
      courierCount: count,
      outboxRecord,
    });
  });

  // Altie AI Photo Recognition
  app.post('/api/altie/photo-recognize', async (req: Request, res: Response) => {
    const { imageBase64, orderId } = req.body || {};
    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64' });
    }

    const order = orderId ? globalStore.getOrder(orderId) : undefined;
    const candidates = order ? order.items : [];

    const result = await altie.identifyProductFromPhoto(imageBase64, candidates);
    res.json({ result });
  });

  // Outbox inspection endpoint
  app.get('/api/outbox', (_req: Request, res: Response) => {
    res.json({ records: outboxWorker.getAllRecords() });
  });

  // Audit logs endpoint
  app.get('/api/audit-logs', (req: Request, res: Response) => {
    const orderId = req.query.orderId as string;
    res.json({ logs: globalStore.getAuditLogs(orderId) });
  });

  // Picker presence & team
  app.post('/api/picker/presence', (req: Request, res: Response) => {
    const picker = req.body as PickerUser;
    if (!picker.id) return res.status(400).json({ error: 'Missing picker id' });
    globalStore.updatePickerPresence(picker);
    res.json({ status: 'ok', activePickers: globalStore.getActivePickers() });
  });

  app.get('/api/picker/team', (_req: Request, res: Response) => {
    res.json({ activePickers: globalStore.getActivePickers() });
  });

  // Metrics
  app.get('/api/metrics', (_req: Request, res: Response) => {
    res.json({ metrics: globalStore.metrics });
  });

  // Server-Sent Events (SSE) for live multi-picker & order sync
  app.get('/api/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const onOrderCreated = (order: any) => sendEvent('order:created', order);
    const onOrderUpdated = (order: any) => sendEvent('order:updated', order);
    const onOutbox = (record: any) => sendEvent('outbox:record', record);
    const onPresence = (pickers: any) => sendEvent('picker:presence', pickers);

    globalStore.on('order:created', onOrderCreated);
    globalStore.on('order:updated', onOrderUpdated);
    globalStore.on('outbox:record', onOutbox);
    globalStore.on('picker:presence', onPresence);

    // Initial heartbeat
    sendEvent('connected', { timestamp: new Date().toISOString() });

    req.on('close', () => {
      globalStore.off('order:created', onOrderCreated);
      globalStore.off('order:updated', onOrderUpdated);
      globalStore.off('outbox:record', onOutbox);
      globalStore.off('picker:presence', onPresence);
    });
  });

  // Simulator helper: Seed sample orders
  app.post('/api/simulator/seed', (req: Request, res: Response) => {
    const location = (req.body?.location as string) || 'loc_london_flagship';
    const sampleOrders = createSampleGroceryOrders(location);

    for (const ord of sampleOrders) {
      globalStore.saveOrder(ord, ord);
    }

    res.json({
      status: 'seeded',
      count: sampleOrders.length,
      orders: sampleOrders,
    });
  });

  /**
   * POST /api/david-victor/order & POST /picking/order/david-victor
   * Ingest orders from David Victor ordering system (github.com/djl88/david-victor).
   * Maps customer, items, and quantities into Deliverect Generic Picking schema,
   * runs Altie AI flow sequencing & cold-chain categorization, and emits SSE alert.
   */
  const handleDavidVictorOrder = (req: Request, res: Response) => {
    try {
      const raw = req.body || {};
      const orderId = raw._id || 'dv_ord_' + Math.random().toString(36).substring(2, 9);
      const now = Date.now();
      const pickupTime = raw.pickupTime || new Date(now + 25 * 60 * 1000).toISOString();

      const rawItems: any[] = Array.isArray(raw.items) ? raw.items : [];
      const parsedItems: PickingItem[] = rawItems.map((item: any, idx: number) => {
        return {
          _id: item._id || `dv_item_${orderId}_${idx + 1}`,
          plu: String(item.plu || Math.floor(100000 + Math.random() * 900000)),
          name: String(item.name || 'David Victor Specialty Item'),
          quantity: typeof item.quantity === 'number' ? item.quantity : 1,
          price: typeof item.price === 'number' ? item.price : 299,
          channelItemId: item.channelItemId || `dv_ch_${idx + 1}`,
          gtin: Array.isArray(item.gtin) ? item.gtin.map(String) : [String(item.plu || '5060999' + idx)],
          subItems: Array.isArray(item.subItems) ? item.subItems : [],
          modifiers: Array.isArray(item.modifiers) ? item.modifiers : [],
          itemUnavailableActions: Array.isArray(item.itemUnavailableActions)
            ? item.itemUnavailableActions
            : ['ITEM_AMENDMENT', 'ITEM_SUBSTITUTION', 'ITEM_REMOVE'],
          department: item.department || 'Specialty & Bakery',
          aisle: item.aisle || `Aisle ${(idx % 4) + 1}`,
          shelf: item.shelf || `Bay ${(idx % 3) + 1}`,
          temperature: item.temperature || (idx % 3 === 0 ? 'CHILLED' : 'AMBIENT'),
          isWeight: Boolean(item.isWeight),
          expectedWeight: item.expectedWeight,
          minWeight: item.minWeight,
          maxWeight: item.maxWeight,
          ageRestricted: Boolean(item.ageRestricted),
          imageUrl: item.imageUrl,
          status: 'PENDING',
          pickedQuantity: 0,
        };
      });

      const order: PickingOrder = {
        _id: orderId,
        location: raw.location || 'loc_london_flagship',
        channelOrderId: raw.channelOrderId || `DV-${Math.floor(100000 + Math.random() * 900000)}`,
        channelOrderDisplayId: raw.channelOrderDisplayId || `#DV-${Math.floor(1000 + Math.random() * 9000)}`,
        pickupTime,
        deliveryTime: raw.deliveryTime || new Date(now + 45 * 60 * 1000).toISOString(),
        orderType: raw.orderType || 'DELIVERY',
        customer: {
          name: raw.customer?.name || 'David Leitch (David Victor)',
          phone: raw.customer?.phone || '+44 7700 900888',
          email: raw.customer?.email || 'david@david-victor.com',
        },
        note: raw.note || 'Order placed via David Victor Store (github.com/djl88/david-victor). Fragile artisanal goods.',
        status: 'SCHEDULED',
        pickerStatus: 'NOT_STARTED',
        receivedAt: new Date(now).toISOString(),
        dueAt: pickupTime,
        items: parsedItems,
        metadata: {
          source: 'djl88/david-victor',
          originalPayload: raw,
        },
      };

      // Altie cold chain & walking sequencing
      const routeResult = altie.optimizePickingRoute(order.items);
      order.items = routeResult.sortedItems;

      // Save order and record audit log
      globalStore.saveOrder(order, raw);
      globalStore.addAuditLog(order._id, 'David Victor Store', 'Received retail order from djl88/david-victor', {
        channelOrderId: order.channelOrderId,
        itemCount: order.items.length,
      });

      res.status(200).json({
        status: 'success',
        orderId: order._id,
        channelOrderDisplayId: order.channelOrderDisplayId,
        message: 'Order received from David Victor and sequenced by Altie AI',
        order,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to process David Victor order', details: err.message });
    }
  };

  app.post('/api/david-victor/order', handleDavidVictorOrder);
  app.post('/picking/order/david-victor', handleDavidVictorOrder);

  // Simulator helper: Emit simulated webhook
  app.post('/api/simulator/emit-webhook', (req: Request, res: Response) => {
    const { order, tamperHmac } = req.body || {};
    const sample = order || createSampleGroceryOrders()[0];
    sample._id = 'sim_' + Math.random().toString(36).substring(2, 9);

    const rawBody = JSON.stringify(sample);
    const location = sample.location || 'loc_london_flagship';
    const secret = tamperHmac ? 'wrong_secret' : globalStore.getHmacSecret(location);
    const headers = mockDeliverect.getWebhookHeaders(rawBody, secret);

    // Verify internally or return headers for testing
    res.json({
      status: 'prepared',
      headers,
      sampleOrder: sample,
    });
  });

  return { app, outboxWorker, mockDeliverect, deliverectClient };
}
