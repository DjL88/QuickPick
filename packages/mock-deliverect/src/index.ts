/**
 * @file packages/mock-deliverect/src/index.ts
 * Standalone mock simulator for Deliverect Generic Picking API.
 */

import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import {
  SuggestSubstituteResponse,
  UpdateOrderItemsPayload,
  OrderLifecycleWebhook,
  RejectOrderPayload,
  CourierCountPayload
} from '../../contracts/src/index.js';
import { createSampleGroceryOrders } from './orders.js';

export interface MockDeliverectConfig {
  clientId?: string;
  clientSecret?: string;
  expectedAudience?: string;
  latencyMs?: number;
  errorRate500?: number; // 0 to 1
  rateLimit429?: boolean;
  hmacSecret?: string;
  hmacHeader?: string;
  targetWebhookUrl?: string;
}

export interface RecordedCall {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  headers: Record<string, any>;
  body: any;
  query: any;
}

export class MockDeliverectServer {
  public app: express.Express;
  public config: MockDeliverectConfig;
  public recordedCalls: RecordedCall[] = [];
  public tokenStorage = new Set<string>();

  constructor(config: MockDeliverectConfig = {}) {
    this.config = {
      clientId: config.clientId || 'ltx-picker-client-id',
      clientSecret: config.clientSecret || 'ltx-picker-secret-key',
      expectedAudience: config.expectedAudience || 'https://api.deliverect.io',
      latencyMs: config.latencyMs || 0,
      errorRate500: config.errorRate500 || 0,
      rateLimit429: config.rateLimit429 || false,
      hmacSecret: config.hmacSecret || 'loc_london_flagship',
      hmacHeader: config.hmacHeader || 'x-deliverect-hmac-sha256',
      targetWebhookUrl: config.targetWebhookUrl || 'http://localhost:3000/picking/order',
    };

    this.app = express();
    this.app.use(express.json());
    this.setupRoutes();
  }

