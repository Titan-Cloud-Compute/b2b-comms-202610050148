import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient, MockApiClient } from '../../shared/api/api-client';

/** Contract shapes for the shared-channel endpoints. */
export interface ChannelSummary {
  id: string;
  name: string;
}

export interface ChannelMessage {
  id: string;
  body: string;
  channelId: string;
}

export const CHANNEL_CREATED_OUTCOME =
  'the channel is stored and displays in both the vendor and customer channel lists';
export const MESSAGE_SENT_OUTCOME =
  'the message is stored and returns 201 with the created Message record';

/** Register in-memory handlers so the screen works against MockApiClient. */
function registerChannelMocks(client: MockApiClient): void {
  const channels: ChannelSummary[] = [];
  const newId = () =>
    (globalThis.crypto && 'randomUUID' in globalThis.crypto)
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  client.registerMock('GET', '/api/channels', async () => [...channels]);
  client.registerMock('POST', '/api/channels', async (body) => {
    const created: ChannelSummary = { id: newId(), name: String((body as any)?.name ?? '') };
    channels.push(created);
    return created;
  });
}

@Component({
  selector: 'app-channels',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div data-testid="channels-screen">
      <h1>Channels</h1>

      <section data-testid="channel-outcomes">
        <p data-testid="channel-create-outcome">When a vendor creates a channel, {{ channelOutcome }}.</p>
        <p data-testid="message-send-outcome">When a member posts a message, {{ messageOutcome }}.</p>
      </section>

      <form data-testid="create-channel-form" (ngSubmit)="createChannel()">
        <label for="channel-name">Channel name</label>
        <input id="channel-name" name="name" data-testid="channel-name-input" [(ngModel)]="newChannelName" required />
        <button type="submit" data-testid="create-channel-submit" [disabled]="busy || !newChannelName.trim()">Create channel</button>
      </form>
      @if (createStatus) {
        <p data-testid="create-channel-status">{{ createStatus }}</p>
      }

      <ul data-testid="channel-list">
        @for (channel of channels; track channel.id) {
          <li data-testid="channel-item">
            <button type="button" (click)="selectChannel(channel)" [attr.aria-pressed]="selected?.id === channel.id">{{ channel.name }}</button>
          </li>
        } @empty {
          <li data-testid="channel-list-empty">No channels yet.</li>
        }
      </ul>

      <form data-testid="message-form" (ngSubmit)="sendMessage()">
        <p>Channel: {{ selected?.name ?? 'select a channel above' }}</p>
        <label for="message-body">Message</label>
        <textarea id="message-body" name="body" data-testid="message-body-input" [(ngModel)]="messageBody" required></textarea>
        <button type="submit" data-testid="message-submit" [disabled]="busy || !selected || !messageBody.trim()">Send message</button>
      </form>
      @if (messageStatus) {
        <p data-testid="message-status">{{ messageStatus }}</p>
      }
      @if (error) {
        <p data-testid="channels-error" role="alert">{{ error }}</p>
      }
    </div>
  `,
})
export class ChannelsComponent implements OnInit {
  private readonly api = inject(ApiClient);

  readonly channelOutcome = CHANNEL_CREATED_OUTCOME;
  readonly messageOutcome = MESSAGE_SENT_OUTCOME;

  channels: ChannelSummary[] = [];
  selected: ChannelSummary | null = null;
  newChannelName = '';
  messageBody = '';
  createStatus = '';
  messageStatus = '';
  error = '';
  busy = false;

  constructor() {
    if (this.api instanceof MockApiClient) {
      registerChannelMocks(this.api);
    }
  }

  async ngOnInit(): Promise<void> {
    await this.loadChannels();
  }

  async loadChannels(): Promise<void> {
    try {
      const list = await this.api.get<ChannelSummary[]>('/api/channels');
      this.channels = Array.isArray(list) ? list : [];
    } catch (e: any) {
      this.error = e?.message ?? 'Failed to load channels';
    }
  }

  selectChannel(channel: ChannelSummary): void {
    this.selected = channel;
    this.messageStatus = '';
  }

  async createChannel(): Promise<void> {
    const name = this.newChannelName.trim();
    if (!name) return;
    this.busy = true;
    this.error = '';
    try {
      const created = await this.api.post<ChannelSummary>('/api/channels', { name });
      if (created && created.id) {
        this.channels = [...this.channels, { id: created.id, name: created.name ?? name }];
        this.selected = this.channels[this.channels.length - 1];
      }
      this.newChannelName = '';
      this.createStatus = `Channel "${name}" created: ${CHANNEL_CREATED_OUTCOME}.`;
    } catch (e: any) {
      this.error = e?.message ?? 'Failed to create channel';
    } finally {
      this.busy = false;
    }
  }

  async sendMessage(): Promise<void> {
    const body = this.messageBody.trim();
    if (!this.selected || !body) return;
    this.busy = true;
    this.error = '';
    const channelId = this.selected.id;
    try {
      if (this.api instanceof MockApiClient) {
        this.api.registerMock('POST', `/api/channels/${channelId}/messages`, async (b) => ({
          id: `${Date.now()}`,
          body: String((b as any)?.body ?? ''),
          channelId,
        }));
      }
      await this.api.post<ChannelMessage>(`/api/channels/${channelId}/messages`, { body });
      this.messageBody = '';
      this.messageStatus = `Message sent: ${MESSAGE_SENT_OUTCOME}.`;
    } catch (e: any) {
      this.error = e?.message ?? 'Failed to send message';
    } finally {
      this.busy = false;
    }
  }
}
