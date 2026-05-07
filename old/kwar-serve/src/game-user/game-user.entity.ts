import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Ecpm } from '../ecpm/ecpm.entity';
import { Game } from 'src/game/game.entity';

@Entity('game_user')
export class GameUser {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, nullable: false })
  nick_id: string;

  @Column({ unique: true, nullable: false })
  open_id: string;

  @Column({ nullable: false })
  app_id: string;

  @Column({ nullable: true })
  code: string;

  @Column({ nullable: true })
  ip: string;

  @Column({ type: 'int', default: '0' })
  video_times: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  last_open_time: Date;

  @Column({ type: 'json', nullable: true })
  systemData: {
    env: string;
    brand: string;
    model: string;
  };

  @OneToMany(() => Ecpm, (ecpm) => ecpm.gameUser)
  ecpm: Ecpm[];

  @ManyToOne(() => Game, (game) => game.users)
  game: Game;

  // 如果需要双向关系，可以在 Game 实体中添加：
  @OneToMany(() => GameUser, (gameUser) => gameUser.game)
  users: GameUser[];

  @Column({ nullable: true })
  bindingUser: string;

  @CreateDateColumn({ type: 'timestamptz' }) // 自动设置创建时间
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' }) // 自动更新修改时间
  updatedAt: Date;

  /**
   * 是否是黑名单
   */
  @Column({ type: 'boolean', default: false })
  isBlack: boolean;
}
