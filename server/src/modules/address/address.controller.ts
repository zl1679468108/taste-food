import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { AddressService, AddressRecord } from './address.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

/**
 * 地址簿：
 * GET    /addresses
 * POST   /addresses
 * PATCH  /addresses/:id
 * DELETE /addresses/:id
 * PATCH  /addresses/:id/default
 * POST   /addresses/:id/set-default  (兼容别名)
 */
@Controller('addresses')
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @Get()
  async list(
    @CurrentUser() user: CurrentUserPayload,
    @Query('shopId') shopId?: string,
  ): Promise<ApiResponse<AddressRecord[]>> {
    const list = await this.addressService.findByUserId(user.userId, shopId);
    return success(list);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateAddressDto,
  ): Promise<ApiResponse<AddressRecord>> {
    const address = await this.addressService.create(user.userId, dto);
    return success(address, '地址已添加');
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
  ): Promise<ApiResponse<AddressRecord>> {
    const address = await this.addressService.update(id, user.userId, dto);
    return success(address, '地址已更新');
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<ApiResponse<null>> {
    await this.addressService.remove(id, user.userId);
    return success(null, '地址已删除');
  }

  @Patch(':id/default')
  async setDefaultPatch(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<ApiResponse<AddressRecord>> {
    const address = await this.addressService.setDefault(id, user.userId);
    return success(address, '已设为默认地址');
  }

  @Post(':id/set-default')
  async setDefaultPost(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<ApiResponse<AddressRecord>> {
    const address = await this.addressService.setDefault(id, user.userId);
    return success(address, '已设为默认地址');
  }
}
