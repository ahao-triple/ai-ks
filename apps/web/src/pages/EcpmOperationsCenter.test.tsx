import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement, ReactNode } from 'react';
import { isValidElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { EcpmOperationsCenter } from './EcpmOperationsCenter';
import type {
  AdminCompany,
  AdminGame,
  EcpmDashboardRow,
  EcpmDashboardScope,
  EcpmUpdateJob,
  EcpmUpdateRequest,
} from '../types/api';

type HookRuntime = {
  useId(): string;
  useState<T>(
    initialValue: T | (() => T),
  ): [T, (value: T | ((currentValue: T) => T)) => void];
};

const hookRuntime = vi.hoisted(() => ({
  current: undefined as HookRuntime | undefined,
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();

  return {
    ...actual,
    useId: () => hookRuntime.current?.useId() ?? actual.useId(),
    useState: <T,>(initialValue: T | (() => T)) =>
      hookRuntime.current?.useState(initialValue) ??
      actual.useState(initialValue),
  };
});

const job: EcpmUpdateJob = {
  actorId: 'admin-1',
  actorType: 'SUPER_ADMIN',
  createdAt: '2026-05-08T00:00:00.000Z',
  endedDataHour: '2026-05-08T03:00:00.000Z',
  errorMessage: 'job level warning',
  failedCount: 1,
  finishedAt: '2026-05-08T03:05:00.000Z',
  id: 'job-1',
  itemCount: 3,
  items: [
    {
      createdAt: '2026-05-08T01:00:00.000Z',
      dataHour: '2026-05-08T01:00:00.000Z',
      errorMessage: null,
      gameAppId: 'game-app-1',
      gameId: 'game-1',
      id: 'item-1',
      jobId: 'job-1',
      kuaishouSyncJobId: 'ks-job-1',
      openId: 'open-1',
      savedCount: 2,
      skipReason: null,
      status: 'SUCCEEDED',
      updatedAt: '2026-05-08T01:05:00.000Z',
      userId: 'user-1',
    },
    {
      createdAt: '2026-05-08T02:00:00.000Z',
      dataHour: '2026-05-08T02:00:00.000Z',
      errorMessage: 'fetch failed',
      gameAppId: 'game-app-1',
      gameId: 'game-1',
      id: 'item-2',
      jobId: 'job-1',
      kuaishouSyncJobId: null,
      openId: 'open-2',
      savedCount: 0,
      skipReason: null,
      status: 'FAILED',
      updatedAt: '2026-05-08T02:05:00.000Z',
      userId: 'user-2',
    },
    {
      createdAt: '2026-05-08T03:00:00.000Z',
      dataHour: '2026-05-08T03:00:00.000Z',
      errorMessage: null,
      gameAppId: 'game-app-1',
      gameId: 'game-1',
      id: 'item-3',
      jobId: 'job-1',
      kuaishouSyncJobId: null,
      openId: 'open-3',
      savedCount: 0,
      skipReason: 'no bound user',
      status: 'PARTIAL',
      updatedAt: '2026-05-08T03:05:00.000Z',
      userId: null,
    },
  ],
  mode: 'range',
  requestedGameCount: 1,
  requestedOpenIdCount: 3,
  savedCount: 2,
  scopeId: 'game-1',
  scopeType: 'game',
  skippedCount: 1,
  startedAt: '2026-05-08T00:00:00.000Z',
  startedDataHour: '2026-05-08T01:00:00.000Z',
  status: 'PARTIAL',
  updatedAt: '2026-05-08T03:05:00.000Z',
};

const row: EcpmDashboardRow = {
  companyId: 'company-1',
  companyName: 'Company A',
  dataHour: '2026-05-08T01:00:00.000Z',
  displayAmount: { li: '300', yuan: '3.00' },
  eventCount: 2,
  gameAppId: 'game-app-1',
  gameId: 'game-1',
  gameName: 'Game A',
  openId: 'open-1',
  openIdCount: 1,
  rawCost: { li: '1000', yuan: '10.00' },
  readableId: 'readable-1',
  status: 'SUCCEEDED',
  updatedAt: '2026-05-08T01:10:00.000Z',
  userId: 'user-1',
  userReadableId: 'user-readable-1',
  username: 'User A',
};

const companies: AdminCompany[] = [
  {
    id: 'company-1',
    name: 'Company A',
    balance: { li: '0', yuan: '0.00' },
  } as AdminCompany,
];

const games: AdminGame[] = [
  {
    id: 'game-1',
    companyId: 'company-1',
    gameAppId: 'game-app-1',
    name: 'Game A',
  } as AdminGame,
];

type CenterOverride = Partial<{
  canUpdate: boolean;
  companies: AdminCompany[];
  games: AdminGame[];
  jobs: EcpmUpdateJob[];
  loadingAction: '' | 'ecpm-dashboard' | 'ecpm-update' | 'ecpm-jobs';
  onDashboardQuery: (
    scope: EcpmDashboardScope,
    query: Record<string, string | undefined>,
  ) => void;
  onJobSelect: () => void;
  selectedJob?: EcpmUpdateJob;
  onUpdate: (request: EcpmUpdateRequest) => void;
}>;

function buildCenter(overrides: CenterOverride = {}) {
  return (
    <EcpmOperationsCenter
      canUpdate={overrides.canUpdate ?? true}
      companies={overrides.companies ?? companies}
      games={overrides.games ?? games}
      jobs={overrides.jobs ?? [job]}
      loadingAction={overrides.loadingAction ?? ''}
      onDashboardQuery={overrides.onDashboardQuery ?? (() => undefined)}
      onJobSelect={overrides.onJobSelect ?? (() => undefined)}
      onUpdate={overrides.onUpdate ?? (() => undefined)}
      rows={[row]}
      selectedJob={overrides.selectedJob ?? job}
    />
  );
}

function renderCenter(canUpdate = true) {
  return renderToStaticMarkup(buildCenter({ canUpdate }));
}

type TestHostNode = {
  children: TestNode[];
  props: Record<string, any>;
  type: string;
};

type TestNode =
  | TestHostNode
  | TestNode[]
  | boolean
  | null
  | number
  | string
  | undefined;

class ComponentHarness implements HookRuntime {
  private element: ReactElement;
  private idCursor = 0;
  private stateCursor = 0;
  private readonly states: unknown[] = [];
  tree: TestNode = null;

  constructor(element: ReactElement) {
    this.element = element;
    this.render();
  }

  rerender(element: ReactElement) {
    this.element = element;
    this.render();
  }

  render() {
    this.idCursor = 0;
    this.stateCursor = 0;
    hookRuntime.current = this;
    try {
      this.tree = resolveNode(this.element);
    } finally {
      hookRuntime.current = undefined;
    }
  }

  useId() {
    this.idCursor += 1;
    return `ecpm-test-id-${this.idCursor}`;
  }

  useState<T>(
    initialValue: T | (() => T),
  ): [T, (value: T | ((currentValue: T) => T)) => void] {
    const index = this.stateCursor;
    this.stateCursor += 1;

    if (this.states.length <= index) {
      this.states[index] =
        typeof initialValue === 'function'
          ? (initialValue as () => T)()
          : initialValue;
    }

    return [
      this.states[index] as T,
      (value) => {
        this.states[index] =
          typeof value === 'function'
            ? (value as (currentValue: T) => T)(this.states[index] as T)
            : value;
      },
    ];
  }
}

function resolveNode(node: ReactNode): TestNode {
  if (
    node === null ||
    node === undefined ||
    typeof node === 'boolean' ||
    typeof node === 'number' ||
    typeof node === 'string'
  ) {
    return node;
  }

  if (Array.isArray(node)) {
    return node.map(resolveNode);
  }

  if (!isValidElement(node)) {
    return null;
  }

  const element = node as ReactElement<{ children?: ReactNode }>;

  if (typeof element.type === 'function') {
    const Component = element.type as (props: typeof element.props) => ReactNode;
    return resolveNode(Component(element.props));
  }

  if (typeof element.type !== 'string') {
    return resolveNode(element.props.children);
  }

  const { children, ...props } = element.props;
  const childNodes =
    children === undefined ? [] : Array.isArray(children) ? children : [children];

  return {
    children: childNodes.map(resolveNode),
    props,
    type: element.type,
  };
}

function renderInteractive(overrides: CenterOverride = {}) {
  return new ComponentHarness(buildCenter(overrides));
}

function findAll(
  node: TestNode,
  predicate: (hostNode: TestHostNode) => boolean,
): TestHostNode[] {
  if (node === null || node === undefined || typeof node !== 'object') {
    return [];
  }

  if (Array.isArray(node)) {
    return node.flatMap((child) => findAll(child, predicate));
  }

  const current = predicate(node) ? [node] : [];
  return current.concat(node.children.flatMap((child) => findAll(child, predicate)));
}

function textContent(node: TestNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return '';
  }

  if (typeof node === 'number' || typeof node === 'string') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(textContent).join('');
  }

  return node.children.map(textContent).join('');
}

