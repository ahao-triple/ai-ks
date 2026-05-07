import { request } from '.';

export const getActingList = async (): Promise<any> => {
    const api = '/acting';
    const response = await request(api, {
        method: 'Get',
        headers: {
            'Content-Type': 'application/json',
        },
    });
    return response.data;
};

export const createActing = async (data: any): Promise<any> => {
    data.nickname = localStorage.getItem('username');
    const api = '/acting';
    const response = await request(api, {
        method: 'Post',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
    return response.data;
};

export const checkActing = async (): Promise<any> => {
    const api = `/company/is-acting`;
    const response = await request(api, {
        method: 'get',
        headers: {
            'Content-Type': 'application/json',
        },
    });
    return response.data;
};

export const update_acting_scale = async (
    id: number,
    scale: number,
): Promise<any> => {
    const api = `/acting/scale?id=${id}&scale=${scale}`;
    const response = await request(api, {
        method: 'put',
        headers: {
            'Content-Type': 'application/json',
        },
    });
    return response.data;
};

export const getActingDetail = async (
    acting_id: string,
    start_time: string,
    end_time: string,
): Promise<any> => {
    const api = `/acting/detail?acting_id=${acting_id}&start_time=${start_time}&end_time=${end_time}`;
    const response = await request(api, {
        method: 'get',
        headers: {
            'Content-Type': 'application/json',
        },
    });
    return response.data;
};
