/**
 * @file apps/server/src/store.ts
 * In-memory state store with deduplication, audit trails, and pub/sub.
 */

import { EventEmitter } from 'events';
import {
  PickingOrder,
  OrderLifecycleWebhook,
  AuditLogEntry,
  PickerUser,
  StoreLocation,
  PickerMetrics,
  OutboxRecord
} from '../../../packages/contracts/src/index.js';

export interface WebhookDedupeRecord {
  hash: string;
  orderId?: string;
  receivedAt: string;
}

export class OrderStore extends EventEmitter {
  public orders = new Map<string, PickingOrder>();
  public rawWebhookPayloads = new Map<string, any>();
  public processedWebhookHashes = new Map<string, WebhookDedupeRecord>();
  public lifecycleEvents: OrderLifecycleWebhook[] = [];
  public auditLogs: AuditLogEntry[] = [];
  public outboxRecords = new Map<string, OutboxRecord>();
  public activePickers = new Map<string, PickerUser>();
  public stores = new Map<string, StoreLocation>();

  // Configurable HMAC secrets per location
  public locationSecrets = new Map<string, string>();

  // Metrics
  public metrics: PickerMetrics = {
    ordersCompleted: 0,
    unitsPicked: 0,
    uph: 82, // Base starting UPH
    avgPickSecondsPerItem: 24,
    substitutionRate: 4.2,
    removalRate: 1.8,
  };

  constructor() {
    super();
    this.initDefaultStores();
  }

  private initDefaultStores() {
    const defaultStores: StoreLocation[] = [
      {
        id: 'loc_london_flagship',
        name: 'LTx Retail - London Flagship',
        address: '142 Oxford St, London W1D 1LU',
        hmacSecret: 'loc_london_flagship',
      },
      {
        id: 'loc_manchester_hub',
        name: 'LTx Retail - Manchester Hub',
        address: '88 Deansgate, Manchester M3 2ER',
        hmacSecret: 'loc_manchester_hub',
      },
      {
        id: 'loc_edinburgh_express',
        name: 'LTx Retail - Edinburgh Express',
        address: '24 Princes St, Edinburgh EH2 2AN',
        hmacSecret: 'loc_edinburgh_express',
      },
    ];

    for (const store of defaultStores) {
      this.stores.set(store.id, store);
      this.locationSecrets.set(store.id, store.hmacSecret);
    }
  }

  public getHmacSecret(locationId: string): string {
    return this.locationSecrets.get(locationId) || locationId;
  }

  public setHmacSecret(locationId: string, secret: string) {
    this.locationSecrets.set(locationId, secret);
  }

  /**
   * Checks if webhook body hash was already processed.
   * If not, records it.
   */
  public checkAndRecordWebhookHash(hash: string, orderId?: string): boolean {
    if (this.processedWebhookHashes.has(hash)) {
      return true; // Already processed!
    }
    this.processedWebhookHashes.set(hash, {
      hash,
      orderId,
      receivedAt: new Date().toISOString(),
    });
    return false;
  }

  public saveOrder(order: PickingOrder, rawPayload?: any) {
    this.orders.set(order._id, order);
    if (rawPayload) {
      this.rawWebhookPayloads.set(order._id, rawPayload);
    }
    this.emit('order:created', order);
  }

  public updateOrder(orderId: string, updates: Partial<PickingOrder>): PickingOrder | undefined {
    const existing = this.orders.get(orderId);
    if (!existing) return undefined;
    const updated: PickingOrder = { ...existing, ...updates };
    this.orders.set(orderId, updated);
    this.emit('order:updated', updated);
    return updated;
  }

  public getOrder(orderId: string): PickingOrder | undefined {
    return this.orders.get(orderId);
  }

  public getRawPayload(orderId: string): any {
    return this.rawWebhookPayloads.get(orderId);
  }

  public listOrders(locationId?: string, status?: string): PickingOrder[] {
    let list = Array.from(this.orders.values());
    if (locationId) {
      list = list.filter((o) => o.location === locationId);
    }
    if (status) {
      list = list.filter((o) => o.pickerStatus === status || o.status === status);
    }
    // Sort by due date (earliest due first)
    return list.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  }

  public recordLifecycleEvent(event: OrderLifecycleWebhook) {
    this.lifecycleEvents.push(event);
    this.emit('lifecycle:event', event);

    // If update event pertains to order, apply any automatic status resolution
    const order = this.orders.get(event.orderId);
    if (order) {
      this.addAuditLog(event.orderId, 'SYSTEM_DELIVERECT', `Lifecycle event: ${event.eventType}`, event.details || {});
      if (event.eventType === 'CUSTOMER_APPROVAL_SUBSTITUTION') {
        // Customer approved substitution
        this.emit('order:updated', order);
      }
    }
  }

  public addAuditLog(orderId: string, actor: string, action: string, details: Record<string, any> = {}) {
    const entry: AuditLogEntry = {
      id: 'audit_' + Math.random().toString(36).substring(2, 9),
      orderId,
      timestamp: new Date().toISOString(),
      actor,
      action,
      details,
    };
    this.auditLogs.unshift(entry);
    this.emit('audit:log', entry);
  }

  public getAuditLogs(orderId?: string): AuditLogEntry[] {
    if (orderId) {
      return this.auditLogs.filter((l) => l.orderId === orderId);
    }
    return this.auditLogs.slice(0, 100);
  }

  public updatePickerPresence(picker: PickerUser) {
    this.activePickers.set(picker.id, picker);
    this.emit('picker:presence', Array.from(this.activePickers.values()));
  }

  public getActivePickers(): PickerUser[] {
    return Array.from(this.activePickers.values());
  }
}

export const globalStore = new OrderStore();
