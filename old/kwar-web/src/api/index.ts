import { addToast } from '@heroui/toast';
import { IGame } from '../types';

// @ts-ignore
const BASE_URL = `http://${import.meta.env.VITE_SERVER_IP}:`;
const BASE_PORT = 9000;

interface ApiResponse {
    code: number;
    message: string;
    data: any;
}

// 基础请求封装
export async function request(
    api: string,
    options: RequestInit,
): Promise<ApiResponse> {
    const response = await fetch(BASE_URL + BASE_PORT + api, options);
    const data = await response.json();

    if (data.code >= 400) {
        addToast({
            title: data.message,
            color: 'danger',
            classNames: { base: 'auto-width-toast' },
        });
    }
    return data;
}

export const ping = async () => {
    const api = '/user/ping';
    const response = await request(api, {
        method: 'Get',
        headers: {
            'Content-Type': 'application/json',
        },
    });
    if (response.data === 'pong') {
    } else {
        addToast({
            title: '服务器连接失败',
            color: 'danger',
            classNames: { base: 'auto-width-toast' },
        });
    }
};

// 登录请求
export const login = async (
    username: string,
    password: string,
): Promise<any> => {
    const api = '/auth/login';

    return request(api, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            username,
            password,
        }),
    });
};

// 注册请求
export const register = async (
    username: string,
    password: string,
    acting_id: string,
) => {
    const api = '/user/create';

    if (!acting_id) {
        acting_id = '暂无代理';
    }
    return request(api, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            username,
            password,
            acting_id,
        }),
    });
};

export const getGameNames = async (): Promise<
    { app_id: string; name: string }[]
> => {
    const api = '/game/names';

    const data = await request(api, {
        method: 'Get',
        headers: {
            'Content-Type': 'application/json',
        },
    });
    return data.data;
};

export const getBinding = async (): Promise<{ nick_id: string }[]> => {
    const api = '/user/binding';
    const response = await request(
        `${api}?username=${localStorage.getItem('username')}`,
        {
            method: 'Get',
            headers: {
                'Content-Type': 'application/json',
            },
        },
    );
    return response.data.map((n: any) => ({ nick_id: n }));
};

export const putBinding = async (nick_id: string): Promise<boolean> => {
    const api = '/user/binding';
    const response = await request(api, {
        method: 'Put',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            username: localStorage.getItem('username'),
            nick_id,
        }),
    });
    return response.data;
};

export const getEcpm = async (
    start_time: string,
    end_time: string,
    app_id: string,
    nick_id: string,
    page: number,
    page_size: number,
) => {
    const api = '/ecpm';
    if (!app_id) return;
    try {
        const param: IEcpmReq = {
            start_time,
            end_time,
            page,
            page_size,
            nick_id,
            app_id,
            username: localStorage.getItem('username') || '',
        };
        const response = await request(api, {
            method: 'Post',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(param),
        });
        if (response.data.ecpms) {
            return response.data;
        } else {
            return { ecpms: [], total: 0, totalCost: 0, totalCostClient: 0 };
        }
    } catch (e) {
        return { ecpms: [], total: 0, totalCost: 0, totalCostClient: 0 };
    }
};

export const refreshEcpm = async (app_id: string) => {
    const api = '/ecpm/refresh';

    const response = await request(api, {
        method: 'Post',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            app_id,
            username: localStorage.getItem('username'),
        }),
    });
    return response.data;
};

export const getTime = (
    time: string,
): { start_time: string; end_time: string } => {
    const today = new Date();

    // 设置日期时间格式化函数，返回 ISO 格式字符串
    const formatDateTime = (date: Date, isEnd: boolean = false): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        // 如果是结束时间，返回 23:59:59，否则返回 00:00:00
        const timePart = isEnd ? '23:59:59' : '00:00:00';
        return `${year}-${month}-${day} ${timePart}`;
    };

    let startDate = new Date(today);
    const endDate = new Date(today);

    // 默认设置为今天
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    switch (time) {
        case 'today':
            // 今天就是当天开始和结束
            break;
        case 'yesterday':
            // 昨天
            startDate.setDate(today.getDate() - 1);
            endDate.setDate(today.getDate() - 1);
            break;
        case 'three':
            // 最近三天
            startDate.setDate(today.getDate() - 2);
            break;
        case 'last7days':
            // 最近七天
            startDate.setDate(today.getDate() - 6);
            break;
        case 'last30days':
            // 最近三十天
            startDate.setDate(today.getDate() - 29);
            break;
        default:
            // 默认返回今天
            break;
    }

    return {
        start_time: formatDateTime(startDate),
        end_time: formatDateTime(endDate, true),
    };
};

