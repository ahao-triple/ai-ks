import {
    addToast,
    Button,
    Card,
    CardHeader,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownTrigger,
    Pagination,
    Select,
    SelectItem,
    Tooltip,
} from '@heroui/react';
import ConfirmModal from '../../components/confirm-modal';
import { useEffect, useState } from 'react';
import { getUserList, updateUserIdentity } from '../../api/user-api';
import FixedHeaderTable from '../../components/fixed-header-table';
import { Icon } from '@iconify/react/dist/iconify.js';
import { EyeIcon, EditIcon, DeleteIcon } from '../../components/confirm-svg';

interface IUserListReq {
    page: number;
    limit: number;
}

interface IUserParams {
    nickname?: string;
    game_users?: string;
    acting_id?: string;
    withdraw_name?: string;
    withdraw_alipay?: string;
}

const identityMap: Record<string, string> = {
    brush: '普通用户',
    admin: '管理员',
    super: '超级管理员',
    blacklist: '黑名单',
    acting: '代理',
};

const UserPage: React.FC = () => {
    const [isSubmtBlack, setSubmitBlack] = useState(false);
    const [userList, setUserList] = useState([]);
    const [userTotal, setUserTotal] = useState(0);
    const [userListReq, setUserListReq] = useState<IUserListReq>({
        page: 1,
        limit: 10,
    });
    const [userParams, setUserParams] = useState<IUserParams>({
        nickname: '',
        game_users: '',
        acting_id: '',
        withdraw_name: '',
        withdraw_alipay: '',
    });

    const columns = [
        {
            key: 'nickname',
            label: '用户号码',
            hideOnMobile: false,
        },
        {
            key: 'identity',
            label: '用户身份',
            render: (identity: any, row: any) => (
                <Select
                    size="sm"
                    aria-label="选择身份"
                    className="min-w-[120px]"
                    defaultSelectedKeys={[identity]}
                    onChange={async (e) => {
                        const newIdentity = e.target.value;
                        await updateUserIdentity(row.id, newIdentity); // 替换成你实际的更新方法
                        addToast({
                            title: '用户身份更新成功',
                            description:
                                '用户身份已成功更新为 ' +
                                identityMap[newIdentity],
                            color: 'success',
                        });
                    }}
                >
                    {Object.entries(identityMap).map(([key, label]) => (
                        <SelectItem key={key}>{label}</SelectItem>
                    ))}
                </Select>
            ),
            hideOnMobile: false,
        },
        {
            key: 'withdraw_info',
            label: '提现信息',
            render: (value: any) => {
                const isUnbound = value.name === 'default_name';

                if (isUnbound) {
                    return (
                        <div className="min-w-[140px] text-left text-sm text-gray-400 border border-gray-300 rounded-md px-3 py-1.5">
                            未绑定
                        </div>
                    );
                }

                return (
                    <Dropdown>
                        <DropdownTrigger>
                            <Button
                                size="sm"
                                variant="light"
                                className="text-left min-w-[140px] truncate"
                            >
                                {value.name}
                                <Icon
                                    icon="lucide:chevron-down"
                                    className="ml-1 w-4 h-4"
                                />
                            </Button>
                        </DropdownTrigger>
                        <DropdownMenu aria-label="提现信息">
                            <DropdownItem key="alipay">
                                支付宝账号: {value.alipay}
                            </DropdownItem>
                            <DropdownItem key="name">
                                支付宝名字: {value.name || '暂无'}
                            </DropdownItem>
                        </DropdownMenu>
                    </Dropdown>
                );
            },
            hideOnMobile: true,
        },
        {
            key: 'game_users',
            label: '绑定账号',
            render: (value: any) => (
                <Dropdown>
                    <DropdownTrigger>
                        <Button
                            size="sm"
                            variant="light"
                            className="text-left min-w-[140px] truncate"
                        >
                            {value?.length
                                ? `已绑定 ${value.length} 个账号`
                                : '未绑定'}
                            <Icon
                                icon="lucide:chevron-down"
                                className="ml-1 w-4 h-4"
                            />
                        </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="绑定账号列表">
                        {value?.length ? (
                            value.map((id: string, index: number) => (
                                <DropdownItem key={id || index}>
                                    账号 ID: {id}
                                </DropdownItem>
                            ))
                        ) : (
                            <DropdownItem key="none">暂无绑定账号</DropdownItem>
                        )}
                    </DropdownMenu>
                </Dropdown>
            ),
            hideOnMobile: true,
        },
        {
            key: 'acting_id',
            label: '用户代理',
            render: (value: any) => (
                <div className="flex items-center">
                    {value === '123456' ? '暂无代理' : value}
                </div>
            ),
            hideOnMobile: false,
        },
        {
            key: 'id',
            label: '操作',
            render: () => (
                <div className="relative flex items-center gap-2">
                    <Tooltip content="查看详情">
                        <span
                            className="text-lg text-default-400 cursor-pointer active:opacity-50"
                            onClick={async () => {}}
                        >
                            <EyeIcon />
                        </span>
                    </Tooltip>
                    <Tooltip content="修改用户">
                        <span
                            className="text-lg text-default-400 cursor-pointer active:opacity-50"
                            onClick={() => {}}
                        >
                            <EditIcon />
                        </span>
                    </Tooltip>
                    <Tooltip color="danger" content="删除">
                        <span
                            className="text-lg text-danger cursor-pointer active:opacity-50"
                            onClick={() => {
                                setSubmitBlack(true);
                            }}
                        >
                            <DeleteIcon />
                        </span>
                    </Tooltip>
                </div>
            ),
        },
    ];

    /**
     * 数据刷新
     */
    useEffect(() => {
        const fetchData = async () => {
            const users = await getUserList(
                userListReq.page,
                userListReq.limit,
                userParams,
            );
            setUserList(
                users.data.filter(
                    (item: any) => item.identity !== 'ahaotriple',
                ),
            );
            setUserTotal(users.total);
        };
        fetchData();
    }, [userListReq, userParams]);
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2 mb-4">
                <input
                    type="text"
                    placeholder="用户号码"
                    className="input input-sm"
                    value={userParams.nickname || ''}
                    onChange={(e) =>
                        setUserParams({
                            ...userParams,
                            nickname: e.target.value,
                        })
                    }
                />
                <input
                    type="text"
                    placeholder="游戏用户ID"
                    className="input input-sm"
                    value={userParams.game_users || ''}
                    onChange={(e) =>
                        setUserParams({
                            ...userParams,
                            game_users: e.target.value,
                        })
                    }
                />
                <input
                    type="text"
                    placeholder="代理ID"
                    className="input input-sm"
                    value={userParams.acting_id || ''}
                    onChange={(e) =>
                        setUserParams({
                            ...userParams,
                            acting_id: e.target.value,
                        })
                    }
                />
                <input
                    type="text"
                    placeholder="支付宝名字"
                    className="input input-sm"
                    value={userParams.withdraw_name || ''}
                    onChange={(e) =>
                        setUserParams({
                            ...userParams,
                            withdraw_name: e.target.value,
                        })
                    }
                />
                <input
                    type="text"
                    placeholder="支付宝账号"
                    className="input input-sm"
                    value={userParams.withdraw_alipay || ''}
                    onChange={(e) =>
                        setUserParams({
                            ...userParams,
                            withdraw_alipay: e.target.value,
                        })
                    }
                />
                <Button
                    size="sm"
                    onClick={
                        () => setUserListReq({ ...userListReq, page: 1 }) // 触发 useEffect 重新拉取数据
                    }
                >
                    搜索
                </Button>
            </div>

            {/* 布局 */}
            <Card>
                <CardHeader> 用户管理 </CardHeader>
                <div className="mb-4">
                    <FixedHeaderTable
                        columns={columns}
                        data={userList}
                        emptyContent={'暂无数据'}
                    ></FixedHeaderTable>
                </div>
                {/* 分页控件 */}
                {userList.length > 0 && (
                    <div className="mt-4 flex justify-center">
                        <Pagination
                            page={userListReq.page}
                            total={Math.ceil(userTotal / userListReq.limit)}
                            onChange={(page) => {
                                setUserListReq({
                                    ...userListReq,
                                    page,
                                });
                            }}
                        ></Pagination>
                    </div>
                )}
            </Card>
            {/* 弹窗 */}
            <ConfirmModal
                isOpen={isSubmtBlack}
                onClose={function (): void {
                    setSubmitBlack(false);
                }}
                onConfirm={async function (): Promise<void> {
                    setSubmitBlack(false);
                }}
                title={'是否确定将该用户删除？'}
                content={undefined}
                confirmColor="primary"
                confirmText="确定"
            ></ConfirmModal>
        </div>
    );
};

export default UserPage;
