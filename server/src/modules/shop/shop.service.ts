import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ShopStatus } from '../../common/constants/enums';
import {
  CreateShopDto,
  ShopResponseDto,
} from './dto/shop.dto';

interface ShopRecord {
  id: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  logoUrl: string;
  status: ShopStatus;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class ShopService {
  // 内存存储模拟数据库
  private shops: Map<string, ShopRecord> = new Map();

  constructor() {
    // 初始化默认店铺
    this.shops.set('00000000-0000-0000-0000-000000000001', {
      id: '00000000-0000-0000-0000-000000000001',
      name: '小买卖烧烤',
      description: '正宗东北烧烤，炭火烤制，香飘十里！',
      address: '北京市朝阳区美食街88号',
      phone: '13800138000',
      logoUrl: 'https://via.placeholder.com/200',
      status: ShopStatus.OPEN,
      createdAt: '2025-06-01T00:00:00Z',
      updatedAt: '2025-06-15T00:00:00Z',
    });
  }

  async findById(id: string): Promise<ShopResponseDto> {
    const shop = this.shops.get(id);
    if (!shop) {
      throw new NotFoundException(`店铺 ${id} 不存在`);
    }
    return this.toResponse(shop);
  }

  async findAll(): Promise<ShopResponseDto[]> {
    return Array.from(this.shops.values()).map(this.toResponse);
  }

  async create(dto: CreateShopDto): Promise<ShopResponseDto> {
    const now = new Date().toISOString();
    const shop: ShopRecord = {
      id: uuidv4(),
      name: dto.name,
      description: dto.description || '',
      address: dto.address || '',
      phone: dto.phone || '',
      logoUrl: dto.logoUrl || '',
      status: dto.status || ShopStatus.OPEN,
      createdAt: now,
      updatedAt: now,
    };
    this.shops.set(shop.id, shop);
    return this.toResponse(shop);
  }

  private toResponse(record: ShopRecord): ShopResponseDto {
    return {
      id: record.id,
      name: record.name,
      description: record.description,
      address: record.address,
      phone: record.phone,
      logoUrl: record.logoUrl,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
