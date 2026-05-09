import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  Alert,
  Button,
  DataTable,
  type DataTableColumn,
  Dialog,
  InputField,
  MetricCard,
  Panel,
  StatusBadge,
} from '.';

interface DataTableTestRow {
  id: string;
  metadata: { source: string };
  name: string;
  score: number | null;
}

describe('UI primitives', () => {
  it('renders a primary Button with its classes and children', () => {
    const markup = renderToStaticMarkup(<Button>登录</Button>);

    expect(markup).toContain('class="ui-button ui-button-primary"');
    expect(markup).toContain('登录');
  });

  it('renders an InputField label and value', () => {
    const markup = renderToStaticMarkup(
      <InputField id="demo-input" label="Name" value="demo" onChange={() => {}} />,
    );

    expect(markup).toContain('Name');
    expect(markup).toContain('value="demo"');
  });

  it('renders a Panel title and description', () => {
    const markup = renderToStaticMarkup(
      <Panel title="Overview" description="Current activity">
        Content
      </Panel>,
    );

    expect(markup).toContain('Overview');
    expect(markup).toContain('Current activity');
  });

  it('renders a Dialog when open is true', () => {
    const markup = renderToStaticMarkup(
      <Dialog
        description="Danger action"
        onClose={() => undefined}
        open
        title="Confirm"
      >
        Body
      </Dialog>,
    );

    expect(markup).toContain('ui-dialog');
    expect(markup).toContain('Confirm');
    expect(markup).toContain('Danger action');
    expect(markup).toContain('Body');
  });

  it('renders a warning StatusBadge with warning class', () => {
    const markup = renderToStaticMarkup(
      <StatusBadge tone="warning">Pending</StatusBadge>,
    );

    expect(markup).toContain('ui-status-badge-warning');
  });

  it('renders an empty state for DataTable without rows', () => {
    const markup = renderToStaticMarkup(
      <DataTable
        columns={[{ key: 'name', label: 'Name' }]}
        emptyLabel="No records"
        rows={[]}
      />,
    );

    expect(markup).toContain('No records');
  });

  it('renders default cells for non-empty DataTable rows', () => {
    const markup = renderToStaticMarkup(
      <DataTable
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'score', label: 'Score' },
        ]}
        rows={[{ id: 'row-1', metadata: { source: 'api' }, name: 'Ada', score: null }]}
      />,
    );

    expect(markup).toContain('Ada');
    expect(markup).toContain('<td>-</td>');
  });

  it('renders custom DataTable cells for object fields and action columns', () => {
    const columns: Array<DataTableColumn<DataTableTestRow>> = [
      {
        key: 'metadata',
        label: 'Source',
        render: (row) => row.metadata.source,
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => <button type="button">Open {row.name}</button>,
      },
    ];

    const markup = renderToStaticMarkup(
      <DataTable
        columns={columns}
        rows={[{ id: 'row-1', metadata: { source: 'api' }, name: 'Ada', score: 7 }]}
      />,
    );

    expect(markup).toContain('api');
    expect(markup).toContain('Open Ada');
  });

  it('uses getRowKey for DataTable row keys', () => {
    const calls: Array<[DataTableTestRow, number]> = [];
    const row = { id: 'row-1', metadata: { source: 'api' }, name: 'Ada', score: 7 };

    renderToStaticMarkup(
      <DataTable
        columns={[{ key: 'name', label: 'Name' }]}
        getRowKey={(currentRow, index) => {
          calls.push([currentRow, index]);
          return currentRow.id;
        }}
        rows={[row]}
      />,
    );

    expect(calls).toEqual([[row, 0]]);
  });

  it('renders a danger Alert with danger class', () => {
    const markup = renderToStaticMarkup(<Alert tone="danger">Failed</Alert>);

    expect(markup).toContain('ui-alert-danger');
  });

  it('renders MetricCard label, value, and detail', () => {
    const markup = renderToStaticMarkup(
      <MetricCard label="Revenue" value="¥ 100" detail="Today" />,
    );

    expect(markup).toContain('Revenue');
    expect(markup).toContain('¥ 100');
    expect(markup).toContain('Today');
  });
});

const validFieldColumns: Array<DataTableColumn<DataTableTestRow>> = [
  { key: 'name', label: 'Name' },
  { key: 'score', label: 'Score' },
];

const validRenderedColumns: Array<DataTableColumn<DataTableTestRow>> = [
  {
    key: 'metadata',
    label: 'Source',
    render: (row) => row.metadata.source,
  },
  {
    key: 'actions',
    label: 'Actions',
    render: (row) => row.id,
  },
];

// @ts-expect-error missing fields must provide a render function
const missingFieldWithoutRender: DataTableColumn<DataTableTestRow> = {
  key: 'missing',
  label: 'Missing',
};

// @ts-expect-error object fields must provide a render function
const objectFieldWithoutRender: DataTableColumn<DataTableTestRow> = {
  key: 'metadata',
  label: 'Metadata',
};

void validFieldColumns;
void validRenderedColumns;
void missingFieldWithoutRender;
void objectFieldWithoutRender;
