import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
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
  dataHour: string;
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

    for (let page = 1; page <= ECPM_MAX_PAGES; page += 1) {
      const requestBody: Record<string, unknown> = {
        advertiser_id: parseAdvertiserId(credentials.advertiserId),
        app_id: input.gameAppId,
        data_hour: formatKuaishouDataHour(input.dataHour),
        ...(input.openIds && input.openIds.length > 0
          ? { open_id: input.openIds }
          : {}),
        page,
        page_size: ECPM_PAGE_SIZE,
      };

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
        throw new BadGatewayException(
          `快手 ECPM 刷新失败：${summarizeKuaishouPayload(payload)}`,
        );
      }
      lastPayload = payload;

      const details = extractDetails(payload);
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

// 我们内部的 dataHour 形如 "2026-05-08T14:00:00+08:00"（ISO + 时区），
// 但快手 ECPM 接口只接受 "2026-05-08 14:00:00"（空格分隔，无时区）。
function formatKuaishouDataHour(input: string): string {
  if (!input.includes('T')) {
    return input;
  }
  return input.replace('T', ' ').replace(/[+-]\d{2}:?\d{2}$|Z$/, '');
}

// 快手 ECPM 接口要求 advertiser_id 是 number。
// 我们历史上把它当 string 存（甚至存成 "0"），下游传给接口前 normalize。
function parseAdvertiserId(value: string | undefined): number | string | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : value;
}
