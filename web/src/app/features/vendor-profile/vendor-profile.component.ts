import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient, MockApiClient } from '../../shared/api/api-client';

export interface VendorProfileRecord {
  id: string;
  companyName: string;
  contactEmail: string;
}

export interface VendorDocument {
  id: string;
  filename: string;
  status: string;
}

/** Registers in-memory handlers so the screen works when USE_MOCKS is on. */
function registerVendorMocks(client: MockApiClient): void {
  let profile: VendorProfileRecord | null = null;
  const docs: VendorDocument[] = [];
  let seq = 0;
  client.registerMock('POST', '/api/vendor/profile', async (body) => {
    const b = body as { companyName: string; contactEmail: string };
    profile = { id: profile?.id ?? `mock-vp-${++seq}`, companyName: b.companyName, contactEmail: b.contactEmail };
    return profile;
  });
  client.registerMock('POST', '/api/vendor/documents', async (body) => {
    const d: VendorDocument = { id: `mock-doc-${++seq}`, filename: (body as { filename: string }).filename, status: 'pending' };
    docs.unshift(d);
    return d;
  });
  client.registerMock('GET', '/api/vendor/documents', async () => [...docs]);
}

@Component({
  selector: 'app-vendor-profile',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div data-testid="vendor-profile-screen">
      <h1>Vendor Profile</h1>

      <section>
        <h2>Company profile</h2>
        <p>When you submit, the profile is stored and returns 201 with the created VendorProfile record.</p>
        <form (ngSubmit)="submitProfile()">
          <label>Company name
            <input data-testid="vendor-company-name" name="companyName" [(ngModel)]="companyName" required />
          </label>
          <label>Contact email
            <input data-testid="vendor-contact-email" name="contactEmail" type="email" [(ngModel)]="contactEmail" required />
          </label>
          <button data-testid="vendor-profile-submit" type="submit" [disabled]="savingProfile">Submit profile</button>
        </form>
        @if (profileError) { <p role="alert">{{ profileError }}</p> }
        @if (profile) {
          <p data-testid="vendor-profile-result">Saved: {{ profile.companyName }} ({{ profile.contactEmail }}) — id {{ profile.id }}</p>
        }
      </section>

      <section>
        <h2>Compliance documents</h2>
        <p>Each upload: the document is stored with status "pending" and displays in the vendor document library.</p>
        <form (ngSubmit)="uploadDocument()">
          <label>Filename
            <input data-testid="vendor-document-filename" name="filename" [(ngModel)]="filename" required />
          </label>
          <button data-testid="vendor-document-upload" type="submit" [disabled]="uploading">Upload document</button>
        </form>
        @if (documentError) { <p role="alert">{{ documentError }}</p> }
        <ul data-testid="vendor-document-library">
          @for (doc of documents; track doc.id) {
            <li>{{ doc.filename }} — {{ doc.status }}</li>
          } @empty {
            <li>No documents uploaded yet.</li>
          }
        </ul>
      </section>
    </div>
  `,
})
export class VendorProfileComponent implements OnInit {
  private readonly api = inject(ApiClient);

  companyName = '';
  contactEmail = '';
  filename = '';
  profile: VendorProfileRecord | null = null;
  documents: VendorDocument[] = [];
  savingProfile = false;
  uploading = false;
  profileError = '';
  documentError = '';

  constructor() {
    if (this.api instanceof MockApiClient) registerVendorMocks(this.api);
  }

  ngOnInit(): void {
    void this.loadDocuments();
  }

  async loadDocuments(): Promise<void> {
    try {
      this.documents = await this.api.get<VendorDocument[]>('/api/vendor/documents');
    } catch {
      this.documents = [];
    }
  }

  async submitProfile(): Promise<void> {
    this.profileError = '';
    if (!this.companyName.trim() || !this.contactEmail.trim()) {
      this.profileError = 'Company name and contact email are required.';
      return;
    }
    this.savingProfile = true;
    try {
      this.profile = await this.api.post<VendorProfileRecord>('/api/vendor/profile', {
        companyName: this.companyName.trim(),
        contactEmail: this.contactEmail.trim(),
      });
    } catch (e: any) {
      this.profileError = e?.message || 'Could not save profile.';
    } finally {
      this.savingProfile = false;
    }
  }

  async uploadDocument(): Promise<void> {
    this.documentError = '';
    if (!this.filename.trim()) {
      this.documentError = 'Filename is required.';
      return;
    }
    this.uploading = true;
    try {
      await this.api.post<VendorDocument>('/api/vendor/documents', { filename: this.filename.trim() });
      this.filename = '';
      await this.loadDocuments();
    } catch (e: any) {
      this.documentError = e?.message || 'Could not upload document.';
    } finally {
      this.uploading = false;
    }
  }
}
