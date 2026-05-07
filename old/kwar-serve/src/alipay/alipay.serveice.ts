/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable spellcheck/spell-checker */
import { Injectable, Logger } from '@nestjs/common';
import { AlipaySdk } from 'alipay-sdk';
import * as path from 'path';
import { envConfig } from 'src/config/config';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AlipayService {
  static alipaySDK;
  constructor() {
    AlipayService.alipaySDK = new AlipaySdk({
      appId: envConfig.alipay.app_id,
      privateKey: envConfig.alipay.private_key,
      alipayRootCertPath: path.join(__dirname, '../../cert/alipayRootCert.crt'),
      alipayPublicCertPath: path.join(
        __dirname,
        '../../cert/alipayCertPublicKey_RSA2.crt',
      ),
      appCertPath: path.join(
        __dirname,
        `../../cert/${envConfig.alipay.alipay_cert_path}.crt`,
      ),
    });
  }

  async getDownUrl() {
    const result = await AlipayService.alipaySDK.curl(
      'GET',
      `/v3/alipay/data/dataservice/bill/downloadurl/query?bill_type=trade&bill_date=2025-04-19`,
    );
    return result;
  }

  async testAlipay() {
    const result = await AlipayService.alipaySDK.curl(
      'POST',
      '/v3/alipay/user/deloauth/detail/query',
      {
        body: {
          date: '20230102',
          offset: 20,
          limit: 1,
        },
      },
    );
    return result;
  }

  async getQuota() {
    const result = await AlipayService.alipaySDK.curl(
      'GET',
      '/v3/alipay/fund/quota/query',
      {
        query: {
          product_code: 'TRANS_ACCOUNT_NO_PWD',
          biz_scene: 'DIRECT_TRANSFER',
        },
      },
    );
    return result;
  }

  async approveWithdraw(dto: {
    id: string;
    amount: number;
    alipay: string;
    name: string;
    tips: string;
    scale: number;
  }): Promise<string> {
    try {
      if (Number(dto.amount) < 0.1) {
        return '提现金额不能小于0.1元';
      }

      // 如果金额≤200，直接单次打款
      if (dto.amount <= 200) {
        return await this.processTransfer({ ...dto, id: String(dto.id) });
      }

      // 分批处理大于200的金额
      const maxAmountPerTransfer = 200;
      const orderCount = Math.ceil(dto.amount / maxAmountPerTransfer);

      for (let i = 0; i < orderCount; i++) {
        const currentAmount = Number(
          Math.min(
            maxAmountPerTransfer,
            dto.amount - i * maxAmountPerTransfer,
          ).toFixed(2),
        );
        const result = await this.processTransfer({
          ...dto,
          amount: currentAmount,
          id: uuidv4().slice(0, 4),
        });

        if (result !== 'success') {
          return '多笔转账错误'; // 如果某次失败，直接返回错误
        }
      }

      return 'success';
    } catch (error) {
      Logger.error(error.code);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      return this.handleError(error.code);
    }
  }

  // 提取单次转账逻辑
  async singleTransfer(dto: {
    id: string;
    amount: number;
    alipay: string;
    name: string;
    tips: string;
  }): Promise<string> {
    const result = await AlipayService.alipaySDK.curl(
      'POST',
      '/v3/alipay/fund/trans/uni/transfer',
      {
        body: {
          out_biz_no: dto.id,
          trans_amount: dto.amount,
          product_code: 'TRANS_ACCOUNT_NO_PWD',
          biz_scene: 'DIRECT_TRANSFER',
          order_title: dto.tips,
          payee_info: {
            identity: dto.alipay,
            identity_type: 'ALIPAY_LOGON_ID',
            name: dto.name,
          },
        },
      },
    );
    Logger.log(`支付宝打款成功: ${JSON.stringify(result)}`);
    return 'success';
  }

  // 提取错误处理逻辑
  handleError(code: string): string {
    const errorMap = {
      PAYEE_NOT_EXIST: '收款账户不存在或姓名有误',
      PAYEE_NOT_RELNAME_CERTIFY: '收款方未实名认证',
      SYSTEM_ERROR: '系统繁忙',
      EXCEED_LIMIT_SM_AMOUNT: '单笔额度超限',
      PAYEE_ACCOUNT_NOT_EXSIT: '收款账号不存在',
      PAYEE_ACC_OCUPIED: '收款方登录号有多个支付宝账号，无法确认唯一收款账号',
      PAYEE_CERT_INFO_ERROR: '收款方证件类型或证件号不一致',
      PAYER_NOT_EXIST: '付款方不存在',
      PAYEE_USERINFO_STATUS_ERROR: '收款方未实名认证',
      PAYMENT_FAIL: '付款失败',
      BALANCE_IS_NOT_ENOUGH: '余额不足',
      EXCEED_LIMIT_SM_MIN_AMOUNT: '单笔转账金额小于最小转账金额',
      EXCEED_LIMIT_DM_MAX_AMOUNT: '超出单日转账限额',
    };
    return errorMap[code] || code;
  }
  /**
   * 处理用户转账金额
   * @param dto
   * @returns
   */
  async processTransfer(dto: {
    id: string;
    amount: number;
    alipay: string;
    name: string;
    tips: string;
    scale: number;
  }): Promise<string> {
    const userAmount = parseFloat((dto.amount * dto.scale).toFixed(2));
    return await this.singleTransfer({
      id: dto.id + '-user' + envConfig.name,
      amount: userAmount,
      alipay: dto.alipay,
      name: dto.name,
      tips: dto.tips,
    });
  }
}
