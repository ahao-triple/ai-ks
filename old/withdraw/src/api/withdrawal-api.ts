import { Approve, User, Withdrawal } from '../types/withdrawal';

// @ts-ignore
const BASE_URL = `http://${import.meta.env.VITE_SERVER_IP}:`;
const BASE_PORT = 9000;

interface ApiResponse {
  code: number;
  message: string;
  data: any;
}

// 基础请求封装
async function request(
  api: string,
  options: RequestInit
): Promise<ApiResponse> {
  const response = await fetch(BASE_URL + BASE_PORT + api, options);
  const data = await response.json();

  if (data.code >= 400) {
  }
  return data;
}

// 获取提现列表
export const fetchWithdrawals = async (status: number): Promise<Withdrawal[]> => {
  const api = '/withdraw/all'
  try {
    const response = await request(`${api}?status=${status}`,{
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    console.log(' 获取提现列表 ',response.data);
    return response.data;
  } catch (error) {
    console.error('获取提现列表失败:', error);
    throw error;
  }
};

export const getUser = async (nickname: string): Promise<User> => {
  const api = '/user';
  try {
    const response = await request(`${api}?nickname=${nickname}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    console.log(' 获取用户信息 ',response.data);
    return response.data;
  }catch (error) {
    console.error('获取用户信息失败:', error);
    throw error;
  }
};

// 审核通过提现申请
export const approveWithdrawal = async (data: Approve): Promise<void> => {
  const api = '/withdraw/approve';
  try {
    const response = await request(api, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return response.data;
  } catch (error) {
    console.error('审核通过提现申请失败:', error);
    throw error;
  }
};

// 拒绝提现申请
export const rejectWithdrawal = async (id: number, reason?: string): Promise<void> => {
  try {
    // 实际API调用
    // await axios.post(`${API_BASE_URL}/withdraw/reject/${id}`, { reason });
    
    // 模拟API调用
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // 模拟成功率90%
        if (Math.random() > 0.1) {
          console.log(`已拒绝ID为${id}的提现申请，原因: ${reason || '无'}`);
          resolve();
        } else {
          reject(new Error('拒绝失败'));
        }
      }, 800);
    });
  } catch (error) {
    console.error('拒绝提现申请失败:', error);
    throw error;
  }
};

// 回退已拒绝的提现申请
export const rollbackWithdrawal = async (id: number): Promise<void> => {
  const api = '/withdraw/rollback';
  try {
    // 实际API调用
    const response = await request(api, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id }),
    });
    console.log(`已回退ID为${id}的提现申请`);
    return response.data;
  } catch (error) {
    console.error('回退提现申请失败:', error);
    throw error;
  }
};


// 批量通过提现申请
export const approveMultipleWithdrawals = async (ids: number[]): Promise<void> => {
  const api = '/withdraw/approve';
  try {
    const response = await request(api, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids }),
    });
    console.log(' 批量通过提现申请 ',response.data);
    return response.data;
  } catch (error) {
    console.error('批量通过提现申请失败:', error);
    throw error;
  }
};