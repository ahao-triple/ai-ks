import React from 'react';
import {
    Table,
    TableHeader,
    TableColumn,
    TableBody,
    TableRow,
    TableCell,
    Tooltip,
    Button,
    addToast,
} from '@heroui/react';
import { Icon } from '@iconify/react';

interface Column {
    key: string;
    label: string;
    width?: string;
    copyable?: boolean;
    render?: (value: any, row: Record<string, any>) => React.ReactNode; // 新增：自定义渲染函数
}

interface FixedHeaderTableProps {
    columns: Column[];
    data?: Record<string, any>[];
    emptyContent?: React.ReactNode;
    className?: string;
}

const FixedHeaderTable: React.FC<FixedHeaderTableProps> = ({
    columns,
    data = [],
    emptyContent = 'No data to display',
    className = '',
}) => {
    // Function to copy cell content to clipboard
    const copyToClipboard = (text: string) => {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard
                .writeText(text)
                .then(() => {
                    addToast({
                        title: '复制成功',
                        color: 'success',
                        classNames: { base: 'auto-width-toast' },
                    });
                })
                .catch(() => {
                    fallbackCopyTextToClipboard(text);
                });
        } else {
            fallbackCopyTextToClipboard(text);
        }
    };

    const fallbackCopyTextToClipboard = (text: string) => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.top = '0';
        textarea.style.left = '0';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        try {
            const successful = document.execCommand('copy');
            if (!successful) {
                console.error('Fallback: Copying text command failed');
            }
            addToast({
                title: '复制成功',
                color: 'success',
                classNames: { base: 'auto-width-toast' },
            });
        } catch (err) {
            console.error('Fallback: Oops, unable to copy', err);
        }

        document.body.removeChild(textarea);
    };

    return (
        <div className={`fixed-header-table ${className}`}>
            <Table removeWrapper aria-label="Table with fixed header">
                <TableHeader>
                    {columns.map((column) => (
                        <TableColumn
                            key={column.key}
                            style={{ width: column.width || 'auto' }}
                        >
                            <div className="flex items-center gap-1">
                                {column.label}
                                {column.copyable && (
                                    <Tooltip
                                        content="This column is copyable"
                                        placement="top"
                                    >
                                        <span className="text-tiny text-default-400">
                                            <Icon
                                                icon="lucide:clipboard"
                                                className="h-3 w-3"
                                            />
                                        </span>
                                    </Tooltip>
                                )}
                            </div>
                        </TableColumn>
                    ))}
                </TableHeader>
                <TableBody
                    items={data.length > 0 ? data : []}
                    emptyContent={data.length === 0 ? emptyContent : null}
                >
                    {(item) => (
                        <TableRow key={item.id || Math.random().toString()}>
                            {columns.map((column) => {
                                const value = item[column.key];
                                return (
                                    <TableCell key={column.key}>
                                        {(() => {
                                            if (column.render) {
                                                return column.render(
                                                    value,
                                                    item,
                                                );
                                            }

                                            if (column.copyable) {
                                                return (
                                                    <div className="flex items-center gap-2">
                                                        <span>
                                                            {String(value)}
                                                        </span>
                                                        <Tooltip content="复制到剪切板">
                                                            <Button
                                                                isIconOnly
                                                                size="sm"
                                                                variant="light"
                                                                onPress={() =>
                                                                    copyToClipboard(
                                                                        String(
                                                                            value,
                                                                        ),
                                                                    )
                                                                }
                                                                className="opacity-70 hover:opacity-100"
                                                            >
                                                                <Icon
                                                                    icon="lucide:copy"
                                                                    className="h-3 w-3"
                                                                />
                                                            </Button>
                                                        </Tooltip>
                                                    </div>
                                                );
                                            }

                                            return String(value);
                                        })()}
                                    </TableCell>
                                );
                            })}
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
};

export default FixedHeaderTable;
