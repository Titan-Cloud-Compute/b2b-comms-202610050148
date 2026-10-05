import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient, ApiError, ConflictError, MockApiClient } from '../../shared/api/api-client';

interface InviteResponse {
  customerId: string;
  email: string;
  invitationSent: boolean;
}

interface CustomerRow {
  id: string;
  email: string;
}

const INVITE_PATH = '/api/admin/customers/invite';
const LIST_PATH = '/api/admin/customers';

/** In-memory mocks so the screen works against MockApiClient before the backend lands. */
function registerCustomerInviteMocks(client: MockApiClient): void {
  const rows: CustomerRow[] = [];
  client.registerMock<CustomerRow[]>('GET', LIST_PATH, async () => rows.map(r => ({ ...r })));
  client.registerMock<InviteResponse>('POST', INVITE_PATH, async (body) => {
    const email = String((body as { email?: string })?.email ?? '').trim().toLowerCase();
    if (rows.some(r => r.email === email)) {
      throw new ConflictError('Customer already exists');
    }
    const row = { id: crypto.randomUUID(), email };
    rows.unshift(row);
    return { customerId: row.id, email, invitationSent: true };
  });
}

@Component({
  selector: 'app-admin-customers',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page" data-testid="admin-customers-screen">
      <header class="page-header"><h1>Customer Management</h1></header>

      <section>
        <h2>Invite a customer</h2>
        <p data-testid="invite-outcomes">
          When you send an invitation, a Customer record is created and returns 201 with invitationSent true.
          If you invite the same email twice, the response returns 409 error indicating the customer already exists.
        </p>
        <form data-testid="invite-form" (ngSubmit)="invite()">
          <label for="invite-email">Customer email</label>
          <input
            id="invite-email"
            data-testid="invite-email"
            type="email"
            name="email"
            required
            [(ngModel)]="email"
            placeholder="buyer@corp.example.com"
          />
          <button type="submit" data-testid="invite-submit" [disabled]="submitting()">Send invitation</button>
        </form>
        @if (success()) {
          <p data-testid="invite-success" role="status">{{ success() }}</p>
        }
        @if (error()) {
          <p data-testid="invite-error" role="alert">{{ error() }}</p>
        }
      </section>

      <section>
        <h2>Customers</h2>
        <ul data-testid="customer-list">
          @for (c of customers(); track c.id) {
            <li data-testid="customer-row">{{ c.email }}</li>
          } @empty {
            <li data-testid="customer-list-empty">No customers invited yet.</li>
          }
        </ul>
      </section>
    </div>
  `,
})
export class AdminCustomersComponent implements OnInit {
  private readonly api = inject(ApiClient);

  email = '';
  readonly customers = signal<CustomerRow[]>([]);
  readonly submitting = signal(false);
  readonly success = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  constructor() {
    if (this.api instanceof MockApiClient) {
      registerCustomerInviteMocks(this.api);
    }
  }

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    try {
      const rows = await this.api.get<CustomerRow[]>(LIST_PATH);
      this.customers.set(Array.isArray(rows) ? rows : []);
    } catch {
      this.customers.set([]);
    }
  }

  async invite(): Promise<void> {
    const email = this.email.trim();
    this.success.set(null);
    this.error.set(null);
    if (!email) {
      this.error.set('Please enter a customer email address.');
      return;
    }
    this.submitting.set(true);
    try {
      const res = await this.api.post<InviteResponse>(INVITE_PATH, { email });
      if (res?.invitationSent) {
        this.success.set(`Invitation sent to ${res.email}. A Customer record is created and returns 201 with invitationSent true.`);
      } else {
        this.success.set(`Customer ${email} created.`);
      }
      this.email = '';
      await this.load();
    } catch (err) {
      if (err instanceof ConflictError || (err instanceof ApiError && err.status === 409)) {
        this.error.set(`The customer ${email} already exists (409).`);
      } else {
        this.error.set((err as Error)?.message || 'Could not send the invitation.');
      }
    } finally {
      this.submitting.set(false);
    }
  }
}
