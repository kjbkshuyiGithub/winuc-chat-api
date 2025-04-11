@echo off
echo 聊天API测试脚本
echo ====================

set BASE_URL=http://localhost:3000

echo 测试1: 获取在线用户列表
curl -X GET %BASE_URL%/api/users
echo.
echo.

echo 测试2: 获取消息历史
curl -X GET "%BASE_URL%/api/messages?limit=5"
echo.
echo.

echo 测试3: 发送普通消息
curl -X POST %BASE_URL%/api/messages ^
  -H "Content-Type: application/json" ^
  -d "{\"userId\":\"test_user\",\"username\":\"测试用户\",\"content\":\"这是一条API发送的测试消息\",\"type\":\"text\"}"
echo.
echo.

echo 测试4: 发送系统广播
curl -X POST %BASE_URL%/api/broadcast ^
  -H "Content-Type: application/json" ^
  -d "{\"content\":\"系统公告: 这是一条通过API发送的系统广播测试\"}"
echo.
echo.

echo 测试完成! 