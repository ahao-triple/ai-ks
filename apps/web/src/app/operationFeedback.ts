export type OperationFeedbackStatus = 'failed' | 'running' | 'success';

export type OperationFeedbackItem = {
  createdAt: string;
  id: string;
  label: string;
  message: string;
  status: OperationFeedbackStatus;
  updatedAt: string;
};

export type OperationFeedbackText = {
  failedMessage: string;
  label: string;
  runningMessage: string;
  successMessage: string;
};

const operationLabels: Record<string, string> = {
  agents: '刷新代理列表',
  alipay: '保存支付宝资料',
  'account-query': '查询账号收益',
  'admin-login': '登录管理员',
  'admin-resources': '刷新预算资源',
  'admin-withdrawals': '刷新提现批次',
  'agent-alipay': '保存代理支付宝',
  'agent-alipay-own': '保存代理支付宝资料',
  'agent-binding': '绑定代理归属',
  'agent-create': '创建代理',
  'agent-earnings': '刷新代理收益',
  'agent-login': '登录代理',
  'agent-users': '刷新代理名下用户',
  'agent-withdrawal': '提交代理提现',
  'agent-withdrawal-own': '提交代理提现',
  'agent-withdrawals': '刷新代理提现批次',
  'audit-logs': '刷新审计日志',
  bind: '绑定 open_id',
  'business-closure': '刷新真实数据闭环核对',
  'company-admin-create': '创建公司管理员',
  'company-admin-scopes': '保存公司管理员授权范围',
  'company-admin-update': '保存公司管理员账号',
  'company-admins': '刷新公司管理员账号',
  'company-balance': '充值公司余额',
  'company-create': '创建公司',
  'ecpm-dashboard': '查询 ECPM 看板',
  'ecpm-jobs': '刷新 ECPM 更新任务',
  'ecpm-update': '更新 ECPM 数据',
  'game-budget': '分配游戏预算',
  'game-config': '保存游戏配置',
  'game-config-budget': '分配游戏配置预算',
  'game-config-ecpm-refresh': '刷新游戏配置 ECPM',
  'game-create': '创建游戏',
  'kuaishou-authorize': '提交快手授权',
  'kuaishou-ecpm-jobs': '刷新同步任务',
  'kuaishou-refresh-token': '刷新平台 token',
  'kuaishou-token': '刷新平台授权状态',
  login: '登录账号',
  'platform-config': '处理平台配置',
  query: '游客收益查询',
  refresh: '刷新游戏 ECPM',
  register: '注册账号',
  session: '换取 open_id',
  'settlement-confirm': '确认结算入账',
  'settlement-preview': '预览结算',
  withdrawal: '提交提现申请',
};

function resolveDynamicOperationLabel(action: string) {
  if (action.startsWith('retry-ecpm-')) {
    return '重试失败 ECPM 任务';
  }

  if (action.startsWith('settlement-detail-')) {
    return '加载结算批次详情';
  }

  if (action.startsWith('approve-')) {
    return '审核提现批次';
  }

  if (action.startsWith('pay-success-')) {
    return '标记提现打款成功';
  }

  if (action.startsWith('pay-failed-')) {
    return '标记提现打款失败';
  }

  if (action.startsWith('close-')) {
    return '关闭提现批次';
  }

  if (action.startsWith('detail-')) {
    return '加载提现批次详情';
  }

  return undefined;
}

export function resolveOperationFeedbackText(
  action: string,
): OperationFeedbackText {
  const label =
    operationLabels[action] ?? resolveDynamicOperationLabel(action) ?? '处理操作';

  return {
    failedMessage: `${label}失败`,
    label,
    runningMessage: `正在${label}...`,
    successMessage: `${label}已完成`,
  };
}

export function createOperationFeedbackItem(
  action: string,
  id: string,
  now = new Date().toISOString(),
): OperationFeedbackItem {
  const text = resolveOperationFeedbackText(action);

  return {
    createdAt: now,
    id,
    label: text.label,
    message: text.runningMessage,
    status: 'running',
    updatedAt: now,
  };
}

export function finishOperationFeedbackItem(
  items: OperationFeedbackItem[],
  id: string,
  status: Exclude<OperationFeedbackStatus, 'running'>,
  message?: string,
  now = new Date().toISOString(),
) {
  return items.map((item) => {
    if (item.id !== id) {
      return item;
    }

    return {
      ...item,
      message:
        message ??
        (status === 'success'
          ? `${item.label}已完成`
          : `${item.label}失败`),
      status,
      updatedAt: now,
    };
  });
}

export function limitOperationFeedbackItems(
  items: OperationFeedbackItem[],
  maxItems = 20,
) {
  return items.slice(0, maxItems);
}
