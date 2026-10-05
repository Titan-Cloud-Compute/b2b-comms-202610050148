import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient, MockApiClient } from '../../shared/api/api-client';

interface InvoiceDto {
  id: string;
  orderId: string;
  amount: number;
}

interface InvoiceDownloadDto {
  id: string;
  downloadUrl: string;
}

const VENDOR_OUTCOME = 'the invoice is created and returns 201 with the invoice id available for download';
const CUSTOMER_OUTCOME = 'the response returns 200 with a downloadUrl pointing to the stored invoice';

@Component({
  selector: 'app-invoices',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div data-testid="invoices-screen">
      <h1>Invoices</h1>

      <section>
        <h2>Generate invoice</h2>
        <p>When you generate an invoice for a confirmed order, {{ vendorOutcome }}.</p>
        <form data-testid="invoice-generate-form" (ngSubmit)="generate()">
          <label>
            Order ID
            <input data-testid="invoice-order-id" name="orderId" [(ngModel)]="orderId" required />
          </label>
          <label>
            Amount
            <input data-testid="invoice-amount" name="amount" type="number" step="0.01" [(ngModel)]="amount" required />
          </label>
          <button type="submit" data-testid="invoice-generate-submit" [disabled]="busy">Generate invoice</button>
        </form>
        @if (created) {
          <p data-testid="invoice-created">Invoice {{ created.id }} created (201): {{ vendorOutcome }}</p>
        }
        @if (generateError) {
          <p data-testid="invoice-generate-error" role="alert">{{ generateError }}</p>
        }
      </section>

      <section>
        <h2>Download invoice</h2>
        <p>When a customer requests the invoice download link, {{ customerOutcome }}.</p>
        <form data-testid="invoice-download-form" (ngSubmit)="download()">
          <label>
            Invoice ID
            <input data-testid="invoice-download-id" name="invoiceId" [(ngModel)]="invoiceId" required />
          </label>
          <button type="submit" data-testid="invoice-download-submit" [disabled]="busy">Get download link</button>
        </form>
        @if (downloadInfo) {
          <p data-testid="invoice-download-result">
            <a [href]="downloadInfo.downloadUrl" target="_blank" rel="noopener">{{ downloadInfo.downloadUrl }}</a>
            (200): {{ customerOutcome }}
          </p>
        }
        @if (downloadError) {
          <p data-testid="invoice-download-error" role="alert">{{ downloadError }}</p>
        }
      </section>
    </div>
  `,
})
export class InvoicesComponent {
  private readonly api = inject(ApiClient);

  readonly vendorOutcome = VENDOR_OUTCOME;
  readonly customerOutcome = CUSTOMER_OUTCOME;

  orderId = '';
  amount: number | null = null;
  invoiceId = '';
  busy = false;
  created: InvoiceDto | null = null;
  downloadInfo: InvoiceDownloadDto | null = null;
  generateError = '';
  downloadError = '';

  constructor() {
    if (this.api instanceof MockApiClient) {
      const mock = this.api;
      mock.registerMock<InvoiceDto>('POST', '/api/invoices', async (body) => {
        const b = (body ?? {}) as { orderId?: string; amount?: number };
        const id = crypto.randomUUID();
        mock.registerMock<InvoiceDownloadDto>('GET', `/api/invoices/${id}/download`, async () => ({
          id,
          downloadUrl: `/files/invoices/${id}.pdf`,
        }));
        return { id, orderId: String(b.orderId ?? ''), amount: Number(b.amount ?? 0) };
      });
    }
  }

  async generate(): Promise<void> {
    this.generateError = '';
    this.created = null;
    if (!this.orderId || this.amount === null) {
      this.generateError = 'Order ID and amount are required.';
      return;
    }
    this.busy = true;
    try {
      this.created = await this.api.post<InvoiceDto>('/api/invoices', {
        orderId: this.orderId.trim(),
        amount: Number(this.amount),
      });
      this.invoiceId = this.created.id;
    } catch (e: any) {
      this.generateError = e?.message || 'Could not generate invoice.';
    } finally {
      this.busy = false;
    }
  }

  async download(): Promise<void> {
    this.downloadError = '';
    this.downloadInfo = null;
    const id = this.invoiceId.trim();
    if (!id) {
      this.downloadError = 'Invoice ID is required.';
      return;
    }
    this.busy = true;
    try {
      this.downloadInfo = await this.api.get<InvoiceDownloadDto>(`/api/invoices/${encodeURIComponent(id)}/download`);
    } catch (e: any) {
      this.downloadError = e?.message || 'Could not fetch download link.';
    } finally {
      this.busy = false;
    }
  }
}
