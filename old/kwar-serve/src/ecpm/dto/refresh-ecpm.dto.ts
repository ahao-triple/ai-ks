import { IsNotEmpty } from 'class-validator';

// 所有查询都是按时间排序
export class RefreshEcpmDto {
  @IsNotEmpty({ message: 'username 不能为空' }) // 这个是 user 表的 username 可以查到 nick_id[]
  username: string;
}
