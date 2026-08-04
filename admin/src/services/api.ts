declare namespace API {
  interface UserRoleItem {
    role: string;
    shopId?: string | null;
    shopName?: string;
    status: string;
  }

  interface CurrentUser {
    id?: string;
    name?: string;
    avatar?: string;
    userid?: string;
    email?: string;
    role?: string;
    shopId?: string;
    username?: string;
    nickName?: string;
    phone?: string;
    roles?: UserRoleItem[];
  }
}
