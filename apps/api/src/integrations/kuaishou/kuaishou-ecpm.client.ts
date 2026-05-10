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
        advertiser_id: credentials.advertiserId,
        app_id: input.gameAppId,
        data_hour: input.dataHour,
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

  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
