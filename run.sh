#!/bin/bash
cd "$(dirname "$0")"

echo "📦 检查依赖..."
pip3 install --user --break-system-packages -r requirements.txt

echo "🚀 启动每日计划表..."
python3 app.py
