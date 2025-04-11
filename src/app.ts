import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// 导入路由和中间件
import userRoutes from './routes/user';
import { authenticateJWT, optionalAuthenticateJWT } from './middlewares/auth';

// 导入控制器
import * as messageController from './controllers/messageController';

// 导入数据库初始化函数
import { initDatabase } from './utils/initDatabase';

// 导入JWT密钥生成工具
import { ensureJwtSecret } from './utils/keyGenerator';

// 加载环境变量
dotenv.config();

// 初始化Express应用
const app = express();
app.use(cors());
app.use(express.json());

// 确保JWT密钥存在
ensureJwtSecret();

// 静态文件目录
app.use(express.static(path.join(__dirname, 'public')));

// 创建HTTP服务器
const server = http.createServer(app);

// 创建Socket.IO服务器
const io = new Server(server, {
  cors: {
    origin: '*', // 允许所有来源
    methods: ['GET', 'POST']
  }
});

// 设置Socket.IO实例到消息控制器
messageController.setSocketIO(io);

// 用户相关API路由
app.use('/api/users', userRoutes);

// 消息相关API路由
// 获取在线用户列表
app.get('/api/users/online', optionalAuthenticateJWT, messageController.getOnlineUsersList);

// 获取消息历史
app.get('/api/messages', optionalAuthenticateJWT, messageController.getMessageHistory);

// 发送消息API - 需要认证
app.post('/api/messages', authenticateJWT, messageController.sendMessage);

// 发送系统广播 - 需要认证
app.post('/api/broadcast', authenticateJWT, messageController.sendBroadcast);

// 获取私聊会话列表
app.get('/api/private-chats', authenticateJWT, messageController.getPrivateChatSessions);

// 获取与特定用户的私聊消息历史
app.get('/api/private-chats/:targetUserId', authenticateJWT, messageController.getPrivateMessages);

// 发送私聊消息
app.post('/api/private-chats/:targetUserId', authenticateJWT, messageController.sendPrivateMessage);

// 配置Socket.IO事件处理
io.on('connection', (socket) => {
  console.log('新连接建立:', socket.id);
  
  // 处理认证
  socket.on('authenticate', (token) => {
    // 认证逻辑在index.ts中
  });
  
  // 处理断开连接
  socket.on('disconnect', () => {
    // 断开连接逻辑在index.ts中
  });
});

// 数据库初始化和服务器启动逻辑保留在index.ts中

export { app, server, io }; 