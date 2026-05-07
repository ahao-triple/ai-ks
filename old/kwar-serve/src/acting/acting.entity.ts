import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('acting')
export class Acting {
  @PrimaryGeneratedColumn()
  id: number;

  // 代理名字
  @Column({ unique: true })
  name: string;

  // 代理邀请码
  @Column({ unique: true })
  acting_id: string;

  // 二级代理绑定的一级代理邀请码
  @Column({ default: '123456' })
  acting_top_id: string;

  // 代理分成比例
  @Column()
  scale: number;

  // 代理抽取分成的方式 0 老板付款 1 客户付款
  @Column({ default: 0 })
  withdraw_type: number;

  // 代理支付宝登录号
  @Column()
  acting_alipay_login: string;

  // 代理支付宝名字
  @Column()
  acting_alipay_name: string;

  /**
   * 代理等级
   * 0 普通代理 - 手续费代理 每一笔打款都需要抽比例，
   * 1 一级代理 - 分成代理()，
   * 2 二级代理 - 分成代理()，
   */
  @Column({ default: 0 })
  acting_level: number;

  @Column({ nullable: true })
  main_acting: boolean;
}
