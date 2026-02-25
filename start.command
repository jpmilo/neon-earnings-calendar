#!/bin/bash
# 自动切换到当前脚本所在的目录
cd "$(dirname "$0")"

echo "=========================================="
echo "    启动 Earnings Calendar (财报日历)"
echo "=========================================="
echo "请勿关闭此终端窗口。如果要停止服务，请关闭此窗口或按 Ctrl+C。"
echo ""

# 运行 Node 服务器
node server.js
