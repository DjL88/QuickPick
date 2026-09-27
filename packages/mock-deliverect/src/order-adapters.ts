import type { PickingGroup, PickingItem } from '../../contracts/src/index.js';

function asRecord(value: unknown): Record<string, any> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : undefined;
}

const knownGroupTypes = new Set([
  'DEAL', 'MEAL_DEAL', 'BUNDLE', 'COMBO', 'MODIFIER_GROUP',
  'CUSTOMISATION_GROUP', 'UPSELL_GROUP', 'ADD_ON_GROUP', 'COLLECTION', 'UNKNOWN',
]);
const knownRoles = new Set(['STANDALONE', 'PARENT', 'COMPONENT', 'MODIFIER', 'CUSTOMISATION', 'UPSELL', 'ADD_ON']);
const knownLineTypes = new Set(['PRODUCT', 'INSTRUCTION', 'GROUP_PARENT']);
const knownTemperatures = new Set(['AMBIENT', 'CHILLED', 'FROZEN']);
const knownStatuses = new Set(['PENDING', 'PICKED', 'REPLACED', 'REMOVED']);
const knownActions = new Set(['ITEM_AMENDMENT', 'ITEM_REMOVE', 'ITEM_SUBSTITUTION', 'ITEM_SUBSTITUTION_CATALOG', 'CANCEL_ORDER']);

const text = (value: unknown) => typeof value === 'string' && value.length > 0 ? value : undefined;
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const strings = (value: unknown) => Array.isArray(value)
  ? value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
  : undefined;

/**
 * Conservative prototype adapter. It preserves source relationships but does
 * not fabricate provider identity, catalogue location, temperature, weight, or
 * verification metadata.
 */
export function normalizeDemoPickingLines(value: unknown, idPrefix = 'line_demo'): PickingItem[] {
  if (!Array.isArray(value)) return [];

  return value.map((entry, index) => {
    const raw = asRecord(entry) || {};
    const groupIds = strings(raw.groupIds);
    const groupId = text(raw.groupId);
    const instruction = raw.isTextInstruction === true || raw.lineType === 'INSTRUCTION';
    const lineType = knownLineTypes.has(raw.lineType) ? raw.lineType : instruction ? 'INSTRUCTION' : 'PRODUCT';
    const role = knownRoles.has(raw.componentRole)
      ? raw.componentRole
      : groupId || groupIds?.length ? 'COMPONENT' : 'STANDALONE';
    const selectedSub = asRecord(raw.customerSelectedSubstitution);
    const customerSelectedSubstitution = selectedSub?.source === 'CUSTOMER'
      ? {
          source: 'CUSTOMER' as const,
          itemId: text(selectedSub.itemId),
          channelItemId: text(selectedSub.channelItemId),
          plu: text(selectedSub.plu),
          name: text(selectedSub.name),
          quantity: number(selectedSub.quantity),
          price: number(selectedSub.price),
          note: text(selectedSub.note),
          raw: asRecord(selectedSub.raw),
        }
      : undefined;

    return {
      _id: text(raw._id) || `${idPrefix}_${index + 1}`,
      plu: typeof raw.plu === 'string' ? raw.plu : '',
      name: text(raw.name) || 'Unnamed item',
      quantity: number(raw.quantity) ?? 1,
      price: number(raw.price) ?? 0,
      channelItemId: text(raw.channelItemId),
      gtin: strings(raw.gtin),
      subItems: Array.isArray(raw.subItems) ? raw.subItems : undefined,
      modifiers: Array.isArray(raw.modifiers) ? raw.modifiers : undefined,
      itemUnavailableActions: Array.isArray(raw.itemUnavailableActions)
        ? raw.itemUnavailableActions.filter((action: unknown) => knownActions.has(action as string)) as PickingItem['itemUnavailableActions']
        : undefined,
      lineType: lineType as PickingItem['lineType'],
      groupId,
      groupIds,
      parentLineId: text(raw.parentLineId),
      componentRole: role as PickingItem['componentRole'],
      isTextInstruction: instruction || undefined,
      requiresBarcodeScan: raw.requiresBarcodeScan === true || undefined,
      requiresIndividualVerification: raw.requiresIndividualVerification === true || undefined,
      customerSelectedSubstitution,
      department: text(raw.department),
      aisle: text(raw.aisle),
      shelf: text(raw.shelf),
      sequence: number(raw.sequence),
      temperature: knownTemperatures.has(raw.temperature) ? raw.temperature as PickingItem['temperature'] : undefined,
      isWeight: typeof raw.isWeight === 'boolean' ? raw.isWeight : undefined,
      weightUnit: ['kg', 'g', 'lb', 'oz'].includes(raw.weightUnit) ? raw.weightUnit : undefined,
      expectedWeight: number(raw.expectedWeight),
      minWeight: number(raw.minWeight),
      maxWeight: number(raw.maxWeight),
      ageRestricted: typeof raw.ageRestricted === 'boolean' ? raw.ageRestricted : undefined,
      minimumAge: number(raw.minimumAge),
      imageUrl: text(raw.imageUrl),
      pickedQuantity: number(raw.pickedQuantity),
      pickedWeight: number(raw.pickedWeight),
      status: knownStatuses.has(raw.status) ? raw.status as PickingItem['status'] : 'PENDING',
      notes: text(raw.notes),
      pickedAt: text(raw.pickedAt),
      pickedBy: text(raw.pickedBy),
      syncState: ['SYNCED', 'PENDING', 'FAILED'].includes(raw.syncState) ? raw.syncState : undefined,
      replacement: asRecord(raw.replacement) as PickingItem['replacement'],
      removalReason: ['OUT_OF_STOCK', 'DAMAGED', 'EXPIRED', 'CUSTOMER_REQUEST', 'OTHER'].includes(raw.removalReason)
        ? raw.removalReason
        : undefined,
    };
  });
}

/**
 * Unknown group semantics fail closed until an adapter explicitly declares
 * SAFE_CHILDREN_ONLY.
 */
export function normalizeDemoPickingGroups(value: unknown): PickingGroup[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    const raw = asRecord(entry);
    const id = raw ? text(raw.id) : undefined;
    if (!raw || !id) return [];

    const lineIds = strings(raw.lineIds) || strings(raw.itemIds) || [];
    const pickAllPolicy = ['SAFE_CHILDREN_ONLY', 'DISABLED', 'NONE'].includes(raw.pickAllPolicy)
      ? raw.pickAllPolicy
      : 'DISABLED';
    const verificationPolicy = ['INHERIT', 'INDIVIDUAL_LINES'].includes(raw.verificationPolicy)
      ? raw.verificationPolicy
      : pickAllPolicy === 'SAFE_CHILDREN_ONLY' ? 'INHERIT' : 'INDIVIDUAL_LINES';

    return [{
      id,
      name: text(raw.name) || text(raw.label) || 'Unlabelled group',
      type: knownGroupTypes.has(raw.type) ? raw.type as PickingGroup['type'] : 'UNKNOWN',
      itemIds: [...lineIds],
      lineIds: [...lineIds],
      pickAllPolicy: pickAllPolicy as PickingGroup['pickAllPolicy'],
      verificationPolicy: verificationPolicy as PickingGroup['verificationPolicy'],
      parentItemId: text(raw.parentItemId),
      parentGroupId: text(raw.parentGroupId),
      childGroupIds: strings(raw.childGroupIds),
      totalCount: number(raw.totalCount),
      pickedCount: number(raw.pickedCount),
    }];
  });
}
