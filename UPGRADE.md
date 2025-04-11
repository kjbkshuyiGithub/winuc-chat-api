# 升级指南：v1.1.0 到 v1.2.0

本文档提供了从v1.1.0版本（内存存储）升级到v1.2.0版本（MySQL + JWT认证）的详细步骤。

## 新特性概述

v1.2.0版本带来以下重大更新：

1. **MySQL数据持久化**
   - 用户数据存储在MySQL数据库
   - 消息历史记录持久化
   - 系统重启后数据不会丢失

2. **JWT用户认证**
   - 用户注册和登录API
   - 基于JWT的安全认证机制
   - API访问权限控制
   - 自动生成安全的JWT密钥

## 升级步骤

### 1. 备份数据（如果需要）

如果您需要保留现有的用户和消息数据，可以先导出现有数据：

```bash
# 启动旧版应用
npm run dev

# 在另一个终端导出用户列表
curl http://localhost:3000/api/users > users_backup.json

# 导出消息历史
curl http://localhost:3000/api/messages > messages_backup.json
```

### 2. 安装新依赖

```bash
# 安装MySQL驱动和其他依赖
npm install mysql2 dotenv

# 安装开发依赖
npm install -D @types/jsonwebtoken @types/bcrypt
```

### 3. 配置数据库

1. 创建MySQL数据库:

```sql
CREATE DATABASE winuc_chat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. 创建配置文件:

```bash
# 复制示例配置文件
cp .env.example .env

# 编辑配置文件，填写您的数据库信息
# DB_HOST=localhost
# DB_USER=your_db_user
# DB_PASSWORD=your_password
# DB_NAME=winuc_chat
```

### 4. 启动新版本应用

```bash
# 启动应用
npm run dev
```

首次启动时，系统将：
- 自动生成JWT密钥并保存到.env文件
- 自动创建所需的数据库表结构

### 5. 使用新版API

#### 用户注册

```bash
curl -X POST http://localhost:3000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

#### 用户登录

```bash
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

#### 使用令牌访问API

```bash
# 将登录或注册返回的token替换到下面的YOUR_TOKEN
curl -X GET http://localhost:3000/api/users/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 客户端适配

### WebSocket连接变更

旧版客户端连接代码:
```javascript
socket.emit('join', { userId: 'user1', username: 'User 1' });
```

新版客户端需要使用JWT令牌:
```javascript
socket.emit('join', { token: 'YOUR_JWT_TOKEN' });
```

### API变更

1. **发送消息** - 删除userId和username参数，添加Authorization头:

   旧版:
   ```javascript
   fetch('/api/messages', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       userId: 'user1',
       username: 'User 1',
       content: 'Hello world'
     })
   });
   ```

   新版:
   ```javascript
   fetch('/api/messages', {
     method: 'POST',
     headers: { 
       'Content-Type': 'application/json',
       'Authorization': 'Bearer YOUR_JWT_TOKEN'
     },
     body: JSON.stringify({
       content: 'Hello world'
     })
   });
   ```

2. **用户列表API** - 路径变更:

   旧版: `/api/users`
   新版: `/api/users/online`

## 数据迁移（可选）

如果你需要将之前备份的数据导入新系统，可以使用提供的数据迁移脚本:

1. 创建 `migration.js` 文件:

```javascript
// 请先备份旧数据，然后修改此脚本的文件路径
const fs = require('fs');
const http = require('http');

// 读取备份文件
const users = JSON.parse(fs.readFileSync('./users_backup.json'));
const messages = JSON.parse(fs.readFileSync('./messages_backup.json'));

// 注册管理员用户
async function registerAdmin() {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/users/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve(JSON.parse(data));
      });
    });
    
    req.on('error', (e) => {
      reject(e);
    });
    
    req.write(JSON.stringify({
      username: 'admin',
      password: 'admin123'
    }));
    
    req.end();
  });
}

// 运行迁移
async function runMigration() {
  try {
    // 注册管理员账号并获取token
    const result = await registerAdmin();
    const token = result.token;
    
    console.log('管理员账号创建成功，获取到token');
    
    // TODO: 导入旧数据，使用token进行认证
    // 在实际迁移中，你需要根据你的数据结构进行适配
    
    console.log('数据迁移完成');
  } catch (error) {
    console.error('迁移失败:', error);
  }
}

// 执行迁移
runMigration();
```

2. 运行迁移脚本:
```bash
node migration.js
```

## 问题排查

### 数据库连接问题

如果遇到数据库连接问题，请检查:

1. MySQL服务是否正常运行
2. `.env`文件中的数据库配置是否正确
3. 数据库用户是否有足够权限

### JWT相关问题

如果遇到JWT认证问题:

1. 检查`.env`文件中是否有`JWT_SECRET`，如果没有，重启应用让系统自动生成
2. 确保在API请求中正确设置`Authorization`头
3. Token可能已过期，尝试重新登录获取新token

### 其他常见问题

- **"找不到表"错误**: 确保应用正确初始化数据库表结构，检查启动日志
- **API 401错误**: 检查认证token是否正确设置和未过期
- **WebSocket连接失败**: 确保发送正确的`join`事件格式 