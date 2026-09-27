/**
 * @file packages/contracts/src/index.ts
 * Shared contracts and types for Deliverect Generic Picking API,
 * Inbound Webhooks, Outbox System, and Picker App state.
 */

export type OrderStatus = 'SCHEDULED' | 'PROCESSING' | 'FINALIZED' | 'CANCELLED';
export type PickerStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';

export type ItemUnavailableAction =
  | 'ITEM_AMENDMENT'
  | 'ITEM_REMOVE'
  | 'ITEM_SUBSTITUTION'
  | 'ITEM_SUBSTITUTION_CATALOG'
  | 'CANCEL_ORDER';

export type TemperatureZone = 'AMBIENT' | 'CHILLED' | 'FROZEN';

export type ItemStatus = 'PENDING' | 'PICKED' | 'REPLACED' | 'REMOVED';

export type RemovalReason = 'OUT_OF_STOCK' | 'DAMAGED' | 'EXPIRED' | 'CUSTOMER_REQUEST' | 'OTHER';

export interface ItemModifier {
  _id?: string;
  name: string;
  price?: number;
  plu?: string;
}

export interface PickingSubItem {
  _id?: string;
  plu: string;
  name: string;
  quantity: number;
  price?: number;
}

export interface PickingItem {
  _id: string;
  plu: string;
  name: string;
  quantity: number;
  price: number; // in cents or currency minor units, or decimal depending on provider
  channelItemId?: string;
  gtin?: string[];
  subItems?: PickingSubItem[];
  modifiers?: ItemModifier[];
  itemUnavailableActions?: ItemUnavailableAction[];

  // Retail & Grocery enrichment
  department?: string;
  aisle?: string;
  shelf?: string;
  sequence?: number; // Altie optimized walking sequence
  temperature?: TemperatureZone;
  isWeight?: boolean;
  weightUnit?: 'kg' | 'g' | 'lb' | 'oz';
  expectedWeight?: number;
  minWeight?: number;
  maxWeight?: number;
  ageRestricted?: boolean;
  minimumAge?: number;
  imageUrl?: string;

  // Live Picking State
  pickedQuantity?: number;
  pickedWeight?: number;
  status: ItemStatus;
  notes?: string;
  pickedAt?: string;
  pickedBy?: string;
  syncState?: 'SYNCED' | 'PENDING' | 'FAILED';

  // Substituted details
  replacement?: {
    plu: string;
    name: string;
    price: number;
    quantity: number;
    reason?: string;
    subItems?: PickingSubItem[];
    itemId?: string;
  };

  // Removal details
  removalReason?: RemovalReason;
}

export interface CustomerInfo {
  name: string;
  phone?: string;
  email?: string;
}

export interface PickingOrder {
  _id: string;
  location: string;
  channelOrderId: string;
  channelOrderDisplayId: string;
  pickupTime?: string;
  deliveryTime?: string;
  orderType?: 'DELIVERY' | 'PICKUP' | 'DINE_IN' | 'CURBSIDE';
  customer: CustomerInfo;
  note?: string;
  items: PickingItem[];
  status: OrderStatus;
  pickerStatus: PickerStatus;

  // Metadata & Timings
  receivedAt: string;
  startedAt?: string;
  completedAt?: string;
  assignedPickerId?: string;
  assignedPickerName?: string;
  rawPayload?: any;
  metadata?: Record<string, any>;

  // Courier information
  courierCount?: number;
  courierNotes?: string;

  // SLA & Timeline
  dueAt: string; // ISO date string computed from pickupTime/deliveryTime
  slaStatus?: 'ON_TIME' | 'WARNING' | 'CRITICAL' | 'OVERDUE';
}

export type OrderLifecycleEventType =
  | 'CUSTOMER_APPROVAL_SUBSTITUTION'
  | 'PARTNER_DONE_SUCCESSFUL'
  | 'PARTNER_UPDATE_FAILED'
  | string;

export interface OrderLifecycleWebhook {
  eventType: OrderLifecycleEventType;
  orderId: string;
  timestamp: string;
  location?: string;
  details?: Record<string, any>;
  rawPayload?: any;
}

// Outbound Actions
export type UpdateActionType = 'ADJUST' | 'REPLACE' | 'REMOVE' | 'PICK';

export interface UpdateOrderItemAction {
  itemId: string;
  action: UpdateActionType;
  reason?: string;
  location?: string;
  properties?: {
    quantity?: number;
    pickedWeight?: number;
    isSubItem?: boolean;
    replaceItem?: {
      plu: string;
      itemType?: string;
      quantity: number;
      subItems?: any[];
      itemId?: string;
      name?: string;
      price?: number;
    };
  };
}

export interface UpdateOrderItemsPayload {
  callbackUrl?: string;
  updates: UpdateOrderItemAction[];
}

export interface SuggestSubstituteResponse {
  substitutes: Array<{
    itemId?: string;
    plu: string;
    name: string;
    price: number;
    similarity?: number;
    reason?: string;
    inStock?: boolean;
    department?: string;
    gtin?: string[];
  }>;
}

export interface RejectOrderPayload {
  location: string;
  reason: string;
  reasonType: string;
}

export interface CourierCountPayload {
  count: number;
  reason?: string;
  updatedBy?: string;
}

// Outbox records
export type OutboxStatus = 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED' | 'TERMINAL_ERROR';

export interface OutboxRecord {
  id: string;
  idempotencyKey: string; // orderId + itemId + action + payloadHash
  orderId: string;
  endpoint: string;
  method: 'POST' | 'GET' | 'PUT';
  payload: any;
  status: OutboxStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  lastAttemptAt?: string;
  nextRetryAt?: string;
  responseStatus?: number;
  responseBody?: any;
  error?: string;
}

// Audit Trail
export interface AuditLogEntry {
  id: string;
  orderId: string;
  timestamp: string;
  actor: string;
  action: string;
  details: Record<string, any>;
}

// Staff & Session
export interface PickerUser {
  id: string;
  name: string;
  role: 'picker' | 'lead' | 'manager';
  storeId: string;
  storeName: string;
  activeOrderId?: string;
  currentAisle?: string;
}

export interface StoreLocation {
  id: string;
  name: string;
  address: string;
  hmacSecret: string;
}

// Stats & Metrics
export interface PickerMetrics {
  ordersCompleted: number;
  unitsPicked: number;
  uph: number; // Units Per Hour
  avgPickSecondsPerItem: number;
  substitutionRate: number; // percentage
  removalRate: number; // percentage
}
