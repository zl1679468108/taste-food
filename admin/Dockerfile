FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# 生产阶段
FROM nginx:alpine

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --retries=3 --start-period=5s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# nginx:alpine 默认以非 root 用户 worker 进程运行，master 仍需 root 绑定 80 端口
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
