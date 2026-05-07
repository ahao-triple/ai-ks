import React from 'react';
import { Card, CardBody, Button, Chip } from '@heroui/react';
import { Icon } from '@iconify/react';
import { Withdrawal } from '../types/withdrawal';
import { rollbackWithdrawal } from '../api/withdrawal-api';

interface WithdrawalCardProps {
  withdrawal: Withdrawal;
  onViewDetails: (withdrawal: Withdrawal) => void;
  onApprove?: (id: number) => void;
  onReject?: (id: number) => void;
  onRollback?: (id: number) => void;
  showActions: boolean;
  loadingState?: {
    approve: boolean;
    reject: boolean;
    rollback?: boolean;
  };
  processedStatus?: 'approved' | 'rejected';
}

export const WithdrawalCard: React.FC<WithdrawalCardProps> = ({
  withdrawal,
  onViewDetails,
  onApprove,
  onReject,
  showActions,
  loadingState = { approve: false, reject: false },
  processedStatus
}) => {
  // 获取状态对应的颜色和文本
  const getStatusInfo = (status: number, processedStatus?: 'approved' | 'rejected') => {
    // 如果有处理状态，优先显示处理状态
    if (processedStatus === 'approved') {
      return { color: 'success' as const, text: '已通过' };
    } else if (processedStatus === 'rejected') {
      return { color: 'danger' as const, text: '已拒绝' };
    }
    
    // 否则显示原始状态
    switch (status) {
      case 0:
        return { color: 'warning' as const, text: '待审核' };
      case 1:
        return { color: 'success' as const, text: '已完成' };
      case 2:
        return { color: 'danger' as const, text: '已拒绝' };
      default:
        return { color: 'default' as const, text: '未知状态' };
    }
  };

  const statusInfo = getStatusInfo(withdrawal.status, processedStatus);
  const isProcessed = !!processedStatus;

  async function onRollback(id: number) {
  const data = await rollbackWithdrawal(id);
    console.log('回退按钮被点击',data);
  }

  return (
    <Card className={`w-full ${isProcessed ? 'opacity-75' : ''}`} shadow="sm">
      <CardBody>
        <div className="flex flex-col gap-2">
          {/* 用户信息和状态 */}
          <div className="flex justify-between items-center">
            <div className="font-medium">
              <span className="text-default-600">用户: </span>
              {withdrawal.nickname}
            </div>
            <Chip color={statusInfo.color} size="sm">{statusInfo.text}</Chip>
          </div>
          
          {/* 提现金额 */}
          <div className="text-lg font-bold">
            ¥{withdrawal.amount}
          </div>
          
          {/* 申请时间 */}
          <div className="text-sm text-default-500">
            申请时间: {new Date(withdrawal.created_at).toLocaleString()}
          </div>
          
          {/* 操作按钮 */}
          <div className="flex flex-wrap gap-2 mt-2">
            <Button 
              size="sm" 
              variant="flat" 
              color="primary"
              onPress={() => onViewDetails(withdrawal)}
              startContent={<Icon icon="lucide:eye" />}
            >
              查看详情
            </Button>
            
            {/* 回退按钮 - 仅在已拒绝状态下显示 */}
            {(processedStatus === 'rejected' || withdrawal.status === 2) && onRollback && (
              <Button 
                size="sm" 
                color="warning" 
                onPress={() => onRollback(withdrawal.id)}
                isLoading={loadingState.rollback}
                startContent={!loadingState.rollback && <Icon icon="lucide:undo-2" />}
              >
                {loadingState.rollback ? "处理中" : "回退"}
              </Button>
            )}
            
            {showActions && (
              <>
                <Button 
                  size="sm" 
                  color="success" 
                  onPress={() => onApprove && onApprove(withdrawal.id)}
                  isLoading={loadingState.approve}
                  startContent={!loadingState.approve && <Icon icon="lucide:check" />}
                  isDisabled={isProcessed || loadingState.reject}
                >
                  {loadingState.approve ? "处理中" : processedStatus === 'approved' ? "已通过" : "通过"}
                </Button>
                <Button 
                  size="sm" 
                  color="danger" 
                  onPress={() => onReject && onReject(withdrawal.id)}
                  isLoading={loadingState.reject}
                  startContent={!loadingState.reject && <Icon icon="lucide:x" />}
                  isDisabled={isProcessed || loadingState.approve}
                >
                  {loadingState.reject ? "处理中" : processedStatus === 'rejected' ? "已拒绝" : "拒绝"}
                </Button>
              </>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
};