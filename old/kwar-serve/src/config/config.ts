/* eslint-disable spellcheck/spell-checker */
import * as dotenv from 'dotenv';

// 加载 .env 文件
dotenv.config();

// 定义配置接口
interface DatabaseConfig {
  type: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

interface EnvConfig {
  secret: string;
  port: number;
  isonline: boolean;
  advertiser_id: string;
  app_id: string;
  name: string;
  database: DatabaseConfig;
  alipay: IAlipayConfig;
}

interface IAlipayConfig {
  app_id: string; // 阿里支付应用ID
  private_key: string; // 应用私钥
  alipay_cert_path: string; // 支付宝公钥证书路径
}

// 默认配置
const defaultConfig: EnvConfig = {
  secret: 'test_secret',
  advertiser_id: '50244846',
  isonline: false,
  port: 9000,
  app_id: '165909357',
  name: '默认公司',
  database: {
    type: 'postgres',
    host: '115.120.233.105',
    port: 5432,
    username: 'admin',
    password: 'Hao758258..',
    database: 'testdb',
  },
  alipay: {
    app_id: '',
    private_key: '',
    alipay_cert_path: '',
  },
};

const alipayConfig: IAlipayConfig = {
  app_id: '',
  private_key: '',
  alipay_cert_path: '',
};

// 最终配置：优先使用 .env 中的值，否则使用默认值
export const envConfig: EnvConfig = {
  secret: process.env.SECRET || defaultConfig.secret,
  advertiser_id: process.env.ADVERTISER_ID || defaultConfig.advertiser_id,
  app_id: process.env.APP_ID || defaultConfig.app_id,
  isonline: process.env.IS_ONLINE === 'true' || defaultConfig.isonline,
  name: process.env.COMPANY_NAME || defaultConfig.name,
  port: process.env.SERVE_PORT
    ? parseInt(process.env.SERVE_PORT)
    : defaultConfig.port,
  database: {
    type: process.env.DB_TYPE || defaultConfig.database.type,
    host: process.env.DB_HOST || defaultConfig.database.host,
    port: process.env.DB_PORT
      ? parseInt(process.env.DB_PORT)
      : defaultConfig.database.port,
    username: process.env.DB_USER || defaultConfig.database.username,
    password: process.env.DB_PASS || defaultConfig.database.password,
    database: process.env.DB_NAME || defaultConfig.database.database,
  },
  alipay: {
    app_id: process.env.ALIPAY_APP_ID || alipayConfig.app_id,
    private_key: process.env.ALIPAY_PRIVATE_KEY || alipayConfig.private_key,
    alipay_cert_path:
      process.env.ALIPAY_CERT_PATH || alipayConfig.alipay_cert_path,
  },
};
