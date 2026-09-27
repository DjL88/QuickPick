/**
 * @file packages/contracts/src/index.ts
 * Shared contracts and types for Deliverect Generic Picking API,
 * Inbound Webhooks, Outbox System, Group/Bundle Model (QP-02),
 * Picking Engine (QP-03), Mobile UI (QP-04), and HeadsUp & Printer Seam (QP-05).
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

export type ComponentRole =
  | 'COMPONENT'
  | 'MODIFIER'
  | 'CUSTOMISATION'
  | 'UPSELL'
  | 'ADD_ON';

export type PickAllPolicy = 'SAFE_CHILDREN_ONLY' | 'DISABLED' | 'NONE';

export interface PickingGroup {
  id: string;
  name: string;
  type?: 'BUNDLE' | 'MEAL_DEAL' | 'COMBO' | 'COLLECTION' | string;
  itemIds: string[];
  pickAllPolicy?: PickAllPolicy;
  parentItemId?: string;
  totalCount?: number;
  pickedCount?: number;
}

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

  // Group & Bundle relationship (QP-02)
  groupId?: string;
  componentRole?: ComponentRole;
  isTextInstruction?: boolean; // non-pickable text-only instruction such as "No mayonnaise"
  requiresBarcodeScan?: boolean;
  requiresIndividualVerification?: boolean;

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
  address?: string;
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
  groups?: PickingGroup[];
  status: OrderStatus;
  pickerStatus: PickerStatus;

  // Metadata & Timings
  receivedAt: string;
  startedAt?: string;
  completedAt?: string;
  assignedPickerId?: string;
  assignedPickerName?: string;
  collaboratorCount?: number;
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

// -------------------------------------------------------------
// QP-05 PRINTER & DEVICE SEAM CONTRACTS
// -------------------------------------------------------------
export type PrintJobType = 'RECEIPT' | 'TOTE_LABEL' | 'BAG_LABEL';

export interface PrintJobItem {
  name: string;
  quantity: number;
  plu?: string;
  pickedWeight?: number;
  price?: number;
  isReplacement?: boolean;
}

export interface PrintJob {
  id: string;
  type: PrintJobType;
  orderId: string;
  channelOrderDisplayId: string;
  customerName: string;
  timestamp: string;
  toteId?: string;
  bagIndex?: number;
  totalBags?: number;
  courierCount?: number;
  items?: PrintJobItem[];
  formattedPayload?: string;
  metadata?: Record<string, any>;
}

export interface PrintResult {
  success: boolean;
  jobId: string;
  printedAt: string;
  type: PrintJobType;
  message?: string;
  error?: string;
}

export interface PrinterProvider {
  name: string;
  print(job: Omit<PrintJob, 'id' | 'timestamp'>): Promise<PrintResult>;
  getRecentJobs(): Promise<PrintJob[]>;
  clearJobs?(): Promise<void>;
}

// -------------------------------------------------------------
// QP-03 PICKING ENGINE TRANSITION TYPES
// -------------------------------------------------------------
export interface PickingTransitionResult {
  order: PickingOrder;
  actionTaken: string;
  changedItemIds: string[];
  changedGroupIds: string[];
  blockReasons?: string[];
  success: boolean;
  message?: string;
}

/**
 * Authoritative QP-02 safety validator for Pick All eligibility.
 * Evaluates whether an item or group line is safe for bulk/all declaration.
 * Returns an array of blocking reasons. If empty, the item is safe.
 */
export function getPickAllBlockReasons(item: PickingItem, group?: PickingGroup): string[] {
  const reasons: string[] = [];

  // 1. Group policy check if group is provided
  if (group && group.pickAllPolicy !== 'SAFE_CHILDREN_ONLY') {
    reasons.push('Group policy does not permit Pick All');
  }

  // 2. Weighing required
  if (item.isWeight) {
    reasons.push('Requires scale weighing');
  }

  // 3. Age verification (18+ alcohol, tobacco, restricted)
  if (item.ageRestricted) {
    reasons.push('Requires 18+ age verification');
  }

  // 4. Barcode scan requirement
  if (item.requiresBarcodeScan) {
    reasons.push('Requires physical barcode scan');
  }

  // 5. Explicit individual verification
  if (item.requiresIndividualVerification) {
    reasons.push('Requires individual item verification');
  }

  // 6. Pending/suggested substitution or active replacement
  if (item.status === 'REPLACED' || item.replacement || item.syncState === 'PENDING') {
    reasons.push('Pending or active substitution');
  }

  // 7. Synthetic or missing source identity
  if (!item.plu && !item.channelItemId && (!item.gtin || item.gtin.length === 0)) {
    reasons.push('Missing source identity (no PLU/GTIN/channelItemId)');
  }

  // 8. Non-pickable instruction line (e.g. text customisation)
  if (item.isTextInstruction) {
    reasons.push('Non-pickable text instruction');
  }

  return reasons;
}