export const grantAdmin = async (client: string) => {
    const api = '/user/grant';
    const response = await request(api, {
        method: 'Post',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: client }),
    });
    return response.data;
};

export const updatePro = async (pro: number) => {
    const api = '/company/pro';
    const response = await request(api, {
        method: 'Put',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pro: pro }),
    });
    return response.data;
};

export const getPro = async () => {
    const api = '/company/pro';
    const response = await request(api, {
        method: 'Get',
        headers: {
            'Content-Type': 'application/json',
        },
    });
    return response.data;
};

export const getGames = async (): Promise<IGame[]> => {
    const api = '/game';
    const response = await request(api, {
        method: 'Get',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    const games: IGame[] = response.data.map((game: any) => {
        return {
            app_id: game.app_id,
            secret: game.secret,
            game_name: game.name,
            game_video_id: game.limit.video_id,
            max_video: game.limit.video_max,
            scale: game.scale,
            is_withdraw: game.is_withdraw,
        };
    });
    return games;
};

export const addGame = async (
    app_id: string,
    secret: string,
    video_id: string,
    name: string,
) => {
    const api = '/game';
    const param = {
        app_id,
        secret,
        limit: { video_id, video_max: 888 },
        config: { ecpm: 60, ipu: 5 },
        name,
        nickname: localStorage.getItem('username'),
    };
    const response = await request(api, {
        method: 'Post',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(param),
    });
    return response.data;
};

export interface IEcpmReq {
    start_time: string;
    end_time: string;
    page: number;
    page_size: number;
    app_id: string;
    username: string;
    nick_id: string;
}

// 提现信息接口
export interface IWithdrawalInfo {
    name: string;
    alipay: string;
    balance: string;
}

// 提现记录接口
export interface IWithdrawalRecord {
    id: string;
    nickname: string;
    amount: number;
    created_at: string;
    remark: string;
    status: 0 | 1 | 2;
}

// 获取用户提现信息
export const getWithdrawalInfo = async (): Promise<any | null> => {
    const api = '/user/withdraw-info';
    const response = await request(
        `${api}?nickname=${localStorage.getItem('username')}`,
        {
            method: 'Get',
            headers: {
                'Content-Type': 'application/json',
            },
        },
    );
    if (response.data.withdraw_info.name === 'default_name') {
        return null;
    }
    return response.data;
};

// 提交用户提现信息
export const submitWithdrawalInfo = async (
    info: IWithdrawalInfo,
): Promise<boolean> => {
    const api = '/user/withdraw-info';
    const response = await request(api, {
        method: 'Post',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            ...info,
            nickname: localStorage.getItem('username'),
        }),
    });
    return response.data;
};

// 提交提现申请
export const submitWithdrawal = async (data: any): Promise<boolean> => {
    const api = '/withdraw';
    const param = {
        nickname: localStorage.getItem('username'),
        amount: data.balance,
        name: data.name,
        alipay: data.alipay,
        id: data.id,
        remark: '没有备注信息',
    };
    const response = await request(api, {
        method: 'Post',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(param),
    });
    return response.data;
};

// 获取提现记录
export const getWithdrawalRecords = async (): Promise<IWithdrawalRecord[]> => {
    const api = '/withdraw';
    const response = await request(
        `${api}?nickname=${localStorage.getItem('username')}`,
        {
            method: 'Get',
            headers: {
                'Content-Type': 'application/json',
            },
        },
    );
    return response.data || [];
};

export const isWithdraw = async (): Promise<boolean> => {
    const api = '/company/is-withdraw';
    const response = await request(api, {
        method: 'Get',
        headers: {
            'Content-Type': 'application/json',
        },
    });
    return response.data;
};

export const updateGameScale = async (
    app_id: string,
    scale: number,
): Promise<boolean> => {
    const api = '/game/scale';
    const response = await request(api, {
        method: 'Put',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            app_id,
            scale,
            nickname: localStorage.getItem('username'),
        }),
    });
    return response.data;
};

export const updateGameIsWithdraw = async (
    app_id: string,
    isWithdraw: boolean,
): Promise<boolean> => {
    const api = '/game/is-withdraw';
    const response = await request(api, {
        method: 'Put',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            app_id,
            isWithdraw,
            nickname: localStorage.getItem('username'),
        }),
    });
    return response.data;
};
