// 用户信息接口
export interface User {
  id: number;
  nickname: string;
  password: string;
  game_users: string[];
  identity: string;
  withdraw_info: {
    name: string;
    alipay: string;
    id: string;
  };
  balance: number;
  frozen: number;
  total: number;
  withdraw_total: number;
  withdraw_dt: string;
}

// 提现申请接口
export interface Withdrawal {
  id: number;
  nickname: string;
  amount: number;
  status: number; // 0: 待审核, 1: 已完成, 2: 已拒绝
  created_at: string;
  processed_at?: string;
  remark?: string;
}

export interface Approve{
  id: string;
  amount: number;
  alipay: string;
  name: string;
  id_card: string;
}