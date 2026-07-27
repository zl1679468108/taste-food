import { Controller, Post, Body, Get } from '@nestjs/common';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import {
  WechatLoginDto,
  LoginResponseDto,
  RefreshTokenDto,
  RegisterDto,
  PasswordLoginDto,
  SwitchRoleDto,
} from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('wechat-login')
  @Public()
  async wechatLogin(
    @Body() dto: WechatLoginDto,
  ): Promise<ApiResponse<LoginResponseDto>> {
    const result = await this.authService.wechatLogin(dto);
    return success(result, '登录成功');
  }

  @Post('register')
  @Public()
  async register(@Body() dto: RegisterDto): Promise<ApiResponse<LoginResponseDto>> {
    const result = await this.authService.register(dto);
    return success(result, '注册成功');
  }

  @Post('login')
  @Public()
  async login(@Body() dto: PasswordLoginDto): Promise<ApiResponse<LoginResponseDto>> {
    const result = await this.authService.passwordLogin(dto);
    return success(result, '登录成功');
  }

  @Post('refresh')
  @Public()
  async refresh(
    @Body() dto: RefreshTokenDto,
  ): Promise<ApiResponse<{ token: string; refreshToken: string }>> {
    const result = await this.authService.refreshAccessToken(dto.refreshToken);
    return success(result, '令牌刷新成功');
  }

  @Get('me')
  async me(@CurrentUser() user: CurrentUserPayload): Promise<ApiResponse<any>> {
    const profile = await this.authService.getProfile(user.userId);
    return success(profile);
  }

  @Post('switch-role')
  async switchRole(
    @CurrentUser('userId') userId: string,
    @Body() dto: SwitchRoleDto,
  ): Promise<ApiResponse<LoginResponseDto>> {
    const result = await this.authService.switchRole(userId, dto.role, dto.shopId);
    return success(result, '角色已切换');
  }

  /** 开发用：确保测试商家密码可用 */
  @Post('dev/seed-merchant')
  @Public()
  async seedMerchant(): Promise<ApiResponse<any>> {
    const result = await this.authService.ensureDemoMerchant();
    return success(result, '测试商家已就绪');
  }
}
