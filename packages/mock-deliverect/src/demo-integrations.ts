import type { PickingOrder } from '../../contracts/src/index.js';
import { normalizeDemoPickingGroups, normalizeDemoPickingLines } from './order-adapters.js';

export interface DemoIntegrationFlags {
  mockGenericPicking: boolean;
  ltxDirectDemo: boolean;
}

export interface DemoOrderAdapterOptions {
  flags?: Partial<DemoIntegrationFlags>;
  now?: Date;
}

const text = (value: unknown) =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

function record(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

export function resolveDemoIntegrationFlags(
  env: Record<string, string | undefined> = process.env
): DemoIntegrationFlags {
  return {
    mockGenericPicking: env.QP_ENABLE_MOCK_GENERIC_PICKING !== 'false',
    ltxDirectDemo: env.QP_ENABLE_LTX_DIRECT_DEMO !== 'false',
  };
}

function buildDemoOrder(
  value: unknown,
  source: 'MOCK_DELIVERECT_GENERIC' | 'LTX_DIRECT_DEMO',
  options: DemoOrderAdapterOptions = {}
): PickingOrder {
  const raw = record(value);
  const flags = {
    ...resolveDemoIntegrationFlags(),
    ...options.flags,
  };

  if (source === 'MOCK_DELIVERECT_GENERIC' && !flags.mockGenericPicking) {
    throw new Error('Mock Generic Picking adapter is disabled');
  }
  if (source === 'LTX_DIRECT_DEMO' && !flags.ltxDirectDemo) {
    throw new Error('LTx direct demo adapter is disabled');
  }

  const now = options.now || new Date();
  const orderId = text(raw._id) || `demo_order_${now.getTime()}`;
  const location = text(raw.location) || 'demo-location-unset';
  const customer = record(raw.customer);
  const pickupTime = text(raw.pickupTime);
  const deliveryTime = text(raw.deliveryTime);
  const dueAt = text(raw.dueAt) || pickupTime || deliveryTime || now.toISOString();
  const groups = normalizeDemoPickingGroups(raw.groups);

  return {
    _id: orderId,
    location,
    channelOrderId: text(raw.channelOrderId) || `${source}:${orderId}`,
    channelOrderDisplayId: text(raw.channelOrderDisplayId) || orderId,
    pickupTime,
    deliveryTime,
    orderType:
      raw.orderType === 'DELIVERY' ||
      raw.orderType === 'PICKUP' ||
      raw.orderType === 'DINE_IN' ||
      raw.orderType === 'CURBSIDE'
        ? raw.orderType
        : undefined,
    customer: {
      name: text(customer.name) || 'Demo customer',
      phone: text(customer.phone),
      email: text(customer.email),
      address: text(customer.address),
    },
    note: text(raw.note),
    items: normalizeDemoPickingLines(raw.items, `line_${orderId}`),
    groups: groups.length > 0 ? groups : undefined,
    status:
      raw.status === 'PROCESSING' ||
      raw.status === 'FINALIZED' ||
      raw.status === 'CANCELLED' ||
      raw.status === 'SCHEDULED'
        ? raw.status
        : 'SCHEDULED',
    pickerStatus:
      raw.pickerStatus === 'IN_PROGRESS' ||
      raw.pickerStatus === 'COMPLETED' ||
      raw.pickerStatus === 'REJECTED' ||
      raw.pickerStatus === 'NOT_STARTED'
        ? raw.pickerStatus
        : 'NOT_STARTED',
    receivedAt: text(raw.receivedAt) || now.toISOString(),
    dueAt,
    metadata: {
      ...(record(raw.metadata)),
      source,
      prototypeOnly: true,
    },
    rawPayload: raw,
  };
}

export function mapMockGenericPickingOrder(
  value: unknown,
  options: DemoOrderAdapterOptions = {}
): PickingOrder {
  return buildDemoOrder(value, 'MOCK_DELIVERECT_GENERIC', options);
}

export function mapLtxDirectDemoOrder(
  value: unknown,
  options: DemoOrderAdapterOptions = {}
): PickingOrder {
  return buildDemoOrder(value, 'LTX_DIRECT_DEMO', options);
}
