import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CircleUserRound,
  Gauge,
  Link2,
  LogIn,
  RefreshCw,
  Search,
  Send,
  UserPlus,
  WalletCards,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

type ViewKey = 'query' | 'account' | 'tools';

type ViewItem = {
  description: string;
  icon: LucideIcon;
  key: ViewKey;
  label: string;
  subtitle: string;
};

type DemoGame = {
  companyName: string;
  gameAppId: string;
  id: string;
  name: string;
};

type IntegrationStatus = {
  kuaishouApiMode: 'mock' | 'real';
  requiredForRealMode: {
    kuaishouAccessToken: boolean;
    kuaishouAdvertiserId: boolean;
  };
};

type GameSessionResult = {
  game: {
    gameAppId: string;
    name: string;
  };
  openId: string;
  readableId: string;
};

type EcpmRefreshResult = {
  requestedOpenIds: string[];
  rows: EcpmRow[];
  savedCount: number;
  source: 'mock' | 'kuaishou';
};

type EarningsResult = {
  date: string;
  identity: string;
  openId: string;
  readableId?: string;
  rows: EcpmRow[];
  totalDisplayAmount: MoneyValue;
  totalRawCost: MoneyValue;
};

type AccountResult = {
  id: string;
  readableId: string;
  username: string;
};

type AuthResult = {
  accessToken: string;
  account: AccountResult;
};

type AdminAuthResult = {
  accessToken: string;
  admin: {
    role: 'SUPER_ADMIN';
    username: string;
  };
};

type AccountEarningsResult = {
  date: string;
  openIds: string[];
  rows: EcpmRow[];
  totalDisplayAmount: MoneyValue;
  totalRawCost: MoneyValue;
  userId: string;
};

type AlipayProfile = {
  alipayAccount: string | null;
  alipayRealName: string | null;
};

