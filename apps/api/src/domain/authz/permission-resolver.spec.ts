import { canAccessGame, canPerformOperation } from './permission-resolver';

describe('permission resolver', () => {
  it('allows super admin to access every game and operation', () => {
    expect(
      canAccessGame({
        principalType: 'SUPER_ADMIN',
        gameId: 'game-a',
        scopes: [],
      }),
    ).toBe(true);

    expect(
      canPerformOperation({
        principalType: 'SUPER_ADMIN',
        operationCode: 'withdrawal.review',
        scopes: [],
      }),
    ).toBe(true);
  });

  it('restricts company admins to assigned games and operations', () => {
    const scopes = [
      {
        companyId: 'company-a',
        gameIds: ['game-a'],
        operationCodes: ['settlement.confirm'],
      },
    ];

    expect(
      canAccessGame({
        principalType: 'COMPANY_ADMIN',
        gameId: 'game-a',
        scopes,
      }),
    ).toBe(true);
    expect(
      canAccessGame({
        principalType: 'COMPANY_ADMIN',
        gameId: 'game-b',
        scopes,
      }),
    ).toBe(false);
    expect(
      canPerformOperation({
        principalType: 'COMPANY_ADMIN',
        operationCode: 'withdrawal.review',
        scopes,
      }),
    ).toBe(false);
  });
});
