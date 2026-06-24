import request from '@/utils/request';

export interface User {
  id: string;
  openid: string;
  role: string;
  nickName: string;
  avatarUrl: string;
  createdAt: string;
  updatedAt: string;
}

export const getUsers = (params: { page: number; pageSize: number; role?: string }) =>
  request.get('/api/users', { params }) as Promise<{ items: User[]; total: number }>;

export const getUser = (id: string) =>
  request.get(`/api/users/${id}`) as Promise<User>;