import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KuaishouTokenService } from '../../features/kuaishou-admin/kuaishou-token.service';
import { summarizeKuaishouPayload } from './kuaishou-error-message';

type ConfigReader = Pick<ConfigService, 'get'>;

export type KuaishouEcpmRow = {
  platformEventId: string;
  openId: string;
  rawCostLi: bigint;
  eventTime: Date;
};

export type KuaishouEcpmRefreshInput = {
  gameAppId: string;
  // 中国时区下的目标日期，格式 "YYYY-MM-DD"。
  // 快手 ECPM 接口按天查询，单次请求返回该日全天数据（含翻页）。
  dataDay: string;
  openIds: string[];
};

export type KuaishouEcpmRefreshResult = {
  source: 'kuaishou';
  rows: KuaishouEcpmRow[];
  raw?: unknown;
};

const ECPM_PAGE_SIZE = 500;
const ECPM_PAGE_CONTINUE_THRESHOLD = 490;
const ECPM_MAX_PAGES = 50;

@Injectable()
export class KuaishouEcpmClient {
  private readonly logger = new Logger('刷新链路:KuaishouClient');

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigReader,
    private readonly tokenService: KuaishouTokenService,
  ) {}

  async refresh(
    input: KuaishouEcpmRefreshInput,
  ): Promise<KuaishouEcpmRefreshResult> {
    this.assertRealMode();

    const credentials = await this.tokenService.resolveReportCredentials();
    const allRows: KuaishouEcpmRow[] = [];
    let lastPayload: Record<string, unknown> | undefined;

    const dataDay = formatKuaishouDataDay(input.dataDay);

    for (let page = 1; page <= ECPM_MAX_PAGES; page += 1) {
      const requestBody: Record<string, unknown> = {
        advertiser_id: parseAdvertiserId(credentials.advertiserId),
        app_id: input.gameAppId,
        data_hour: dataDay,
        ...(input.openIds && input.openIds.length > 0
          ? { open_id: input.openIds }
          : {}),
        page,
        page_size: ECPM_PAGE_SIZE,
      };

      const tPage = Date.now();
      const response = await fetch(
        'https://ad.e.kuaishou.com/rest/openapi/gw/dsp/v1/report/ecpm_report',
        {
          body: JSON.stringify(requestBody),
          headers: {
            'Access-Token': credentials.accessToken,
            'Content-Type': 'application/json',
          },
          method: 'POST',
        },
      );
      const payload = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        this.logger.error(
          `[快手 API 返非 2xx] dataDay=${dataDay} page=${page} 耗时=${Date.now() - tPage}ms payload=${JSON.stringify(payload).slice(0, 200)}`,
        );
        throw new BadGatewayException(
          `快手 ECPM 刷新失败：${summarizeKuaishouPayload(payload)}`,
        );
      }
      lastPayload = payload;

      const details = extractDetails(payload);
      this.logger.log(
        `[快手 API] dataDay=${dataDay} page=${page} 拿到 ${details.length} 条 耗时=${Date.now() - tPage}ms`,
      );
      allRows.push(...details.flatMap(detailToRow));
      if (details.length < ECPM_PAGE_CONTINUE_THRESHOLD) {
        break;
      }
    }

    return {
      source: 'kuaishou',
      rows: allRows,
      raw: lastPayload,
    };
  }

  private assertRealMode() {
    if (this.configService.get<string>('KUAISHOU_API_MODE') !== 'real') {
      throw new BadRequestException(
        'KUAISHOU_API_MODE 必须配置为 real 后才能刷新快手 ECPM',
      );
    }
  }
}

function extractDetails(payload: Record<string, unknown>): unknown[] {
  const data = asRecord(payload.data);
  return asArray(data?.details) ?? asArray(payload.details) ?? [];
}

function detailToRow(item: unknown): KuaishouEcpmRow[] {
  const row = asRecord(item);
  if (!row) {
    return [];
  }

  const openId = readString(row, 'open_id');
  const platformEventId = readString(row, 'id');
  const rawCostLi = readBigInt(row.cost);
  const eventTime = readDate(row, 'event_time');

  if (!openId || !platformEventId || rawCostLi === undefined || !eventTime) {
    return [];
  }

  return [
    {
      platformEventId,
      openId,
      rawCostLi,
      eventTime,
    },
  ];
}

function asRecord(value: unknown) {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : undefined;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : undefined;
}

function readString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readBigInt(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }

  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return BigInt(value);
  }

  return undefined;
}

function readDate(payload: Record<string, unknown>, key: string) {
  const value = readString(payload, key);
  if (!value) {
    return undefined;
  }

  // 快手 ECPM 接口的 event_time 形如 "2026-05-10 06:21:34"（北京时间，不带时区）。
  // 这里把无时区字符串按 +08:00 解析，避免在 UTC 服务器上被当作 UTC 而漂移 8 小时。
  let normalized: string;
  if (value.includes('T')) {
    normalized = value;
  } else if (/[+-]\d{2}:?\d{2}$|Z$/.test(value)) {
    normalized = value.replace(' ', 'T');
  } else {
    normalized = `${value.replace(' ', 'T')}+08:00`;
  }
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

// 快手 ECPM 接口的 data_hour 字段实际同时接受天级（YYYY-MM-DD，返回该日全天数据）
// 和小时级（YYYY-MM-DD HH:00:00）。我们统一用天级，单次请求拉一整天。
// 该函数接受 "YYYY-MM-DD" 或带时分秒/ISO 的输入，归一化为天级字符串。
function formatKuaishouDataDay(input: string): string {
  if (!input) return input;
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return input;
  }
  // 兼容历史调用方传入的 "YYYY-MM-DDTHH:00:00+08:00" / "YYYY-MM-DD HH:00:00"
  return input.slice(0, 10);
}

// 快手 ECPM 接口要求 advertiser_id 是 number。
// 我们历史上把它当 string 存（甚至存成 "0"），下游传给接口前 normalize。
function parseAdvertiserId(value: string | undefined): number | string | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : value;
}
