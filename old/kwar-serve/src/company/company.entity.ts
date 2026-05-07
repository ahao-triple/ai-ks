import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('company')
export class Company {
  @PrimaryGeneratedColumn()
  id: string;

  @Column({ unique: true }) // 这个不是游戏ID 而是磁力开放平台的应用 ID
  app_id: string;

  @Column() // 授权是返回的 auth_code
  auth_code: string;

  @Column({ nullable: true }) // 广告主ID
  advertiser_id: string;

  @Column({ length: 100 }) // 公司名称
  name: string;

  @Column() // 开放平台的 密钥 手动填写
  secret: string;

  @Column({ nullable: true }) // 回调地址，为自动化服务
  callback: string;

  @Column('json', { nullable: true })
  token_data: {
    access_token: string;
    refresh_token_expires_in: number;
    refresh_token: string;
    access_token_expires_in: number;
  };

  @Column('json', {
    default: {
      // 统一缩放比例
      proportion: 40, // 所有数据缩小的比例

      // 设置数值
      middle_cost: 100, // 中位数
      max_cost: 500, // 顶包（一般情况）
      min_cost: 10, // 最小包
      custom_pro: 0.31415, // 小于1000 缩小的比例

      // 概率
      disappear_pro: 8, // 吞包概率（所有情况）
      gre_1000_to_real_pro: 10, // 大于 1000 显示概率
      middle_1000_to_max_pro: 90, // 等于 1000 显示顶包的概率
      equal_1000_to_max_pro: 90, // 真实数据等于 1000 变 顶包 的概率
      les_1000_and_gre_max_to_max_pro: 80, // 小于 1000 大于 顶包 变 顶包 的概率
      middle_max_to_middle_pro: 20, // 顶包 变 中位数的概率
    },
  })
  proportion: {
    proportion: number; // 所有数据缩小的比例

    middle_cost: number; // 中位数
    max_cost: number; // 顶包（一般情况）
    min_cost: number; // 最小包
    custom_pro: number;

    disappear_pro: number; // 吞包概率（所有情况）
    gre_1000_to_real_pro: number;
    middle_1000_to_max_pro: number;
    equal_1000_to_max_pro: number;
    les_1000_and_gre_max_to_max_pro: number;
    middle_max_to_middle_pro: number;
  };

  @Column({ nullable: true, default: true }) // 是否使用模型算法
  isModule: boolean;

  @Column({ nullable: true }) // 账单上一次更新时间
  withdraw_update_dt: string;

  @Column({ nullable: true, default: true }) // 是否开启提现功能
  isWithdraw: boolean;

  @CreateDateColumn({ type: 'timestamptz' }) // 自动设置创建时间
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' }) // 自动更新修改时间
  updatedAt: Date;

  @Column({ default: 0, nullable: true }) // 是否启用代理功能 // 0 未启用 1 启用
  isActing: number;

  @Column({ default: '666666' })
  pay_password: string; // 支付密码

  @Column({ default: 1000 })
  max_cost: number; // 最大金额
}
