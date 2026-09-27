export type PrinterPurpose = 'RECEIPT' | 'TOTE_LABEL' | 'BAG_LABEL';
export type PrinterTransport = 'MOCK' | 'ESC_POS_NETWORK' | 'BLUETOOTH' | 'NATIVE_BRIDGE';
export type PrinterStatus = 'AVAILABLE' | 'OFFLINE' | 'UNCONFIGURED';

export interface PrinterTarget {
  id: string;
  name: string;
  purpose: PrinterPurpose;
  transport: PrinterTransport;
  status: PrinterStatus;
}

export interface PrinterJob {
  id: string;
  printerId: string;
  purpose: PrinterPurpose;
  title: string;
  lines: string[];
  copies?: number;
  metadata?: Record<string, unknown>;
}

export interface PrinterResult {
  ok: boolean;
  jobId: string;
  provider: string;
  printedAt?: string;
  message?: string;
}

export interface PrinterProvider {
  readonly id: string;
  listPrinters(): Promise<PrinterTarget[]>;
  print(job: PrinterJob): Promise<PrinterResult>;
}

export class MockPrinterProvider implements PrinterProvider {
  readonly id = 'mock';
  readonly jobs: PrinterJob[] = [];

  constructor(
    private readonly targets: PrinterTarget[] = [
      { id: 'demo-receipt', name: 'Demo receipt printer', purpose: 'RECEIPT', transport: 'MOCK', status: 'AVAILABLE' },
      { id: 'demo-tote', name: 'Demo tote label', purpose: 'TOTE_LABEL', transport: 'MOCK', status: 'AVAILABLE' },
      { id: 'demo-bag', name: 'Demo bag label', purpose: 'BAG_LABEL', transport: 'MOCK', status: 'AVAILABLE' },
    ]
  ) {}

  async listPrinters(): Promise<PrinterTarget[]> {
    return this.targets.map((target) => ({ ...target }));
  }

  async print(job: PrinterJob): Promise<PrinterResult> {
    const target = this.targets.find((entry) => entry.id === job.printerId);
    if (!target || target.status !== 'AVAILABLE') {
      return {
        ok: false,
        jobId: job.id,
        provider: this.id,
        message: 'Printer is not available in the demo provider.',
      };
    }

    this.jobs.push({
      ...job,
      lines: [...job.lines],
      metadata: job.metadata ? { ...job.metadata } : undefined,
    });

    return {
      ok: true,
      jobId: job.id,
      provider: this.id,
      printedAt: new Date().toISOString(),
      message: 'Captured by the demo printer provider.',
    };
  }
}

export const demoPrinterProvider = new MockPrinterProvider();
