/**
 * T301 角色-店铺写时不变量 —— 真实 HTTP 探针
 *
 * 用途：验证运行中的后端确实拒绝生成 admin + shopId 二义账号。
 * 前置：后端已在 127.0.0.1:3010 运行（cd server && npm run start）。
 * 运行：node --use-env-proxy tests/t301-invariant.probe.mjs
 *
 * 注意：本探针只发送**预期被拒绝**的请求，不会在库中留下脏数据。
 */
const BASE = 'http://127.0.0.1:3010/api';
const SHOP = '00000000-0000-0000-0000-000000000001';

async function req(path, options = {}) {
  const { method = 'GET', body, token } = options;
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* 非 JSON 响应 */
  }
  return { status: res.status, body: json };
}

const login = await req('/auth/login', {
  method: 'POST',
  body: { username: 'admin', password: 'admin123' },
});
const data = login.body && login.body.data;
const token = data && (data.accessToken || data.token);
console.log(
  '登录平台管理员: HTTP ' +
    login.status +
    ' role=' +
    (data && data.role) +
    ' shopId=' +
    ((data && data.shopId) || '空'),
);
if (!token) {
  console.log('无 token，终止：' + JSON.stringify(login.body).slice(0, 300));
  process.exit(1);
}

const cases = [
  {
    name: '创建 admin + shopId 应被拒（二义账号）',
    payload: { nickName: 'T301越权管理员', role: 'admin', shopId: SHOP },
    expect: 400,
    expectMsg: /不可绑定店铺/,
  },
  {
    name: '创建 merchant 无 shopId 应被拒',
    payload: { nickName: 'T301野商家', role: 'merchant' },
    expect: 400,
    expectMsg: /必须绑定店铺/,
  },
  {
    // 正向链路：DEFAULT_SHOP_ID 版本位为 0，曾被 @IsUUID() 误判为非法而 400
    //（"shopId must be a UUID"），导致默认店铺永远建不了商家账号。
    // 修复后应越过 DTO 与不变量校验抵达持久层：
    //   - 连库模式：撞「一店一商家」唯一索引 → 409
    //   - 内存回退模式：→ 400「数据库未配置」
    // 两者都证明校验层已放行；该店已有合法商家，不会写入脏数据。
    name: '默认店铺 shopId 应通过 UUID 与不变量校验（不再被误判非法）',
    check: (r) => {
      const msg = String((r.body && r.body.message) || '');
      if (/must be a UUID|必须是合法的店铺 UUID/.test(msg)) return false;
      if (/不可绑定店铺|必须绑定店铺/.test(msg)) return false;
      return (r.status === 409 && /一店一商家/.test(msg)) ||
        (r.status === 400 && /数据库未配置/.test(msg)) ||
        r.status === 201;
    },
    payload: { nickName: 'T301重复商家', role: 'merchant', shopId: SHOP },
  },
];

let pass = 0;
let fail = 0;
for (const c of cases) {
  const r = await req('/users', { method: 'POST', body: c.payload, token });
  const msg = (r.body && r.body.message) || '';
  const okCase = c.check
    ? c.check(r)
    : r.status === c.expect && c.expectMsg.test(String(msg));
  okCase ? pass++ : fail++;
  console.log('  ' + (okCase ? 'PASS' : 'FAIL') + '  ' + c.name + '  [' + r.status + '] ' + msg);
}

console.log('\n汇总: PASS ' + pass + '   FAIL ' + fail);
process.exit(fail > 0 ? 1 : 0);