type WithdrawalResult = {
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

type AdminWithdrawalBatch = WithdrawalResult & {
  createdAt: string;
  updatedAt: string;
  userId: string;
};

type AdminWithdrawalListResult = {
  batches: AdminWithdrawalBatch[];
};

type SettlementResult = {
  settledAmount: MoneyValue;
  settledCount: number;
  userId: string;
};

type AuditLogRow = {
  action: string;
  actorId: string;
  actorType: string;
  createdAt: string;
  id: string;
  metadata: unknown;
  targetId: string;
  targetType: string;
};

type AuditLogListResult = {
  logs: AuditLogRow[];
};

type AdminWithdrawalDetailResult = {
  auditLogs: AuditLogRow[];
  batch: AdminWithdrawalBatch;
};

type EcpmRow = {
  displayAmount: MoneyValue;
  eventTime: string;
  gameAppId: string;
  openId: string;
  platformEventId: string;
  rawCost: MoneyValue;
};

type MoneyValue = {
  li: string;
  yuan: string;
};

type MetricCardProps = {
  detail?: string;
  label: string;
  value: string;
};

type EcpmTableProps = {
  emptyLabel: string;
  meta: string;
  rows: EcpmRow[];
  title: string;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || '/api';
const AUTH_STORAGE_KEY = 'ai-ks.accountAccessToken';
const ADMIN_AUTH_STORAGE_KEY = 'ai-ks.adminAccessToken';

const views: ViewItem[] = [
  {
    description: '按 open_id 或可读 ID 查看当天收益',
    icon: Gauge,
    key: 'query',
    label: '收益查询',
    subtitle: '用户侧',
  },
  {
    description: '账号登录、注册、绑定游戏 ID',
    icon: CircleUserRound,
    key: 'account',
    label: '账号中心',
    subtitle: '用户账号',
  },
  {
    description: '游戏登录与快手 ECPM 刷新',
    icon: Wrench,
    key: 'tools',
    label: '联调工具',
    subtitle: '接口联调',
  },
];

const viewMeta = Object.fromEntries(
  views.map((view) => [view.key, view]),
) as Record<ViewKey, ViewItem>;

export function App() {
  const [activeView, setActiveView] = useState<ViewKey>('query');
  const [games, setGames] = useState<DemoGame[]>([]);
  const [sampleJsCodes, setSampleJsCodes] = useState<string[]>([]);
  const [status, setStatus] = useState<IntegrationStatus>();
  const [gameAppId, setGameAppId] = useState('');
  const [jsCode, setJsCode] = useState('mock-js-code-001');
  const [session, setSession] = useState<GameSessionResult>();
  const [refreshResult, setRefreshResult] = useState<EcpmRefreshResult>();
  const [identity, setIdentity] = useState('');
  const [bindIdentity, setBindIdentity] = useState('');
  const [earnings, setEarnings] = useState<EarningsResult>();
  const [username, setUsername] = useState('demo_user');
  const [password, setPassword] = useState('demo123456');
  const [account, setAccount] = useState<AccountResult>();
  const [accessToken, setAccessToken] = useState(
    () => window.localStorage.getItem(AUTH_STORAGE_KEY) ?? '',
  );
  const [adminAccessToken, setAdminAccessToken] = useState(
    () => window.localStorage.getItem(ADMIN_AUTH_STORAGE_KEY) ?? '',
  );
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('admin123456');
  const [adminName, setAdminName] = useState('');
  const [accountEarnings, setAccountEarnings] =
    useState<AccountEarningsResult>();
  const [alipayAccount, setAlipayAccount] = useState('');
  const [alipayRealName, setAlipayRealName] = useState('');
  const [withdrawalAmountYuan, setWithdrawalAmountYuan] = useState('10.00');
  const [withdrawal, setWithdrawal] = useState<WithdrawalResult>();
  const [settlement, setSettlement] = useState<SettlementResult>();
  const [adminWithdrawals, setAdminWithdrawals] = useState<
    AdminWithdrawalBatch[]
  >([]);
  const [adminWithdrawalStatus, setAdminWithdrawalStatus] =
    useState('PENDING_REVIEW');
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [selectedWithdrawalDetail, setSelectedWithdrawalDetail] =
    useState<AdminWithdrawalDetailResult>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const busyRef = useRef(false);

  const activeMeta = viewMeta[activeView];
  const selectedGame = useMemo(
    () => games.find((game) => game.gameAppId === gameAppId),
    [gameAppId, games],
  );
  const mode = status?.kuaishouApiMode ?? 'mock';
  const modeText = mode === 'real' ? '快手真实接口' : '快手 Mock';
  const isBusy = (name: string) => busyAction === name;

  useEffect(() => {
    void loadContext().catch((nextError: unknown) => {
      setError(
        nextError instanceof Error
          ? nextError.message
          : '无法连接 API，请确认后端服务已启动',
      );
    });
  }, []);

  async function loadContext() {
    setError('');
    const [context, integrationStatus] = await Promise.all([
      apiGet<{ games: DemoGame[]; sampleJsCodes: string[] }>(
        '/demo/test-context',
      ),
      apiGet<IntegrationStatus>('/integrations/status'),
    ]);

    setGames(context.games);
    setSampleJsCodes(context.sampleJsCodes);
    setStatus(integrationStatus);
    setGameAppId(context.games[0]?.gameAppId ?? '');
    setJsCode(context.sampleJsCodes[0] ?? 'mock-js-code-001');

    if (accessToken) {
      try {
        const currentAccount = await apiGet<AccountResult>(
          '/accounts/me',
          accessToken,
        );
        setAccount(currentAccount);
        await loadAlipayProfile(accessToken);
      } catch {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
        setAccessToken('');
      }
    }
  }

  async function createGameSession() {
    await runAction('session', async () => {
      const result = await apiPost<GameSessionResult>('/game/sessions', {
        gameAppId,
        jsCode,
      });
      setSession(result);
      setIdentity(result.openId);
      setBindIdentity(result.openId);
      setNotice('open_id 获取成功');
    });
  }

  async function refreshEcpm() {
    await runAction('refresh', async () => {
      const result = await apiPost<EcpmRefreshResult>(
        '/admin/kuaishou/ecpm/refresh',
        {
          gameAppId,
        },
        adminAccessToken,
      );
      setRefreshResult(result);
      setNotice(`ECPM 刷新成功，写入 ${result.savedCount} 条明细`);
    });
  }

  async function queryEarnings() {
    const targetIdentity = identity.trim();
    if (!targetIdentity) {
      setError('请输入 open_id 或可读 ID');
      return;
    }

    await runAction('query', async () => {
      const result = await apiGet<EarningsResult>(
        `/user/earnings?identity=${encodeURIComponent(targetIdentity)}`,
      );
      setEarnings(result);
      setNotice('收益查询成功');
    });
  }

  async function registerAccount() {
    await runAction('register', async () => {
      const result = await apiPost<AuthResult>('/accounts/register', {
        password,
        username,
      });
      persistAuth(result);
      setNotice('账号注册成功');
    });
  }

  async function loginAccount() {
    await runAction('login', async () => {
      const result = await apiPost<AuthResult>('/accounts/login', {
        password,
        username,
      });
      persistAuth(result);
      setNotice('账号登录成功');
    });
  }

  async function bindAccountOpenId() {
    if (!account || !accessToken) {
      setError('请先登录或注册账号');
      return;
    }

    const targetIdentity = bindIdentity.trim();
    if (!targetIdentity) {
      setError('请输入要绑定的 open_id 或可读 ID');
      return;
    }

    await runAction('bind', async () => {
      await apiPost<unknown>(
        '/accounts/me/open-ids',
        {
          identity: targetIdentity,
        },
        accessToken,
      );
      const result = await apiGet<AccountEarningsResult>(
        '/accounts/me/earnings',
        accessToken,
      );
      setAccountEarnings(result);
      setNotice('open_id 绑定成功');
    });
  }

  async function queryAccountEarnings() {
    if (!account || !accessToken) {
      setError('请先登录或注册账号');
      return;
    }

    await runAction('account-query', async () => {
      const result = await apiGet<AccountEarningsResult>(
        '/accounts/me/earnings',
        accessToken,
      );
      setAccountEarnings(result);
      setNotice('账号收益查询成功');
    });
  }

  function persistAuth(result: AuthResult) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, result.accessToken);
    setAccessToken(result.accessToken);
    setAccount(result.account);
    void loadAlipayProfile(result.accessToken);
  }

  async function loadAlipayProfile(token: string) {
    const profile = await apiGet<AlipayProfile>('/accounts/me/alipay', token);
    setAlipayAccount(profile.alipayAccount ?? '');
    setAlipayRealName(profile.alipayRealName ?? '');
  }

  async function updateAlipayProfile() {
    if (!accessToken) {
      setError('请先登录或注册账号');
      return;
    }

    await runAction('alipay', async () => {
      const profile = await apiPatch<AlipayProfile>(
        '/accounts/me/alipay',
        {
          alipayAccount,
          alipayRealName,
        },
        accessToken,
      );
      setAlipayAccount(profile.alipayAccount ?? '');
      setAlipayRealName(profile.alipayRealName ?? '');
      setNotice('支付宝资料已保存');
    });
  }

  async function requestWithdrawal() {
    if (!accessToken) {
      setError('请先登录或注册账号');
      return;
    }

    await runAction('withdrawal', async () => {
      const result = await apiPost<WithdrawalResult>(
        '/accounts/me/withdrawals',
        {
          amountYuan: withdrawalAmountYuan,
        },
        accessToken,
      );
      setWithdrawal(result);
      setNotice('提现申请已提交，等待审核');
    });
  }

  async function confirmSettlement() {
    if (!accessToken) {
      setError('请先登录或注册账号');
      return;
    }

    await runAction('settlement', async () => {
      const result = await apiPost<SettlementResult>(
        '/accounts/me/settlements/confirm',
        {},
        accessToken,
      );
      setSettlement(result);
      setNotice(
        `确认结算 ${result.settledCount} 条，入账 ¥ ${result.settledAmount.yuan}`,
      );
      const earningsResult = await apiGet<AccountEarningsResult>(
        '/accounts/me/earnings',
        accessToken,
      );
      setAccountEarnings(earningsResult);
    });
  }

  async function loadAdminWithdrawals(status = adminWithdrawalStatus) {
    if (!adminAccessToken) {
      setError('请先登录管理员账号');
      return;
    }

    await runAction('admin-withdrawals', async () => {
      const result = await apiGet<AdminWithdrawalListResult>(
        `/admin/withdrawals?status=${encodeURIComponent(status)}`,
        adminAccessToken,
      );
      setAdminWithdrawals(result.batches);
      setAdminWithdrawalStatus(status);
      setNotice(`提现批次 ${result.batches.length} 笔`);
    });
  }

  async function approveAdminWithdrawal(batchId: string) {
    if (!adminAccessToken) {
      setError('请先登录管理员账号');
      return;
    }

    await runAction(`approve-${batchId}`, async () => {
      const result = await apiPost<AdminWithdrawalBatch>(
        `/admin/withdrawals/${batchId}/approve`,
        {},
        adminAccessToken,
      );
      setAdminWithdrawals((current) =>
        current.filter((batch) => batch.id !== result.id),
      );
      setNotice(`提现批次 ${result.id} 已审核通过`);
    });
  }

  async function payAdminWithdrawal(
    batchId: string,
    mockResult: 'failed' | 'success' = 'success',
  ) {
    if (!adminAccessToken) {
      setError('请先登录管理员账号');
      return;
    }

    await runAction(`pay-${mockResult}-${batchId}`, async () => {
      const result = await apiPost<AdminWithdrawalBatch>(
        `/admin/withdrawals/${batchId}/pay`,
        {
          mockResult,
        },
        adminAccessToken,
      );
      setAdminWithdrawals((current) =>
        current.filter((batch) => batch.id !== result.id),
      );
      setNotice(
        mockResult === 'failed'
          ? `提现批次 ${result.id} 已标记失败`
          : `提现批次 ${result.id} 已打款`,
      );
    });
  }

  async function closeAdminWithdrawal(batchId: string) {
    if (!adminAccessToken) {
      setError('请先登录管理员账号');
      return;
    }

    await runAction(`close-${batchId}`, async () => {
      const result = await apiPost<AdminWithdrawalBatch>(
        `/admin/withdrawals/${batchId}/close`,
        {},
        adminAccessToken,
      );
      setAdminWithdrawals((current) =>
        current.filter((batch) => batch.id !== result.id),
      );
      setNotice(`提现批次 ${result.id} 已关闭并退回冻结金额`);
    });
  }

  async function loadWithdrawalDetail(batchId: string) {
    if (!adminAccessToken) {
      setError('请先登录管理员账号');
      return;
    }

    await runAction(`detail-${batchId}`, async () => {
      const result = await apiGet<AdminWithdrawalDetailResult>(
        `/admin/withdrawals/${batchId}`,
        adminAccessToken,
      );
      setSelectedWithdrawalDetail(result);
      setNotice(`已加载提现批次 ${batchId}`);
    });
  }

  async function loginAdmin() {
    await runAction('admin-login', async () => {
      const result = await apiPost<AdminAuthResult>('/admin/auth/login', {
        password: adminPassword,
        username: adminUsername,
      });
      window.localStorage.setItem(
        ADMIN_AUTH_STORAGE_KEY,
        result.accessToken,
      );
      setAdminAccessToken(result.accessToken);
      setAdminName(result.admin.username);
      setNotice('管理员登录成功');
    });
  }

  async function loadAuditLogs() {
    if (!adminAccessToken) {
      setError('请先登录管理员账号');
      return;
    }

    await runAction('audit-logs', async () => {
      const result = await apiGet<AuditLogListResult>(
        '/admin/audit-logs?limit=20',
        adminAccessToken,
      );
      setAuditLogs(result.logs);
      setNotice(`审计日志 ${result.logs.length} 条`);
    });
  }

  async function runAction(name: string, action: () => Promise<void>) {
    if (busyRef.current) {
      return;
    }

    busyRef.current = true;
    setBusyAction(name);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : '请求失败，请检查 API',
      );
    } finally {
      busyRef.current = false;
      setBusyAction('');
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">KS</span>
          <div>
            <strong>AI-KS</strong>
            <span>收益结算后台</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="主导航">
          {views.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={
                  item.key === activeView ? 'nav-item active' : 'nav-item'
                }
                key={item.key}
                onClick={() => setActiveView(item.key)}
                type="button"
              >
                <Icon size={18} />
                <span>{item.label}</span>
                <small>{item.subtitle}</small>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <span>接口环境</span>
          <strong>{modeText}</strong>
          <small>
            {mode === 'real'
              ? '当前走快手真实接口'
              : '当前走本地 mock 数据'}
          </small>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p>{activeMeta.subtitle}</p>
            <h1>{activeMeta.label}</h1>
            <span>{activeMeta.description}</span>
          </div>
          <div className="topbar-actions">
            {account ? (
              <span className="account-badge">
                <CircleUserRound size={16} />
                {account.username}
              </span>
            ) : null}
            <span className={`status ${mode}`}>{modeText}</span>
          </div>
        </header>

        {error ? <div className="alert danger">{error}</div> : null}
        {notice ? <div className="alert success">{notice}</div> : null}

        {activeView === 'query' ? (
          <QueryView
            busy={isBusy('query')}
            earnings={earnings}
            identity={identity}
            onIdentityChange={setIdentity}
            onQuery={queryEarnings}
            selectedGame={selectedGame}
          />
        ) : null}

        {activeView === 'account' ? (
          <AccountView
            account={account}
            accountEarnings={accountEarnings}
            bindIdentity={bindIdentity}
            busyAction={busyAction}
            onBindIdentityChange={setBindIdentity}
            onBindOpenId={bindAccountOpenId}
            onAlipayAccountChange={setAlipayAccount}
            onAlipayRealNameChange={setAlipayRealName}
            onLogin={loginAccount}
            onPasswordChange={setPassword}
            onConfirmSettlement={confirmSettlement}
            onQueryAccountEarnings={queryAccountEarnings}
            onRegister={registerAccount}
            onRequestWithdrawal={requestWithdrawal}
            onUpdateAlipayProfile={updateAlipayProfile}
            onUsernameChange={setUsername}
            onWithdrawalAmountChange={setWithdrawalAmountYuan}
            password={password}
            username={username}
            alipayAccount={alipayAccount}
            alipayRealName={alipayRealName}
            settlement={settlement}
            withdrawal={withdrawal}
            withdrawalAmountYuan={withdrawalAmountYuan}
          />
        ) : null}

        {activeView === 'tools' ? (
          <ToolsView
            adminWithdrawals={adminWithdrawals}
            adminWithdrawalStatus={adminWithdrawalStatus}
            auditLogs={auditLogs}
            adminName={adminName}
            adminPassword={adminPassword}
            adminUsername={adminUsername}
            busyAction={busyAction}
            gameAppId={gameAppId}
            games={games}
            jsCode={jsCode}
            onApproveWithdrawal={approveAdminWithdrawal}
            onCreateSession={createGameSession}
            onGameChange={setGameAppId}
            onAdminPasswordChange={setAdminPassword}
            onAdminUsernameChange={setAdminUsername}
            onJsCodeChange={setJsCode}
            onLoadWithdrawals={loadAdminWithdrawals}
            onCloseWithdrawal={closeAdminWithdrawal}
            onLoadAuditLogs={loadAuditLogs}
            onLoadWithdrawalDetail={loadWithdrawalDetail}
            onLoginAdmin={loginAdmin}
            onPayWithdrawal={payAdminWithdrawal}
            onRefreshEcpm={refreshEcpm}
            refreshResult={refreshResult}
            sampleJsCodes={sampleJsCodes}
            selectedGame={selectedGame}
            session={session}
            selectedWithdrawalDetail={selectedWithdrawalDetail}
          />
        ) : null}
      </section>
    </main>
  );
}

