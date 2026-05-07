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

type AccountEarningsResult = {
  date: string;
  openIds: string[];
  rows: EcpmRow[];
  totalDisplayAmount: MoneyValue;
  totalRawCost: MoneyValue;
  userId: string;
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
  const [accountEarnings, setAccountEarnings] =
    useState<AccountEarningsResult>();
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
      const result = await apiPost<AccountResult>('/accounts/register', {
        password,
        username,
      });
      setAccount(result);
      setNotice('账号注册成功');
    });
  }

  async function loginAccount() {
    await runAction('login', async () => {
      const result = await apiPost<AccountResult>('/accounts/login', {
        password,
        username,
      });
      setAccount(result);
      setNotice('账号登录成功');
    });
  }

  async function bindAccountOpenId() {
    if (!account) {
      setError('请先登录或注册账号');
      return;
    }

    const targetIdentity = bindIdentity.trim();
    if (!targetIdentity) {
      setError('请输入要绑定的 open_id 或可读 ID');
      return;
    }

    await runAction('bind', async () => {
      await apiPost<unknown>(`/accounts/${account.id}/open-ids`, {
        identity: targetIdentity,
      });
      const result = await apiGet<AccountEarningsResult>(
        `/accounts/${account.id}/earnings`,
      );
      setAccountEarnings(result);
      setNotice('open_id 绑定成功');
    });
  }

  async function queryAccountEarnings() {
    if (!account) {
      setError('请先登录或注册账号');
      return;
    }

    await runAction('account-query', async () => {
      const result = await apiGet<AccountEarningsResult>(
        `/accounts/${account.id}/earnings`,
      );
      setAccountEarnings(result);
      setNotice('账号收益查询成功');
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
            onLogin={loginAccount}
            onPasswordChange={setPassword}
            onQueryAccountEarnings={queryAccountEarnings}
            onRegister={registerAccount}
            onUsernameChange={setUsername}
            password={password}
            username={username}
          />
        ) : null}

        {activeView === 'tools' ? (
          <ToolsView
            busyAction={busyAction}
            gameAppId={gameAppId}
            games={games}
            jsCode={jsCode}
            onCreateSession={createGameSession}
            onGameChange={setGameAppId}
            onJsCodeChange={setJsCode}
            onRefreshEcpm={refreshEcpm}
            refreshResult={refreshResult}
            sampleJsCodes={sampleJsCodes}
            selectedGame={selectedGame}
            session={session}
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
  bindIdentity: string;
  busyAction: string;
  onBindIdentityChange: (value: string) => void;
  onBindOpenId: () => void;
  onLogin: () => void;
  onPasswordChange: (value: string) => void;
  onQueryAccountEarnings: () => void;
  onRegister: () => void;
  onUsernameChange: (value: string) => void;
  password: string;
  username: string;
}) {
  const {
    account,
    accountEarnings,
    bindIdentity,
    busyAction,
    onBindIdentityChange,
    onBindOpenId,
    onLogin,
    onPasswordChange,
    onQueryAccountEarnings,
    onRegister,
    onUsernameChange,
    password,
    username,
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
  busyAction: string;
  gameAppId: string;
  games: DemoGame[];
  jsCode: string;
  onCreateSession: () => void;
  onGameChange: (value: string) => void;
  onJsCodeChange: (value: string) => void;
  onRefreshEcpm: () => void;
  refreshResult?: EcpmRefreshResult;
  sampleJsCodes: string[];
  selectedGame?: DemoGame;
  session?: GameSessionResult;
}) {
  const {
    busyAction,
    gameAppId,
    games,
    jsCode,
    onCreateSession,
    onGameChange,
    onJsCodeChange,
    onRefreshEcpm,
    refreshResult,
    sampleJsCodes,
    selectedGame,
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

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  return readResponse<T>(response);
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  return readResponse<T>(response);
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
