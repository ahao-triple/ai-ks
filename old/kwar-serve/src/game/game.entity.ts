import { Ecpm } from 'src/ecpm/ecpm.entity';
import { GameUser } from 'src/game-user/game-user.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('game')
export class Game {
  @PrimaryGeneratedColumn()
  id: string;

  @Column({ unique: true })
  app_id: string;

  @Column({ length: 100 })
  name: string;

  @Column()
  secret: string;

  @Column('json', { nullable: true })
  config: {
    ecpm: number;
    ipu: number;
  };

  @Column('json', {
    nullable: true,
    default: () => `'{"video_max": 888}'`,
  })
  limit: {
    video_max: number;
    video_id: string;
  };

  @OneToMany(() => Ecpm, (ecpm) => ecpm.game)
  ecpm: Ecpm[];

  @OneToMany(() => GameUser, (gameUser) => gameUser.game)
  users: GameUser[];

  @CreateDateColumn({ type: 'timestamptz' }) // 自动设置创建时间
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' }) // 自动更新修改时间
  updatedAt: Date;

  // 是否使用按比例缩放客户金额
  @Column({ nullable: true, default: true })
  is_scale: boolean;

  // 按比例缩放客户金额比例 默认 50%
  @Column({ nullable: true, default: 50 })
  scale: number;

  // 游戏余额 单位 里 1
  @Column({ nullable: true, default: 0 })
  game_balance_li: number;

  @Column({ nullable: true, default: false })
  is_withdraw: boolean;

  // 吞包率
  @Column({ nullable: true, default: 5 })
  packet_loss_rate: number;

  // 是否开启强弹
  @Column({ nullable: true, default: false })
  enforce: boolean;
}
