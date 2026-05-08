import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KuaishouTokenService } from '../../features/kuaishou-admin/kuaishou-token.service';

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
  source: 'mock' | 'kuaishou';
  rows: KuaishouEcpmRow[];
  raw?: unknown;
};

@Injectable()
export class KuaishouEcpmClient {
  constructor(
    @Inject(ConfigService) private readonly configService: ConfigReader,
    private readonly tokenService: KuaishouTokenService,
  ) {}

  async refresh(
    input: KuaishouEcpmRefreshInput,
  ): Promise<KuaishouEcpmRefreshResult> {
    if (this.getMode() !== 'real') {
      return this.createMockRows(input);
    }

    const credentials = await this.tokenService.resolveReportCredentials();

    const response = await fetch(
      'https://ad.e.kuaishou.com/rest/openapi/gw/dsp/v1/report/ecpm_report',
      {
        body: JSON.stringify({
          advertiser_id: credentials.advertiserId,
          app_id: input.gameAppId,
          data_hour: input.dataHour,
          open_id: input.openIds,
          page: 1,
          page_size: 500,
        }),
        headers: {
          'Access-Token': credentials.accessToken,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    );
    const payload = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      throw new Error(`Kuaishou ECPM refresh failed: ${JSON.stringify(payload)}`);
    }

    return {
      source: 'kuaishou',
      rows: extractEcpmRows(payload),
      raw: payload,
    };
  }

  private getMode(): 'mock' | 'real' {
    return this.configService.get<string>('KUAISHOU_API_MODE') === 'real'
      ? 'real'
      : 'mock';
  }

  private createMockRows(
    input: KuaishouEcpmRefreshInput,
  ): KuaishouEcpmRefreshResult {
    const eventTime = parseDataHour(input.dataHour);
    const rows = input.openIds.flatMap((openId, openIndex) =>
      [1800n, 2600n, 4200n].map((rawCostLi, index) => ({
        platformEventId: createMockEventId(input, openId, index),
        openId,
        rawCostLi: rawCostLi + BigInt(openIndex * 300),
        eventTime: new Date(eventTime.getTime() + index * 12 * 60 * 1000),
      })),
    );

    return {
      source: 'mock',
      rows,
      raw: {
        mode: 'mock',
      },
    };
  }
}

function createMockEventId(
  input: KuaishouEcpmRefreshInput,
  openId: string,
  index: number,
) {
  const digest = createHash('sha1')
    .update(`${input.gameAppId}:${input.dataHour}:${openId}:${index}`)
    .digest('hex')
    .slice(0, 16);
  return `mock_ecpm_${digest}`;
}

function parseDataHour(dataHour: string) {
  const normalized =
    dataHour.length === 10 ? `${dataHour}T00:00:00+08:00` : dataHour;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function extractEcpmRows(payload: Record<string, unknown>): KuaishouEcpmRow[] {
  const data = asRecord(payload.data);
  const details = asArray(data?.details) ?? asArray(payload.details) ?? [];

  return details.flatMap((item) => {
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
  });
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
