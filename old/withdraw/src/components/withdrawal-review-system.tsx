import React from 'react';
import { Tabs, Tab } from '@heroui/react';
import { PendingReviewList } from './pending-review-list';
import { CompletedList } from './completed-list';
import { RejectedList } from './rejected-list';

export const WithdrawalReviewSystem: React.FC = () => {
  // 状态管理：当前选中的标签
  const [selected, setSelected] = React.useState("pending");

  return (
    <div className="flex flex-col w-full max-w-md mx-auto p-4">
      <h1 className="text-xl font-bold mb-4 text-center">提现审核系统</h1>
      
      <Tabs 
        aria-label="提现审核状态" 
        selectedKey={selected} 
        onSelectionChange={(key: string | number) => setSelected(key.toString())}
        fullWidth
        variant="underlined"
        color="primary"
      >
        <Tab key="pending" title="待审核">
          <PendingReviewList />
        </Tab>
        <Tab key="completed" title="已完成">
          <CompletedList />
        </Tab>
        <Tab key="rejected" title="已拒绝">
          <RejectedList />
        </Tab>
      </Tabs>
    </div>
  );
};