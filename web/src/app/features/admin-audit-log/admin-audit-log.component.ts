import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient } from '../../shared/api/api-client';

export interface AuditEntry {
  id: string;
  action: string;
  userId: string;
  createdAt: string;
}

const AUDIT_LOG_PATH = 'api/admin/audit-log';

@Component({
  selector: 'app-admin-audit-log',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="page" data-testid="admin-audit-log-screen">
      <header class="page-header"><h1>Audit Log</h1></header>

      <section>
        <h2>Audit entries</h2>
        <p>Admin views audit log: a list of AuditEntry records is displayed in chronological order returns 200</p>
        @if (loading()) {
          <p>Loading audit entries…</p>
        } @else if (error()) {
          <p role="alert">{{ error() }}</p>
        } @else if (entries().length === 0) {
          <p>No audit entries yet.</p>
        } @else {
          <table>
            <thead>
              <tr><th>ID</th><th>Action</th><th>User ID</th><th>Created at</th></tr>
            </thead>
            <tbody>
              @for (e of entries(); track e.id) {
                <tr>
                  <td>{{ e.id }}</td>
                  <td>{{ e.action }}</td>
                  <td>{{ e.userId }}</td>
                  <td>{{ e.createdAt }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
      </section>

      <section>
        <h2>Record an entry</h2>
        <p>System records audit entry: the AuditEntry is stored and returns 201 with the created record</p>
        <form (ngSubmit)="record()">
          <label>Action <input name="action" [(ngModel)]="action" required /></label>
          <label>User ID <input name="userId" [(ngModel)]="userId" required /></label>
          <button type="submit" [disabled]="saving() || !action.trim() || !userId.trim()">Record</button>
        </form>
        @if (saveError()) {
          <p role="alert">{{ saveError() }}</p>
        }
      </section>
    </div>
  `,
})
export class AdminAuditLogComponent implements OnInit {
  private readonly api = inject(ApiClient);

  readonly entries = signal<AuditEntry[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);

  action = '';
  userId = '';

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const rows = await this.api.get<AuditEntry[]>(AUDIT_LOG_PATH);
      this.entries.set(sortChronologically(Array.isArray(rows) ? rows : []));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Failed to load audit log');
    } finally {
      this.loading.set(false);
    }
  }

  async record(): Promise<void> {
    const action = this.action.trim();
    const userId = this.userId.trim();
    if (!action || !userId) return;
    this.saving.set(true);
    this.saveError.set(null);
    try {
      // POST response contract omits userId; fall back to the submitted value.
      const created = await this.api.post<Omit<AuditEntry, 'userId'> & { userId?: string }>(
        AUDIT_LOG_PATH,
        { action, userId },
      );
      if (created && typeof created === 'object' && 'id' in created) {
        this.entries.set(
          sortChronologically([...this.entries(), { ...created, userId: created.userId ?? userId }]),
        );
      }
      this.action = '';
      this.userId = '';
    } catch (e) {
      this.saveError.set(e instanceof Error ? e.message : 'Failed to record audit entry');
    } finally {
      this.saving.set(false);
    }
  }
}

function sortChronologically(rows: AuditEntry[]): AuditEntry[] {
  return [...rows].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}
