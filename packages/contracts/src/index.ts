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

export type PickingComponentRole =
  | 'STANDALONE'
  | 'PRIMARY'
  | 'COMPONENT'
  | 'MODIFIER'
  | 'CUSTOMISATION'
  | 'UPSELL'
  | 'ADD_ON';

export type PickingGroupType =
  | 'DEAL'
  | 'BUNDLE'
  | 'MODIFIER_GROUP'
  | 'CUSTOMISATION_GROUP'
  | 'UPSELL_GROUP'
  | 'ADD_ON_GROUP';

export type PickingSubstitutionState =
  | 'NONE'
  | 'SUGGESTED'
  | 'PENDING_CUSTOMER'
  | 'APPROVED'
  | 'REJECTED';

export type PickingSubstitutionPreference =
  | 'BEST_MATCH'
  | 'CUSTOMER_SELECTED'
  | 'REMOVE'
  | 'CANCEL_ORDER';

export type PickAllBlockReason =
  | 'ALREADY_HANDLED'
  | 'NON_PICKABLE'
  | 'MISSING_SOURCE_ID'
  | 'WEIGHT_REQUIRED'
  | 'AGE_CHECK_REQUIRED'
  | 'SCAN_REQUIRED'
  | 'INDIVIDUAL_VERIFICATION'
  | 'SUBSTITUTION_PENDING';

export interface PickingGroupInstruction {
  id: string;
  label: string;
  value?: string;
  sourcePath?: string[];
}

export interface PickingGroup {
  id: string;
  type: PickingGroupType;
  label: string;
  parentGroupId?: string;
  parentLineId?: string;
  lineIds: string[];
  childGroupIds: string[];
  instructions: PickingGroupInstruction[];
  pickAllPolicy: 'SAFE_CHILDREN_ONLY' | 'INDIVIDUAL_ONLY';
  sourcePath?: string[];
}

export interface PickAllLineDecision {
  lineId: string;
  eligible: boolean;
  reasons: PickAllBlockReason[];
}

export interface PickAllDecision {
  groupId: string;
  eligible: boolean;
  eligibleLineIds: string[];
  blocked: PickAllLineDecision[];
}

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

  // Canonical picking structure. PickingOrder.items stays flat/actionable for route
  // optimisation while these fields retain bundle/deal/modifier parentage for the UI.
  componentRole?: PickingComponentRole;
  parentItemId?: string;
  groupId?: string;
  sourcePath?: string[];
  pickable?: boolean;
  identitySource?: 'SOURCE' | 'SYNTHETIC_INTERNAL';
  requiresScan?: boolean;
  requiresIndividualVerification?: boolean;
  substitutionState?: PickingSubstitutionState;
  substitutionPreference?: PickingSubstitutionPreference;
  customerSelectedSubstitutes?: Array<{
    itemId?: string;
    plu: string;
    name: string;
    quantity: number;
    price?: number;
    gtin?: string[];
  }>;

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
  groups?: PickingGroup[];
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


/**
 * Returns the reasons a line must not be included in a bulk "Pick All" action.
 * The rule is deliberately conservative: bulk picking is for boring, already
 * identified physical lines only. Weight, age, scan, substitution and explicit
 * verification work always remains visible to the picker.
 */
export function getPickAllBlockReasons(item: PickingItem): PickAllBlockReason[] {
  const reasons: PickAllBlockReason[] = [];

  if (item.status !== 'PENDING') reasons.push('ALREADY_HANDLED');
  if (item.pickable === false) reasons.push('NON_PICKABLE');
  if (item.identitySource === 'SYNTHETIC_INTERNAL') reasons.push('MISSING_SOURCE_ID');
  if (item.isWeight) reasons.push('WEIGHT_REQUIRED');
  if (item.ageRestricted) reasons.push('AGE_CHECK_REQUIRED');
  if (item.requiresScan) reasons.push('SCAN_REQUIRED');
  if (item.requiresIndividualVerification) reasons.push('INDIVIDUAL_VERIFICATION');
  if (item.substitutionState === 'PENDING_CUSTOMER' || item.substitutionState === 'SUGGESTED') {
    reasons.push('SUBSTITUTION_PENDING');
  }

  return Array.from(new Set(reasons));
}