function QueryView(props: {
  busy: boolean;
  earnings?: EarningsResult;
  identity: string;
  onIdentityChange: (value: string) => void;
  onQuery: () => void;
  selectedGame?: DemoGame;
}) {
  const { busy, earnings, identity, onIdentityChange, onQuery, selectedGame } =
    props;

  return (
    <div className="view-stack">
      <section className="metric-grid" aria-label="收益概览">
        <MetricCard
          detail={earnings ? `${earnings.rows.length} 条 ECPM 明细` : '默认当天'}
          label="展示金额"
          value={formatMoney(earnings?.totalDisplayAmount)}
        />
        <MetricCard
          detail={earnings?.readableId ?? '等待查询'}
          label="可读 ID"
          value={earnings?.readableId ?? '-'}
        />
        <MetricCard
          detail={selectedGame?.gameAppId ?? '-'}
          label="当前游戏"
          value={selectedGame?.name ?? '-'}
        />
      </section>

      <section className="split-grid">
        <article className="panel action-panel">
          <div className="panel-heading">
            <div>
              <h2>单个 ID 查询</h2>
              <p>当天 00:00 - 24:00</p>
            </div>
          </div>
          <div className="panel-body query-form">
            <label className="field">
              <span>open_id / 可读 ID</span>
              <input
                onChange={(event) => onIdentityChange(event.target.value)}
                placeholder="输入 open_id 或 7 位可读 ID"
                value={identity}
              />
            </label>
            <button
              className="primary-action"
              disabled={!identity.trim() || busy}
              onClick={onQuery}
              type="button"
            >
              <Search size={16} />
              {busy ? '查询中' : '查询收益'}
            </button>
          </div>
        </article>

        <article className="panel info-panel">
          <div className="panel-heading">
            <div>
              <h2>查询结果</h2>
              <p>{earnings?.date ?? '今日'}</p>
            </div>
          </div>
          <div className="panel-body result-list">
            <Readout label="open_id" value={earnings?.openId ?? '-'} />
            <Readout label="原始金额" value={formatMoney(earnings?.totalRawCost)} />
            <Readout
              label="展示金额"
              value={formatMoney(earnings?.totalDisplayAmount)}
            />
          </div>
        </article>
      </section>

      <EcpmTable
        emptyLabel="暂无收益明细"
        meta={earnings?.date ?? '今日'}
        rows={earnings?.rows ?? []}
        title="收益明细"
      />
    </div>
  );
}

