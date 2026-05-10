import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EcpmRecordTable, type EcpmRecordView } from './EcpmRecordTable';

const sampleRows: EcpmRecordView[] = [
  {
    todaySequence: 4,
    eventTimeIso: '2026-05-11T14:34:18+08:00',
    ecpmYuan: 45.2,
    gameName: '消消乐 Pro',
    accountReadableId: 'A8F3D2K',
    source: 'kuaishou',
  },
  {
    todaySequence: 1,
    eventTimeIso: '2026-05-11T13:42:11+08:00',
    ecpmYuan: 38.2,
    gameName: '消消乐 Pro',
    accountReadableId: 'A8F3D2K',
    source: 'kuaishou',
  },
];

describe('EcpmRecordTable', () => {
  it('渲染表格默认列（序号 / 时间 / ECPM / 游戏 / 账号）', () => {
    const markup = renderToStaticMarkup(
      <EcpmRecordTable
        rows={sampleRows}
        loading={false}
        totalToday={2}
        totalAll={2}
      />,
    );
    expect(markup).toContain('今日序号');
    expect(markup).toContain('第 4 条');
    expect(markup).toContain('第 1 条 🎯');
    expect(markup).toContain('¥ 45.20');
    expect(markup).toContain('A8F3D2K');
    expect(markup).toContain('消消乐 Pro');
  });

  it('计数提示显示今日和累计条数', () => {
    const markup = renderToStaticMarkup(
      <EcpmRecordTable
        rows={sampleRows}
        loading={false}
        totalToday={2}
        totalAll={287}
      />,
    );
    expect(markup).toContain('今日');
    expect(markup).toContain('<strong>2</strong>');
    expect(markup).toContain('<strong>287</strong>');
  });

  it('loading 且无数据时显示骨架屏', () => {
    const markup = renderToStaticMarkup(
      <EcpmRecordTable
        rows={[]}
        loading={true}
        totalToday={0}
        totalAll={0}
      />,
    );
    expect(markup).toContain('ecpm-record-skeleton');
    expect(markup).toContain('aria-busy');
  });

  it('空记录显示友好引导文案', () => {
    const markup = renderToStaticMarkup(
      <EcpmRecordTable
        rows={[]}
        loading={false}
        totalToday={0}
        totalAll={0}
      />,
    );
    expect(markup).toContain('还没有 ECPM 记录');
    expect(markup).toContain('绑定一个游戏并在游戏内看广告');
  });

  it('extraColumns 打开"展示金额"列', () => {
    const rowsWithMoney: EcpmRecordView[] = [
      { ...sampleRows[0], displayAmountYuan: 0.45 },
    ];
    const markup = renderToStaticMarkup(
      <EcpmRecordTable
        rows={rowsWithMoney}
        loading={false}
        totalToday={1}
        totalAll={1}
        extraColumns={['displayAmount']}
      />,
    );
    expect(markup).toContain('展示金额');
    expect(markup).toContain('¥ 0.45');
  });

  it('未启用额外列时不出现"展示金额"', () => {
    const markup = renderToStaticMarkup(
      <EcpmRecordTable
        rows={sampleRows}
        loading={false}
        totalToday={2}
        totalAll={2}
      />,
    );
    expect(markup).not.toContain('展示金额');
    expect(markup).not.toContain('入账状态');
  });

  it('同时打开 status 和 errorReason 列', () => {
    const enrichedRows: EcpmRecordView[] = [
      {
        ...sampleRows[0],
        status: '已入账',
        errorReason: '',
      },
      {
        ...sampleRows[1],
        status: '失败',
        errorReason: '预算不足',
      },
    ];
    const markup = renderToStaticMarkup(
      <EcpmRecordTable
        rows={enrichedRows}
        loading={false}
        totalToday={2}
        totalAll={2}
        extraColumns={['status', 'errorReason']}
      />,
    );
    expect(markup).toContain('入账状态');
    expect(markup).toContain('异常原因');
    expect(markup).toContain('已入账');
    expect(markup).toContain('预算不足');
  });
});
