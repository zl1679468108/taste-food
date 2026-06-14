import { Controller, Post, Body } from '@nestjs/common';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';
import { AuthService } from './auth.service';
import { WechatLoginDto, LoginResponseDto } from './dto/auth.dto';

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
}
