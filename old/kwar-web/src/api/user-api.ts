import { request } from '../api/index';

export const getUserList = async (
    page: number = 1,
    pageSize: number = 10,
    queryParams: any,
): Promise<any> => {
    const api = '/user/list';

    // 构建查询字符串
    const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        ...queryParams,
    });

    const response = await request(`${api}?${params.toString()}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    return response.data;
};

export const getUserInfo = async (id: string): Promise<any> => {
    const api = '/user/info';
    const response = await request(`${api}?id=${id}`, {
        method: 'Get',
        headers: {
            'Content-Type': 'application/json',
        },
    });
    return response.data;
};

export const setBlackList = async (
    id: string,
    newIdentity: string,
): Promise<boolean> => {
    const api = '/user/blacklist';
    const response = await request(api, {
        method: 'Post',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            id,
            newIdentity,
            nickname: localStorage.getItem('username'),
        }),
    });
    return response.data;
};

export const updateUserIdentity = async (
    id: string,
    identity: string,
): Promise<boolean> => {
    const api = '/user/identity';
    const response = await request(api, {
        method: 'Post',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            id,
            identity,
            nickname: localStorage.getItem('username'),
        }),
    });
    return response.data;
};

export const bindActing = async (acting_id: string): Promise<boolean> => {
    const api = '/user/bind-acting';
    const response = await request(api, {
        method: 'Post',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            acting_id,
            username: localStorage.getItem('username'),
        }),
    });
    return response.data;
};

export const getActingId = async (): Promise<string> => {
    const api = '/user/acting-id';
    const response = await request(
        `${api}?nickname=${localStorage.getItem('username')}`,
        {
            method: 'Get',
            headers: {
                'Content-Type': 'application/json',
            },
        },
    );
    return response.data;
};
