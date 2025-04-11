# 简易聊天服务 (WinUC Chat API)

基于Node.js、Express、Socket.IO的简易实时聊天服务器，支持MySQL数据持久化和JWT用户认证

## 版本信息

**当前版本**: `v1.2.0`
- 新增MySQL数据持久化
- 新增JWT用户认证
- 新增用户注册和登录API
- 改进WebSocket认证机制
- 增加git支持和项目结构优化

**上一版本**: `v1.1.0`
- 基于内存存储的聊天服务

查看详细升级指南: [UPGRADE.md](UPGRADE.md)

## 功能特性

- 基于WebSocket的实时通信
- MySQL数据持久化
- JWT用户认证
- 用户注册和登录
- 用户上下线通知
- 显示在线用户列表
- 统计在线人数
- 心跳检测
- HTTP API接口支持
- 多语言客户端支持 (C++, Python)
- 私聊功能
- Git版本控制

## 技术栈

- **后端**: Node.js + Express + Socket.IO + TypeScript + MySQL
- **前端**: HTML + CSS + JavaScript
- **客户端**: C++, Python
- **认证**: JWT (JSON Web Tokens)
- **数据库**: MySQL
- **版本控制**: Git

## 项目结构

```
winuc-chat-api/
├── src/                  # 源代码目录
│   ├── config/           # 配置文件
│   ├── middlewares/      # 中间件
│   ├── models/           # 数据模型
│   ├── public/           # 静态资源
│   ├── routes/           # 路由
│   ├── services/         # 服务
│   ├── utils/            # 工具函数
│   └── index.ts          # 主入口文件
├── dist/                 # 编译后文件
├── examples/             # 示例代码
│   └── web-client/       # Web客户端示例
├── docs/                 # 文档
├── .env                  # 环境变量
├── .env.example          # 环境变量示例
├── .gitignore            # Git忽略文件
├── package.json          # 项目配置
├── tsconfig.json         # TypeScript配置
└── README.md             # 项目说明
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 环境配置

复制`.env.example`文件为`.env`并根据需要修改配置:

```bash
cp .env.example .env
```

修改以下配置项：
```
DB_HOST=localhost    # 数据库主机名
DB_USER=root         # 数据库用户名
DB_PASSWORD=your_pwd # 数据库密码
DB_NAME=winuc_chat   # 数据库名称
```

### 开发环境运行

```bash
npm run dev
```

### 生产环境构建

```bash
npm run build
```

### 生产环境运行

```bash
npm start
```

## Windows快速启动

使用提供的批处理脚本快速启动服务:

```bash
start-winuc-chat.bat
```

## 访问与测试

### Web客户端

开发服务器启动后，访问 http://localhost:3000

### API测试

Windows:
```bash
test-api.bat
```

Linux/Mac:
```bash
chmod +x test-api.sh
./test-api.sh
```

## API接口

服务提供以下HTTP API:

### 认证相关
- `POST /api/users/register` - 用户注册
- `POST /api/users/login` - 用户登录
- `GET /api/users/me` - 获取当前用户信息（需要认证）

### 聊天相关
- `GET /api/users/online` - 获取在线用户列表
- `GET /api/messages` - 获取消息历史
- `POST /api/messages` - 发送聊天消息
- `POST /api/broadcast` - 发送系统广播
- `GET /api/private-chats` - 获取私聊会话列表
- `GET /api/private-chats/:targetUserId` - 获取与特定用户的私聊消息历史

详细API文档请查阅 [API.md](API.md)

## 客户端接入指南

提供了多种语言的客户端接入实现：

- [Web客户端示例](examples/web-client/) - 带有JWT认证的Web客户端示例
- [C++客户端接入](docs/cpp-client.md) - 支持Windows和macOS
- [Python客户端接入](docs/python-client.md) - 支持Windows和macOS

查看完整指南: [接入指南索引](docs/index.md)

## 数据库配置

项目现已支持MySQL数据库，首次启动应用时，系统将自动创建数据库表结构。

## JWT认证

项目集成了JWT认证功能，实现用户注册和登录。首次启动应用时，系统会自动生成JWT密钥并保存到`.env`文件中。

### 用户认证示例

```bash
# 用户注册
curl -X POST http://localhost:3000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "password123"}'

# 用户登录
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "password123"}'

# 获取当前用户信息（需要认证）
curl -X GET http://localhost:3000/api/users/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Git使用

项目已集成Git版本控制，使用以下常用命令：

```bash
# 查看状态
git status

# 添加文件
git add .

# 提交更改
git commit -m "提交说明"

# 添加远程仓库
git remote add origin <仓库URL>

# 推送到远程仓库
git push -u origin main
```

## 后续规划

- 添加Redis支持分布式部署
- 添加MongoDB支持
- 图片和文件支持
- API权限细化
- 更多语言客户端支持

```