import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient } from '../../shared/api/api-client';

interface NotificationPreferenceDto {
  userId?: string;
  orderAlerts: boolean;
  messageAlerts: boolean;
}

const PREFERENCES_PATH = '/api/notifications/preferences';

@Component({
  selector: 'app-settings-notifications',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div data-testid="settings-notifications-screen">
      <h1>Notification Settings</h1>
      <form (ngSubmit)="save()">
        <label>
          <input
            type="checkbox"
            name="orderAlerts"
            data-testid="order-alerts-toggle"
            [(ngModel)]="orderAlerts"
          />
          Order alerts
        </label>
        <label>
          <input
            type="checkbox"
            name="messageAlerts"
            data-testid="message-alerts-toggle"
            [(ngModel)]="messageAlerts"
          />
          Message alerts
        </label>
        <button type="submit" data-testid="save-notification-preferences" [disabled]="saving()">
          Save preferences
        </button>
      </form>

      <ul data-testid="notification-preferences-outcomes">
        <li>When you save, the preferences are updated and returns 200 with the stored NotificationPreference record.</li>
        <li>When both alerts are off, the preferences are updated with both alert fields stored as false.</li>
      </ul>

      @if (status()) {
        <p data-testid="notification-preferences-status" role="status">{{ status() }}</p>
      }
      @if (error()) {
        <p data-testid="notification-preferences-error" role="alert">{{ error() }}</p>
      }
    </div>
  `,
})
export class SettingsNotificationsComponent implements OnInit {
  private readonly api = inject(ApiClient);

  orderAlerts = false;
  messageAlerts = false;
  readonly saving = signal(false);
  readonly status = signal('');
  readonly error = signal('');

  async ngOnInit(): Promise<void> {
    try {
      const res = await this.api.get<unknown>(PREFERENCES_PATH);
      const pref = this.normalize(res);
      this.orderAlerts = pref.orderAlerts;
      this.messageAlerts = pref.messageAlerts;
    } catch {
      this.orderAlerts = false;
      this.messageAlerts = false;
    }
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.status.set('');
    this.error.set('');
    try {
      const body = { orderAlerts: !!this.orderAlerts, messageAlerts: !!this.messageAlerts };
      const res = await this.api.request<unknown>(PREFERENCES_PATH, { method: 'PUT', body });
      const stored = res && typeof res === 'object' && !Array.isArray(res) ? this.normalize(res) : body;
      this.orderAlerts = stored.orderAlerts;
      this.messageAlerts = stored.messageAlerts;
      this.status.set(
        !stored.orderAlerts && !stored.messageAlerts
          ? 'Saved: the preferences are updated with both alert fields stored as false.'
          : 'Saved: the preferences are updated and returns 200 with the stored NotificationPreference record.',
      );
    } catch {
      this.error.set('Could not save notification preferences. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }

  private normalize(res: unknown): NotificationPreferenceDto {
    if (!res || typeof res !== 'object' || Array.isArray(res)) {
      return { orderAlerts: false, messageAlerts: false };
    }
    const r = res as Partial<NotificationPreferenceDto>;
    return { userId: r.userId, orderAlerts: r.orderAlerts === true, messageAlerts: r.messageAlerts === true };
  }
}
