export type PrincipalType =
  | 'USER'
  | 'AGENT'
  | 'COMPANY_ADMIN'
  | 'SUPER_ADMIN';

export type AdminScope = {
  companyId: string;
  gameIds: string[];
  operationCodes: string[];
};

export type GameAccessInput = {
  principalType: PrincipalType;
  gameId: string;
  scopes: AdminScope[];
};

export type OperationAccessInput = {
  principalType: PrincipalType;
  operationCode: string;
  scopes: AdminScope[];
};

export function canAccessGame(input: GameAccessInput): boolean {
  if (input.principalType === 'SUPER_ADMIN') {
    return true;
  }

  if (input.principalType !== 'COMPANY_ADMIN') {
    return false;
  }

  return input.scopes.some((scope) => scope.gameIds.includes(input.gameId));
}

export function canPerformOperation(input: OperationAccessInput): boolean {
  if (input.principalType === 'SUPER_ADMIN') {
    return true;
  }

  if (input.principalType !== 'COMPANY_ADMIN') {
    return false;
  }

  return input.scopes.some((scope) =>
    scope.operationCodes.includes(input.operationCode),
  );
}