  private setupRoutes() {
    // Latency & Chaos middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      // Record call
      this.recordedCalls.push({
        id: 'call_' + Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.originalUrl,
        headers: req.headers,
        body: req.body,
        query: req.query,
      });

      if (this.config.rateLimit429) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfter: 2,
        });
      }

      if (this.config.errorRate500 && Math.random() < this.config.errorRate500) {
        return res.status(500).json({
          error: 'Internal Server Error (Simulated Chaos)',
        });
      }

      if (this.config.latencyMs && this.config.latencyMs > 0) {
        setTimeout(next, this.config.latencyMs);
      } else {
        next();
      }
    });

    // 1. OAuth2 Client Credentials
    this.app.post('/oauth/token', (req: Request, res: Response) => {
      const { grant_type, client_id, client_secret } = req.body;
      if (grant_type !== 'client_credentials' && !req.headers.authorization) {
        // Tolerant of standard body or Basic auth header
      }
      const token = 'mock_jwt_generic_picking_' + Math.random().toString(36).substring(2, 12);
      this.tokenStorage.add(token);

      res.json({
        access_token: token,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'genericPicking',
      });
    });

    // Auth verification helper
    const verifyAuth = (req: Request, res: Response, next: NextFunction) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Bearer token' });
      }
      next();
    };

    // 2. Start picking: POST /picking/order/:orderId/start
    this.app.post('/picking/order/:orderId/start', verifyAuth, (req: Request, res: Response) => {
      const { orderId } = req.params;
      res.json({
        status: 'success',
        orderId,
        message: 'Picking started',
        pickerStatus: 'IN_PROGRESS',
      });
    });

    // 3. Single item pick: POST /picking/order/:orderId/item/:itemId/pick
    this.app.post('/picking/order/:orderId/item/:itemId/pick', verifyAuth, (req: Request, res: Response) => {
      const { orderId, itemId } = req.params;
      const { pickedWeight, isSubItem, timestamp, location, notes } = req.body;

      res.json({
        status: 'success',
        orderId,
        itemId,
        pickedWeight,
        isSubItem: !!isSubItem,
        timestamp: timestamp || new Date().toISOString(),
        location,
        notes,
      });
    });

    // 4. Suggest substitutes: GET /picking/order/:orderId/item/:itemId/suggestSubstitute
    this.app.get('/picking/order/:orderId/item/:itemId/suggestSubstitute', verifyAuth, (req: Request, res: Response) => {
      const { itemId } = req.params;
      const reason = req.query.reason as string || 'OUT_OF_STOCK';

      // Provide realistic substitutions
      const mockSubstitutes: Record<string, SuggestSubstituteResponse> = {
        item_bananas_001: {
          substitutes: [
            {
              itemId: 'sub_bananas_loose',
              plu: '4012',
              name: 'Fairtrade Loose Bananas (Organic)',
              price: 190,
              similarity: 0.98,
              reason: 'Identical organic origin, loose format',
              inStock: true,
              department: 'Fresh Produce',
              gtin: ['0000004012002'],
            },
            {
              itemId: 'sub_plantain_ripe',
              plu: '4233',
              name: 'Ripe Sweet Plantains 500g',
              price: 210,
              similarity: 0.72,
              reason: 'Cooking banana alternative',
              inStock: true,
              department: 'Fresh Produce',
            },
          ],
        },
        item_sourdough_002: {
          substitutes: [
            {
              itemId: 'sub_bloomer_bread',
              plu: '502399',
              name: 'White Artisan Bloomer Bread 600g',
              price: 295,
              similarity: 0.89,
              reason: 'Fresh bakery artisan bread',
              inStock: true,
              department: 'Bakery',
              gtin: ['5060123459999'],
            },
          ],
        },
        item_cheddar_004: {
          substitutes: [
            {
              itemId: 'sub_davidstow_cheddar',
              plu: '501088',
              name: 'Davidstow 18 Month Aged Cheddar 320g',
              price: 490,
              similarity: 0.95,
              reason: 'Premium mature cheddar',
              inStock: true,
              department: 'Chilled Dairy',
              gtin: ['5010293847999'],
            },
          ],
        },
      };

      const found = mockSubstitutes[itemId] || {
        substitutes: [
          {
            itemId: 'sub_generic_alt',
            plu: '999001',
            name: 'Store Brand Equivalent Substitute',
            price: 250,
            similarity: 0.85,
            reason: `Closest store match for ${reason}`,
            inStock: true,
          },
        ],
      };

      res.json(found);
    });

    // 5. Update order items: POST /picking/order/:orderId/updateOrderItems
    this.app.post('/picking/order/:orderId/updateOrderItems', verifyAuth, (req: Request, res: Response) => {
      const { orderId } = req.params;
      const payload = req.body as UpdateOrderItemsPayload;

      // Deliverect Generic Picking contract: only acknowledges receipt; final result arrives via /update events
      res.status(200).json({
        status: 'ACKNOWLEDGED',
        orderId,
        updateCount: payload.updates?.length || 0,
        message: 'Batch item mutations accepted for processing',
      });
    });

    // 6. Reject order: POST /picking/order/:orderId/reject
    this.app.post('/picking/order/:orderId/reject', verifyAuth, (req: Request, res: Response) => {
      const { orderId } = req.params;
      const { location, reason, reasonType } = req.body as RejectOrderPayload;

      res.json({
        status: 'success',
        orderId,
        pickerStatus: 'REJECTED',
        location,
        reason,
        reasonType,
      });
    });

    // 7. Finish order: POST /picking/order/:orderId/done
    this.app.post('/picking/order/:orderId/done', verifyAuth, (req: Request, res: Response) => {
      const { orderId } = req.params;

      res.json({
        status: 'success',
        orderId,
        pickerStatus: 'COMPLETED',
        message: 'Order picking finalized successfully',
      });
    });

    // 8. Couriers count: POST /picking/order/:orderId/couriers
    this.app.post('/picking/order/:orderId/couriers', verifyAuth, (req: Request, res: Response) => {
      const { orderId } = req.params;
      const { count, reason, updatedBy } = req.body as CourierCountPayload;

      if (typeof count !== 'number' || count < 0) {
        return res.status(412).json({
          error: 'Precondition Failed: Courier count must be a non-negative number',
        });
      }

      res.json({
        status: 'success',
        orderId,
        courierCount: count,
        reason,
        updatedBy,
      });
    });

    // --- Simulator & Assertions Endpoints ---
    this.app.get('/mock/calls', (req: Request, res: Response) => {
      res.json({ calls: this.recordedCalls });
    });

    this.app.post('/mock/clear-calls', (req: Request, res: Response) => {
      this.recordedCalls = [];
      res.json({ cleared: true });
    });

    this.app.post('/mock/config', (req: Request, res: Response) => {
      this.config = { ...this.config, ...req.body };
      res.json({ config: this.config });
    });

    this.app.get('/mock/sample-orders', (req: Request, res: Response) => {
      const location = (req.query.location as string) || 'loc_london_flagship';
      res.json({ orders: createSampleGroceryOrders(location) });
    });
  }

  /**
   * Helper to sign a payload with HMAC-SHA256 hex string
   */
  public signPayload(payload: any, secret?: string): string {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const key = secret || this.config.hmacSecret || 'loc_london_flagship';
    return crypto.createHmac('sha256', key).update(raw).digest('hex');
  }

  /**
   * Generates sample webhook request headers
   */
  public getWebhookHeaders(payload: any, secret?: string): Record<string, string> {
    const signature = this.signPayload(payload, secret);
    const headerKey = this.config.hmacHeader || 'x-deliverect-hmac-sha256';
    return {
      'content-type': 'application/json',
      [headerKey]: signature,
      // Also provide the alternate header for compatibility testing
      'x-server-authorization-hmac-sha256': signature,
    };
  }
}
