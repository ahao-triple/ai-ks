export type MoneyValue = {
  li: string;
  yuan: string;
};

export type DemoGame = {
  companyName: string;
  gameAppId: string;
  id: string;
  name: string;
};

export type IntegrationStatus = {
  kuaishouApiMode: 'mock' | 'real';
  requiredForRealMode: {
    kuaishouAccessToken: boolean;
    kuaishouAdvertiserId: boolean;
  };
};

export type GameSessionResult = {
  game: {
    gameAppId: string;
    name: string;
  };
  openId: string;
  readableId: string;
};

export type EcpmRow = {
  displayAmount: MoneyValue;
  eventTime: string;
  gameAppId: string;
  openId: string;
  platformEventId: string;
  rawCost: MoneyValue;
};

export type EcpmRefreshResult = {
  requestedOpenIds: string[];
  rows: EcpmRow[];
  savedCount: number;
  source: 'mock' | 'kuaishou';
};

export type EarningsResult = {
  date: string;
  identity: string;
  openId: string;
  readableId?: string;
  rows: EcpmRow[];
  totalDisplayAmount: MoneyValue;
  totalRawCost: MoneyValue;
};

export type AccountResult = {
  id: string;
  readableId: string;
  username: string;
};

export type AuthResult = {
  accessToken: string;
  account: AccountResult;
};

export type AdminAuthResult = {
  accessToken: string;
  admin: {
    role: 'SUPER_ADMIN';
    username: string;
  };
};

export type AccountEarningsResult = {
  date: string;
  openIds: string[];
  rows: EcpmRow[];
  totalDisplayAmount: MoneyValue;
  totalRawCost: MoneyValue;
  userId: string;
};

export type AlipayProfile = {
  alipayAccount: string | null;
  alipayRealName: string | null;
};

export type WithdrawalResult = {
  details: Array<{
    amount: MoneyValue;
    alipayRequestSnapshot?: unknown;
    alipayResponseSnapshot?: unknown;
    errorCode?: string | null;
    errorMessage?: string | null;
    recipientAlipay: string;
    recipientName: string;
    status: string;
    type: string;
  }>;
  id: string;
  status: string;
  totalAmount: MoneyValue;
};

export type AdminWithdrawalBatch = WithdrawalResult & {
  createdAt: string;
  updatedAt: string;
  userId: string;
};

export type AdminWithdrawalListResult = {
  batches: AdminWithdrawalBatch[];
};

export type SettlementResult = {
  settledAmount: MoneyValue;
  settledCount: number;
  userId: string;
};

export type AuditLogRow = {
  action: string;
  actorId: string;
  actorType: string;
  createdAt: string;
  id: string;
  metadata: unknown;
  targetId: string;
  targetType: string;
};

export type AuditLogListResult = {
  logs: AuditLogRow[];
};

export type AdminWithdrawalDetailResult = {
  auditLogs: AuditLogRow[];
  batch: AdminWithdrawalBatch;
};
