import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Banknote,
  Building2,
  Gamepad2,
  Gauge,
  HandCoins,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';

type WorkspaceRole = '用户' | '代理' | '公司管理员' | '超级管理员';

type NavItem = {
  label: string;
  icon: LucideIcon;
};

type DemoGame = {
  id: string;
  companyName: string;
  gameAppId: string;
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
  source: 'mock' | 'kuaishou';
  requestedOpenIds: string[];
  savedCount: number;
  rows: EcpmRow[];
};

type EarningsResult = {
  identity: string;
  openId: string;
  readableId?: string;
  date: string;
  totalRawCost: MoneyValue;
  totalDisplayAmount: MoneyValue;
  rows: EcpmRow[];
};

type AccountResult = {
  id: string;
  readableId: string;
  username: string;
};

type AccountEarningsResult = {
  date: string;
  openIds: string[];
  totalRawCost: MoneyValue;
  totalDisplayAmount: MoneyValue;
  rows: EcpmRow[];
  userId: string;
};

type EcpmRow = {
  platformEventId: string;
  gameAppId: string;
  openId: string;
  rawCost: MoneyValue;
  displayAmount: MoneyValue;
  eventTime: string;
};

type MoneyValue = {
  li: string;
  yuan: string;
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() || '/api';

const navByRole: Record<WorkspaceRole, NavItem[]> = {
  用户: [
    { label: '收益查询', icon: Gauge },
    { label: 'ID 绑定', icon: Gamepad2 },
    { label: '提现记录', icon: Banknote },
  ],
  代理: [
    { label: '收益概览', icon: HandCoins },
    { label: '名下用户', icon: Users },
    { label: '收款信息', icon: Banknote },
  ],
  公司管理员: [
    { label: '游戏数据', icon: Gamepad2 },
    { label: '结算审核', icon: ShieldCheck },
    { label: '提现审核', icon: Banknote },
  ],
  超级管理员: [
    { label: '联调工作台', icon: Gauge },
    { label: '公司与游戏', icon: Building2 },
    { label: '代理配置', icon: Users },
    { label: '系统配置', icon: Settings },
  ],
};

const roles = Object.keys(navByRole) as WorkspaceRole[];

export function App() {
  const [activeRole, setActiveRole] = useState<WorkspaceRole>('超级管理员');
  const [games, setGames] = useState<DemoGame[]>([]);
  const [sampleJsCodes, setSampleJsCodes] = useState<string[]>([]);
  const [status, setStatus] = useState<IntegrationStatus>();
  const [gameAppId, setGameAppId] = useState('');
  const [jsCode, setJsCode] = useState('mock-js-code-001');
  const [session, setSession] = useState<GameSessionResult>();
  const [refreshResult, setRefreshResult] = useState<EcpmRefreshResult>();
  const [identity, setIdentity] = useState('');
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

  const navItems = navByRole[activeRole];
  const selectedGame = useMemo(
    () => games.find((game) => game.gameAppId === gameAppId),
    [gameAppId, games],
  );

  useEffect(() => {
    void loadContext().catch((nextError: unknown) => {
      setError(
        nextError instanceof Error
          ? nextError.message
          : '无法连接 API，请确认 pnpm dev 已启动',
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
      setNotice('open_id 获取成功');
    });
  }

  async function refreshEcpm() {
    await runAction('refresh', async () => {
      const result = await apiPost<EcpmRefreshResult>(
        '/admin/kuaishou/ecpm/refresh',
        {
          gameAppId,
          openIds: session?.openId ? [session.openId] : undefined,
        },
      );
      setRefreshResult(result);
      setNotice(`ECPM 刷新成功，写入 ${result.savedCount} 条明细`);
    });
  }

  async function queryEarnings() {
    await runAction('query', async () => {
      const result = await apiGet<EarningsResult>(
        `/user/earnings?identity=${encodeURIComponent(identity)}`,
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
      return;
    }

    await runAction('bind', async () => {
      await apiPost(`/accounts/${account.id}/open-ids`, {
        identity: session?.openId ?? identity,
      });
      setNotice('open_id 绑定成功');
    });
  }

  async function queryAccountEarnings() {
    if (!account) {
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
            <span>运营后台</span>
          </div>
        </div>

        <div className="role-switcher" aria-label="身份预览">
          {roles.map((role) => (
            <button
              className={role === activeRole ? 'role-chip active' : 'role-chip'}
              key={role}
              onClick={() => setActiveRole(role)}
              type="button"
            >
              {role}
            </button>
          ))}
        </div>

        <nav className="nav-list" aria-label="主导航">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <a
                className={index === 0 ? 'nav-item active' : 'nav-item'}
                href="#"
                key={item.label}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p>游戏端 / 快手端 / 用户端</p>
            <h1>open_id 收益联调</h1>
          </div>
          <span className={`status ${status?.kuaishouApiMode ?? 'warning'}`}>
            {status?.kuaishouApiMode === 'real' ? '快手真实接口' : '快手 Mock'}
          </span>
        </header>

        {error ? <div className="alert danger">{error}</div> : null}
        {notice ? <div className="alert success">{notice}</div> : null}

        <section className="metric-grid" aria-label="关键指标">
          <article className="metric-card">
            <span>当前游戏</span>
            <strong>{selectedGame?.name ?? '-'}</strong>
            <p>{gameAppId || '-'}</p>
          </article>
          <article className="metric-card">
            <span>open_id</span>
            <strong className="compact-value">{session?.readableId ?? '-'}</strong>
            <p>{session?.openId ?? '等待游戏端登录'}</p>
          </article>
          <article className="metric-card">
            <span>今日展示金额</span>
            <strong>¥ {earnings?.totalDisplayAmount.yuan ?? '0.00'}</strong>
            <p>{earnings ? `${earnings.rows.length} 条 ECPM 明细` : '等待查询'}</p>
          </article>
        </section>

        <section className="workbench-grid">
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
                  onChange={(event) => setGameAppId(event.target.value)}
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
                  onChange={(event) => setJsCode(event.target.value)}
                  value={jsCode}
                />
                <datalist id="sample-js-codes">
                  {sampleJsCodes.map((code) => (
                    <option key={code} value={code} />
                  ))}
                </datalist>
              </label>
              <button
                className="primary-action full"
                disabled={!gameAppId || !jsCode || busyAction === 'session'}
                onClick={createGameSession}
                type="button"
              >
                <Send size={16} />
                换取 open_id
              </button>
            </div>
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div>
                <h2>快手 ECPM</h2>
                <p>ecpm_report</p>
              </div>
            </div>
            <div className="panel-body">
              <div className="readonly-box">
                <span>请求 open_id</span>
                <strong>{session?.openId ?? '-'}</strong>
              </div>
              <button
                className="primary-action full"
                disabled={!session || busyAction === 'refresh'}
                onClick={refreshEcpm}
                type="button"
              >
                <RefreshCw size={16} />
                刷新 ECPM
              </button>
              <div className="mini-result">
                {refreshResult
                  ? `${refreshResult.source} / ${refreshResult.savedCount} 条`
                  : '-'}
              </div>
            </div>
          </article>

          <article className="panel">
            <div className="panel-heading">
              <div>
                <h2>用户查询</h2>
                <p>默认当天</p>
              </div>
            </div>
            <div className="panel-body">
              <label className="field">
                <span>open_id / 可读 ID</span>
                <input
                  onChange={(event) => setIdentity(event.target.value)}
                  value={identity}
                />
              </label>
              <button
                className="primary-action full"
                disabled={!identity || busyAction === 'query'}
                onClick={queryEarnings}
                type="button"
              >
                <Search size={16} />
                查询收益
              </button>
            </div>
          </article>
        </section>

        <section className="panel account-panel">
          <div className="panel-heading">
            <div>
              <h2>账号绑定</h2>
              <p>注册后绑定多个 open_id</p>
            </div>
          </div>
          <div className="account-grid">
            <label className="field">
              <span>账号</span>
              <input
                onChange={(event) => setUsername(event.target.value)}
                value={username}
              />
            </label>
            <label className="field">
              <span>密码</span>
              <input
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </label>
            <button
              className="primary-action full"
              disabled={!username || !password || busyAction === 'register'}
              onClick={registerAccount}
              type="button"
            >
              注册账号
            </button>
            <button
              className="secondary-action full"
              disabled={!username || !password || busyAction === 'login'}
              onClick={loginAccount}
              type="button"
            >
              登录账号
            </button>
            <button
              className="primary-action full"
              disabled={!account || !session || busyAction === 'bind'}
              onClick={bindAccountOpenId}
              type="button"
            >
              绑定 open_id
            </button>
            <button
              className="primary-action full"
              disabled={!account || busyAction === 'account-query'}
              onClick={queryAccountEarnings}
              type="button"
            >
              查询账号收益
            </button>
            <div className="readonly-box">
              <span>当前账号</span>
              <strong>
                {account
                  ? `${account.username} / ${account.readableId}`
                  : '未注册'}
              </strong>
            </div>
          </div>
          <div className="account-summary">
            <span>账号聚合展示金额</span>
            <strong>¥ {accountEarnings?.totalDisplayAmount.yuan ?? '0.00'}</strong>
            <span>{accountEarnings?.openIds.length ?? 0} 个 open_id</span>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>收益明细</h2>
              <p>{earnings?.date ?? '今日'}</p>
            </div>
          </div>
          <div className="table">
            <div className="table-row table-head">
              <span>事件</span>
              <span>原始金额</span>
              <span>展示金额</span>
            </div>
            {(earnings?.rows ?? []).map((row) => (
              <div className="table-row" key={row.platformEventId}>
                <span>{row.platformEventId}</span>
                <span>¥ {row.rawCost.yuan}</span>
                <span>¥ {row.displayAmount.yuan}</span>
              </div>
            ))}
            {!earnings?.rows.length ? (
              <div className="empty-state">暂无明细</div>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
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
