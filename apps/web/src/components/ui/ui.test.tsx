import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  Alert,
  Button,
  DataTable,
  InputField,
  MetricCard,
  Panel,
  StatusBadge,
} from '.';

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
