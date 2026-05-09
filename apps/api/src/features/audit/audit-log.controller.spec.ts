import { AuditLogController } from './audit-log.controller';

describe('AuditLogController', () => {
  it('lists audit logs for the current admin', async () => {
    const auditLogService = {
      list: jest.fn(async () => [
        {
          action: 'company.updated',
          actorId: 'admin',
          actorType: 'SUPER_ADMIN',
          createdAt: new Date('2026-05-08T00:00:00.000Z'),
          id: 'audit-1',
          metadata: {},
          targetId: 'company-1',
          targetType: 'company',
        },
      ]),
    };
    const controller = new AuditLogController(auditLogService as any);

    const result = await controller.list(admin, '20');

    expect(auditLogService.list).toHaveBeenCalledWith({
      admin,
      limit: 20,
    });
    expect(result).toEqual({
      logs: [
        {
          action: 'company.updated',
          actorId: 'admin',
          actorType: 'SUPER_ADMIN',
          createdAt: '2026-05-08T00:00:00.000Z',
          id: 'audit-1',
          metadata: {},
          targetId: 'company-1',
          targetType: 'company',
        },
      ],
    });
  });
});

const admin = { role: 'SUPER_ADMIN' as const, username: 'admin' };
