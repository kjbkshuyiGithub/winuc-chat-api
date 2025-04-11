@echo off
echo ===================================
echo WinUC Chat API服务启动脚本
echo ===================================
echo.

REM 检查.env文件
if not exist .env (
  echo 未找到.env配置文件，正在从模板创建...
  copy .env.example .env
  echo 已创建.env文件，请检查配置是否正确
)

REM 安装依赖
echo 检查依赖...
call npm install
if %errorlevel% neq 0 (
  echo 依赖安装失败，请手动运行 npm install
  pause
  exit /b 1
)

REM 测试数据库连接
echo.
echo 正在测试数据库连接...
node test-db.js
if %errorlevel% neq 0 (
  echo 数据库连接测试失败，请检查数据库配置
  pause
  exit /b 1
)

REM 启动服务
echo.
echo 正在启动WinUC Chat API服务...
call npm run dev

REM 如果服务意外退出
echo.
echo 服务已停止运行
pause 