function buttonByText(
  harness: ComponentHarness,
  label: string,
  index = 0,
): TestHostNode {
  const buttons = findAll(
    harness.tree,
    (node) => node.type === 'button' && textContent(node).trim() === label,
  );
  const button = buttons[index];
  if (!button) {
    throw new Error(`Button not found: ${label} at index ${index}`);
  }

  return button;
}

function nodeById(harness: ComponentHarness, id: string): TestHostNode {
  const node = findAll(harness.tree, (item) => item.props.id === id)[0];
  if (!node) {
    throw new Error(`Node not found: ${id}`);
  }

  return node;
}

function updateButton(harness: ComponentHarness): TestHostNode {
  return buttonByText(harness, '更新', 1);
}

function queryButton(harness: ComponentHarness): TestHostNode {
  return buttonByText(harness, '查询');
}

function click(harness: ComponentHarness, node: TestHostNode) {
  node.props.onClick?.({ currentTarget: node });
  harness.render();
}

function change(harness: ComponentHarness, node: TestHostNode, value: string) {
  node.props.onChange?.({ currentTarget: { value } });
  harness.render();
}

function selectGameScope(harness: ComponentHarness) {
  change(harness, nodeById(harness, 'ecpm-game-scope'), 'game-1');
}

function rerenderInteractive(harness: ComponentHarness, overrides: CenterOverride = {}) {
  harness.rerender(buildCenter(overrides));
}

