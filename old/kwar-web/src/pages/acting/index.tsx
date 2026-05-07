import {
    addToast,
    Button,
    Card,
    CardHeader,
    Input,
    InputOtp,
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
    Select,
    SelectItem,
    Tooltip,
} from '@heroui/react';
import FixedHeaderTable from '../../components/fixed-header-table';
import { useEffect, useState } from 'react';
import {
    createActing,
    getActingList,
    update_acting_scale,
} from '../../api/acting-api';
import { Icon } from '@iconify/react/dist/iconify.js';
import { EditIcon } from '../../components/confirm-svg';

const ActingPage: React.FC = () => {
    const columns = [
        // {
        //   key: 'id',
        //   label: 'ID',
        //   render: (value: any) => <div className="flex items-center">{value}</div>,
        //   hideOnMobile: false,
        // },
        {
            key: 'name',
            label: '代理名字',
            hideOnMobile: false,
        },
        // {
        //   key: 'acting_id',
        //   label: '代理邀请码',
        //   hideOnMobile: false,
        //   copyable: true,
        // },
        {
            key: 'scale',
            label: '代理比例',
            hideOnMobile: false,
            render: (value: any) => (
                <div className="flex items-center">{`${value}%`}</div>
            ),
        },
        {
            key: 'withdraw_type',
            label: '代理抽取分成方式',
            hideOnMobile: false,
            render: (value: any) => (
                <div className="flex items-center">
                    {value === 0 ? '老板' : '客户'}
                </div>
            ),
        },
        {
            key: 'acting_alipay_name',
            label: '代理支付宝姓名',
            hideOnMobile: false,
        },
        // {
        //   key: 'acting_alipay_login',
        //   label: '代理支付宝账号',
        //   hideOnMobile: false,
        // },
        // {
        //   key: 'acting_level',
        //   label: '代理等级',
        //   hideOnMobile: false,
        // },
        // {
        //   key: 'acting_top_id',
        //   label: '代理上级',
        //   hideOnMobile: false,
        //   copyable: true,
        // },
        {
            key: 'acting_id',
            label: '代理邀请连接',
            hideOnMobile: false,
            copyable: true,
            render: (value: any) => (
                <div
                    className="text-primary cursor-pointer"
                    onClick={() => {
                        // 复制邀请链接到剪贴板
                        const inviteLink = `${
                            // @ts-ignore
                            import.meta.env.VITE_SERVER_IP
                        }:9100/register?acting_id=${value}`;
                        if (navigator.clipboard && window.isSecureContext) {
                            navigator.clipboard
                                .writeText(inviteLink)
                                .then(() => {
                                    addToast({
                                        title: '复制成功',
                                        color: 'success',
                                        classNames: {
                                            base: 'auto-width-toast',
                                        },
                                    });
                                })
                                .catch(() => {
                                    fallbackCopyTextToClipboard(inviteLink);
                                });
                        } else {
                            fallbackCopyTextToClipboard(inviteLink);
                        }
                    }}
                >
                    {`http://${
                        // @ts-ignore
                        import.meta.env.VITE_SERVER_IP
                    }:9100/register?acting_id=${value}`}
                </div>
            ),
        },
        {
            key: 'id',
            label: '操作',
            render: (value: any) => (
                <div>
                    <Tooltip content="修改用户">
                        <span
                            className="text-lg text-default-400 cursor-pointer active:opacity-50"
                            onClick={() => {
                                setIsEdit(true);
                                setEditDate({ ...editDate, id: Number(value) });
                            }}
                        >
                            <EditIcon />
                        </span>
                    </Tooltip>
                </div>
            ),
        },
    ];
    const withdrawTypeOptions = [
        { label: '老板', value: 0 },
        { label: '客户', value: 1 },
    ];

    const agentLevelOptions = [
        { label: '总代理（手续费）', value: 0 },
        { label: '一级代理（只可以让二级代理绑定）', value: 1 },
        { label: '二级代理（给普通用户绑定的代理）', value: 2 },
    ];

    const [actingList, setActingList] = useState<any>([]); // 代理列表
    const [isOpen, setIsOpen] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [editDate, setEditDate] = useState<{ id: number; scale: number }>({
        id: 0,
        scale: 0,
    });
    const [newActing, setNewActing] = useState<any>({
        name: '',
        scale: 0,
        withdraw_type: 0,
        acting_alipay_name: '',
        acting_alipay_login: '',
        acting_level: 1,
        acting_top_id: 'ahaotriple',
    });

    const fetchData = async () => {
        const actings = await getActingList();
        setActingList(actings);
    };
    useEffect(() => {
        fetchData();
    }, []);

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
        <div className="flex flex-col gap-4">
            {/* 布局 */}
            <Card>
                <CardHeader> 代理管理 </CardHeader>
                <div className="flex justify-between gap-4 mb-4">
                    <Button
                        color="primary"
                        startContent={<Icon icon="lucide:search" />}
                        className="w-[30%] justify-center"
                    >
                        查询
                    </Button>
                    <Button
                        variant="flat"
                        startContent={<Icon icon="lucide:refresh-cw" />}
                        className="w-[30%] justify-center"
                        onPress={fetchData}
                    >
                        刷新
                    </Button>
                    <Button
                        variant="flat"
                        startContent={<Icon icon="lucide:plus-circle" />}
                        className="w-[30%] justify-center"
                        onPress={() => setIsOpen(true)}
                    >
                        新增代理
                    </Button>
                </div>
                <div className="flex flex-col gap-4">
                    <FixedHeaderTable
                        columns={columns}
                        data={actingList}
                        emptyContent="暂无数据"
                    ></FixedHeaderTable>
                </div>
            </Card>
            <Modal isOpen={isEdit} onClose={() => setIsEdit(false)}>
                <ModalContent>
                    {() => (
                        <>
                            <ModalHeader>修改代理比例</ModalHeader>
                            <ModalBody>
                                <div className="text-small text-default-500">
                                    代理分成比例:{' '}
                                    <span className="text-md font-medium">
                                        {editDate.scale}
                                    </span>
                                </div>
                                <InputOtp
                                    length={2}
                                    value={String(editDate.scale)}
                                    onValueChange={(value: any) => {
                                        setEditDate({
                                            ...editDate,
                                            scale: Number(value),
                                        });
                                    }}
                                />
                            </ModalBody>

                            <ModalFooter>
                                <Button
                                    variant="light"
                                    onPress={() => setIsOpen(false)}
                                >
                                    取消
                                </Button>
                                <Button
                                    color="danger"
                                    onPress={async () => {
                                        setIsEdit(false);
                                        const result =
                                            await update_acting_scale(
                                                editDate.id,
                                                editDate.scale,
                                            );
                                        if (result) {
                                            fetchData();
                                            addToast({
                                                title: '修改成功',
                                                classNames: {
                                                    base: 'auto-width-toast',
                                                },
                                                color: 'success',
                                            });
                                        }
                                    }}
                                >
                                    确定修改
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
            <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
                <ModalContent>
                    {() => (
                        <>
                            <ModalHeader>创建一个新代理</ModalHeader>
                            <ModalBody>
                                <div className="flex flex-col gap-4">
                                    <Input
                                        label="代理名字"
                                        placeholder="输入代理名字"
                                        value={newActing.name}
                                        onValueChange={(value: string) =>
                                            setNewActing({
                                                ...newActing,
                                                name: value,
                                            })
                                        }
                                    />
                                    <Select
                                        label="代理抽取分成方式"
                                        placeholder="请选择代理抽取分成方式"
                                        value={newActing.withdraw_type}
                                        onSelectionChange={(keys) =>
                                            setNewActing({
                                                ...newActing,
                                                withdraw_type: keys.currentKey,
                                            })
                                        }
                                    >
                                        {withdrawTypeOptions.map((option) => (
                                            <SelectItem key={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </Select>

                                    <Select
                                        label="代理等级"
                                        placeholder="请选择代理等级"
                                        value={newActing.acting_level}
                                        onSelectionChange={(keys) => {
                                            setNewActing({
                                                ...newActing,
                                                acting_level: keys.currentKey,
                                            });
                                        }}
                                    >
                                        {agentLevelOptions.map((option) => (
                                            <SelectItem key={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </Select>

                                    {/* 如果选择了 2 级代理，显示一级代理邀请码输入框 */}
                                    {newActing.acting_level === '2' && (
                                        <Input
                                            label="一级代理的邀请码"
                                            placeholder="请输入一级代理的邀请码"
                                            value={newActing.acting_top_id}
                                            onValueChange={(value: string) => {
                                                setNewActing({
                                                    ...newActing,
                                                    acting_top_id: value,
                                                });
                                            }}
                                        />
                                    )}

                                    <div className="text-small text-default-500">
                                        代理分成比例:{' '}
                                        <span className="text-md font-medium">
                                            {newActing.scale}
                                        </span>
                                    </div>
                                    <InputOtp
                                        length={2}
                                        value={newActing.scale}
                                        onValueChange={(value: any) => {
                                            setNewActing({
                                                ...newActing,
                                                scale: value,
                                            });
                                        }}
                                    />

                                    <Input
                                        label="代理支付宝姓名"
                                        placeholder="输入代理支付宝姓名"
                                        value={newActing.acting_alipay_name}
                                        onValueChange={(value: string) =>
                                            setNewActing({
                                                ...newActing,
                                                acting_alipay_name: value,
                                            })
                                        }
                                    />
                                    <Input
                                        label="代理支付宝账号"
                                        placeholder="输入代理支付宝账号"
                                        value={newActing.acting_alipay_login}
                                        onValueChange={(value: string) =>
                                            setNewActing({
                                                ...newActing,
                                                acting_alipay_login: value,
                                            })
                                        }
                                    />
                                </div>
                            </ModalBody>

                            <ModalFooter>
                                <Button
                                    variant="light"
                                    onPress={() => setIsOpen(false)}
                                >
                                    取消
                                </Button>
                                <Button
                                    color="danger"
                                    onPress={async () => {
                                        setIsOpen(false);
                                        const isCreate = await createActing({
                                            ...newActing,
                                            scale: Number(newActing.scale),
                                        });
                                        if (isCreate) {
                                            fetchData();
                                            addToast({
                                                title: '创建成功',
                                                classNames: {
                                                    base: 'auto-width-toast',
                                                },
                                                color: 'success',
                                            });
                                        }
                                    }}
                                >
                                    创建(注意不要输入错误信息)
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
};

export default ActingPage;
