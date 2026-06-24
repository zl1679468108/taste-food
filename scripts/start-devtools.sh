#!/bin/bash
# 启动微信开发者工具并启用自动化
# 使用方法: bash scripts/start-devtools.sh

CLI="/Applications/wechatwebdevtools.app/Contents/MacOS/cli"
PROJECT="/Users/zhaolong/前端/vibe-coding-project/taste-food/client"

echo "🚀 启动微信开发者工具..."
echo "项目路径: $PROJECT"
echo ""

$CLI auto --project "$PROJECT"

echo ""
echo "✅ 开发者工具已启动，自动化端口已启用"
echo "现在可以运行: npm run test:connect"
