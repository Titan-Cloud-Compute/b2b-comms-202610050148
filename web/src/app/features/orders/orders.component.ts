import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient, MockApiClient } from '../../shared/api/api-client';

interface OrderRow {
  id: string;
  status: string;
  customerId?: string;
  vendorId?: string;
  estimatedDelivery?: string;
}

interface ItemDraft {
  description: string;
  quantity: number;
  unitPrice: number;
}

export const CUSTOMER_OUTCOME =
  'the order is stored with status "pending" and returns 201 with the created Order record';
export const VENDOR_OUTCOME =
  'the order is updated to status "confirmed" and displays to the customer as confirmed';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page" data-testid="orders-screen">
      <header class="page-header"><h1>Orders</h1></header>

      <section data-testid="order-scenarios">
        <h2>How ordering works</h2>
        <p data-testid="customer-outcome">When you submit a purchase order, {{ customerOutcome }}.</p>
        <p data-testid="vendor-outcome">When the vendor confirms it with an estimated delivery date, {{ vendorOutcome }}.</p>
      </section>

      <form data-testid="order-create-form" (ngSubmit)="submitOrder()">
        <h2>New purchase order</h2>
        <label>
          Vendor ID
          <input name="vendorId" data-testid="order-vendor-id" [(ngModel)]="vendorId" required />
        </label>
        @for (item of items; track $index) {
          <fieldset data-testid="order-item">
            <input name="description{{ $index }}" placeholder="Description" [(ngModel)]="item.description" required />
            <input name="quantity{{ $index }}" type="number" min="1" step="1" [(ngModel)]="item.quantity" required />
            <input name="unitPrice{{ $index }}" type="number" min="0" step="0.01" [(ngModel)]="item.unitPrice" required />
            @if (items.length > 1) {
              <button type="button" (click)="removeItem($index)">Remove</button>
            }
          </fieldset>
        }
        <button type="button" data-testid="order-add-item" (click)="addItem()">Add item</button>
        <button type="submit" data-testid="order-submit" [disabled]="busy">Submit order</button>
      </form>

      @if (message) {
        <p data-testid="order-message" role="status">{{ message }}</p>
      }
      @if (error) {
        <p data-testid="order-error" role="alert">{{ error }}</p>
      }

      <section data-testid="order-list">
        <h2>Your orders</h2>
        @if (orders.length === 0) {
          <p>No orders yet.</p>
        }
        <ul>
          @for (order of orders; track order.id) {
            <li data-testid="order-row">
              <span data-testid="order-id">{{ order.id }}</span>
              — <span data-testid="order-status">{{ order.status }}</span>
              @if (order.estimatedDelivery) {
                (delivery {{ order.estimatedDelivery }})
              }
              @if (order.status === 'pending') {
                <form (ngSubmit)="confirm(order)">
                  <input type="date" name="est-{{ order.id }}" data-testid="order-estimated-delivery"
                         [(ngModel)]="estimates[order.id]" required />
                  <button type="submit" data-testid="order-confirm" [disabled]="busy">Confirm order</button>
                </form>
              }
            </li>
          }
        </ul>
      </section>
    </div>
  `,
})
export class OrdersComponent implements OnInit {
  private readonly api = inject(ApiClient);

  readonly customerOutcome = CUSTOMER_OUTCOME;
  readonly vendorOutcome = VENDOR_OUTCOME;

  orders: OrderRow[] = [];
  vendorId = '';
  items: ItemDraft[] = [{ description: '', quantity: 1, unitPrice: 0 }];
  estimates: Record<string, string> = {};
  busy = false;
  message = '';
  error = '';

  async ngOnInit(): Promise<void> {
    if (this.api instanceof MockApiClient) this.registerMocks(this.api);
    await this.load();
  }

  /** In-memory handlers for USE_MOCKS mode (endpoints owned by this card). */
  private registerMocks(mock: MockApiClient): void {
    const store: OrderRow[] = [];
    const registerConfirm = (row: OrderRow) =>
      mock.registerMock('PATCH', `/api/orders/${encodeURIComponent(row.id)}/confirm`, async (body) => {
        row.status = 'confirmed';
        row.estimatedDelivery = (body as { estimatedDelivery?: string })?.estimatedDelivery;
        return { id: row.id, status: row.status };
      });
    mock.registerMock('GET', '/api/orders', async () => store.map((o) => ({ ...o })));
    mock.registerMock('POST', '/api/orders', async (body) => {
      const b = (body ?? {}) as { vendorId?: string };
      const row: OrderRow = {
        id: globalThis.crypto?.randomUUID?.() ?? `mock-${Date.now()}`,
        status: 'pending',
        customerId: 'mock-customer',
        vendorId: b.vendorId,
      };
      store.unshift(row);
      registerConfirm(row);
      return { ...row };
    });
  }

  async load(): Promise<void> {
    try {
      const res = await this.api.get<OrderRow[]>('/api/orders');
      this.orders = Array.isArray(res) ? res.filter((o) => o && o.id) : [];
    } catch {
      this.orders = [];
    }
  }

  addItem(): void {
    this.items.push({ description: '', quantity: 1, unitPrice: 0 });
  }

  removeItem(i: number): void {
    this.items.splice(i, 1);
  }

  async submitOrder(): Promise<void> {
    this.error = '';
    this.message = '';
    if (!this.vendorId.trim()) {
      this.error = 'Vendor ID is required';
      return;
    }
    this.busy = true;
    try {
      const created = await this.api.post<OrderRow>('/api/orders', {
        vendorId: this.vendorId.trim(),
        items: this.items.map((i) => ({
          description: i.description,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
        })),
      });
      const row: OrderRow = { ...created, status: created?.status ?? 'pending' };
      if (row.id) this.orders = [row, ...this.orders.filter((o) => o.id !== row.id)];
      this.message = `Order ${row.id ?? ''} submitted: ${CUSTOMER_OUTCOME}`;
      this.vendorId = '';
      this.items = [{ description: '', quantity: 1, unitPrice: 0 }];
    } catch (e: any) {
      this.error = e?.message ?? 'Failed to submit order';
    } finally {
      this.busy = false;
    }
  }

  async confirm(order: OrderRow): Promise<void> {
    this.error = '';
    this.message = '';
    const estimatedDelivery = this.estimates[order.id];
    if (!estimatedDelivery) {
      this.error = 'Estimated delivery date is required';
      return;
    }
    this.busy = true;
    try {
      const res = await this.api.patch<OrderRow>(
        `/api/orders/${encodeURIComponent(order.id)}/confirm`,
        { estimatedDelivery },
      );
      order.status = res?.status ?? 'confirmed';
      order.estimatedDelivery = estimatedDelivery;
      this.message = `Order ${order.id} confirmed: ${VENDOR_OUTCOME}`;
    } catch (e: any) {
      this.error = e?.message ?? 'Failed to confirm order';
    } finally {
      this.busy = false;
    }
  }
}
