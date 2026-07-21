import { Controller, Post, Body } from '@nestjs/common';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { WechatLoginDto, LoginResponseDto, RefreshTokenDto } from './dto/auth.dto';

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

  @Post('refresh')
  @Public()
  async refresh(
    @Body() dto: RefreshTokenDto,
  ): Promise<ApiResponse<{ token: string; refreshToken: string }>> {
    const result = await this.authService.refreshAccessToken(dto.refreshToken);
    return success(result, '令牌刷新成功');
  }
}
