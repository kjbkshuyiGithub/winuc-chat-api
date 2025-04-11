# 聊天服务API文档

## 基本信息

- 基础URL: `http://localhost:3000/api`
- 内容类型: `application/json`
- 字符编码: `UTF-8`

## 通用规范

### 请求头部

所有API请求应包含以下头部：

```
Content-Type: application/json
```

### 响应格式

API响应格式统一为JSON，包含以下字段：

- 成功响应：
  - 状态码: 2xx
  - 包含相关数据或成功确认信息

- 错误响应：
  - 状态码: 4xx 或 5xx
  - 包含错误详情

```json
{
  "error": "错误描述信息"
}
```

### 错误码说明

| 状态码 | 描述 |
|--------|------|
| 200 | 请求成功 |
| 201 | 资源创建成功 |
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 404 | 资源未找到 |
| 429 | 请求频率超限 |
| 500 | 服务器内部错误 |

## API端点

### 1. 获取在线用户列表

**请求**

```
GET /api/users
```

**响应**

```json
{
  "count": 2,
  "users": [
    {
      "userId": "user_1617282",
      "username": "张三",
      "joinTime": "2023-04-05T12:30:45.123Z"
    },
    {
      "userId": "user_1617283",
      "username": "李四",
      "joinTime": "2023-04-05T12:35:22.456Z"
    }
  ]
}
```

**cURL测试**

```bash
curl -X GET http://localhost:3000/api/users
```

### 2. 获取消息历史

**请求**

```
GET /api/messages?limit=10&offset=0
```

参数说明:
- `limit`: 每页数量 (默认50)
- `offset`: 起始位置 (默认0)
- `type`: 可选，消息类型过滤 (text, system)

**响应**

```json
{
  "total": 100,
  "messages": [
    {
      "id": "msg_1617282345",
      "senderId": "user_1617282",
      "sender": "张三",
      "content": "大家好!",
      "type": "text",
      "time": "2023-04-05T12:31:22.123Z"
    },
    {
      "id": "sys_1617282346",
      "type": "system",
      "content": "李四 加入了聊天",
      "time": "2023-04-05T12:35:22.456Z"
    }
  ]
}
```

**cURL测试**

```bash
curl -X GET "http://localhost:3000/api/messages?limit=10&offset=0"
```

### 3. 发送消息

**请求**

```
POST /api/messages
```

请求体:

```json
{
  "userId": "user_1617282",
  "username": "张三",
  "content": "大家好!",
  "type": "text"
}
```

参数说明:
- `userId`: 用户ID (必填)
- `username`: 用户名 (必填)
- `content`: 消息内容 (必填)
- `type`: 消息类型 (可选，默认"text")

**响应**

```json
{
  "success": true,
  "message": "Message sent successfully",
  "messageId": "msg_1617282345"
}
```

**cURL测试**

```bash
curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -d '{"userId":"user_1617282","username":"张三","content":"大家好!","type":"text"}'
```

### 4. 系统广播

**请求**

```
POST /api/broadcast
```

请求体:

```json
{
  "content": "系统将在5分钟后维护"
}
```

参数说明:
- `content`: 广播内容 (必填)

**响应**

```json
{
  "success": true
}
```

**cURL测试**

```bash
curl -X POST http://localhost:3000/api/broadcast \
  -H "Content-Type: application/json" \
  -d '{"content":"系统将在5分钟后维护"}'
```

## WebSocket事件

以下是与API交互时可以通过WebSocket接收的事件:

### 事件类型

| 事件名 | 描述 | 数据格式 |
|--------|------|---------|
| `message` | 当有新消息时触发 | 消息对象 |
| `userList` | 当用户列表更新时触发 | 用户列表数组 |
| `userCount` | 当在线人数变化时触发 | 数字 |
| `ping` | 客户端发送心跳检测 | 无数据 |
| `pong` | 服务端响应心跳检测 | 无数据 |

### WebSocket连接

连接地址: `ws://localhost:3000` 或 `wss://your-domain.com`（生产环境）

### WebSocket事件说明

**消息对象格式**
```json
{
  "id": "msg_1617282345",
  "senderId": "user_1617282",
  "sender": "张三",
  "content": "大家好!",
  "type": "text",
  "time": "2023-04-05T12:31:22.123Z"
}
```

**系统消息格式**
```json
{
  "id": "sys_1617282346",
  "type": "system",
  "content": "李四 加入了聊天",
  "time": "2023-04-05T12:35:22.456Z"
}
```

**用户加入事件**
```json
{
  "userId": "user_1617282",
  "username": "张三"
}
```

## 示例场景

**场景一: 后台系统向聊天室发送通知**

```bash
curl -X POST http://localhost:3000/api/broadcast \
  -H "Content-Type: application/json" \
  -d '{"content":"重要通知: 系统将于今晚23:00进行例行维护, 预计持续30分钟"}'
```

**场景二: 机器人发送消息**

```bash
curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -d '{"userId":"bot_weather","username":"天气机器人","content":"今日北京天气: 晴, 温度28°C, 空气质量良好","type":"text"}'
```

**场景三: 查询最近10条消息**

```bash
curl -X GET "http://localhost:3000/api/messages?limit=10"
```

## 速率限制

为保护服务器资源，API请求存在以下限制：

- 消息发送：每用户每分钟最多60条
- 系统广播：每IP每分钟最多10条
- 查询请求：每IP每分钟最多100次

超出限制将返回429状态码。

## 最佳实践

1. 使用WebSocket监听实时事件，使用REST API进行查询和管理操作
2. 实现适当的重连机制和错误处理
3. 在客户端缓存用户信息和消息历史，减少请求次数
4. 定期发送心跳（每30秒）保持连接活跃

