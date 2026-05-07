import React, { useEffect, useState } from 'react';
import {
    Card,
    CardBody,
    CardHeader,
    Button,
    Input,
    InputOtp,
    addToast,
    Tabs,
    Tab,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import FixedHeaderTable from '../../components/fixed-header-table';
import ConfirmModal from '../../components/confirm-modal';
import {
    getBinding,
    putBinding,
    grantAdmin,
    updatePro,
    getPro,
    getWithdrawalInfo,
    submitWithdrawalInfo,
    submitWithdrawal,
    getWithdrawalRecords,
    IWithdrawalInfo,
    IWithdrawalRecord,
    isWithdraw,
} from '../../api';
import * as moment from 'moment-timezone';
import { bindActing, getActingId } from '../../api/user-api';
import { checkActing } from '../../api/acting-api';

interface UserBinding {
    nick_id: string;
}

const bindingColumns = [{ key: 'nick_id', label: 'Nick ID' }];

const withdrawalColumns = [
    { key: 'id', label: '订单ID' },
    { key: 'amount', label: '金额' },
    { key: 'status', label: '状态' },
    { key: 'created_at', label: '申请时间' },
    { key: 'payment_method', label: '支付方式' },
];

const UserBindingPage: React.FC = () => {
    const [bindings, setBindings] = useState<UserBinding[]>([]);
    const [nick_id, setNickId] = useState('');
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
    const [adminAccount, setAdminAccount] = useState('');
    const [isWith, setIsWith] = useState(false);
    // 新增状态：当前比例、模态框显示、输入的新比例
    const [isRatioModalOpen, setIsRatioModalOpen] = useState(false);
    const [newRatio, setNewRatio] = useState('');
    const [circularProgress, setCircularProgress] = useState(0);

    // 提现相关状态
    const [isWithdrawalModalOpen, setIsWithdrawalModalOpen] = useState(false);
    const [isWithdrawalInfoModalOpen, setIsWithdrawalInfoModalOpen] =
        useState(false);
    const [isEditWithdrawalInfoModalOpen, setIsEditWithdrawalInfoModalOpen] =
        useState(false);
    const [withdrawalRecords, setWithdrawalRecords] = useState<
        IWithdrawalRecord[]
    >([]);
    const [withdrawalInfo, setWithdrawalInfo] =
        useState<IWithdrawalInfo | null>(null);
    const [isbingActing, setIsbingActing] = useState(false);
    const [acting_id, setActing_id] = useState('');
    const [isActing, setIsActing] = useState(false);

    // 提现信息表单
    const [withdrawalInfoForm, setWithdrawalInfoForm] =
        useState<IWithdrawalInfo>({
            name: '',
            alipay: '',
            balance: '0.00',
        });

    // 从 localStorage 获取用户身份
    const loginInfo = JSON.parse(localStorage.getItem('login') || '{}');
    const isAdmin =
        loginInfo.identity === 'lion' ||
        loginInfo.identity === 'super' ||
        loginInfo.identity === 'ahaotriple';

    // 处理绑定用户
    const handleBindUsers = () => {
        setIsConfirmModalOpen(true);
    };

    const confirmBinding = async () => {
        const result = await putBinding(nick_id);
        if (result) {
            setNickId('');
            setIsConfirmModalOpen(false);
        }
    };

    // 处理管理员功能
    const handleAdminButton = () => {
        setIsAdminModalOpen(true);
    };

    const confirmAdminGrant = async () => {
        if (adminAccount) {
            await grantAdmin(adminAccount);
            addToast({
                title: '已授予管理员权限',
                color: 'success',
                classNames: { base: 'auto-width-toast' },
            });
            setAdminAccount('');
            setIsAdminModalOpen(false);
        }
    };

    // 处理修改比例
    const handleModifyRatio = () => {
        setIsRatioModalOpen(true);
    };

    const confirmModifyRatio = async () => {
        setNickId('');
        setIsConfirmModalOpen(false);
        const ratioValue = parseInt(newRatio, 10);
        if (ratioValue >= 1 && ratioValue <= 100) {
            // setRatio(ratioValue); // 暂时更新本地状态，后续替换为 API 调用
            await updatePro(ratioValue);
            const newPro = await getPro();
            addToast({
                title: '已修改比例为' + newPro + '%',
                color: 'success',
                classNames: { base: 'auto-width-toast' },
            });
            setCircularProgress(newPro);
            setNewRatio('');
            setIsRatioModalOpen(false);
        } else {
            addToast({
                title: '比例必须在1到100之间',
                color: 'danger',
                classNames: { base: 'auto-width-toast' },
            });
        }
    };

    // 获取绑定数据
    useEffect(() => {
        const fetchData = async () => {
            const users = await getBinding();
            setBindings(users);
            const result = await getActingId();
            if (result) {
                setActing_id(result);
            }
        };
        fetchData();
    }, [isConfirmModalOpen]);

    const setWithdrawFunc = (user: any) => {
        setWithdrawalInfo({
            alipay: user.withdraw_info.alipay,
            balance: user.balance,
            name: user.withdraw_info.name,
        });
    };

    // 获取提现信息和记录
    useEffect(() => {
        const fetchWithdrawalData = async () => {
            const user = await getWithdrawalInfo();
            const acting_result = await checkActing();
            if (acting_result) {
                setIsActing(true);
            } else {
                setIsActing(false);
            }
            const isWith = await isWithdraw();
            if (user) {
                setWithdrawFunc(user);
            }
            if (isWith) {
                setIsWith(true);
            }
            fetchWithdrawalRecords();
        };
        fetchWithdrawalData();
    }, []);

    // 获取默认比例（后续从 API 拿数据）
    useEffect(() => {
        const fetchRatio = async () => {
            const currentRatio = await getPro();
            if (typeof currentRatio === 'number') {
                setCircularProgress(currentRatio);
            }
        };
        fetchRatio();
    }, []);

    // 处理提现按钮点击
    const onWithdrawal = async () => {
        // 先获取用户提现信息
        const user = await getWithdrawalInfo();
        setWithdrawFunc(user); // 暂时更新本地状态，后续替换为 API 调用

        // 如果用户没有提现信息，先让用户填写提现信息
        if (!user) {
            setIsWithdrawalInfoModalOpen(true);
        } else {
            // 如果已有提现信息，直接打开提现金额输入模态框
            setIsWithdrawalModalOpen(true);
        }
    };

    // 处理修改提现信息按钮点击
    const onEditWithdrawalInfo = async () => {
        // 先获取用户提现信息
        const info = await getWithdrawalInfo();
        if (info) {
            // 设置表单初始值为当前提现信息
            setWithdrawalInfoForm({
                name: info.withdraw_info.name,
                alipay: info.withdraw_info.alipay,
                balance: info.balance,
            });
            setIsEditWithdrawalInfoModalOpen(true);
        } else {
            addToast({
                title: '暂无提现信息，请先填写',
                color: 'warning',
                classNames: { base: 'auto-width-toast' },
            });
            setIsWithdrawalInfoModalOpen(true);
        }
    };

    // 处理提现信息表单变更
    const handleWithdrawalInfoChange = (
        field: keyof IWithdrawalInfo,
        value: string,
    ) => {
        setWithdrawalInfoForm((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    // 提交提现信息
    const confirmWithdrawalInfo = async () => {
        // 验证必填字段
        if (!withdrawalInfoForm.name || !withdrawalInfoForm.alipay) {
            addToast({
                title: '请填写完整的提现信息',
                color: 'danger',
                classNames: { base: 'auto-width-toast' },
            });
            return;
        }

        const result = await submitWithdrawalInfo(withdrawalInfoForm);
        if (result) {
            addToast({
                title: '提现信息提交成功',
                color: 'success',
                classNames: { base: 'auto-width-toast' },
            });
            setIsWithdrawalInfoModalOpen(false);
        }
    };

    // 提交提现申请
    const confirmWithdrawal = async () => {
        if (!withdrawalInfo || Number(withdrawalInfo.balance) <= 0) {
            addToast({
                title: '账户余额不足',
                color: 'danger',
                classNames: { base: 'auto-width-toast' },
            });
            return;
        }

        const result = await submitWithdrawal({ ...withdrawalInfo });
        if (result) {
            addToast({
                title: '提现申请提交成功',
                color: 'success',
                classNames: { base: 'auto-width-toast' },
            });
            setIsWithdrawalModalOpen(false);
            // 刷新提现记录
            fetchWithdrawalRecords();
            // 刷新提现信息（余额会变化）
            const user = await getWithdrawalInfo();
            setWithdrawFunc(user);
        }
    };

    // 获取提现记录
    const fetchWithdrawalRecords = async () => {
        const records = await getWithdrawalRecords();
        setWithdrawalRecords(records);
    };

    return (
        <div className="flex flex-col gap-4">
            <Card>
                <CardHeader className="pb-0">
                    <h2 className="text-xl font-bold">用户绑定</h2>
                </CardHeader>
                <CardBody>
                    <div className="flex flex-col gap-4 mb-6">
                        <Input
                            label={`Nick ID`}
                            placeholder="输入游戏上显示的六位ID - Nick ID "
                            className="flex-1"
                            onChange={(e) => setNickId(e.target.value)}
                            value={nick_id}
                        />

                        <Button
                            color="primary"
                            onPress={handleBindUsers}
                            startContent={<Icon icon="lucide:link" />}
                        >
                            绑定游戏账号(NickID)
                        </Button>

                        {isActing && (
                            <>
                                <Input
                                    label={`代理邀请码`}
                                    placeholder="输入代理邀请码"
                                    className="flex-1"
                                    onChange={(e) =>
                                        setActing_id(e.target.value)
                                    }
                                    value={acting_id}
                                />
                                <Button
                                    color="primary"
                                    onPress={() => setIsbingActing(true)}
                                    startContent={<Icon icon="lucide:link" />}
                                >
                                    绑定代理(邀请码)
                                </Button>
                            </>
                        )}

                        {isWith && (
                            <>
                                <Button
                                    color="danger"
                                    onPress={onWithdrawal}
                                    startContent={<Icon icon="lucide:wallet" />}
                                    isDisabled={
                                        !withdrawalInfo ||
                                        Number(withdrawalInfo.balance) <= 1
                                    }
                                >
                                    提现(收益需要高于1元) ---{' '}
                                    {withdrawalInfo
                                        ? withdrawalInfo.balance
                                        : 0}
                                </Button>
                                <Button
                                    color="secondary"
                                    onPress={onEditWithdrawalInfo}
                                    startContent={<Icon icon="lucide:edit" />}
                                >
                                    提现信息
                                </Button>
                            </>
                        )}

                        {/* 管理员功能，只有 "admin" 用户可见 */}
                        {isAdmin && (
                            <>
                                {isAdmin && (
                                    <Button
                                        color="secondary"
                                        onPress={handleAdminButton}
                                        startContent={
                                            <Icon icon="lucide:shield" />
                                        }
                                    >
                                        管理员功能
                                    </Button>
                                )}
                                <Button
                                    color="warning"
                                    onPress={handleModifyRatio}
                                    startContent={
                                        <Icon icon="lucide:settings" />
                                    }
                                >
                                    修改比例
                                </Button>
                            </>
                        )}
                    </div>

                    <Tabs aria-label="用户数据" className="mt-4">
                        <Tab key="bindings" title="已绑定列表">
                            <FixedHeaderTable
                                columns={bindingColumns}
                                data={bindings}
                                emptyContent="暂无绑定 Nick ID"
                            />
                        </Tab>
                        <Tab key="withdrawals" title="提现记录">
                            <FixedHeaderTable
                                columns={withdrawalColumns}
                                data={withdrawalRecords.map((record) => ({
                                    ...record,
                                    status:
                                        record.status === 0
                                            ? '提现中'
                                            : record.status === 1
                                              ? '提现成功'
                                              : '提现失败',
                                    payment_method: '支付宝',
                                    created_at: record.created_at
                                        ? moment
                                              .utc(record.created_at)
                                              .tz('Asia/Shanghai')
                                              .format('YYYY-MM-DD HH:mm:ss')
                                        : '',
                                }))}
                                emptyContent="暂无提现记录"
                            />
                        </Tab>
                    </Tabs>
                </CardBody>
            </Card>

            {/* 绑定确认模态框 */}
            <ConfirmModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={confirmBinding}
                title="这是您的ID吗？ 绑定别人账号终止所有合作！"
                content={
                    <div>
                        <p>请检查您输入的Nick ID 是否是您自己的Nick ID?</p>
                        <p>{nick_id}</p>
                    </div>
                }
                confirmText="提交绑定"
                confirmColor="primary"
            />

            {/* 绑定确认模态框 */}
            <ConfirmModal
                isOpen={isbingActing}
                onClose={() => setIsbingActing(false)}
                onConfirm={async () => {
                    setIsbingActing(false);
                    const result = await bindActing(acting_id);
                    if (result) {
                        addToast({
                            title: '绑定成功',
                            color: 'success',
                            classNames: { base: 'auto-width-toast' },
                        });
                    }
                }}
                title="绑定代理邀请码"
                content={
                    <div>
                        <p>请核对绑定的邀请码</p>
                        <p>{acting_id}</p>
                    </div>
                }
                confirmText="提交绑定"
                confirmColor="primary"
            />

            {/* 管理员相关模态框，只有 "lion" 用户需要 */}
            {isAdmin && (
                <>
                    <ConfirmModal
                        isOpen={isAdminModalOpen}
                        onClose={() => setIsAdminModalOpen(false)}
                        onConfirm={confirmAdminGrant}
                        title="授予管理员权限"
                        content={
                            <div>
                                <p>请输入要授予管理员权限的账号：</p>
                                <Input
                                    placeholder="输入账号"
                                    value={adminAccount}
                                    onChange={(e) =>
                                        setAdminAccount(e.target.value)
                                    }
                                />
                            </div>
                        }
                        confirmText="确认授予"
                        confirmColor="danger"
                    />
                    <ConfirmModal
                        isOpen={isRatioModalOpen}
                        onClose={() => setIsRatioModalOpen(false)}
                        onConfirm={confirmModifyRatio}
                        title={
                            circularProgress !== null
                                ? `当前比例: ${circularProgress}%`
                                : '加载中...'
                        }
                        content={
                            <div>
                                <p>请输入新的比例（1-100）：</p>
                                <InputOtp
                                    length={2}
                                    value={newRatio}
                                    onValueChange={setNewRatio}
                                />
                            </div>
                        }
                        confirmText="确认修改"
                        confirmColor="warning"
                    />
                </>
            )}

            {/* 提现信息填写模态框 */}
            <ConfirmModal
                isOpen={isWithdrawalInfoModalOpen}
                onClose={() => setIsWithdrawalInfoModalOpen(false)}
                onConfirm={confirmWithdrawalInfo}
                title="填写提现信息"
                content={
                    <div className="flex flex-col gap-4">
                        <p>首次提现需要填写提现信息：</p>
                        <Input
                            label="真实姓名"
                            placeholder="请输入真实姓名"
                            value={withdrawalInfoForm.name}
                            onChange={(e) =>
                                handleWithdrawalInfoChange(
                                    'name',
                                    e.target.value,
                                )
                            }
                            isRequired
                        />
                        <Input
                            label="支付宝账号"
                            placeholder="请输入支付宝账号"
                            value={withdrawalInfoForm.alipay || ''}
                            onChange={(e) =>
                                handleWithdrawalInfoChange(
                                    'alipay',
                                    e.target.value,
                                )
                            }
                            isRequired
                        />
                        <p className="text-sm text-primary">提现方式：支付宝</p>
                    </div>
                }
                confirmText="提交信息"
                confirmColor="primary"
            />

            {/* 修改提现信息模态框 */}
            <ConfirmModal
                isOpen={isEditWithdrawalInfoModalOpen}
                onClose={() => setIsEditWithdrawalInfoModalOpen(false)}
                onConfirm={confirmWithdrawalInfo}
                title="提现信息"
                content={
                    <div className="flex flex-col gap-4">
                        <p>修改提现信息：</p>
                        <Input
                            label="真实姓名"
                            placeholder="请输入真实姓名"
                            value={withdrawalInfoForm.name}
                            onChange={(e) =>
                                handleWithdrawalInfoChange(
                                    'name',
                                    e.target.value,
                                )
                            }
                            isRequired
                        />
                        <Input
                            label="支付宝账号登录账号"
                            placeholder="请输入支付宝账号一般是手机号码---不要输入错了不然打款会有问题"
                            value={withdrawalInfoForm.alipay || ''}
                            onChange={(e) =>
                                handleWithdrawalInfoChange(
                                    'alipay',
                                    e.target.value,
                                )
                            }
                            isRequired
                        />
                        <p className="text-sm text-primary">提现方式：支付宝</p>
                    </div>
                }
                confirmText="保存修改"
                confirmColor="primary"
            />

            {/* 提现金额输入模态框 */}
            <ConfirmModal
                isOpen={isWithdrawalModalOpen}
                onClose={() => setIsWithdrawalModalOpen(false)}
                onConfirm={confirmWithdrawal}
                title="申请提现"
                content={
                    <div className="flex flex-col gap-4">
                        {withdrawalInfo && (
                            <>
                                <div className="flex items-center justify-between">
                                    <p className="text-lg font-semibold">
                                        可提现金额：
                                    </p>
                                    <p className="text-xl font-bold text-danger">
                                        ¥{withdrawalInfo.balance}
                                    </p>
                                </div>
                                <div className="mt-2">
                                    <p className="text-sm text-gray-500">
                                        提现信息：
                                    </p>
                                    <p className="text-sm">
                                        真实姓名：{withdrawalInfo.name}
                                    </p>
                                    <p className="text-sm">
                                        支付宝账号：{withdrawalInfo.alipay}
                                    </p>
                                    <p className="text-sm text-primary mt-2">
                                        提现方式：支付宝
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                }
                confirmText="确认提现"
                confirmColor="danger"
            />
        </div>
    );
};

export default UserBindingPage;
