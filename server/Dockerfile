# 构建阶段
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# 生产阶段
FROM node:18-alpine AS production

WORKDIR /app

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# 仅安装生产依赖
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# 从构建阶段拷贝编译产物
COPY --from=builder /app/dist ./dist

# 设置文件所有权
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3010

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --retries=3 --start-period=10s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3010/api/health || exit 1

CMD ["node", "dist/main.js"]