## 用户认证 API

> **注意**: 从v1.2.0版本开始，所有需要认证的API都需要在请求头中包含JWT令牌

### 用户注册

**请求**:
```
POST /api/users/register
```

**参数**:
```json
{
  "username": "example_user",  // 用户名，3-20个字符
  "password": "password123"    // 密码，最少6个字符
}
```

**成功响应** (状态码: 201):
```json
{
  "message": "注册成功",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."  // JWT令牌
}
```

**错误响应** (状态码: 400):
```json
{
  "error": "用户名已存在" // 或其他错误信息
}
```

### 用户登录

**请求**:
```
POST /api/users/login
```

**参数**:
```json
{
  "username": "example_user",
  "password": "password123"
}
```

**成功响应** (状态码: 200):
```json
{
  "message": "登录成功",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."  // JWT令牌
}
```

**错误响应** (状态码: 401):
```json
{
  "error": "用户名或密码错误"
}
```

### 获取当前用户信息

**请求**:
```
GET /api/users/me
```

**请求头**:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**成功响应** (状态码: 200):
```json
{
  "id": "12b49e61-6793-45f3-8f36-1a653ab1c2ab",
  "username": "example_user",
  "created_at": "2023-05-10T15:30:45.123Z",
  "last_login": "2023-05-10T16:20:10.456Z"
}
```

**错误响应** (状态码: 401):
```json
{
  "error": "需要认证"
}
```

## 聊天 API

### 获取在线用户列表

**请求**:
```
GET /api/users/online
```

**请求头** (可选):
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**响应**:
```json
{
  "count": 2,
  "users": [
    {
      "userId": "user_1617282",
      "username": "张三",
      "joinTime": "2023-04-05T12:30:45.123Z"
    },
    {
      "userId": "user_1617283",
      "username": "李四",
      "joinTime": "2023-04-05T12:35:22.456Z"
    }
  ]
}
```

**cURL测试**:
```bash
curl -X GET http://localhost:3000/api/users/online
```

### 获取消息历史

**请求**:
```
GET /api/messages?limit=10&offset=0
```

**请求头** (可选):
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**参数说明**:
- `limit`: 每页数量 (默认50)
- `offset`: 起始位置 (默认0)

**响应**:
```json
{
  "total": 100,
  "messages": [
    {
      "id": "msg_1617282345",
      "senderId": "user_1617282",
      "sender": "张三",
      "content": "大家好!",
      "type": "text",
      "time": "2023-04-05T12:31:22.123Z"
    },
    {
      "id": "sys_1617282346",
      "type": "system",
      "content": "李四 加入了聊天",
      "time": "2023-04-05T12:35:22.456Z"
    }
  ]
}
```

**cURL测试**:
```bash
curl -X GET "http://localhost:3000/api/messages?limit=10&offset=0"
```

### 发送消息

**请求**:
```
POST /api/messages
```

**请求头** (必需):
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**请求体**:
```json
{
  "content": "大家好!",
  "type": "text"
}
```

**参数说明**:
- `content`: 消息内容 (必填)
- `type`: 消息类型 (可选，默认"text")

**响应**:
```json
{
  "success": true,
  "message": "消息发送成功",
  "messageId": "msg_1617282345"
}
```

**cURL测试**:
```bash
curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"content":"大家好!","type":"text"}'
```

### 系统广播

**请求**:
```
POST /api/broadcast
```

**请求头** (必需):
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**请求体**:
```json
{
  "content": "系统将在5分钟后维护"
}
```

**参数说明**:
- `content`: 广播内容 (必填)

**响应**:
```json
{
  "success": true
}
```

**cURL测试**:
```bash
curl -X POST http://localhost:3000/api/broadcast \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"content":"系统将在5分钟后维护"}'
```

## WebSocket事件

WebSocket连接现在需要使用JWT令牌进行认证。

### WebSocket连接和认证

连接地址: `ws://localhost:3000` 或 `wss://your-domain.com`（生产环境）

客户端连接后需要发送join事件，包含Token:

```json
{
  "token": "YOUR_JWT_TOKEN"
}
```

### 事件类型

| 事件名 | 描述 | 数据格式 |
|--------|------|---------|
| `message` | 当有新消息时触发 | 消息对象 |
| `userList` | 当用户列表更新时触发 | 用户列表数组 |
| `userCount` | 当在线人数变化时触发 | 数字 |
| `error` | 当发生错误时触发 | 错误对象 |
| `ping` | 客户端发送心跳检测 | 无数据 |
| `pong` | 服务端响应心跳检测 | 无数据 |

### WebSocket事件说明

**消息对象格式**:
```json
{
  "id": "msg_1617282345",
  "senderId": "user_1617282",
  "sender": "张三",
  "content": "大家好!",
  "type": "text",
  "time": "2023-04-05T12:31:22.123Z"
}
```

**系统消息格式**:
```json
{
  "id": "sys_1617282346",
  "type": "system",
  "content": "李四 加入了聊天",
  "time": "2023-04-05T12:35:22.456Z"
}
```

**错误消息格式**:
```json
{
  "message": "认证失败，请重新登录"
}
```

## 速率限制

为保护服务器资源，API请求存在以下限制：

- 消息发送：每用户每分钟最多60条
- 系统广播：每IP每分钟最多10条
- 查询请求：每IP每分钟最多100次

超出限制将返回429状态码。

## 最佳实践

1. 使用WebSocket监听实时事件，使用REST API进行查询和管理操作
2. 实现适当的重连机制和错误处理
3. 在客户端缓存用户信息和消息历史，减少请求次数
4. 定期发送心跳（每30秒）保持连接活跃
5. 安全保存JWT令牌，在请求时正确设置Authorization头 