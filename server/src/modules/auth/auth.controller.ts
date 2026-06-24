import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { WechatLoginDto, LoginResponseDto, RefreshTokenDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('wechat-login')
  async wechatLogin(
    @Body() dto: WechatLoginDto,
  ): Promise<ApiResponse<LoginResponseDto>> {
    const result = await this.authService.wechatLogin(dto);
    return success(result, '登录成功');
  }

  @Post('refresh')
  async refresh(
    @Body() dto: RefreshTokenDto,
  ): Promise<ApiResponse<{ token: string; refreshToken: string }>> {
    const result = await this.authService.refreshAccessToken(dto.refreshToken);
    return success(result, '令牌刷新成功');
  }
}
