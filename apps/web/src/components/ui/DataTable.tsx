import type { ReactNode } from 'react';

export type DataTableAlign = 'center' | 'left' | 'right';

export type DataTableRenderableKey<T> = {
  [K in Extract<keyof T, string>]-?: T[K] extends ReactNode ? K : never;
}[Extract<keyof T, string>];

export interface DataTableFieldColumn<
  T,
  K extends DataTableRenderableKey<T> = DataTableRenderableKey<T>,
> {
  align?: DataTableAlign;
  key: K;
  label: ReactNode;
  render?: (row: T) => ReactNode;
}

export interface DataTableRenderedColumn<T> {
  align?: DataTableAlign;
  key: string;
  label: ReactNode;
  render: (row: T) => ReactNode;
}

export type DataTableColumn<T> =
  | DataTableFieldColumn<T>
  | DataTableRenderedColumn<T>;

export interface DataTableProps<T> {
  columns: Array<DataTableColumn<T>>;
  emptyLabel?: ReactNode;
  getRowKey?: (row: T, index: number) => string | number;
  rows: T[];
}

export function DataTable<T>({
  columns,
  emptyLabel = 'No data',
  getRowKey,
  rows,
}: DataTableProps<T>) {
  return (
    <table className="ui-data-table">
      <thead>
        <tr>
          {columns.map((column) => (
            <th
              className={column.align ? `ui-data-table-${column.align}` : undefined}
              key={column.key}
              scope="col"
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length > 0 ? (
          rows.map((row, index) => (
            <tr key={getRowKey?.(row, index) ?? index}>
              {columns.map((column) => (
                <td
                  className={
                    column.align ? `ui-data-table-${column.align}` : undefined
                  }
                  key={column.key}
                >
                  {column.render
                    ? column.render(row)
                    : ((row[column.key as keyof T] ?? '-') as ReactNode)}
                </td>
              ))}
            </tr>
          ))
        ) : (
          <tr>
            <td className="ui-data-table-empty" colSpan={columns.length}>
              {emptyLabel}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
