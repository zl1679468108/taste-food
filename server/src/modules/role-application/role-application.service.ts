import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { supabase, hasSupabase } from '../../database/supabase.client';
import { assertMemoryFallbackAllowed } from '../../common/utils/memory-guard';
import { DEFAULT_SHOP_ID } from '../../common/constants/shop';
import { UserRole } from '../../common/constants/enums';
import { InboxService } from '../inbox/inbox.service';
import { CreateRoleApplicationDto, ReviewRoleApplicationDto } from './dto/role-application.dto';

export interface RoleApplication {
  id: string;
  userId: string;
  applyRole: 'merchant' | 'rider';
  status: 'pending' | 'approved' | 'rejected';
  shopName?: string;
  shopAddress?: string;
  shopPhone?: string;
  contactName?: string;
  contactPhone?: string;
  rejectReason?: string;
  reviewerId?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const memoryApps = new Map<string, RoleApplication>();

@Injectable()
export class RoleApplicationService {
  private readonly logger = new Logger(RoleApplicationService.name);

  constructor(private readonly inbox: InboxService) {}

  async create(userId: string, dto: CreateRoleApplicationDto): Promise<RoleApplication> {
    if (dto.applyRole === 'merchant') {
      if (!dto.shopName?.trim()) {
        throw new BadRequestException('申请商家请填写店铺名称');
      }
    }

    // 仅允许一条 pending
    const existing = await this.findPending(userId, dto.applyRole);
    if (existing) {
      throw new BadRequestException('已有待审批申请，请等待处理或撤回后重提');
    }

    const now = new Date().toISOString();
    const record: RoleApplication = {
      id: uuidv4(),
      userId,
      applyRole: dto.applyRole,
      status: 'pending',
      shopName: dto.shopName?.trim(),
      shopAddress: dto.shopAddress?.trim(),
      shopPhone: dto.shopPhone?.trim(),
      contactName: dto.contactName?.trim(),
      contactPhone: dto.contactPhone?.trim(),
      createdAt: now,
      updatedAt: now,
    };

    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_role_applications')
        .insert({
          id: record.id,
          user_id: userId,
          apply_role: record.applyRole,
          status: 'pending',
          shop_name: record.shopName || null,
          shop_address: record.shopAddress || null,
          shop_phone: record.shopPhone || null,
          contact_name: record.contactName || null,
          contact_phone: record.contactPhone || null,
        })
        .select('*')
        .single();
      if (error) {
        this.logger.warn(`[RoleApp] create failed: ${error.message}`);
        if (/unique|duplicate/i.test(error.message)) {
          throw new BadRequestException('已有待审批申请');
        }
        // fallthrough memory
      } else if (data) {
        await this.notifyAdmins(
          `新的${record.applyRole === 'merchant' ? '商家' : '骑手'}申请`,
          `用户提交了${record.applyRole === 'merchant' ? '商家' : '骑手'}入驻申请，请及时审批`,
          record.id,
        );
        await this.inbox.create({
          userId,
          type: 'role_application_submitted',
          title: '申请已提交',
          content: `您的${record.applyRole === 'merchant' ? '商家' : '骑手'}申请已提交，请等待管理员审批`,
          relatedType: 'role_application',
          relatedId: record.id,
        });
        return this.toRecord(data);
      }
    }

    assertMemoryFallbackAllowed('RoleApplicationService');
    memoryApps.set(record.id, record);
    await this.inbox.create({
      userId,
      type: 'role_application_submitted',
      title: '申请已提交',
      content: `您的${record.applyRole === 'merchant' ? '商家' : '骑手'}申请已提交，请等待管理员审批`,
      relatedType: 'role_application',
      relatedId: record.id,
    });
    return record;
  }

