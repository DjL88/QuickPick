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
  | 'STANDALONE'
  | 'PARENT'
  | 'COMPONENT'
  | 'MODIFIER'
  | 'CUSTOMISATION'
  | 'UPSELL'
  | 'ADD_ON';

export type PickAllPolicy = 'SAFE_CHILDREN_ONLY' | 'DISABLED' | 'NONE';
export type PickingLineType = 'PRODUCT' | 'INSTRUCTION' | 'GROUP_PARENT';
export type PickingGroupType =
  | 'DEAL'
  | 'MEAL_DEAL'
  | 'BUNDLE'
  | 'COMBO'
  | 'MODIFIER_GROUP'
  | 'CUSTOMISATION_GROUP'
  | 'UPSELL_GROUP'
  | 'ADD_ON_GROUP'
  | 'COLLECTION'
  | 'UNKNOWN';
export type PickingGroupVerificationPolicy = 'INHERIT' | 'INDIVIDUAL_LINES';

export interface CustomerSelectedSubstitution {
  source: 'CUSTOMER';
  itemId?: string;
  channelItemId?: string;
  plu?: string;
  name?: string;
  quantity?: number;
  price?: number;
  note?: string;
  raw?: Record<string, unknown>;
}

export interface PickingGroup {
  id: string;
  name: string;
  type?: PickingGroupType;
  /**
   * Compatibility field retained for the current UI/engine. New code should treat
   * lineIds as canonical when present and itemIds as the legacy alias.
   */
  itemIds: string[];
  lineIds?: string[];
  pickAllPolicy?: PickAllPolicy;
  verificationPolicy?: PickingGroupVerificationPolicy;
  parentItemId?: string;
  parentGroupId?: string;
  childGroupIds?: string[];
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
  lineType?: PickingLineType;
  groupId?: string; // nearest / primary group for legacy callers
  groupIds?: string[]; // outermost -> innermost memberships for nested deals/bundles
  parentLineId?: string; // preserves parent/child relationship without flattening
  componentRole?: ComponentRole;
  isTextInstruction?: boolean; // compatibility flag for non-pickable instruction lines
  requiresBarcodeScan?: boolean;
  requiresIndividualVerification?: boolean;
  customerSelectedSubstitution?: CustomerSelectedSubstitution;

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

/**
 * Canonical internal name used by picker-domain code. PickingItem remains the
 * compatibility name used throughout the existing prototype.
 */
export type PickingLine = PickingItem;

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
 * Return the line ids carried by a group. lineIds is the canonical field; the
 * existing itemIds field remains supported so current UI code does not break.
 */
export function getGroupLineIds(group: PickingGroup): string[] {
  return group.lineIds && group.lineIds.length > 0 ? group.lineIds : group.itemIds;
}

/**
 * Resolve every explicit and inherited group that constrains a line. groupIds is
 * ordered outermost -> innermost, while groupId remains the nearest-group legacy
 * shortcut. Parent groups are added defensively when only the leaf membership is
 * supplied by an adapter.
 */
export function getPickingLineGroups(
  line: PickingLine,
  groups: PickingGroup[] = []
): PickingGroup[] {
  const byId = new Map(groups.map((group) => [group.id, group]));
  const orderedIds: string[] = [];

  const add = (id?: string) => {
    if (id && !orderedIds.includes(id)) orderedIds.push(id);
  };

  line.groupIds?.forEach(add);
  add(line.groupId);

  for (let index = 0; index < orderedIds.length; index += 1) {
    const group = byId.get(orderedIds[index]);
    add(group?.parentGroupId);
  }

  return orderedIds
    .map((id) => byId.get(id))
    .filter((group): group is PickingGroup => Boolean(group));
}

/**
 * Product lines are physical pick tasks. Instruction/group-parent rows are kept
 * in the order model so the UI can retain context without pretending they are
 * products that need a scan/pick mutation.
 */
export function isPickingLinePickable(line: PickingLine): boolean {
  if (line.isTextInstruction) return false;
  return line.lineType !== 'INSTRUCTION' && line.lineType !== 'GROUP_PARENT';
}

/**
 * Authoritative safety validator for Pick All eligibility.
 *
 * A child may participate in Pick All only when every group that constrains it
 * allows SAFE_CHILDREN_ONLY and the line itself needs no physical/approval
 * verification. This is intentionally conservative for the demo: unknown
 * provider semantics stay individually handled instead of being guessed.
 */
export function getPickAllBlockReasons(
  item: PickingLine,
  group?: PickingGroup | PickingGroup[]
): string[] {
  const reasons: string[] = [];
  const groups = group ? (Array.isArray(group) ? group : [group]) : [];

  for (const candidate of groups) {
    if (candidate.pickAllPolicy !== 'SAFE_CHILDREN_ONLY') {
      reasons.push(`Group ${candidate.name} does not permit Pick All`);
    }
    if (candidate.verificationPolicy === 'INDIVIDUAL_LINES') {
      reasons.push(`Group ${candidate.name} requires individual verification`);
    }
  }

  if (!isPickingLinePickable(item)) {
    reasons.push('Non-pickable instruction or group-parent line');
  }

  if (item.isWeight) {
    reasons.push('Requires scale weighing');
  }

  if (item.ageRestricted) {
    reasons.push(`Requires ${item.minimumAge ?? 18}+ age verification`);
  }

  if (item.requiresBarcodeScan) {
    reasons.push('Requires physical barcode scan');
  }

  if (item.requiresIndividualVerification) {
    reasons.push('Requires individual item verification');
  }

  if (item.customerSelectedSubstitution) {
    reasons.push('Customer-selected substitution requires individual verification');
  }

  if (item.status === 'REPLACED' || item.replacement || item.syncState === 'PENDING') {
    reasons.push('Pending or active substitution');
  }

  if (!item.plu && !item.channelItemId && (!item.gtin || item.gtin.length === 0)) {
    reasons.push('Missing source identity (no PLU/GTIN/channelItemId)');
  }

  return Array.from(new Set(reasons));
}

/**
 * Full nested-group Pick All evaluation used by the engine. This is preferred
 * whenever the complete order/group set is available.
 */
export function getPickAllBlockReasonsForLine(
  line: PickingLine,
  groups: PickingGroup[] = []
): string[] {
  const constraints = getPickingLineGroups(line, groups);
  return getPickAllBlockReasons(line, constraints);
}
