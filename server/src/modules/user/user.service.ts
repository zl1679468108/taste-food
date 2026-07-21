import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { supabase, hasSupabase } from '../../database/supabase.client';

export interface UserSummary {
  id: string;
  nickName: string;
  avatarUrl: string;
  role: string;
  registerDate: string;
}

export interface PaginatedUsers {
  items: UserSummary[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class UserService {
  async getUsers(page = 1, pageSize = 20, role?: string): Promise<PaginatedUsers> {
    if (!hasSupabase() || !supabase) {
      return { items: [], total: 0, page, pageSize };
    }
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabase
      .from('tf_users')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (role) {
      query = query.eq('role', role);
    }
    const { data, error, count } = await query;
    if (error) throw new BadRequestException(`获取用户列表失败: ${error.message}`);
    return {
      items: (data || []).map((u: any) => ({
        id: u.id, nickName: u.nick_name, avatarUrl: u.avatar_url,
        role: u.role, registerDate: u.created_at,
      })),
      total: count || 0, page, pageSize,
    };
  }

  async getUserDetail(userId: string): Promise<UserSummary> {
    if (!hasSupabase() || !supabase) throw new NotFoundException('用户不存在');
    const { data, error } = await supabase
      .from('tf_users')
      .select('*').eq('id', userId).single();
    if (error || !data) throw new NotFoundException(`用户 ${userId} 不存在`);
    return {
      id: data.id, nickName: data.nick_name, avatarUrl: data.avatar_url,
      role: data.role, registerDate: data.created_at,
    };
  }
}