  async listMine(userId: string): Promise<RoleApplication[]> {
    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_role_applications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (!error) return (data || []).map((r) => this.toRecord(r));
    }
    assertMemoryFallbackAllowed('RoleApplicationService');
    return Array.from(memoryApps.values())
      .filter((a) => a.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listAll(status?: string): Promise<RoleApplication[]> {
    if (hasSupabase() && supabase) {
      let q = supabase
        .from('tf_role_applications')
        .select('*')
        .order('created_at', { ascending: false });
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (!error) return (data || []).map((r) => this.toRecord(r));
    }
    assertMemoryFallbackAllowed('RoleApplicationService');
    let all = Array.from(memoryApps.values());
    if (status) all = all.filter((a) => a.status === status);
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async review(
    id: string,
    reviewerId: string,
    dto: ReviewRoleApplicationDto,
  ): Promise<RoleApplication> {
    const app = await this.findById(id);
    if (!app) throw new NotFoundException('申请不存在');
    if (app.status !== 'pending') throw new BadRequestException('申请已处理');
    if (dto.status === 'rejected' && !dto.rejectReason?.trim()) {
      throw new BadRequestException('驳回请填写原因');
    }

    if (dto.status === 'approved') {
      if (app.applyRole === 'merchant') {
        await this.approveMerchant(app);
      } else {
        await this.approveRider(app);
      }
    }

    const now = new Date().toISOString();
    const next: RoleApplication = {
      ...app,
      status: dto.status,
      rejectReason: dto.status === 'rejected' ? dto.rejectReason?.trim() : undefined,
      reviewerId,
      reviewedAt: now,
      updatedAt: now,
    };

    if (hasSupabase() && supabase) {
      const { data, error } = await supabase
        .from('tf_role_applications')
        .update({
          status: next.status,
          reject_reason: next.rejectReason || null,
          reviewer_id: reviewerId,
          reviewed_at: now,
          updated_at: now,
        })
        .eq('id', id)
        .eq('status', 'pending')
        .select('*')
        .single();
      if (error) {
        this.logger.warn(`[RoleApp] review update failed: ${error.message}`);
      } else if (data) {
        Object.assign(next, this.toRecord(data));
      }
    } else {
      assertMemoryFallbackAllowed('RoleApplicationService');
      memoryApps.set(id, next);
    }

    if (dto.status === 'approved') {
      await this.inbox.create({
        userId: app.userId,
        type: 'role_application_approved',
        title: '申请已通过',
        content:
          app.applyRole === 'merchant'
            ? '恭喜，商家申请已通过，请切换到商家身份管理店铺'
            : '恭喜，骑手申请已通过，可切换到骑手身份接单',
        relatedType: 'role_application',
        relatedId: id,
      });
    } else {
      await this.inbox.create({
        userId: app.userId,
        type: 'role_application_rejected',
        title: '申请被驳回',
        content: `原因：${next.rejectReason || '未填写'}。可修改资料后重新申请。`,
        relatedType: 'role_application',
        relatedId: id,
      });
    }

    return next;
  }

  /** 被拒后允许用同一接口重提：若有 rejected 记录，新建 pending */
  private async findPending(userId: string, role: string): Promise<RoleApplication | null> {
    if (hasSupabase() && supabase) {
      const { data } = await supabase
        .from('tf_role_applications')
        .select('*')
        .eq('user_id', userId)
        .eq('apply_role', role)
        .eq('status', 'pending')
        .maybeSingle();
      return data ? this.toRecord(data) : null;
    }
    return (
      Array.from(memoryApps.values()).find(
        (a) => a.userId === userId && a.applyRole === role && a.status === 'pending',
      ) || null
    );
  }

  private async findById(id: string): Promise<RoleApplication | null> {
    if (hasSupabase() && supabase) {
      const { data } = await supabase.from('tf_role_applications').select('*').eq('id', id).maybeSingle();
      return data ? this.toRecord(data) : null;
    }
    return memoryApps.get(id) || null;
  }

  private async approveMerchant(app: RoleApplication) {
    // 创建新店并绑定；一店一商家
    let shopId = uuidv4();
    if (hasSupabase() && supabase) {
      const { data: shop, error: shopErr } = await supabase
        .from('tf_shops')
        .insert({
          id: shopId,
          name: app.shopName || '新店铺',
          description: '',
          address: app.shopAddress || '',
          phone: app.shopPhone || app.contactPhone || '',
          status: 'open',
        })
        .select('id')
        .single();
      if (shopErr) {
        // 若表字段不全，回退默认店仅当无冲突
        this.logger.warn(`[RoleApp] create shop failed: ${shopErr.message}`);
        shopId = DEFAULT_SHOP_ID;
        // 检查默认店是否已有商家
        const { data: occupied } = await supabase
          .from('tf_users')
          .select('id')
          .eq('role', 'merchant')
          .eq('shop_id', shopId)
          .maybeSingle();
        if (occupied && occupied.id !== app.userId) {
          throw new BadRequestException('目标店铺已有商家，无法通过（一店一商家）');
        }
      } else if (shop?.id) {
        shopId = shop.id;
      }

      const { error: userErr } = await supabase
        .from('tf_users')
        .update({ role: UserRole.MERCHANT, shop_id: shopId })
        .eq('id', app.userId);
      if (userErr) throw new BadRequestException(`更新用户角色失败: ${userErr.message}`);

      await supabase.from('tf_user_roles').upsert(
        {
          user_id: app.userId,
          role: UserRole.MERCHANT,
          shop_id: shopId,
          status: 'active',
        },
        { onConflict: 'user_id,role,shop_id' },
      );

      // 确保顾客角色仍在
      await supabase.from('tf_user_roles').upsert(
        {
          user_id: app.userId,
          role: UserRole.CUSTOMER,
          shop_id: null,
          status: 'active',
        },
        { onConflict: 'user_id,role,shop_id' },
      );
    } else {
      assertMemoryFallbackAllowed('RoleApplicationService');
      // 内存路径由 AuthService 暴露接口更好；此处仅记日志
      this.logger.log(`[RoleApp] memory approve merchant user=${app.userId} shop=${shopId}`);
    }
  }

  private async approveRider(app: RoleApplication) {
    if (hasSupabase() && supabase) {
      // 不改当前 role，除非当前是 customer 且用户未登录其它角色——保留当前 role，仅写入 user_roles
      await supabase.from('tf_user_roles').upsert(
        {
          user_id: app.userId,
          role: UserRole.RIDER,
          shop_id: null,
          status: 'active',
        },
        { onConflict: 'user_id,role,shop_id' },
      );
    } else {
      assertMemoryFallbackAllowed('RoleApplicationService');
      this.logger.log(`[RoleApp] memory approve rider user=${app.userId}`);
    }
  }

  private async notifyAdmins(title: string, content: string, relatedId: string) {
    if (hasSupabase() && supabase) {
      const { data } = await supabase.from('tf_users').select('id').eq('role', 'admin');
      for (const row of data || []) {
        await this.inbox.create({
          userId: row.id,
          type: 'role_application_pending',
          title,
          content,
          relatedType: 'role_application',
          relatedId,
        });
      }
    }
  }

  private toRecord(row: any): RoleApplication {
    return {
      id: row.id,
      userId: row.user_id || row.userId,
      applyRole: row.apply_role || row.applyRole,
      status: row.status,
      shopName: row.shop_name || row.shopName,
      shopAddress: row.shop_address || row.shopAddress,
      shopPhone: row.shop_phone || row.shopPhone,
      contactName: row.contact_name || row.contactName,
      contactPhone: row.contact_phone || row.contactPhone,
      rejectReason: row.reject_reason || row.rejectReason,
      reviewerId: row.reviewer_id || row.reviewerId,
      reviewedAt: row.reviewed_at || row.reviewedAt,
      createdAt: row.created_at || row.createdAt,
      updatedAt: row.updated_at || row.updatedAt,
    };
  }
}
