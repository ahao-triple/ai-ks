import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Check,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('user')
@Check(`"balance" >= 0`)
@Check(`"frozen" >= 0`)
@Check(`"total" >= 0`)
@Check(`"withdraw_total" >= 0`)
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  // 用户手机号码
  @Column({ unique: true })
  nickname: string;

  // 用户密码
  @Column({ unique: true })
  password: string;

  // 绑定的游戏 nick_id 列表
  @Column('text', {
    array: true,
    default: '{}',
    nullable: false,
  })
  game_users: string[] = [];

  // 用户身份
  @Column({ default: 'brush' }) // ahaotriple super admin brush visitors general 管理员，刷手，游客，一般游客
  identity: string;

  // 用户提现信息
  @Column('json', {
    default: {
      name: 'default_name',
      alipay: 'default_alipay',
      id: 'default_id',
    },
  })
  withdraw_info: {
    name: string;
    alipay: string;
    id: string;
  };

  // 用户余额 总金额 - 已提现金额 - 冻结金额
  @Column({
    type: 'decimal',
    precision: 10, // 总位数
    scale: 2, // 小数位数
    default: 0.0,
  })
  balance: number;
  @Column({ type: 'bigint', default: 0 })
  balance_li: number;

  // 用户冻结金额 --- 提现中
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0.0,
  })
  frozen: number;
  @Column({ type: 'bigint', default: 0 })
  frozen_li: number;

  // 用户总金额
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0.0,
  })
  total: number;
  @Column({ type: 'bigint', default: 0 })
  total_li: number;

  // 用户已提现金额
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0.0,
  })
  withdraw_total: number;

  @Column({ type: 'bigint', default: 0 })
  withdraw_li: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  withdraw_dt: Date;

  @CreateDateColumn({ type: 'timestamptz' }) // 自动设置创建时间
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' }) // 自动更新修改时间
  updatedAt: Date;

  @Column({ default: '1232456' })
  acting_id: string;

  @Column({ default: '123456' })
  top_acting_id: string;
}
