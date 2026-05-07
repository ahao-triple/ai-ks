import React from 'react';
import { Card, CardBody, Button, Spinner, Alert } from '@heroui/react';
import { Icon } from '@iconify/react';
import { fetchWithdrawals, rollbackWithdrawal } from '../api/withdrawal-api';
import { Withdrawal } from '../types/withdrawal';
import { WithdrawalCard } from './withdrawal-card';
import { WithdrawalDetailsModal } from './withdrawal-details-modal';

export const RejectedList: React.FC = () => {
  // 状态管理
  const [withdrawals, setWithdrawals] = React.useState<Withdrawal[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedWithdrawal, setSelectedWithdrawal] = React.useState<Withdrawal | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState<boolean>(false);
  const [refreshing, setRefreshing] = React.useState<boolean>(false);
  const [rollbackLoading, setRollbackLoading] = React.useState<{[key: number]: boolean}>({});

  // 获取已拒绝提现列表
  const loadWithdrawals = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchWithdrawals(2); // 2 表示已拒绝状态
      setWithdrawals(data);
      setError(null);
    } catch (err) {
      setError('获取提现列表失败，请稍后重试');
      console.error('获取提现列表失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadWithdrawals();
  }, [loadWithdrawals]);

  // 查看详情处理函数
  const handleViewDetails = (withdrawal: Withdrawal) => {
    setSelectedWithdrawal(withdrawal);
    setIsModalOpen(true);
  };

  // 回退处理函数
  const handleRollback = async (id: number) => {
    try {
      setRollbackLoading(prev => ({ ...prev, [id]: true }));
      await rollbackWithdrawal(id);
      // 回退成功后刷新列表
      await loadWithdrawals();
    } catch (err) {
      setError('回退提现申请失败，请稍后重试');
      console.error('回退提现申请失败:', err);
    } finally {
      setRollbackLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  // 刷新列表
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadWithdrawals();
    } finally {
      setRefreshing(false);
    }
  };

  // 加载中状态
  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Spinner color="primary" label="加载中..." />
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="p-4">
        <Alert 
          color="danger"
          title="加载失败"
          description={error}
          icon={<Icon icon="lucide:alert-circle" />}
        />
        <div className="flex justify-center mt-4">
          <Button color="primary" onPress={() => window.location.reload()}>
            重试
          </Button>
        </div>
      </div>
    );
  }

  // 空数据状态
  if (withdrawals.length === 0) {
    return (
      <Card className="mt-4">
        <CardBody className="text-center py-8">
          <p>暂无已拒绝的提现申请</p>
          <Button 
            color="primary" 
            variant="flat" 
            className="mt-4"
            onPress={handleRefresh}
            isLoading={refreshing}
            startContent={!refreshing && <Icon icon="lucide:refresh-cw" />}
          >
            刷新列表
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {/* 刷新按钮 */}
      <div className="flex justify-end">
        <Button 
          color="default" 
          variant="flat" 
          size="sm"
          onPress={handleRefresh}
          isLoading={refreshing}
          startContent={!refreshing && <Icon icon="lucide:refresh-cw" />}
        >
          刷新列表
        </Button>
      </div>

      {/* 提现列表 */}
      <div className="space-y-4">
        {withdrawals.map((withdrawal) => (
          <WithdrawalCard
            key={withdrawal.id}
            withdrawal={withdrawal}
            onViewDetails={handleViewDetails}
            onRollback={handleRollback}
            showActions={false}
            loadingState={{
              approve: false,
              reject: false,
              rollback: rollbackLoading[withdrawal.id] || false
            }}
          />
        ))}
      </div>

      {/* 详情模态框 */}
      <WithdrawalDetailsModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        withdrawal={selectedWithdrawal}
      />
    </div>
  );
};