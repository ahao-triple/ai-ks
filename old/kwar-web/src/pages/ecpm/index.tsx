import { useEffect, useState } from 'react';
import {
    Card,
    CardBody,
    CardHeader,
    Input,
    Button,
    Select,
    SelectItem,
    Pagination,
    Tooltip, // 新增 Tooltip 组件
} from '@heroui/react';
import { Icon } from '@iconify/react';
import FixedHeaderTable from '../../components/fixed-header-table';
import { getEcpm, getGameNames, refreshEcpm } from '../../api';
import { formatTime, formatCurrency } from '../../components/utils';
import { ServerDateRangePicker } from '../../components/range-picker';

const EcpmPage = () => {
    const defaultNickId = localStorage.getItem('username') || '请登录';
    const [nickId, setNickId] = useState(defaultNickId);
    const [gameStage, setGameStage] = useState('');
    const [data, setData] = useState<any[]>([]); // 指定 data 为 any[] 类型
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [total, setTotal] = useState(0);
    const [totalCost, setTotalCost] = useState(0);
    const [totalCostClient, setTotalCostClient] = useState(0);
    const [gameNames, setGameNames] = useState<any[]>([]); // 指定 gameNames 为 any[] 类型
    const [isLoading, setIsLoading] = useState(false);
    const [start, setStart] = useState<string | null>(null);
    const [end, setEnd] = useState<string | null>(null);

    // 获取用户身份并判断是否为 "brush"
    const loginInfo = JSON.parse(localStorage.getItem('login') || '{}');
    const isBrush =
        loginInfo.identity === 'brush' ||
        loginInfo.identity === 'blacklist' ||
        loginInfo.identity === 'acting';

    // 判断是否为移动端
    const isMobile = window.innerWidth <= 768;

    // 定义表格列，添加隐藏条件
    const columns = [
        {
            key: 'nick_id',
            label: 'Nick ID',
            hideOnMobile: false,
            hideForBrush: false,
        },
        {
            key: 'open_id',
            label: 'Open ID',
            hideOnMobile: true,
            hideForBrush: false,
            copyable: true,
        },
        {
            key: 'cost_client',
            label: '结算金额 (元)',
            hideOnMobile: false,
            hideForBrush: false,
        },
        {
            key: 'event_time',
            label: '时间',
            hideOnMobile: false,
            hideForBrush: false,
        },
        {
            key: 'cost',
            label: '实际金额 (元)',
            hideOnMobile: true,
            hideForBrush: true,
        },
    ];

    // 过滤出可见列
    const visibleColumns = columns.filter((col) => {
        if (isBrush && col.hideForBrush) return false; // "brush" 用户隐藏指定列
        if (isMobile && col.hideOnMobile) return false; // 移动端隐藏指定列
        return true;
    });

    // 定义信息项，根据 isBrush 动态显示
    const stats = [
        { label: '总记录数', value: total },
        {
            label: '总金额 (元)',
            value: formatCurrency(totalCost),
            hideForBrush: true,
        },
        { label: '总结算金额 (元)', value: formatCurrency(totalCostClient) },
    ];

    // 过滤出可见的信息项
    const visibleStats = stats.filter(
        (stat) => !(isBrush && stat.hideForBrush),
    );

    const fetchData = async () => {
        setIsLoading(true);
        setData([]);
        try {
            if (start === null || end === null) {
                return; // 如果 start 或 end 为 null，直接退出
            }
            const result = await getEcpm(
                start,
                end,
                gameStage,
                nickId,
                page,
                pageSize,
            );
            if (!result || !result.ecpms) {
                return; // 如果 result 无效，直接退出
            }
            const filteredData = result.ecpms.filter(
                (item: any) => item.cost_client !== 0,
            );
            const filteredCount = result.ecpms.length - filteredData.length;

            const formattedData = filteredData.map((item: any) => ({
                ...item,
                event_time: formatTime(item.event_time),
                cost_client: formatCurrency(item.cost_client),
                cost: formatCurrency(item.cost),
            }));

            setData(formattedData);
            setTotal(result.total - filteredCount);
            setTotalCost(result.totalCost);
            setTotalCostClient(result.totalCostClient);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const fetchNames = async () => {
            const names: any = await getGameNames();
            setGameStage('');
            setGameNames(names);
        };
        fetchNames();
    }, []);

    useEffect(() => {
        fetchData();
    }, [page, gameStage, start, end]);

    const handleQuery = () => {
        if (isLoading) return;
        setPage(1);
        fetchData();
    };

    const handleRefresh = async () => {
        if (isLoading) return;
        await refreshEcpm(gameStage);
        setPage(1);
        fetchData();
    };

    const handleNickIdChange = (value: string) => {
        // 修改为 string 类型
        if (value === '') {
            if (nickId === defaultNickId) {
                setNickId('');
            } else {
                setNickId(defaultNickId);
            }
        } else {
            setNickId(value);
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
        <div className="flex flex-col gap-4 ">
            <Card className="shadow-md rounded-lg">
                <CardHeader>
                    <h1 className="text-xl font-bold">实时数据</h1>
                </CardHeader>
                <CardBody>
                    {/* 查询条件区域 */}
                    <div className="mb-4">
                        <ServerDateRangePicker
                            onChange={handleDateRangeChange}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 justify-items-center">
                        <Select
                            label="游戏"
                            selectedKeys={[gameStage]}
                            onSelectionChange={(keys) =>
                                setGameStage(keys.currentKey || '')
                            }
                            disabled={isLoading}
                            className="w-full max-w-md"
                        >
                            {gameNames.map((s: any) => (
                                <SelectItem key={s.app_id}>{s.name}</SelectItem>
                            ))}
                        </Select>
                        <div className="flex flex-col md:flex-row gap-2 items-center justify-center w-full max-w-md">
                            <Input
                                label="Nick ID"
                                value={nickId}
                                onValueChange={handleNickIdChange}
                                isClearable
                                disabled={isLoading}
                                className="w-full"
                            />
                            <Tooltip content="请输入您的 Nick ID 以筛选数据">
                                <Icon
                                    icon="lucide:info"
                                    className="text-gray-500"
                                />
                            </Tooltip>
                        </div>
                        <div className="flex flex-col md:flex-row gap-2 items-center justify-center w-full max-w-md">
                            <Button
                                color="primary"
                                onPress={handleQuery}
                                startContent={<Icon icon="lucide:search" />}
                                isLoading={isLoading}
                                className="w-full"
                            >
                                查询
                            </Button>
                            <Button
                                variant="flat"
                                onPress={handleRefresh}
                                startContent={<Icon icon="lucide:refresh-cw" />}
                                disabled={isLoading}
                                className="w-full"
                            >
                                刷新
                            </Button>
                            <Tooltip content="点击刷新数据，获取最新记录">
                                <Icon
                                    icon="lucide:info"
                                    className="text-gray-500"
                                />
                            </Tooltip>
                        </div>
                    </div>

                    {/* 信息项区域：根据 isBrush 动态显示 */}
                    <div className="flex flex-row gap-4 mb-4 flex-wrap">
                        {/* 新增：统计数据提示 */}
                        <p className="text-sm text-gray-500 w-full">
                            以下是您查询的统计数据汇总：
                        </p>
                        {visibleStats.map((stat) => (
                            <Card
                                key={stat.label}
                                className="shadow-sm rounded-md flex-1 min-w-[100px]"
                            >
                                <CardBody className="p-3">
                                    <p className="text-sm">{stat.label}</p>
                                    <p className="text-lg font-semibold">
                                        {stat.value}
                                    </p>
                                </CardBody>
                            </Card>
                        ))}
                    </div>

                    {/* 数据表格 */}
                    <div className="mb-4">
                        {/* 新增：表格提示 */}
                        <p className="text-sm text-gray-500 mb-2">
                            以下是您查询的详细数据记录：
                        </p>
                        <FixedHeaderTable
                            columns={visibleColumns}
                            data={data}
                            emptyContent={
                                isLoading ? '加载中...' : '暂无 ECPM 数据'
                            }
                        />
                    </div>

                    {/* 分页控件 */}
                    {total > 0 && (
                        <div className="mt-4 flex justify-center">
                            <Pagination
                                total={Math.ceil(total / pageSize)}
                                page={page}
                                onChange={setPage}
                                showControls
                                isDisabled={isLoading}
                            />
                        </div>
                    )}
                </CardBody>
            </Card>
        </div>
    );
};

export default EcpmPage;
