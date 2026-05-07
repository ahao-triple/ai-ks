import React from "react";
import {
  Card,
  CardBody,
  Button,
  Spinner,
  Alert,
  addToast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  fetchWithdrawals,
  rejectWithdrawal,
  approveMultipleWithdrawals,
} from "../api/withdrawal-api";
import { Withdrawal } from "../types/withdrawal";
import { WithdrawalCard } from "./withdrawal-card";
import { WithdrawalDetailsModal } from "./withdrawal-details-modal";
import { RejectionReasonModal } from "./rejection-reason-modal";

export const PendingReviewList: React.FC = () => {
  // 状态管理
  const [withdrawals, setWithdrawals] = React.useState<Withdrawal[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedWithdrawal, setSelectedWithdrawal] =
    React.useState<Withdrawal | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState<boolean>(false);
  
  // 拒绝原因模态框状态
  const [isRejectionModalOpen, setIsRejectionModalOpen] = React.useState<boolean>(false);
  const [rejectionWithdrawalId, setRejectionWithdrawalId] = React.useState<number | null>(null);

  // 按钮加载状态
  const [loadingStates, setLoadingStates] = React.useState<{
    [key: number]: {
      approve: boolean;
      reject: boolean;
    };
  }>({});

  // 处理状态 - 记录已处理但未从列表中移除的项
  const [processedItems, setProcessedItems] = React.useState<{
    [key: number]: {
      status: "approved" | "rejected";
      timestamp: number;
    };
  }>({});

  const [batchLoading, setBatchLoading] = React.useState<{
    all: boolean;
    ten: boolean;
    refresh: boolean;
  }>({
    all: false,
    ten: false,
    refresh: false,
  });

  // 获取待审核提现列表
  const loadWithdrawals = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchWithdrawals(0); // 0 表示待审核状态
      setWithdrawals(data);
      // 重置处理状态
      setProcessedItems({});
      setError(null);
    } catch (err) {
      setError("获取提现列表失败，请稍后重试");
      console.error("获取提现列表失败:", err);
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

  // 刷新列表
  const handleRefresh = async () => {
    setBatchLoading((prev) => ({ ...prev, refresh: true }));
    try {
      await loadWithdrawals();
      addToast({ title: "刷新成功", color: "success" });
    } catch (err) {
      addToast({ title: "刷新失败", color: "danger" });
    } finally {
      setBatchLoading((prev) => ({ ...prev, refresh: false }));
    }
  };

  // 批量通过处理函数
  const handleApproveAll = async () => {
    if (withdrawals.length === 0) return;

    // 设置所有记录的通过按钮为加载状态
    const newLoadingStates = { ...loadingStates };
    withdrawals.forEach((withdrawal) => {
      // 只设置未处理项的加载状态
      if (!processedItems[withdrawal.id]) {
        newLoadingStates[withdrawal.id] = {
          ...newLoadingStates[withdrawal.id],
          approve: true,
          reject: false,
        };
      }
    });
    setLoadingStates(newLoadingStates);

    // 设置批量按钮加载状态
    setBatchLoading((prev) => ({ ...prev, all: true }));

    try {
      // 获取所有未处理的ID
      const unprocessedWithdrawals = withdrawals.filter(
        (w) => !processedItems[w.id]
      );
      const ids = unprocessedWithdrawals.map((w) => w.id);

      if (ids.length > 0) {
        // 调用批量通过API
        console.log("待处理的提现申请ID:", withdrawals);
        await approveMultipleWithdrawals(ids);

        // 更新处理状态
        const newProcessedItems = { ...processedItems };
        unprocessedWithdrawals.forEach((withdrawal) => {
          newProcessedItems[withdrawal.id] = {
            status: "approved",
            timestamp: Date.now(),
          };
        });
        setProcessedItems(newProcessedItems);

        addToast({
          title: `已批量通过全部${ids.length}条提现申请`,
          color: "success",
        });
      } else {
        addToast({ title: `没有可以处理的提现申请`, color: "warning" });
      }
    } catch (err) {
      addToast({
        title: `批量提现申请处理失败，请到拒接列表查看`,
        color: "danger",
      });
      console.error("批量通过失败:", err);
    } finally {
      // 清除所有加载状态
      const resetLoadingStates = { ...loadingStates };
      withdrawals.forEach((withdrawal) => {
        if (resetLoadingStates[withdrawal.id]) {
          resetLoadingStates[withdrawal.id].approve = false;
          resetLoadingStates[withdrawal.id].reject = false;
        }
      });
      setLoadingStates(resetLoadingStates);
      setBatchLoading((prev) => ({ ...prev, all: false }));
    }
  };

  // 批量通过10条处理函数
  const handleApproveTen = async () => {
    if (withdrawals.length === 0) return;

    // 获取未处理的项
    const unprocessedWithdrawals = withdrawals.filter(
      (w) => !processedItems[w.id]
    );
    const count = Math.min(10, unprocessedWithdrawals.length);
    const batchItems = unprocessedWithdrawals.slice(0, count);

    if (batchItems.length === 0) {
      addToast({ title: `没有可处理的提现申请`, color: "warning" });
      return;
    }

    // 设置这些记录的通过按钮为加载状态
    const newLoadingStates = { ...loadingStates };
    batchItems.forEach((withdrawal) => {
      newLoadingStates[withdrawal.id] = {
        ...newLoadingStates[withdrawal.id],
        approve: true,
        reject: false,
      };
    });
    setLoadingStates(newLoadingStates);

    // 设置批量按钮加载状态
    setBatchLoading((prev) => ({ ...prev, ten: true }));

    try {
      const ids = batchItems.map((w) => w.id);
      // 调用批量通过API
      await approveMultipleWithdrawals(ids);

      // 更新处理状态
      const newProcessedItems = { ...processedItems };
      batchItems.forEach((withdrawal) => {
        newProcessedItems[withdrawal.id] = {
          status: "approved",
          timestamp: Date.now(),
        };
      });
      setProcessedItems(newProcessedItems);

      addToast({
        title: `已批量通过 ${count} 条提现申请`,
        color: "success",
      });
    } catch (err) {
      addToast({
        title: `批量通过失败，请到拒接列表查看`,
        color: "danger",
      });
      console.error("批量通过失败:", err);
    } finally {
      // 清除加载状态
      const resetLoadingStates = { ...loadingStates };
      batchItems.forEach((withdrawal) => {
        if (resetLoadingStates[withdrawal.id]) {
          resetLoadingStates[withdrawal.id].approve = false;
          resetLoadingStates[withdrawal.id].reject = false;
        }
      });
      setLoadingStates(resetLoadingStates);
      setBatchLoading((prev) => ({ ...prev, ten: false }));
    }
  };

  // 单条审核处理函数
  const handleApprove = async (id: number) => {
    // 设置加载状态
    setLoadingStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], approve: true },
    }));

    try {
      // 调用审核通过API
      await approveMultipleWithdrawals([id]);
      addToast({
        title: `已通过ID为 ${id} 的提现申请,请到已完成列表查看`,
        color: "success",
      });
    } catch (err) {
      addToast({
        title: `ID为 ${id} 的提现申请已被拒绝,请到拒绝列表查看详细原因`,
        color: "danger",
      })
      console.error("审核失败:", err);
    } finally {
      // 清除加载状态
      setLoadingStates((prev) => ({
        ...prev,
        [id]: { ...prev[id], approve: false },
      }));
    }
  };

  // 打开拒绝原因模态框
  const handleReject = (id: number) => {
    // 如果已处理，则不再处理
    if (processedItems[id]) return;
    
    // 设置当前处理的提现ID并打开模态框
    setRejectionWithdrawalId(id);
    setIsRejectionModalOpen(true);
  };
  
  // 确认拒绝处理函数
  const handleConfirmReject = async (reason: string) => {
    if (!rejectionWithdrawalId) return;
    
    const id = rejectionWithdrawalId;
    
    // 设置加载状态
    setLoadingStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], reject: true },
    }));

    try {
      // 调用拒绝API，传入拒绝原因
      await rejectWithdrawal(id, reason);

      // 更新处理状态
      setProcessedItems((prev) => ({
        ...prev,
        [id]: {
          status: "rejected",
          timestamp: Date.now(),
        },
      }));

      addToast({
        title: `已拒绝ID为 ${id} 的提现申请`,
        color: "danger",
      })
    } catch (err) {
      addToast({
        title: `拒绝失败，请联系管理员处理`,
        color: "danger",
      })
      console.error("拒绝失败:", err);
    } finally {
      // 清除加载状态
      setLoadingStates((prev) => ({
        ...prev,
        [id]: { ...prev[id], reject: false },
      }));
      
      // 重置拒绝ID
      setRejectionWithdrawalId(null);
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
          <p>暂无待审核的提现申请</p>
          <Button
            color="primary"
            variant="flat"
            className="mt-4"
            onPress={handleRefresh}
            isLoading={batchLoading.refresh}
            startContent={
              !batchLoading.refresh && <Icon icon="lucide:refresh-cw" />
            }
          >
            刷新列表
          </Button>
        </CardBody>
      </Card>
    );
  }

  // 计算未处理项数量
  const unprocessedCount = withdrawals.filter(
    (w) => !processedItems[w.id]
  ).length;

  return (
    <div className="mt-4 space-y-4">
      {/* 批量操作按钮 */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Button
          color="success"
          onPress={handleApproveAll}
          size="sm"
          isLoading={batchLoading.all}
          startContent={
            !batchLoading.all && <Icon icon="lucide:check-circle" />
          }
          isDisabled={unprocessedCount === 0}
        >
          一键通过全部
        </Button>
        <Button
          color="primary"
          onPress={handleApproveTen}
          size="sm"
          isLoading={batchLoading.ten}
          startContent={!batchLoading.ten && <Icon icon="lucide:check" />}
          isDisabled={unprocessedCount === 0}
        >
          一键通过10条
        </Button>
        <Button
          color="default"
          variant="flat"
          onPress={handleRefresh}
          size="sm"
          isLoading={batchLoading.refresh}
          startContent={
            !batchLoading.refresh && <Icon icon="lucide:refresh-cw" />
          }
        >
          刷新列表
        </Button>
      </div>

      {/* 处理状态提示 */}
      {Object.keys(processedItems).length > 0 && (
        <Alert
          color="primary"
          title="提示"
          description={`已处理 ${
            Object.keys(processedItems).length
          } 条记录，点击"刷新列表"更新数据`}
          icon={<Icon icon="lucide:info" />}
        />
      )}

      {/* 提现列表 */}
      <div className="space-y-4">
        {withdrawals.map((withdrawal) => (
          <WithdrawalCard
            key={withdrawal.id}
            withdrawal={withdrawal}
            onViewDetails={handleViewDetails}
            onApprove={handleApprove}
            onReject={handleReject}
            showActions={true}
            loadingState={
              loadingStates[withdrawal.id] || { approve: false, reject: false }
            }
            processedStatus={processedItems[withdrawal.id]?.status}
          />
        ))}
      </div>

      {/* 详情模态框 */}
      <WithdrawalDetailsModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        withdrawal={selectedWithdrawal}
      />
      
      {/* 拒绝原因模态框 */}
      <RejectionReasonModal
        isOpen={isRejectionModalOpen}
        onOpenChange={setIsRejectionModalOpen}
        onConfirm={handleConfirmReject}
        isLoading={rejectionWithdrawalId ? loadingStates[rejectionWithdrawalId]?.reject : false}
      />
    </div>
  );
};
