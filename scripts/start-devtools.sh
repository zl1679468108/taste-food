#!/bin/bash
set -e
# 启动微信开发者工具并启用自动化
# 使用方法: bash scripts/start-devtools.sh

CLI="/Applications/wechatwebdevtools.app/Contents/MacOS/cli"
PROJECT="/Users/zhaolong/前端/vibe-coding-project/taste-food/client"

# 检查微信开发者工具是否安装
if [ ! -f "$CLI" ]; then
  echo "❌ 未找到微信开发者工具 CLI: $CLI"
  echo "请先安装微信开发者工具"
  exit 1
fi

# 检查项目目录是否存在
if [ ! -d "$PROJECT" ]; then
  echo "❌ 项目目录不存在: $PROJECT"
  exit 1
fi

echo "🚀 启动微信开发者工具..."
echo "项目路径: $PROJECT"
echo ""

if $CLI auto --project "$PROJECT"; then
  echo ""
  echo "✅ 开发者工具已启动，自动化端口已启用"
  echo "现在可以运行: npm run test:connect"
else
  echo ""
  echo "❌ 启动开发者工具失败"
  exit 1
fi
