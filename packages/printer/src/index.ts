/**
 * @file packages/printer/src/index.ts
 * QP-05 Device & Printer Seam for QuickPick.
 * Provides in-memory MockPrinterProvider for RECEIPT, TOTE_LABEL, and BAG_LABEL printing,
 * with clean seams for future ESC/POS, Bluetooth, and native bridge integration.
 */

import {
  PrintJob,
  PrintJobType,
  PrintResult,
  PrinterProvider,
  PickingOrder,
} from '../../contracts/src/index.js';

export class MockPrinterProvider implements PrinterProvider {
  public name = 'MockPrinterProvider (In-Memory)';
  private jobs: PrintJob[] = [];

  /**
   * Submit a print job to the in-memory mock printer
   */
  public async print(jobInput: Omit<PrintJob, 'id' | 'timestamp'>): Promise<PrintResult> {
    const id = 'prn_' + Math.random().toString(36).substring(2, 9);
    const timestamp = new Date().toISOString();

    const formattedPayload = this.formatJob(jobInput.type, jobInput);

    const job: PrintJob = {
      ...jobInput,
      id,
      timestamp,
      formattedPayload,
    };

    this.jobs.unshift(job);
    // Keep max 50 recent jobs in memory
    if (this.jobs.length > 50) {
      this.jobs.pop();
    }

    return {
      success: true,
      jobId: id,
      type: jobInput.type,
      printedAt: timestamp,
      message: `Successfully printed ${jobInput.type} for ${jobInput.channelOrderDisplayId}`,
    };
  }

  /**
   * Retrieve recent print jobs
   */
  public async getRecentJobs(): Promise<PrintJob[]> {
    return [...this.jobs];
  }

  /**
   * Clear in-memory print buffer
   */
  public async clearJobs(): Promise<void> {
    this.jobs = [];
  }

  /**
   * Text formatter for labels & receipts
   */
  private formatJob(type: PrintJobType, data: Partial<PrintJob>): string {
    const divider = '========================================';
    const thinDivider = '----------------------------------------';

    if (type === 'TOTE_LABEL') {
      return [
        divider,
        `  LTx QuickPick - TOTE LABEL`,
        divider,
        `ORDER: ${data.channelOrderDisplayId || 'N/A'}`,
        `CUSTOMER: ${data.customerName || 'N/A'}`,
        `TOTE ID: ${data.toteId || 'TOTE-01'}`,
        `PRINTED: ${new Date().toLocaleTimeString()}`,
        thinDivider,
        `[BARCODE: ${data.orderId}]`,
        divider,
      ].join('\n');
    }

    if (type === 'BAG_LABEL') {
      const bagIndex = data.bagIndex || 1;
      const totalBags = data.totalBags || 1;
      return [
        divider,
        `  LTx QuickPick - BAG DISPATCH LABEL`,
        divider,
        `BAG ${bagIndex} OF ${totalBags}`,
        `ORDER: ${data.channelOrderDisplayId || 'N/A'}`,
        `CUSTOMER: ${data.customerName || 'N/A'}`,
        `COURIERS: ${data.courierCount || 1}`,
        thinDivider,
        `Handle with care. Temperature verified.`,
        divider,
      ].join('\n');
    }

    // Default: RECEIPT
    const itemsText = (data.items || [])
      .map(
        (i) =>
          `• ${i.quantity}x ${i.name.slice(0, 24).padEnd(24)} ${
            i.price ? `£${(i.price / 100).toFixed(2)}` : ''
          }`
      )
      .join('\n');

    return [
      divider,
      `      LTx QuickPick DISPATCH RECEIPT`,
      divider,
      `Order: ${data.channelOrderDisplayId}`,
      `Customer: ${data.customerName}`,
      `Date: ${new Date().toLocaleString()}`,
      thinDivider,
      itemsText || '(No items listed)',
      thinDivider,
      `Total items declared and verified.`,
      `Thank you for ordering with Deliverect!`,
      divider,
    ].join('\n');
  }
}

// Export default singleton instance
export const mockPrinter = new MockPrinterProvider();

/**
 * Convenience helper to print order receipt
 */
export async function printOrderReceipt(order: PickingOrder): Promise<PrintResult> {
  const items = order.items.map((i) => ({
    name: i.name,
    quantity: i.pickedQuantity || i.quantity || 1,
    plu: i.plu,
    price: i.price,
    pickedWeight: i.pickedWeight,
  }));

  return mockPrinter.print({
    type: 'RECEIPT',
    orderId: order._id,
    channelOrderDisplayId: order.channelOrderDisplayId,
    customerName: order.customer.name,
    items,
    courierCount: order.courierCount || 1,
  });
}

/**
 * Convenience helper to print tote label
 */
export async function printToteLabel(order: PickingOrder, toteId: string = 'TOTE-01'): Promise<PrintResult> {
  return mockPrinter.print({
    type: 'TOTE_LABEL',
    orderId: order._id,
    channelOrderDisplayId: order.channelOrderDisplayId,
    customerName: order.customer.name,
    toteId,
  });
}

/**
 * Convenience helper to print bag labels
 */
export async function printBagLabels(order: PickingOrder, totalBags: number = 1): Promise<PrintResult[]> {
  const results: PrintResult[] = [];
  for (let i = 1; i <= totalBags; i++) {
    const res = await mockPrinter.print({
      type: 'BAG_LABEL',
      orderId: order._id,
      channelOrderDisplayId: order.channelOrderDisplayId,
      customerName: order.customer.name,
      bagIndex: i,
      totalBags,
      courierCount: order.courierCount || 1,
    });
    results.push(res);
  }
  return results;
}
