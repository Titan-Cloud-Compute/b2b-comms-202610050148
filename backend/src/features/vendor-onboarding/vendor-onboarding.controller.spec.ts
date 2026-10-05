import { HTTP_CODE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VendorOnboardingController } from './vendor-onboarding.controller';
import { VendorOnboardingService } from './vendor-onboarding.service';
import type { PrismaService } from '../../prisma/prisma.service';

function makeFakePrisma() {
  const profiles: any[] = [];
  const docs: any[] = [];
  let n = 0;
  return {
    profiles,
    docs,
    vendorProfile: {
      upsert: async ({ where, create, update }: any) => {
        const existing = profiles.find((p) => p.userId === where.userId);
        if (existing) return Object.assign(existing, update);
        const p = { id: `vp-${++n}`, ...create };
        profiles.push(p);
        return p;
      },
      findUnique: async ({ where }: any) => profiles.find((p) => p.userId === where.userId) ?? null,
    },
    document: {
      create: async ({ data }: any) => {
        const d = { id: `doc-${++n}`, createdAt: new Date(), ...data };
        docs.push(d);
        return d;
      },
      findMany: async ({ where }: any) => docs.filter((d) => d.vendorProfileId === where.vendorProfileId),
    },
  };
}

const reqFor = (userId: string) => ({ session: { userId, email: `${userId}@x.test`, role: 'VENDOR' } }) as any;

describe('VendorOnboardingController', () => {
  let prisma: ReturnType<typeof makeFakePrisma>;
  let controller: VendorOnboardingController;

  beforeEach(() => {
    prisma = makeFakePrisma();
    controller = new VendorOnboardingController(
      new VendorOnboardingService(prisma as unknown as PrismaService),
    );
  });

  it('is mounted at api/vendor with 201 on POST routes', () => {
    expect(Reflect.getMetadata(PATH_METADATA, VendorOnboardingController)).toBe('api/vendor');
    const proto = VendorOnboardingController.prototype;
    expect(Reflect.getMetadata(PATH_METADATA, proto.postApiVendorProfile)).toBe('profile');
    expect(Reflect.getMetadata(PATH_METADATA, proto.postApiVendorDocuments)).toBe('documents');
    expect(Reflect.getMetadata(PATH_METADATA, proto.getApiVendorDocuments)).toBe('documents');
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, proto.postApiVendorProfile)).toBe(201);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, proto.postApiVendorDocuments)).toBe(201);
  });

  it('stores the profile for the session user and returns the record', async () => {
    const res = await controller.postApiVendorProfile(reqFor('u1'), {
      companyName: 'Acme',
      contactEmail: 'ops@acme.example.com',
    });
    expect(res).toEqual({ id: expect.any(String), companyName: 'Acme', contactEmail: 'ops@acme.example.com' });
    expect(prisma.profiles[0].userId).toBe('u1');
  });

  it('rejects an invalid profile', async () => {
    await expect(
      controller.postApiVendorProfile(reqFor('u1'), { companyName: '', contactEmail: 'bad' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('stores an uploaded document as pending and lists it, scoped to the vendor', async () => {
    await controller.postApiVendorProfile(reqFor('u1'), { companyName: 'Acme', contactEmail: 'a@acme.test' });
    await controller.postApiVendorProfile(reqFor('u2'), { companyName: 'Other', contactEmail: 'b@other.test' });
    const doc = await controller.postApiVendorDocuments(reqFor('u1'), { filename: 'w9.pdf' });
    expect(doc).toEqual({ id: expect.any(String), filename: 'w9.pdf', status: 'pending' });
    expect(await controller.getApiVendorDocuments(reqFor('u1'))).toEqual([doc]);
    expect(await controller.getApiVendorDocuments(reqFor('u2'))).toEqual([]);
  });

  it('requires a profile before uploading', async () => {
    await expect(
      controller.postApiVendorDocuments(reqFor('u3'), { filename: 'w9.pdf' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