export function getGroupPickAllDecision(group: PickingGroup, items: PickingItem[]): PickAllDecision {
  const byId = new Map(items.map((item) => [item._id, item]));
  const decisions: PickAllLineDecision[] = group.lineIds.map((lineId) => {
    const item = byId.get(lineId);
    const reasons = item ? getPickAllBlockReasons(item) : ['NON_PICKABLE' as PickAllBlockReason];

    if (group.pickAllPolicy === 'INDIVIDUAL_ONLY' && !reasons.includes('INDIVIDUAL_VERIFICATION')) {
      reasons.push('INDIVIDUAL_VERIFICATION');
    }

    return {
      lineId,
      eligible: reasons.length === 0,
      reasons,
    };
  });

  return {
    groupId: group.id,
    eligible: decisions.length > 0 && decisions.every((decision) => decision.eligible),
    eligibleLineIds: decisions.filter((decision) => decision.eligible).map((decision) => decision.lineId),
    blocked: decisions.filter((decision) => !decision.eligible),
  };
}

interface NormalisePickingOptions {
  orderId: string;
}

interface NormalisePickingResult {
  items: PickingItem[];
  groups: PickingGroup[];
}

type NestedDescriptor = {
  key: string;
  type: PickingGroupType;
  role: PickingComponentRole;
};

const NESTED_DESCRIPTORS: NestedDescriptor[] = [
  { key: 'subItems', type: 'BUNDLE', role: 'COMPONENT' },
  { key: 'components', type: 'BUNDLE', role: 'COMPONENT' },
  { key: 'modifiers', type: 'MODIFIER_GROUP', role: 'MODIFIER' },
  { key: 'customisations', type: 'CUSTOMISATION_GROUP', role: 'CUSTOMISATION' },
  { key: 'customizations', type: 'CUSTOMISATION_GROUP', role: 'CUSTOMISATION' },
  { key: 'upsells', type: 'UPSELL_GROUP', role: 'UPSELL' },
  { key: 'addOns', type: 'ADD_ON_GROUP', role: 'ADD_ON' },
  { key: 'addons', type: 'ADD_ON_GROUP', role: 'ADD_ON' },
];

function safeNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function hasPhysicalIdentity(raw: any): boolean {
  return Boolean(
    raw &&
      (raw.plu !== undefined ||
        raw.channelItemId !== undefined ||
        (Array.isArray(raw.gtin) && raw.gtin.length > 0))
  );
}

function inferContainerType(raw: any): PickingGroupType | null {
  const marker = String(raw?.itemType || raw?.type || raw?.kind || '').toUpperCase();
  if (marker.includes('DEAL')) return 'DEAL';
  if (marker.includes('BUNDLE') || marker.includes('COMBO')) return 'BUNDLE';
  if (raw?.isContainer === true) return 'BUNDLE';
  return null;
}

/**
 * Converts tolerant provider/demo payloads into one canonical internal shape:
 * - PickingOrder.items is a flat list of actionable physical lines.
 * - PickingOrder.groups preserves nested deal/bundle/modifier/upsell structure.
 * - Text-only modifiers/customisations become group instructions rather than
 *   fake PLUs.
 *
 * Unknown provider fields stay on the raw payload; this helper does not claim
 * any undocumented Deliverect field names are authoritative.
 */
