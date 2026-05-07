import { Ecpm } from 'src/ecpm/ecpm.entity';

// 定义 token 数据结构
export interface TokenRes {
  code: number;
  message: string;
  data: TokenData;
}

export interface TokenData {
  access_token: string;
  access_token_expires_in: number;
  refresh_token: string;
  refresh_token_expires_in: number;
}

export interface TokenReq {
  app_id: string;
  secret: string;
  auth_code: string;
}

export interface IRefreshToken {
  app_id: string;
  secret: string;
  refresh_token: string;
}

export interface IEcpmReq {
  app_id: string;
  data_hour: string;
  open_id: string;
}

export interface IEcpmData {
  empty: boolean;
  total_count: number;
  details: IDetail[];
}

export interface IEcpmRes {
  code: number;
  data: IEcpmData;
  message: string;
  request_id: string;
}

export interface IDetail {
  id: string;
  app_id: string;
  open_id: string;
  cost: number;
  event_time: string;
}

export interface IKwaiLoginData {
  app_id: string;
  app_secret: string;
  js_code: string;
  grant_type: string;
}

export interface ILoginRes {
  open_id: string;
  video_id: string;
  nick_id: string;
}

// ECPM 查询时返回给客户端的数据结构
export interface IEcpmClientRes {
  data: Ecpm[];
  total: number;
  totalCost: number;
  totalCostClient: number;
}
