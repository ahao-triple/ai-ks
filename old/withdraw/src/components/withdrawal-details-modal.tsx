import React, { useEffect } from 'react';
import { 
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalBody, 
  ModalFooter, 
  Button,
  Divider
} from '@heroui/react';
import { User, Withdrawal } from '../types/withdrawal';
import { getUser } from '../api/withdrawal-api';

interface WithdrawalDetailsModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  withdrawal: Withdrawal | null;
}

export const WithdrawalDetailsModal: React.FC<WithdrawalDetailsModalProps> = ({
  isOpen,
  onOpenChange,
  withdrawal
}) => {
  const [userInfo, setUserInfo] = React.useState<User | null>(null);
  useEffect(() => {
    const useUser = async () => {
      if (isOpen && withdrawal?.id && withdrawal.nickname) {
        const user = await getUser(withdrawal.nickname);
        setUserInfo(user);
      }
    }
    useUser();
  },[isOpen]);
  if (!withdrawal) return null;

  // 获取状态对应的文本
  const getStatusText = (status: number) => {
    switch (status) {
      case 0:
        return '待审核';
      case 1:
        return '已完成';
      case 2:
        return '已拒绝';
      default:
        return '未知状态';
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onOpenChange={onOpenChange}
      placement="center"
      scrollBehavior="inside"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              提现申请详情
            </ModalHeader>
            <ModalBody>
              <div className="space-y-4">
                {/* 基本信息 */}
                <div>
                  <h3 className="text-lg font-medium mb-2">基本信息</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-default-600">申请ID:</span>
                      <span>{withdrawal.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-default-600">申请状态:</span>
                      <span>{getStatusText(withdrawal.status)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-default-600">提现金额:</span>
                      <span className="font-bold">¥{withdrawal.amount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-default-600">申请时间:</span>
                      <span>{new Date(withdrawal.created_at).toLocaleString()}</span>
                    </div>
                    {withdrawal.processed_at && (
                      <div className="flex justify-between">
                        <span className="text-default-600">处理时间:</span>
                        <span>{new Date(withdrawal.processed_at).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Divider />

                {/* 用户信息 */}
                <div>
                  <h3 className="text-lg font-medium mb-2">用户信息</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-default-600">用户ID:</span>
                      <span>{withdrawal.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-default-600">手机号:</span>
                      <span>{userInfo?.nickname}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-default-600">用户身份:</span>
                      <span>{userInfo?.identity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-default-600">账户余额:</span>
                      <span>¥{userInfo?.balance}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-default-600">冻结金额:</span>
                      <span>¥{userInfo?.frozen}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-default-600">总金额:</span>
                      <span>¥{userInfo?.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-default-600">已提现总额:</span>
                      <span>¥{userInfo?.withdraw_total}</span>
                    </div>
                  </div>
                </div>

                <Divider />

                {/* 提现账户信息 */}
                <div>
                  <h3 className="text-lg font-medium mb-2">提现账户信息</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-default-600">真实姓名:</span>
                      <span>{userInfo?.withdraw_info.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-default-600">支付宝账号:</span>
                      <span>{userInfo?.withdraw_info.alipay}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-default-600">身份证号:</span>
                      <span>{userInfo?.withdraw_info.id}</span>
                    </div>
                  </div>
                </div>

                {withdrawal.remark && (
                  <>
                    <Divider />
                    <div>
                      <h3 className="text-lg font-medium mb-2">备注</h3>
                      <p>{withdrawal.remark}</p>
                    </div>
                  </>
                )}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button color="primary" onPress={onClose}>
                关闭
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};