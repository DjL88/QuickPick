/**
 * @file apps/server/src/deliverectClient.ts
 * Outbound Deliverect Generic Picking API client with OAuth2 token caching,
 * auto-refresh on 401, and configurable base URL.
 */

import {
  UpdateOrderItemsPayload,
  SuggestSubstituteResponse,
  RejectOrderPayload,
  CourierCountPayload
} from '../../../packages/contracts/src/index.js';

export interface DeliverectClientConfig {
  baseUrl?: string;
  clientId?: string;
  clientSecret?: string;
  scope?: string;
  audience?: string;
  fetchHandler?: (url: string, init?: any) => Promise<Response>;
}

export interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

export class DeliverectClient {
  public baseUrl: string;
  public clientId: string;
  public clientSecret: string;
  public scope: string;
  public audience?: string;
  public fetchHandler?: (url: string, init?: any) => Promise<Response>;

  private tokenCache: CachedToken | null = null;
  private tokenFetchPromise: Promise<string> | null = null;

  constructor(config: DeliverectClientConfig = {}) {
    this.baseUrl = (config.baseUrl || process.env.DELIVERECT_BASE_URL || 'https://api.staging.deliverect.io').replace(/\/$/, '');
    this.clientId = config.clientId || process.env.OAUTH_CLIENT_ID || 'ltx-picker-client-id';
    this.clientSecret = config.clientSecret || process.env.OAUTH_CLIENT_SECRET || 'ltx-picker-secret-key';
    this.scope = config.scope || 'genericPicking';
    this.audience = config.audience || process.env.OAUTH_AUDIENCE;
    this.fetchHandler = config.fetchHandler;
  }

  private async executeFetch(url: string, init: any): Promise<Response> {
    if (this.fetchHandler) {
      return this.fetchHandler(url, init);
    }
    return fetch(url, init);
  }

  /**
   * Retrieves a valid OAuth2 bearer token, using cached token if unexpired.
   */
  public async getAccessToken(forceRefresh = false): Promise<string> {
    const now = Date.now();
    // Cache valid with 60 second safety buffer
    if (!forceRefresh && this.tokenCache && this.tokenCache.expiresAt > now + 60000) {
      return this.tokenCache.accessToken;
    }

    if (this.tokenFetchPromise && !forceRefresh) {
      return this.tokenFetchPromise;
    }

    this.tokenFetchPromise = this.fetchNewToken();
    try {
      const token = await this.tokenFetchPromise;
      return token;
    } finally {
      this.tokenFetchPromise = null;
    }
  }

  private async fetchNewToken(): Promise<string> {
    const tokenUrl = `${this.baseUrl}/oauth/token`;
    const payload: Record<string, string> = {
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: this.scope,
    };
    if (this.audience) {
      payload.audience = this.audience;
    }

    const response = await this.executeFetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Deliverect OAuth token failure (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600;
    this.tokenCache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + expiresIn * 1000,
    };

    return data.access_token;
  }

  /**
   * Executes an authenticated request to Deliverect, automatically refreshing token on 401.
   */
  public async request<T = any>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: any;
      query?: Record<string, any>;
      headers?: Record<string, string>;
    } = {}
  ): Promise<{ status: number; data: T }> {
    let token = await this.getAccessToken();

    let url = `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    if (options.query) {
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(options.query)) {
        if (v !== undefined && v !== null) q.append(k, String(v));
      }
      const qs = q.toString();
      if (qs) url += (url.includes('?') ? '&' : '?') + qs;
    }

    const makeFetch = async (authToken: string) => {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      };

      return this.executeFetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
    };

    let resp = await makeFetch(token);

    // Refresh on 401 and retry once
    if (resp.status === 401) {
      token = await this.getAccessToken(true);
      resp = await makeFetch(token);
    }

    let responseData: any;
    const contentType = resp.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        responseData = await resp.json();
      } catch {
        responseData = null;
      }
    } else {
      responseData = await resp.text();
    }

    return {
      status: resp.status,
      data: responseData,
    };
  }

  // Contract Methods

  /**
   * POST /picking/order/{orderId}/start
   */
  public async startPicking(orderId: string) {
    return this.request(`/picking/order/${encodeURIComponent(orderId)}/start`, {
      method: 'POST',
    });
  }

  /**
   * POST /picking/order/{orderId}/item/{itemId}/pick
   */
  public async pickItem(
    orderId: string,
    itemId: string,
    data: { pickedWeight?: number; isSubItem?: boolean; timestamp?: string; location?: string; notes?: string }
  ) {
    return this.request(`/picking/order/${encodeURIComponent(orderId)}/item/${encodeURIComponent(itemId)}/pick`, {
      method: 'POST',
      body: {
        pickedWeight: data.pickedWeight,
        isSubItem: !!data.isSubItem,
        timestamp: data.timestamp || new Date().toISOString(),
        location: data.location,
        notes: data.notes,
      },
    });
  }

  /**
   * POST or GET /picking/order/{orderId}/item/{itemId}/suggestSubstitute?reason=OUT_OF_STOCK
   */
  public async suggestSubstitute(orderId: string, itemId: string, reason: string = 'OUT_OF_STOCK') {
    // Deliverect contract specifies suggestSubstitute with query param reason
    return this.request<SuggestSubstituteResponse>(
      `/picking/order/${encodeURIComponent(orderId)}/item/${encodeURIComponent(itemId)}/suggestSubstitute`,
      {
        method: 'GET',
        query: { reason },
      }
    );
  }

  /**
   * POST /picking/order/{orderId}/updateOrderItems
   * body: { callbackUrl, updates: [...] }
   */
  public async updateOrderItems(orderId: string, payload: UpdateOrderItemsPayload) {
    return this.request(`/picking/order/${encodeURIComponent(orderId)}/updateOrderItems`, {
      method: 'POST',
      body: payload,
    });
  }

  /**
   * POST /picking/order/{orderId}/reject
   * body: { location, reason, reasonType }
   */
  public async rejectOrder(orderId: string, payload: RejectOrderPayload) {
    return this.request(`/picking/order/${encodeURIComponent(orderId)}/reject`, {
      method: 'POST',
      body: payload,
    });
  }

  /**
   * POST /picking/order/{orderId}/done
   */
  public async completeOrder(orderId: string) {
    return this.request(`/picking/order/${encodeURIComponent(orderId)}/done`, {
      method: 'POST',
    });
  }

  /**
   * POST /picking/order/{orderId}/couriers
   * body: { count, reason?, updatedBy? } (412 = precondition failed)
   */
  public async updateCouriers(orderId: string, payload: CourierCountPayload) {
    return this.request(`/picking/order/${encodeURIComponent(orderId)}/couriers`, {
      method: 'POST',
      body: payload,
    });
  }
}
