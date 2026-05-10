import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OperationFeedback } from '../components/ui';
import {
  createOperationFeedbackItem,
  finishOperationFeedbackItem,
  limitOperationFeedbackItems,
  resolveOperationFeedbackText,
} from './operationFeedback';

describe('operation feedback text', () => {
  it('names the high-frequency account and admin operations in Chinese', () => {
    expect(resolveOperationFeedbackText('login').runningMessage).toBe(
      '正在登录账号...',
    );
    expect(resolveOperationFeedbackText('register').runningMessage).toBe(
      '正在注册账号...',
    );
    expect(resolveOperationFeedbackText('company-create').runningMessage).toBe(
      '正在创建公司...',
    );
    expect(resolveOperationFeedbackText('game-create').runningMessage).toBe(
      '正在创建游戏...',
    );
  });

  it('names dynamic batch operations so users know which workflow is running', () => {
    expect(resolveOperationFeedbackText('approve-batch-1').runningMessage).toBe(
      '正在审核提现批次...',
    );
    expect(
      resolveOperationFeedbackText('pay-success-batch-1').runningMessage,
    ).toBe('正在标记提现打款成功...');
    expect(
      resolveOperationFeedbackText('settlement-detail-batch-1').runningMessage,
    ).toBe('正在加载结算批次详情...');
  });
});

describe('operation feedback state helpers', () => {
  it('creates running feedback and finishes it with an explicit message', () => {
    const started = createOperationFeedbackItem(
      'game-create',
      'op-1',
      '2026-05-10T10:00:00.000Z',
    );

    expect(started).toMatchObject({
      id: 'op-1',
      label: '创建游戏',
      message: '正在创建游戏...',
      status: 'running',
    });

    const finished = finishOperationFeedbackItem(
      [started],
      'op-1',
      'failed',
      '请填写公司、游戏名称、AppID 和密钥',
      '2026-05-10T10:00:01.000Z',
    );

    expect(finished[0]).toMatchObject({
      message: '请填写公司、游戏名称、AppID 和密钥',
      status: 'failed',
      updatedAt: '2026-05-10T10:00:01.000Z',
    });
  });

  it('keeps only the newest feedback records', () => {
    const items = Array.from({ length: 25 }, (_, index) =>
      createOperationFeedbackItem('login', `op-${index}`, `2026-05-10T10:00:${index
        .toString()
        .padStart(2, '0')}.000Z`),
    );

    expect(limitOperationFeedbackItems(items, 20)).toHaveLength(20);
  });
});

describe('OperationFeedback', () => {
  it('renders the current operation and recent history', () => {
    const markup = renderToStaticMarkup(
      <OperationFeedback
        items={[
          {
            createdAt: '2026-05-10T10:00:00.000Z',
            id: 'op-2',
            label: '创建游戏',
            message: '创建游戏已完成',
            status: 'success',
            updatedAt: '2026-05-10T10:00:01.000Z',
          },
          {
            createdAt: '2026-05-10T09:59:00.000Z',
            id: 'op-1',
            label: '登录账号',
            message: '正在登录账号...',
            status: 'running',
            updatedAt: '2026-05-10T09:59:00.000Z',
          },
        ]}
      />,
    );

    expect(markup).toContain('操作反馈');
    expect(markup).toContain('创建游戏已完成');
    expect(markup).toContain('最近操作');
    expect(markup).toContain('正在登录账号...');
  });
});
