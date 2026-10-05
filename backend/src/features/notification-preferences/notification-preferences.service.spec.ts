import { NotificationPreferencesService } from './notification-preferences.service';

function makeService(existing: { userId: string; orderAlerts: boolean; messageAlerts: boolean } | null) {
  const findUnique = jest.fn().mockResolvedValue(existing);
  const upsert = jest.fn().mockImplementation(async (args: any) => ({
    id: 'np-1',
    userId: args.where.userId,
    ...(existing ? args.update : args.create),
  }));
  const prisma = { notificationPreference: { findUnique, upsert } } as any;
  return { service: new NotificationPreferencesService(prisma), findUnique, upsert };
}

describe('NotificationPreferencesService', () => {
  it('user configures notifications: upserts keyed by userId and returns the stored record', async () => {
    const { service, upsert } = makeService(null);
    const res = await service.upsert('u-1', { orderAlerts: true, messageAlerts: false });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'u-1' } }));
    expect(res).toEqual({ userId: 'u-1', orderAlerts: true, messageAlerts: false });
  });

  it('user disables all notifications: both alert fields stored as false', async () => {
    const { service } = makeService({ userId: 'u-1', orderAlerts: true, messageAlerts: true });
    const res = await service.upsert('u-1', { orderAlerts: false, messageAlerts: false });
    expect(res).toEqual({ userId: 'u-1', orderAlerts: false, messageAlerts: false });
  });

  it('get returns defaults when no record exists', async () => {
    const { service } = makeService(null);
    expect(await service.get('u-2')).toEqual({ userId: 'u-2', orderAlerts: false, messageAlerts: false });
  });

  it('get returns the stored record', async () => {
    const { service } = makeService({ userId: 'u-3', orderAlerts: true, messageAlerts: false });
    expect(await service.get('u-3')).toEqual({ userId: 'u-3', orderAlerts: true, messageAlerts: false });
  });
});
