import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Check,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('withdraw')
@Check(`"amount" >= 0`) // 约束 amount 不能为负数
export class WithdrawEntity {
  // 提现状态
  static readonly STATUS_EMNU = {
    PENDING: 0, // 提现中
    SUCCESS: 1, // 提现完成
    FAIL: 2, // 提现失败
    REJECT: 3, // 提现拒绝
    REDUNDANCE: 4, // 提现冗余
  };
  // 提现记录ID
  @PrimaryGeneratedColumn()
  id: number;
  // 用户手机号码
  @Column()
  nickname: string;
  // 提现金额
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0.0,
  })
  amount: number;

  @Column({ type: 'bigint', default: 0 })
  amount_li: number;

  // 提现时间
  @Column({ type: 'timestamp' })
  created_at: Date;
  // 提现备注
  @Column({ nullable: true })
  remark: string;

  // 提现状态 0: 提现中 1: 提现完成 2: 提现失败
  @Column({ default: WithdrawEntity.STATUS_EMNU.PENDING })
  status: number;

  // 提现完成时间
  @Column({ type: 'timestamp', nullable: true })
  end_at: Date;

  @CreateDateColumn({ type: 'timestamptz' }) // 自动设置创建时间
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' }) // 自动更新修改时间
  updatedAt: Date;

  @Column({ default: 0 }) // 已打款金额
  pay_amount: number;

  @Column({ default: 0 }) // 手续费是否已经打款 0 未打款 1 已打款
  fee_status: number;

  @Column({ default: 0 }) // 代理费用是否打算款 0 未打款 1 已打款
  acting_status: number;
}
