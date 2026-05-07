import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  PrimaryColumn,
  BeforeInsert,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { GameUser } from '../game-user/game-user.entity';
import { Game } from '../game/game.entity';
import * as crypto from 'crypto';

@Entity('ecpm')
@Index(['open_id', 'event_time'], { unique: true })
export class Ecpm {
  @PrimaryColumn()
  custom_id: string;

  @Column({ nullable: true, unique: true })
  ecpm_id: string;

  @Column({ name: 'app_id' })
  app_id: string;

  @Column({ type: 'int' })
  cost: number;

  @Column({ type: 'int' }) // 给客户显示的 cost
  cost_client: number;

  @Column({ type: 'timestamp' })
  event_time: Date;

  // 用于保存 open_id，同时作为关联 GameUser 的外键
  @Column({ name: 'open_id' })
  open_id: string;

  // 关联到 GameUser（根据 open_id）
  @ManyToOne(() => GameUser, (gameUser) => gameUser.ecpm, { eager: true })
  @JoinColumn({ name: 'open_id', referencedColumnName: 'open_id' })
  gameUser: GameUser;

  // 关联到 Game（根据 app_id）
  @ManyToOne(() => Game, (game) => game.ecpm, { eager: true })
  @JoinColumn({ name: 'app_id', referencedColumnName: 'app_id' })
  game: Game;

  @Column({ nullable: true, default: 'ahaotriple' })
  nick_id: string;

  // 通过关联 GameUser 获取 ip
  get ip(): string | null {
    if (this.gameUser && typeof this.gameUser.ip === 'string') {
      return this.gameUser.ip;
    }
    return null;
  }

  @BeforeInsert()
  generateId() {
    const str = `${this.open_id}-${this.event_time.toISOString()}-${this.ecpm_id}`;
    this.custom_id = crypto.createHash('md5').update(str).digest('hex');
  }

  @CreateDateColumn({ type: 'timestamptz' }) // 自动设置创建时间
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' }) // 自动更新修改时间
  updatedAt: Date;

  // 是否是被吞包
  @Column({ default: false })
  is_duplicate: boolean;
}
