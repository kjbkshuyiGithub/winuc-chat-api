import dotenv from 'dotenv';
import { initDatabase } from './utils/initDatabase';
import { authService } from './services/auth';
import { logger } from './utils/logger';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import userRoutes from './routes/user';
import { authenticateJWT, optionalAuthenticateJWT } from './middlewares/auth';
import * as messageController from './controllers/messageController';
import { ensureJwtSecret } from './utils/keyGenerator';

// 加载环境变量
dotenv.config();

// 定义服务器端口
const PORT = process.env.PORT || 3000;

// 初始化Express应用
const app = express();
app.use(cors());
app.use(express.json());

// 确保JWT密钥存在
ensureJwtSecret();

// 静态文件目录
app.use(express.static(path.join(__dirname, 'public')));

// 创建HTTP服务器
const httpServer = http.createServer(app);

// 创建Socket.IO服务器
const socketIO = new Server(httpServer, {
  cors: {
    origin: '*', // 允许所有来源
    methods: ['GET', 'POST']
  }
});

// 设置Socket.IO实例到消息控制器
messageController.setSocketIO(socketIO);

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
app.post('/api/private-messages', authenticateJWT, messageController.sendPrivateMessage);

/**
 * 应用启动函数
 */
async function startApp() {
  try {
    // 初始化数据库
    await initDatabase();
    logger.info('数据库初始化成功');
    
    // 设置Socket.IO认证
    socketIO.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        if (!token) {
          return next(new Error('认证失败 - 未提供令牌'));
        }
        
        // 验证JWT令牌
        const user = await authService.verifyToken(token as string);
        if (!user) {
          return next(new Error('认证失败 - 无效令牌'));
        }
        
        // 将用户信息附加到socket连接
        socket.data.user = user;
        
        // 记录用户上线
        logger.info(`用户上线: ${user.username} (${user.userId})`);
        
        // 更新用户在线状态
        const onlineUsers = messageController.getOnlineUsers();
        
        // 记录用户信息
        onlineUsers.set(socket.id, {
          socketId: socket.id,
          userId: user.userId,
          username: user.username,
          joinTime: new Date()
        });
        
        // 广播用户上线事件
        socket.broadcast.emit('userJoin', {
          type: 'userJoin',
          userId: user.userId,
          username: user.username,
          time: new Date(),
          count: onlineUsers.size
        });
        
        next();
      } catch (error) {
        logger.error('Socket认证失败:', error);
        next(new Error('认证失败'));
      }
    });
    
    // 监听客户端连接
    socketIO.on('connection', (socket) => {
      logger.info(`新连接: ${socket.id}`);
      
      // 处理断开连接
      socket.on('disconnect', () => {
        const onlineUsers = messageController.getOnlineUsers();
        const user = onlineUsers.get(socket.id);
        
        if (user) {
          logger.info(`用户下线: ${user.username} (${user.userId})`);
          
          // 从在线用户列表移除
          onlineUsers.delete(socket.id);
          
          // 广播用户下线事件
          socket.broadcast.emit('userLeave', {
            type: 'userLeave',
            userId: user.userId,
            username: user.username,
            time: new Date(),
            count: onlineUsers.size
          });
        } else {
          logger.info(`未认证连接断开: ${socket.id}`);
        }
      });
      
      // 处理客户端消息
      socket.on('message', async (data) => {
        try {
          const user = socket.data.user;
          if (!user) {
            socket.emit('error', { message: '未认证用户' });
            return;
          }
          
          // 消息处理逻辑已移至消息控制器
        } catch (error) {
          logger.error('处理消息失败:', error);
          socket.emit('error', { message: '处理消息失败' });
        }
      });
      
      // 处理客户端私聊消息
      socket.on('privateMessage', async (data) => {
        try {
          const user = socket.data.user;
          if (!user) {
            socket.emit('error', { message: '未认证用户' });
            return;
          }
          
          // 私聊消息处理逻辑已移至消息控制器
        } catch (error) {
          logger.error('处理私聊消息失败:', error);
          socket.emit('error', { message: '处理私聊消息失败' });
        }
      });
      
      // 处理心跳
      socket.on('ping', () => {
        socket.emit('pong', { time: new Date() });
      });
    });
    
    // 启动服务器
    httpServer.listen(PORT, () => {
      logger.info(`服务器已启动: http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('启动应用失败:', error);
    process.exit(1);
  }
}

// 启动应用
startApp(); 