export function normalisePickingStructure(
  rawItems: any[],
  options: NormalisePickingOptions
): NormalisePickingResult {
  const items: PickingItem[] = [];
  const groups: PickingGroup[] = [];
  let syntheticCounter = 0;
  let groupCounter = 0;

  const syntheticLineId = (path: string[]) => {
    syntheticCounter += 1;
    return `internal_${options.orderId}_${path.join('_') || syntheticCounter}`;
  };

  const walk = (
    raw: any,
    context: {
      parentLineId?: string;
      parentGroupId?: string;
      role: PickingComponentRole;
      path: string[];
    }
  ): string | undefined => {
    if (!raw || typeof raw !== 'object') return undefined;

    const sourceId = raw._id ?? raw.id ?? raw.itemId;
    const identitySource: PickingItem['identitySource'] = sourceId ? 'SOURCE' : 'SYNTHETIC_INTERNAL';
    const lineId = sourceId ? String(sourceId) : syntheticLineId(context.path);
    const explicitContainerType = inferContainerType(raw);
    const physical = hasPhysicalIdentity(raw);
    const pickable = explicitContainerType ? false : physical && identitySource === 'SOURCE';

    let createdLineId: string | undefined;
    if (!explicitContainerType && (physical || sourceId)) {
      const item: PickingItem = {
        _id: lineId,
        plu: raw.plu !== undefined ? String(raw.plu) : '',
        name: String(raw.name || raw.label || 'Unnamed item'),
        quantity: safeNumber(raw.quantity, 1),
        price: safeNumber(raw.price ?? raw.unitPrice, 0),
        channelItemId: raw.channelItemId !== undefined ? String(raw.channelItemId) : undefined,
        gtin: Array.isArray(raw.gtin) ? raw.gtin.map(String) : [],
        subItems: Array.isArray(raw.subItems) ? raw.subItems : [],
        modifiers: Array.isArray(raw.modifiers) ? raw.modifiers : [],
        itemUnavailableActions: Array.isArray(raw.itemUnavailableActions)
          ? raw.itemUnavailableActions
          : undefined,
        department: raw.department,
        aisle: raw.aisle,
        shelf: raw.shelf,
        sequence: typeof raw.sequence === 'number' ? raw.sequence : undefined,
        temperature: raw.temperature,
        isWeight: Boolean(raw.isWeight ?? raw.isWeighted),
        weightUnit: raw.weightUnit,
        expectedWeight: raw.expectedWeight ?? raw.expectedWeightG,
        minWeight: raw.minWeight,
        maxWeight: raw.maxWeight,
        ageRestricted: Boolean(raw.ageRestricted),
        minimumAge: raw.minimumAge,
        imageUrl: raw.imageUrl,
        status: 'PENDING',
        pickedQuantity: 0,
        componentRole: context.role,
        parentItemId: context.parentLineId,
        groupId: context.parentGroupId,
        sourcePath: context.path,
        pickable,
        identitySource,
        requiresScan: Boolean(raw.requiresScan),
        requiresIndividualVerification: Boolean(raw.requiresIndividualVerification),
        substitutionState: raw.substitutionState || 'NONE',
        substitutionPreference: raw.substitutionPreference,
        customerSelectedSubstitutes: Array.isArray(raw.customerSelectedSubstitutes)
          ? raw.customerSelectedSubstitutes
          : Array.isArray(raw.customerCandidates)
            ? raw.customerCandidates
            : undefined,
      };
      items.push(item);
      createdLineId = item._id;
    }

    const parentForChildren = createdLineId || context.parentLineId;

    for (const descriptor of NESTED_DESCRIPTORS) {
      const children = Array.isArray(raw[descriptor.key]) ? raw[descriptor.key] : [];
      if (children.length === 0) continue;

      groupCounter += 1;
      const groupId = String(
        raw[`${descriptor.key}GroupId`] ||
          `group_${options.orderId}_${groupCounter}`
      );
      const group: PickingGroup = {
        id: groupId,
        type: explicitContainerType || descriptor.type,
        label: String(
          raw[`${descriptor.key}Label`] ||
            raw.name ||
            raw.label ||
            descriptor.key
        ),
        parentGroupId: context.parentGroupId,
        parentLineId: parentForChildren,
        lineIds: [],
        childGroupIds: [],
        instructions: [],
        pickAllPolicy:
          raw.pickAllPolicy === 'INDIVIDUAL_ONLY' || raw.requiresIndividualVerification === true
            ? 'INDIVIDUAL_ONLY'
            : 'SAFE_CHILDREN_ONLY',
        sourcePath: [...context.path, descriptor.key],
      };
      groups.push(group);

      for (let index = 0; index < children.length; index += 1) {
        const child = children[index];
        const childPath = [...context.path, descriptor.key, String(index)];

        if (
          (descriptor.role === 'MODIFIER' || descriptor.role === 'CUSTOMISATION') &&
          !hasPhysicalIdentity(child)
        ) {
          group.instructions.push({
            id: String(child?._id || child?.id || `${groupId}_instruction_${index + 1}`),
            label: String(child?.name || child?.label || child?.value || 'Customisation'),
            value: child?.value !== undefined ? String(child.value) : undefined,
            sourcePath: childPath,
          });
          continue;
        }

        const childLineId = walk(child, {
          parentLineId: parentForChildren,
          parentGroupId: groupId,
          role: descriptor.role,
          path: childPath,
        });
        if (childLineId) group.lineIds.push(childLineId);
      }
    }

    return createdLineId;
  };

  rawItems.forEach((raw, index) => {
    const rootId = walk(raw, {
      role: 'STANDALONE',
      path: ['items', String(index)],
    });

    const explicitContainerType = inferContainerType(raw);
    if (explicitContainerType) {
      const directGroups = groups.filter(
        (group) => group.sourcePath?.[0] === 'items' && group.sourcePath?.[1] === String(index)
      );
      for (const group of directGroups) {
        group.type = explicitContainerType;
        if (rootId && !group.parentLineId) group.parentLineId = rootId;
      }
    }
  });

  const groupById = new Map(groups.map((group) => [group.id, group]));
  for (const group of groups) {
    if (group.parentGroupId) {
      const parent = groupById.get(group.parentGroupId);
      if (parent && !parent.childGroupIds.includes(group.id)) parent.childGroupIds.push(group.id);
    }
  }

  return { items, groups };
}
