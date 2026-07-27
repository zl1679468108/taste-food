import request from '@/utils/request';

export type ApplyRole = 'merchant' | 'rider';
export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface RoleApplication {
  id: string;
  userId: string;
  applyRole: ApplyRole;
  status: ApplicationStatus;
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

export interface CreateRoleApplicationParams {
  applyRole: ApplyRole;
  shopName?: string;
  shopAddress?: string;
  shopPhone?: string;
  contactName?: string;
  contactPhone?: string;
}

export interface ReviewRoleApplicationParams {
  status: 'approved' | 'rejected';
  rejectReason?: string;
}

/** 提交商家/骑手申请 */
export const createRoleApplication = (params: CreateRoleApplicationParams) =>
  request.post('/api/role-applications', params) as Promise<RoleApplication>;

/** 我的申请列表 */
export const listMyApplications = () =>
  request.get('/api/role-applications/mine') as Promise<RoleApplication[]>;

/** 管理员：全部申请 */
export const listApplications = (status?: ApplicationStatus | string) =>
  request.get('/api/role-applications', {
    params: status ? { status } : undefined,
  }) as Promise<RoleApplication[]>;

/** 管理员：审批 */
export const reviewApplication = (id: string, params: ReviewRoleApplicationParams) =>
  request.patch(`/api/role-applications/${id}/review`, params) as Promise<RoleApplication>;
