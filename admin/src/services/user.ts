import request from '@/utils/request';

export interface User {
  id: string;
  openid: string;
  role: string;
  nickName: string;
  avatarUrl: string;
  shopId?: string;
  createdAt: string;
  updatedAt?: string;
  registerDate?: string;
}

export interface CreateUserPayload {
  nickName: string;
  role: 'customer' | 'admin' | 'merchant' | 'rider';
  shopId?: string;
  openid?: string;
  avatarUrl?: string;
}

export interface UpdateUserPayload {
  nickName?: string;
  avatarUrl?: string;
  role?: 'customer' | 'admin' | 'merchant' | 'rider';
  shopId?: string | null;
}

export const getUsers = (params: { page: number; pageSize: number; role?: string }) =>
  request.get('/api/users', { params }) as Promise<{ items: User[]; total: number }>;

export const getUser = (id: string) =>
  request.get(`/api/users/${id}`) as Promise<User>;

export const getMe = () =>
  request.get('/api/users/me') as Promise<User>;

export const createUser = (data: CreateUserPayload) =>
  request.post('/api/users', data) as Promise<User>;

export const updateUser = (id: string, data: UpdateUserPayload) =>
  request.patch(`/api/users/${id}`, data) as Promise<User>;

export const updateMe = (data: Pick<UpdateUserPayload, 'nickName' | 'avatarUrl'>) =>
  request.patch('/api/users/me', data) as Promise<User>;
