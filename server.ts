/**
 * @file server.ts
 * Main entry point for LTx Picker full-stack application.
 * Runs Express backend with Deliverect Generic Picking API routes and Vite middleware on port 3000.
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createApp } from './apps/server/src/app.js';
import { globalStore } from './apps/server/src/store.js';
import { createSampleGroceryOrders } from './packages/mock-deliverect/src/orders.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';

async function bootstrap() {
  const { app, outboxWorker } = createApp();

  // Pre-seed sample retail grocery orders for instant picking testing
  const initialOrders = createSampleGroceryOrders('loc_london_flagship');
  for (const ord of initialOrders) {
    globalStore.saveOrder(ord, ord);
  }
  console.log(`[LTx Picker] Seeded ${initialOrders.length} initial retail grocery orders`);

  if (!isProduction) {
    // Development mode: Mount Vite middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: Serve static assets
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[LTx Picker] Server running on port ${PORT} (${isProduction ? 'production' : 'development'})`);
    console.log(`[LTx Picker] Deliverect Picking Inbound Webhook ready at http://localhost:${PORT}/picking/order`);
  });
}

bootstrap().catch((err) => {
  console.error('[LTx Picker] Server failed to start:', err);
  process.exit(1);
});
