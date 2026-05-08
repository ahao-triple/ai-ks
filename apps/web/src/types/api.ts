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

export type AdminCompany = {
  balance: MoneyValue;
  createdAt: string;
  id: string;
  name: string;
  updatedAt: string;
};

export type AdminCompanyListResult = {
  companies: AdminCompany[];
};

export type AdminGame = {
  budget: MoneyValue;
  companyId: string;
  companyName: string;
  createdAt: string;
  gameAppId: string;
  gameSecret: string;
  id: string;
  name: string;
  settlementPaused: boolean;
  updatedAt: string;
};

export type AdminGameListResult = {
  games: AdminGame[];
};

export type AdminGameBudgetAllocationResult = {
  company: AdminCompany;
  game: AdminGame;
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

export type AdminSettlementRange = {
  endDate: string;
  gameId: string;
  startDate: string;
  userId?: string;
};

export type AdminSettlementPreview = {
  budgetAfter: MoneyValue;
  budgetBefore: MoneyValue;
  canConfirm: boolean;
  companyId: string;
  gameId: string;
  settlementAmount: MoneyValue;
  settlementCount: number;
  unboundCount: number;
  userCount: number;
};

export type AdminSettlementItem = {
  createdAt: string;
  displayAmount: MoneyValue;
  gameOpenIdId: string;
  id: string;
  openId: string;
  rawEcpmId: string;
  settlementAmount: MoneyValue;
  userId: string;
};

export type AdminSettlementBatch = {
  budgetAfter: MoneyValue;
  budgetBefore: MoneyValue;
  companyId: string;
  configSnapshot: unknown;
  createdAt: string;
  endedAt: string;
  gameId: string;
  id: string;
  operatorId: string;
  operatorType: string;
  settledAmount: MoneyValue;
  settledCount: number;
  startedAt: string;
  status: string;
  userCount: number;
};

export type AdminSettlementConfirmResult = {
  batch: AdminSettlementBatch;
  items: AdminSettlementItem[];
};

export type AdminSettlementListResult = {
  batches: AdminSettlementBatch[];
};

export type AdminSettlementDetailResult = {
  batch: AdminSettlementBatch;
  items: AdminSettlementItem[];
};
