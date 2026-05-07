import {
    addToast,
    Button,
    Card,
    CardBody,
    CardHeader,
    Input,
} from '@heroui/react';
import { Icon } from '@iconify/react/dist/iconify.js';
import { useState } from 'react';
import FixedHeaderTable from '../../components/fixed-header-table';
import { ServerDateRangePicker } from '../../components/range-picker';
import { getActingDetail } from '../../api/acting-api';
import { formatCurrency } from '../../components/utils';

interface IData {
    total_people: string;
    total_cost: string;
    scale: string;
    users: any[];
}

const columns = [
    {
        key: 'nickname',
        label: '用户账号',
    },
    {
        key: 'balance_li',
        label: '用户收益',
        render: (value: string) => <div>{formatCurrency(Number(value))}</div>,
    },
];

const ActingEcpmPage = () => {
    const [actingId, setActingId] = useState<string>('');
    const [start, setStart] = useState<string | null>(null);
    const [end, setEnd] = useState<string | null>(null);
    const [data, setData] = useState<IData | null>(null);

    // useEffect(() => {
    //   const fetchData = async () => {
    //   };
    // });
    // setData({
    //   total_people: '',
    //   total_cost: '',
    //   scale: '',
    //   users: [],
    // });

    const handleQuery = async () => {
        if (!actingId) {
            addToast({
                title: '代理ID不能为空',
                description: '请输入代理ID',
                color: 'warning',
            });
            return;
        }
        if (!start || !end) {
            addToast({
                title: '时间不能为空',
                description: '请选择时间',
                color: 'warning',
            });
            return;
        }
        const result = await getActingDetail(actingId, start, end);

        if (Array.isArray(result?.users) && result.users.length > 0) {
            const sortedUsers = [...result.users].sort(
                (a: any, b: any) =>
                    (Number(b.balance_li) || 0) - (Number(a.balance_li) || 0),
            );

            setData({ ...result, users: sortedUsers });
        } else {
            // 没有用户数据也可以安全设置空数组
            setData({ ...result, users: [] });
            addToast({
                title: '查询失败',
                description: '查询失败',
                color: 'warning',
            });
        }
    };

    const handleDateRangeChange = (
        start: string | null,
        end: string | null,
    ) => {
        if (start === null || end === null) {
            setStart(null);
            setEnd(null);
            return;
        } else {
            setStart(start);
            setEnd(end);
        }
    };
    return (
        <div className="flex flex-col gap-4">
            <Card className="shadow-md rounded-lg">
                <CardHeader>
                    <h2 className="text-xl font-bold">代理数据查询</h2>
                </CardHeader>

                <CardBody className="p-4">
                    <div className="mb-4">
                        <ServerDateRangePicker
                            onChange={handleDateRangeChange}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 justify-items-center items-center">
                        <Input
                            label="代理ID"
                            value={actingId}
                            onValueChange={setActingId}
                            isClearable
                            placeholder="请输入代理ID"
                        />
                        <Button
                            color="primary"
                            onPress={handleQuery}
                            startContent={<Icon icon="lucide:search" />}
                        >
                            查询
                        </Button>
                    </div>
                    <div className="p-4 rounded-lg shadow-md">
                        {/* 数据展示区域 */}
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-base font-medium p-4">
                            <div>总人数：{data?.total_people ?? 0}</div>
                            <div>
                                总收益：
                                {formatCurrency(Number(data?.total_cost ?? 0))}
                            </div>
                            <div>当前分成比例：{data?.scale ?? '-'} %</div>
                        </div>
                    </div>

                    <p className="p-4 text-lg">以下是代理用户的信息</p>

                    <div className="p-4">
                        <FixedHeaderTable
                            data={data?.users ?? []}
                            columns={columns}
                        />
                    </div>
                </CardBody>
            </Card>
        </div>
    );
};

export default ActingEcpmPage;