function AccountView(props: {
  account?: AccountResult;
  accountEarnings?: AccountEarningsResult;
  alipayAccount: string;
  alipayRealName: string;
  bindIdentity: string;
  busyAction: string;
  onAlipayAccountChange: (value: string) => void;
  onAlipayRealNameChange: (value: string) => void;
  onBindIdentityChange: (value: string) => void;
  onBindOpenId: () => void;
  onConfirmSettlement: () => void;
  onLogin: () => void;
  onPasswordChange: (value: string) => void;
  onQueryAccountEarnings: () => void;
  onRegister: () => void;
  onRequestWithdrawal: () => void;
  onUpdateAlipayProfile: () => void;
  onUsernameChange: (value: string) => void;
  onWithdrawalAmountChange: (value: string) => void;
  password: string;
  settlement?: SettlementResult;
  username: string;
  withdrawal?: WithdrawalResult;
  withdrawalAmountYuan: string;
}) {
  const {
    account,
    accountEarnings,
    alipayAccount,
    alipayRealName,
    bindIdentity,
    busyAction,
    onAlipayAccountChange,
    onAlipayRealNameChange,
    onBindIdentityChange,
    onBindOpenId,
    onConfirmSettlement,
    onLogin,
    onPasswordChange,
    onQueryAccountEarnings,
    onRegister,
    onRequestWithdrawal,
    onUpdateAlipayProfile,
    onUsernameChange,
    onWithdrawalAmountChange,
    password,
    settlement,
    username,
    withdrawal,
    withdrawalAmountYuan,
  } = props;

  return (
    <div className="view-stack">
      <section className="metric-grid" aria-label="账号概览">
        <MetricCard
          detail={account?.readableId ?? '未登录'}
          label="当前账号"
          value={account?.username ?? '-'}
        />
        <MetricCard
          detail="已绑定游戏 ID"
          label="绑定数量"
          value={`${accountEarnings?.openIds.length ?? 0}`}
        />
        <MetricCard
          detail={accountEarnings?.date ?? '默认当天'}
          label="账号展示金额"
          value={formatMoney(accountEarnings?.totalDisplayAmount)}
        />
        <MetricCard
          detail={`${settlement?.settledCount ?? 0} 条 ECPM 入账`}
          label="最近结算"
          value={formatMoney(settlement?.settledAmount)}
        />
      </section>

      <section className="split-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>账号登录</h2>
              <p>注册后可绑定多个游戏 ID</p>
            </div>
          </div>
          <div className="panel-body">
            <label className="field">
              <span>账号</span>
              <input
                onChange={(event) => onUsernameChange(event.target.value)}
                value={username}
              />
            </label>
            <label className="field">
              <span>密码</span>
              <input
                onChange={(event) => onPasswordChange(event.target.value)}
                type="password"
                value={password}
              />
            </label>
            <div className="button-row">
              <button
                className="primary-action"
                disabled={!username || !password || busyAction === 'login'}
                onClick={onLogin}
                type="button"
              >
                <LogIn size={16} />
                {busyAction === 'login' ? '登录中' : '登录'}
              </button>
              <button
                className="secondary-action"
                disabled={!username || !password || busyAction === 'register'}
                onClick={onRegister}
                type="button"
              >
                <UserPlus size={16} />
                {busyAction === 'register' ? '注册中' : '注册'}
              </button>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>ID 绑定</h2>
              <p>{account ? account.readableId : '请先登录账号'}</p>
            </div>
          </div>
          <div className="panel-body">
            <label className="field">
              <span>open_id / 可读 ID</span>
              <input
                onChange={(event) => onBindIdentityChange(event.target.value)}
                placeholder="输入要绑定的游戏 ID"
                value={bindIdentity}
              />
            </label>
            <div className="button-row">
              <button
                className="primary-action"
                disabled={
                  !account || !bindIdentity.trim() || busyAction === 'bind'
                }
                onClick={onBindOpenId}
                type="button"
              >
                <Link2 size={16} />
                {busyAction === 'bind' ? '绑定中' : '绑定 ID'}
              </button>
              <button
                className="secondary-action"
                disabled={!account || busyAction === 'account-query'}
                onClick={onQueryAccountEarnings}
                type="button"
              >
                <WalletCards size={16} />
                {busyAction === 'account-query' ? '查询中' : '账号收益'}
              </button>
            </div>
          </div>
        </article>
      </section>

      <section className="split-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>支付宝资料</h2>
              <p>{alipayAccount ? '已维护收款信息' : '提现前必须维护'}</p>
            </div>
          </div>
          <div className="panel-body">
            <label className="field">
              <span>支付宝账号</span>
              <input
                onChange={(event) => onAlipayAccountChange(event.target.value)}
                placeholder="邮箱或手机号"
                value={alipayAccount}
              />
            </label>
            <label className="field">
              <span>真实姓名</span>
              <input
                onChange={(event) => onAlipayRealNameChange(event.target.value)}
                placeholder="收款人实名"
                value={alipayRealName}
              />
            </label>
            <button
              className="primary-action"
              disabled={
                !account ||
                !alipayAccount.trim() ||
                !alipayRealName.trim() ||
                busyAction === 'alipay'
              }
              onClick={onUpdateAlipayProfile}
              type="button"
            >
              <WalletCards size={16} />
              {busyAction === 'alipay' ? '保存中' : '保存支付宝'}
            </button>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>提现申请</h2>
              <p>{withdrawal?.status ?? '生成待审核批次'}</p>
            </div>
          </div>
          <div className="panel-body">
            <label className="field">
              <span>提现金额</span>
              <input
                inputMode="decimal"
                onChange={(event) =>
                  onWithdrawalAmountChange(event.target.value)
                }
                placeholder="例如 10.00"
                value={withdrawalAmountYuan}
              />
            </label>
            <div className="button-row">
              <button
                className="primary-action"
                disabled={
                  !account ||
                  !withdrawalAmountYuan.trim() ||
                  busyAction === 'withdrawal'
                }
                onClick={onRequestWithdrawal}
                type="button"
              >
                <Send size={16} />
                {busyAction === 'withdrawal' ? '提交中' : '提交提现'}
              </button>
              <button
                className="secondary-action"
                disabled={!account || busyAction === 'settlement'}
                onClick={onConfirmSettlement}
                type="button"
              >
                <WalletCards size={16} />
                {busyAction === 'settlement' ? '结算中' : '确认结算'}
              </button>
            </div>
            <div className="result-list">
              <Readout
                label="最近入账"
                value={formatMoney(settlement?.settledAmount)}
              />
              <Readout
                label="最近批次"
                value={withdrawal ? withdrawal.id : '-'}
              />
              <Readout
                label="冻结金额"
                value={formatMoney(withdrawal?.totalAmount)}
              />
            </div>
          </div>
        </article>
      </section>

      <EcpmTable
        emptyLabel="暂无账号收益明细"
        meta={`${accountEarnings?.openIds.length ?? 0} 个 open_id`}
        rows={accountEarnings?.rows ?? []}
        title="账号收益明细"
      />
    </div>
  );
}

