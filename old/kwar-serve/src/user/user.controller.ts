import { Controller, Post, Body, Put, Get, Query } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { BindingUserDto } from './dto/binding-user.dto';
import { FindBindingDto } from './dto/find-binding.dto';
import { GrantUserDto } from './dto/grant-user.dto';
import { WithdrawInfoDto } from './dto/withdraw-info.dto';
import { IdentityUserDto } from './dto/identity-user.dto';
import { BindingActingDto } from './dto/binding-acting.dts';
import { SelectDto } from './dto/select.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('create')
  async createUser(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get()
  async getUser(@Query('nickname') nickname: string) {
    return await this.userService.getUser(nickname);
  }

  @Put('binding')
  async bindingUser(@Body() bindingUserDto: BindingUserDto) {
    return await this.userService.bindingUser(bindingUserDto);
  }

  @Post('bind-acting')
  async bindActing(@Body() bindActingDto: BindingActingDto) {
    return await this.userService.bindingActing(bindActingDto);
  }

  @Get('acting-id')
  async getActingId(@Query('nickname') nickname: string) {
    return await this.userService.getActingId(nickname);
  }

  @Get('binding')
  async findingBinding(@Query() findBindingDto: FindBindingDto) {
    return await this.userService.findBinding(findBindingDto);
  }

  @Post('grant')
  async grantUser(@Body() grantUserDto: GrantUserDto) {
    return await this.userService.granUser(grantUserDto);
  }

  @Post('withdraw-info')
  async addWithdrawInfo(@Body() addWithdrawDto: WithdrawInfoDto) {
    return await this.userService.addWithdrawInfo(addWithdrawDto);
  }

  @Get('withdraw-info')
  async getWithdrawInfo(@Query('nickname') nickname: string) {
    return await this.userService.getWithdrawInfo(nickname);
  }

  @Get('ping')
  ping() {
    return 'pong';
  }

  @Get('list')
  async selectUsers(@Query() query: SelectDto) {
    return await this.userService.selectUsers(query);
  }

  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: { nickname: string }) {
    return await this.userService.resetPassword(resetPasswordDto.nickname);
  }

  @Get('info')
  async getUserInfo(@Query('id') id: string) {
    return await this.userService.getUserInfo(id);
  }

  @Post('blacklist')
  async addBlacklist(@Query('id') id: string) {
    return await this.userService.addBlacklist(id);
  }

  @Post('identity')
  async updateIdentity(@Body() identityDto: IdentityUserDto) {
    return await this.userService.updateIdentity(identityDto);
  }

  @Get('clear')
  async clear() {
    return await this.userService.clear();
  }
}
