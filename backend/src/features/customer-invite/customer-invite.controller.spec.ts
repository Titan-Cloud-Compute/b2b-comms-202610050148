import { BadRequestException, ConflictException } from '@nestjs/common';
import { CustomerInviteController } from './customer-invite.controller';
import { CustomerInviteService } from './customer-invite.service';

function makePrisma() {
  const customers: { id: string; email: string; userId: string; createdAt: Date }[] = [];
  const users: { id: string; email: string; role: string }[] = [];
  let seq = 0;
  return {
    customer: {
      findUnique: jest.fn(async ({ where }: any) => customers.find((c) => c.email === where.email) ?? null),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: `c${++seq}`, createdAt: new Date(), ...data };
        customers.push(row);
        return row;
      }),
      findMany: jest.fn(async () => customers.map((c) => ({ id: c.id, email: c.email }))),
    },
    user: {
      findUnique: jest.fn(async ({ where }: any) => users.find((u) => u.email === where.email) ?? null),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: `u${++seq}`, ...data };
        users.push(row);
        return row;
      }),
    },
  };
}

describe('CustomerInviteController', () => {
  let controller: CustomerInviteController;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    const service = new CustomerInviteService(prisma as any);
    controller = new CustomerInviteController(service);
  });

  it('admin invites customer: creates a Customer and returns invitationSent true', async () => {
    const res = await controller.postApiAdminCustomersInvite({ email: 'buyer@corp.example.com' });
    expect(res).toEqual({ customerId: expect.any(String), email: 'buyer@corp.example.com', invitationSent: true });
    expect(prisma.user.create).toHaveBeenCalledWith({ data: { email: 'buyer@corp.example.com', role: 'CUSTOMER' } });
    expect(prisma.customer.create).toHaveBeenCalled();
  });

  it('duplicate invite rejected with 409', async () => {
    await controller.postApiAdminCustomersInvite({ email: 'buyer@corp.example.com' });
    await expect(controller.postApiAdminCustomersInvite({ email: 'buyer@corp.example.com' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects an invalid email with 400', async () => {
    await expect(controller.postApiAdminCustomersInvite({ email: 'nope' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists customers with id and email', async () => {
    await controller.postApiAdminCustomersInvite({ email: 'a@x.example.com' });
    const list = await controller.getApiAdminCustomers();
    expect(list).toEqual([{ id: expect.any(String), email: 'a@x.example.com' }]);
  });
});