function ToolsView(props: {
  adminName: string;
  adminPassword: string;
  adminWithdrawals: AdminWithdrawalBatch[];
  adminWithdrawalStatus: string;
  adminUsername: string;
  auditLogs: AuditLogRow[];
  busyAction: string;
  gameAppId: string;
  games: DemoGame[];
  jsCode: string;
  onAdminPasswordChange: (value: string) => void;
  onAdminUsernameChange: (value: string) => void;
  onApproveWithdrawal: (batchId: string) => void;
  onCreateSession: () => void;
  onGameChange: (value: string) => void;
  onJsCodeChange: (value: string) => void;
  onLoadAuditLogs: () => void;
  onLoadWithdrawalDetail: (batchId: string) => void;
  onLoadWithdrawals: (status?: string) => void;
  onCloseWithdrawal: (batchId: string) => void;
  onLoginAdmin: () => void;
  onPayWithdrawal: (
    batchId: string,
    mockResult?: 'failed' | 'success',
  ) => void;
  onRefreshEcpm: () => void;
  refreshResult?: EcpmRefreshResult;
  sampleJsCodes: string[];
  selectedGame?: DemoGame;
  selectedWithdrawalDetail?: AdminWithdrawalDetailResult;
  session?: GameSessionResult;
}) {
  const {
    adminName,
    adminPassword,
    adminWithdrawals,
    adminWithdrawalStatus,
    adminUsername,
    auditLogs,
    busyAction,
    gameAppId,
    games,
    jsCode,
    onAdminPasswordChange,
    onAdminUsernameChange,
    onApproveWithdrawal,
    onCreateSession,
    onGameChange,
    onJsCodeChange,
    onLoadAuditLogs,
    onLoadWithdrawalDetail,
    onLoadWithdrawals,
    onCloseWithdrawal,
    onLoginAdmin,
    onPayWithdrawal,
    onRefreshEcpm,
    refreshResult,
    sampleJsCodes,
    selectedGame,
    selectedWithdrawalDetail,
    session,
  } = props;

  return (
    <div className="view-stack">
      <section className="metric-grid" aria-label="联调状态">
        <MetricCard
          detail={gameAppId || '-'}
          label="测试游戏"
          value={selectedGame?.name ?? '-'}
        />
        <MetricCard
          detail={session?.openId ?? '等待游戏登录'}
          label="最新可读 ID"
          value={session?.readableId ?? '-'}
        />
        <MetricCard
          detail={`${refreshResult?.requestedOpenIds.length ?? 0} 个 open_id`}
          label="最近写入"
          value={`${refreshResult?.savedCount ?? 0} 条`}
        />
      </section>

      <section className="tool-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>管理员登录</h2>
              <p>{adminName ? `已登录 ${adminName}` : '保护后台接口'}</p>
            </div>
          </div>
          <div className="panel-body">
            <label className="field">
              <span>管理员账号</span>
              <input
                onChange={(event) => onAdminUsernameChange(event.target.value)}
                value={adminUsername}
              />
            </label>
            <label className="field">
              <span>管理员密码</span>
              <input
                onChange={(event) => onAdminPasswordChange(event.target.value)}
                type="password"
                value={adminPassword}
              />
            </label>
            <button
              className="primary-action"
              disabled={
                !adminUsername || !adminPassword || busyAction === 'admin-login'
              }
              onClick={onLoginAdmin}
              type="button"
            >
              <LogIn size={16} />
              {busyAction === 'admin-login' ? '登录中' : '管理员登录'}
            </button>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>游戏端登录</h2>
              <p>code2Session</p>
            </div>
          </div>
          <div className="panel-body">
            <label className="field">
              <span>游戏</span>
              <select
                onChange={(event) => onGameChange(event.target.value)}
                value={gameAppId}
              >
                {games.map((game) => (
                  <option key={game.gameAppId} value={game.gameAppId}>
                    {game.name} / {game.gameAppId}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>js_code</span>
              <input
                list="sample-js-codes"
                onChange={(event) => onJsCodeChange(event.target.value)}
                value={jsCode}
              />
              <datalist id="sample-js-codes">
                {sampleJsCodes.map((code) => (
                  <option key={code} value={code} />
                ))}
              </datalist>
            </label>
            <button
              className="primary-action"
              disabled={!gameAppId || !jsCode || busyAction === 'session'}
              onClick={onCreateSession}
              type="button"
            >
              <Send size={16} />
              {busyAction === 'session' ? '获取中' : '换取 open_id'}
            </button>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>快手 ECPM</h2>
              <p>按游戏刷新</p>
            </div>
          </div>
          <div className="panel-body">
            <Readout label="游戏 AppID" value={gameAppId || '-'} />
            <Readout
              label="刷新来源"
              value={refreshResult?.source ?? '等待刷新'}
            />
            <button
              className="primary-action"
              disabled={!gameAppId || busyAction === 'refresh'}
              onClick={onRefreshEcpm}
              type="button"
            >
              <RefreshCw size={16} />
              {busyAction === 'refresh' ? '刷新中' : '刷新游戏 ECPM'}
            </button>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>最新 open_id</h2>
              <p>{session?.game.name ?? '未获取'}</p>
            </div>
          </div>
          <div className="panel-body result-list">
            <Readout label="可读 ID" value={session?.readableId ?? '-'} />
            <Readout label="open_id" value={session?.openId ?? '-'} />
            <Readout
              label="写入明细"
              value={`${refreshResult?.savedCount ?? 0} 条`}
            />
          </div>
        </article>
      </section>

      <EcpmTable
        emptyLabel="暂无刷新明细"
        meta={`${refreshResult?.requestedOpenIds.length ?? 0} 个 open_id`}
        rows={refreshResult?.rows ?? []}
        title="刷新明细"
      />

      <section className="panel">
        <div className="panel-heading table-heading">
          <div>
            <h2>提现审核</h2>
            <p>{adminWithdrawalStatus}</p>
          </div>
          <div className="button-row">
            <button
              className="secondary-action"
              disabled={busyAction === 'admin-withdrawals'}
              onClick={() => onLoadWithdrawals('PENDING_REVIEW')}
              type="button"
            >
              待审核
            </button>
            <button
              className="secondary-action"
              disabled={busyAction === 'admin-withdrawals'}
              onClick={() => onLoadWithdrawals('APPROVED')}
              type="button"
            >
              已审核
            </button>
            <button
              className="secondary-action"
              disabled={busyAction === 'admin-withdrawals'}
              onClick={() => onLoadWithdrawals('FAILED')}
              type="button"
            >
              失败
            </button>
          </div>
        </div>
        <div className="table">
          <div className="table-row table-head">
            <span>批次</span>
            <span>用户</span>
            <span>金额</span>
            <span>收款人</span>
            <span>操作</span>
          </div>
          {adminWithdrawals.map((batch) => {
            const detail = batch.details[0];
            return (
              <div className="table-row" key={batch.id}>
                <span>{batch.id}</span>
                <span>{batch.userId}</span>
                <span>¥ {batch.totalAmount.yuan}</span>
                <span>{detail?.recipientName ?? '-'}</span>
                <span>
                  {batch.status === 'APPROVED' ? (
                    <span className="inline-actions">
                      <button
                        className="secondary-action compact-action"
                        disabled={busyAction === `detail-${batch.id}`}
                        onClick={() => onLoadWithdrawalDetail(batch.id)}
                        type="button"
                      >
                        详情
                      </button>
                      <button
                        className="secondary-action compact-action"
                        disabled={busyAction === `pay-success-${batch.id}`}
                        onClick={() => onPayWithdrawal(batch.id, 'success')}
                        type="button"
                      >
                        {busyAction === `pay-success-${batch.id}`
                          ? '打款中'
                          : '打款'}
                      </button>
                      <button
                        className="secondary-action compact-action"
                        disabled={busyAction === `pay-failed-${batch.id}`}
                        onClick={() => onPayWithdrawal(batch.id, 'failed')}
                        type="button"
                      >
                        {busyAction === `pay-failed-${batch.id}`
                          ? '提交中'
                          : '失败'}
                      </button>
                    </span>
                  ) : batch.status === 'FAILED' ? (
                    <span className="inline-actions">
                      <button
                        className="secondary-action compact-action"
                        disabled={busyAction === `detail-${batch.id}`}
                        onClick={() => onLoadWithdrawalDetail(batch.id)}
                        type="button"
                      >
                        详情
                      </button>
                      <button
                        className="secondary-action compact-action"
                        disabled={busyAction === `close-${batch.id}`}
                        onClick={() => onCloseWithdrawal(batch.id)}
                        type="button"
                      >
                        {busyAction === `close-${batch.id}`
                          ? '关闭中'
                          : '关闭'}
                      </button>
                    </span>
                  ) : (
                    <span className="inline-actions">
                      <button
                        className="secondary-action compact-action"
                        disabled={busyAction === `detail-${batch.id}`}
                        onClick={() => onLoadWithdrawalDetail(batch.id)}
                        type="button"
                      >
                        详情
                      </button>
                      <button
                        className="secondary-action compact-action"
                        disabled={busyAction === `approve-${batch.id}`}
                        onClick={() => onApproveWithdrawal(batch.id)}
                        type="button"
                      >
                        {busyAction === `approve-${batch.id}`
                          ? '审核中'
                          : '通过'}
                      </button>
                    </span>
                  )}
                </span>
              </div>
            );
          })}
          {adminWithdrawals.length === 0 ? (
            <div className="empty-state">暂无待审核提现</div>
          ) : null}
        </div>
      </section>

      {selectedWithdrawalDetail ? (
        <section className="panel">
          <div className="panel-heading table-heading">
            <div>
              <h2>提现详情</h2>
              <p>{selectedWithdrawalDetail.batch.id}</p>
            </div>
            <span>{selectedWithdrawalDetail.batch.status}</span>
          </div>
          <div className="panel-body result-list">
            <Readout
              label="用户"
              value={selectedWithdrawalDetail.batch.userId}
            />
            <Readout
              label="金额"
              value={formatMoney(selectedWithdrawalDetail.batch.totalAmount)}
            />
            <Readout
              label="审计"
              value={`${selectedWithdrawalDetail.auditLogs.length} 条`}
            />
          </div>
          <div className="table">
            <div className="table-row table-head">
              <span>明细</span>
              <span>状态</span>
              <span>收款人</span>
              <span>错误</span>
              <span>响应</span>
            </div>
            {selectedWithdrawalDetail.batch.details.map((detail) => (
              <div className="table-row" key={detail.type}>
                <span>{detail.type}</span>
                <span>{detail.status}</span>
                <span>{detail.recipientName}</span>
                <span>{detail.errorCode ?? '-'}</span>
                <span>{formatAuditMetadata(detail.alipayResponseSnapshot)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-heading table-heading">
          <div>
            <h2>审计日志</h2>
            <p>最近操作</p>
          </div>
          <button
            className="secondary-action"
            disabled={busyAction === 'audit-logs'}
            onClick={onLoadAuditLogs}
            type="button"
          >
            <RefreshCw size={16} />
            {busyAction === 'audit-logs' ? '加载中' : '刷新日志'}
          </button>
        </div>
        <div className="table">
          <div className="table-row table-head">
            <span>时间</span>
            <span>动作</span>
            <span>操作者</span>
            <span>目标</span>
            <span>摘要</span>
          </div>
          {auditLogs.map((log) => (
            <div className="table-row" key={log.id}>
              <span>{new Date(log.createdAt).toLocaleString()}</span>
              <span>{log.action}</span>
              <span>
                {log.actorType}/{log.actorId}
              </span>
              <span>
                {log.targetType}/{log.targetId}
              </span>
              <span>{formatAuditMetadata(log.metadata)}</span>
            </div>
          ))}
          {auditLogs.length === 0 ? (
            <div className="empty-state">暂无审计日志</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function MetricCard({ detail, label, value }: MetricCardProps) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail ?? '-'}</p>
    </article>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="readout">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EcpmTable({ emptyLabel, meta, rows, title }: EcpmTableProps) {
  return (
    <section className="panel">
      <div className="panel-heading table-heading">
        <div>
          <h2>{title}</h2>
          <p>{meta}</p>
        </div>
        <span>{rows.length} 条</span>
      </div>
      <div className="table">
        <div className="table-row table-head">
          <span>事件</span>
          <span>游戏</span>
          <span>open_id</span>
          <span>原始金额</span>
          <span>展示金额</span>
        </div>
        {rows.map((row) => (
          <div className="table-row" key={row.platformEventId}>
            <span>{row.platformEventId}</span>
            <span>{row.gameAppId}</span>
            <span>{row.openId}</span>
            <span>¥ {row.rawCost.yuan}</span>
            <span>¥ {row.displayAmount.yuan}</span>
          </div>
        ))}
        {rows.length === 0 ? <div className="empty-state">{emptyLabel}</div> : null}
      </div>
    </section>
  );
}

function formatMoney(money?: MoneyValue) {
  return `¥ ${money?.yuan ?? '0.00'}`;
}

function formatAuditMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object') {
    return '-';
  }

  const entries = Object.entries(metadata as Record<string, unknown>).slice(
    0,
    3,
  );
  return entries.map(([key, value]) => `${key}:${String(value)}`).join(' / ');
}

async function apiGet<T>(path: string, accessToken?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: createHeaders(accessToken),
  });
  return readResponse<T>(response);
}

async function apiPost<T>(
  path: string,
  body: unknown,
  accessToken?: string,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    body: JSON.stringify(body),
    headers: createHeaders(accessToken),
    method: 'POST',
  });
  return readResponse<T>(response);
}

async function apiPatch<T>(
  path: string,
  body: unknown,
  accessToken?: string,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    body: JSON.stringify(body),
    headers: createHeaders(accessToken),
    method: 'PATCH',
  });
  return readResponse<T>(response);
}

function createHeaders(accessToken?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

async function readResponse<T>(response: Response): Promise<T> {
  const payload = await readPayload(response);
  if (!response.ok) {
    throw new Error(readApiErrorMessage(payload, response.status));
  }

  return payload as T;
}

async function readPayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return response.text();
  }

  return response.json();
}

function readApiErrorMessage(payload: unknown, status: number) {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    if (Array.isArray(message)) {
      return message.join('；');
    }

    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }

  if (typeof payload === 'string' && payload.length > 0) {
    return payload;
  }

  if (status === 409) {
    return '数据已存在，请勿重复提交';
  }

  if (status === 400) {
    return '请求参数错误，请检查输入';
  }

  return '请求失败，请稍后重试';
}