describe('EcpmOperationsCenter', () => {
  it('renders dashboard, update scope, and report status labels', () => {
    const markup = renderCenter();

    expect(markup).toContain('最新数据');
    expect(markup).toContain('公司');
    expect(markup).toContain('游戏');
    expect(markup).toContain('用户');
    expect(markup).toContain('open_id');
    expect(markup).toContain('成功');
    expect(markup).toContain('失败');
    expect(markup).toContain('跳过');
  });

  it('renders dashboard spec columns when optional row fields are available', () => {
    const markup = renderCenter();

    expect(markup).toContain('open_id 数');
    expect(markup).toContain('可读 ID');
    expect(markup).toContain('结算状态');
    expect(markup).toContain('更新时间');
    expect(markup).toContain('1');
    expect(markup).toContain('readable-1');
    expect(markup).toContain('user-readable-1');
    expect(markup).toContain('SUCCEEDED');
    expect(markup).toContain('2026-05-08T01:10:00.000Z');
  });

  it('disables the update button when updates are not allowed', () => {
    const markup = renderCenter(false);

    expect(markup).toContain('disabled=""');
  });

  it('renders selected report metadata and covered hours', () => {
    const markup = renderCenter();

    expect(markup).toContain('SUPER_ADMIN admin-1');
    expect(markup).toContain('创建 2026-05-08T00:00:00.000Z');
    expect(markup).toContain('开始 2026-05-08T00:00:00.000Z');
    expect(markup).toContain('完成 2026-05-08T03:05:00.000Z');
    expect(markup).toContain('数据 2026-05-08T01:00:00.000Z - 2026-05-08T03:00:00.000Z');
    expect(markup).toContain('请求游戏 1');
    expect(markup).toContain('open_id 3');
    expect(markup).toContain('来源 -');
    expect(markup).toContain('请求数 3');
    expect(markup).toContain('job level warning');
    expect(markup).toContain(
      '覆盖小时 2026-05-08T01:00:00.000Z / 2026-05-08T02:00:00.000Z / 2026-05-08T03:00:00.000Z',
    );
  });

  it('renders optional report source and request count when present', () => {
    const markup = renderToStaticMarkup(
      buildCenter({
        selectedJob: {
          ...job,
          requestCount: 7,
          source: 'kuaishou',
        } as EcpmUpdateJob,
      }),
    );

    expect(markup).toContain('来源 kuaishou');
    expect(markup).toContain('请求数 7');
  });

  it('normalizes dashboard hour range filters before querying', () => {
    const onDashboardQuery = vi.fn();
    const harness = renderInteractive({ onDashboardQuery });

    change(
      harness,
      nodeById(harness, 'ecpm-dashboard-started-data-hour'),
      '2026-05-08T03:00',
    );
    change(
      harness,
      nodeById(harness, 'ecpm-dashboard-ended-data-hour'),
      '2026-05-08T05:00',
    );
    click(harness, queryButton(harness));

    expect(onDashboardQuery).toHaveBeenCalledWith('latest', {
      endedDataHour: '2026-05-08T05:00:00+08:00',
      startedDataHour: '2026-05-08T03:00:00+08:00',
    });
  });

  it('queries latest dashboard data without hour filters by default', () => {
    const onDashboardQuery = vi.fn();
    const harness = renderInteractive({ onDashboardQuery });

    click(harness, queryButton(harness));

    expect(onDashboardQuery).toHaveBeenCalledWith('latest', {});
    expect(Object.keys(onDashboardQuery.mock.calls[0]?.[1] ?? {})).toEqual([]);
  });

  it('disables dashboard query for reversed or invalid hour ranges', () => {
    const onDashboardQuery = vi.fn();
    const harness = renderInteractive({ onDashboardQuery });

    change(
      harness,
      nodeById(harness, 'ecpm-dashboard-started-data-hour'),
      '2026-05-08T05:00',
    );
    change(
      harness,
      nodeById(harness, 'ecpm-dashboard-ended-data-hour'),
      '2026-05-08T03:00',
    );

    expect(queryButton(harness).props.disabled).toBe(true);

    click(harness, queryButton(harness));

    expect(onDashboardQuery).not.toHaveBeenCalled();

    change(
      harness,
      nodeById(harness, 'ecpm-dashboard-started-data-hour'),
      '2026-05-08T03:30',
    );
    change(
      harness,
      nodeById(harness, 'ecpm-dashboard-ended-data-hour'),
      '2026-05-08T05:00',
    );

    expect(queryButton(harness).props.disabled).toBe(true);
  });

  it('requires an id before querying user or open_id dashboard scopes', () => {
    const onDashboardQuery = vi.fn();
    const harness = renderInteractive({ onDashboardQuery });

    click(harness, buttonByText(harness, '用户'));

    expect(queryButton(harness).props.disabled).toBe(true);

    click(harness, queryButton(harness));

    expect(onDashboardQuery).not.toHaveBeenCalled();

    click(harness, buttonByText(harness, 'open_id'));

    expect(queryButton(harness).props.disabled).toBe(true);
  });

  it('clears dashboard id when changing scopes so stale user id cannot query open_id', () => {
    const onDashboardQuery = vi.fn();
    const harness = renderInteractive({ onDashboardQuery });

    click(harness, buttonByText(harness, '用户'));
    change(harness, nodeById(harness, 'ecpm-dashboard-scope-id'), 'user-1');
    click(harness, queryButton(harness));

    expect(onDashboardQuery).toHaveBeenCalledWith('user', { userId: 'user-1' });

    click(harness, buttonByText(harness, 'open_id'));

    expect(nodeById(harness, 'ecpm-dashboard-scope-id').props.value).toBe('');
    expect(queryButton(harness).props.disabled).toBe(true);

    click(harness, queryButton(harness));

    expect(onDashboardQuery).toHaveBeenCalledTimes(1);
  });

  it('normalizes range update hours before calling onUpdate', () => {
    const onUpdate = vi.fn();
    const harness = renderInteractive({ onUpdate });

    selectGameScope(harness);
    click(harness, buttonByText(harness, '时间范围'));
    change(harness, nodeById(harness, 'ecpm-started-data-hour'), '2026-05-08T03:00');
    change(harness, nodeById(harness, 'ecpm-ended-data-hour'), '2026-05-08T05:00');
    click(harness, updateButton(harness));

    expect(onUpdate).toHaveBeenCalledWith({
      endedDataHour: '2026-05-08T05:00:00+08:00',
      mode: 'range',
      scopeId: 'game-1',
      scopeType: 'game',
      startedDataHour: '2026-05-08T03:00:00+08:00',
    });
  });

  it('disables range update while start or end hour is missing', () => {
    const harness = renderInteractive();

    selectGameScope(harness);
    click(harness, buttonByText(harness, '时间范围'));

    expect(updateButton(harness).props.disabled).toBe(true);

    change(harness, nodeById(harness, 'ecpm-started-data-hour'), '2026-05-08T03:00');

    expect(updateButton(harness).props.disabled).toBe(true);
  });

  it('disables range update when an hour value is not whole-hour aligned', () => {
    const harness = renderInteractive();

    selectGameScope(harness);
    click(harness, buttonByText(harness, '时间范围'));
    change(harness, nodeById(harness, 'ecpm-started-data-hour'), '2026-05-08T03:30');
    change(harness, nodeById(harness, 'ecpm-ended-data-hour'), '2026-05-08T05:00');

    expect(updateButton(harness).props.disabled).toBe(true);
  });

  it('disables range update when the time window is reversed', () => {
    const onUpdate = vi.fn();
    const harness = renderInteractive({ onUpdate });

    selectGameScope(harness);
    click(harness, buttonByText(harness, '时间范围'));
    change(harness, nodeById(harness, 'ecpm-started-data-hour'), '2026-05-08T05:00');
    change(harness, nodeById(harness, 'ecpm-ended-data-hour'), '2026-05-08T03:00');

    expect(updateButton(harness).props.disabled).toBe(true);

    click(harness, updateButton(harness));

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('disables range update when the inclusive window exceeds 24 hours', () => {
    const onUpdate = vi.fn();
    const harness = renderInteractive({ onUpdate });

    selectGameScope(harness);
    click(harness, buttonByText(harness, '时间范围'));
    change(harness, nodeById(harness, 'ecpm-started-data-hour'), '2026-05-08T00:00');
    change(harness, nodeById(harness, 'ecpm-ended-data-hour'), '2026-05-09T00:00');

    expect(updateButton(harness).props.disabled).toBe(true);

    click(harness, updateButton(harness));

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('does not let dashboard query id enable the update action', () => {
    const harness = renderInteractive();

    change(harness, nodeById(harness, 'ecpm-dashboard-scope-id'), 'game-1');

    expect(updateButton(harness).props.disabled).toBe(true);
  });

  it('clears stale update scope id when switching update scope type', () => {
    const harness = renderInteractive();

    selectGameScope(harness);

    expect(updateButton(harness).props.disabled).toBe(false);

    click(harness, buttonByText(harness, '用户', 1));

    expect(nodeById(harness, 'ecpm-user-scope').props.value).toBe('');
    expect(updateButton(harness).props.disabled).toBe(true);
  });

  it('keeps update scope id when clicking the already-selected update scope', () => {
    const harness = renderInteractive();

    selectGameScope(harness);
    click(harness, buttonByText(harness, '游戏', 1));

    expect(nodeById(harness, 'ecpm-game-scope').props.value).toBe('game-1');
    expect(updateButton(harness).props.disabled).toBe(false);
  });

  it('disables the actual update button when updates are not allowed', () => {
    const harness = renderInteractive({ canUpdate: false });

    selectGameScope(harness);

    expect(updateButton(harness).props.disabled).toBe(true);
  });

  it('disables update when a selected game is removed from props', () => {
    const onUpdate = vi.fn();
    const harness = renderInteractive({ onUpdate });

    selectGameScope(harness);

    expect(updateButton(harness).props.disabled).toBe(false);

    rerenderInteractive(harness, { games: [], onUpdate });

    expect(updateButton(harness).props.disabled).toBe(true);

    click(harness, updateButton(harness));

    expect(onUpdate).not.toHaveBeenCalled();
  });
});
