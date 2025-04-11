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

// 主页路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 私聊页面路由
app.get('/private-chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'private-chat.html'));
});

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

// 发送私聊消息 - API方式
app.post('/api/private-chats/:targetUserId', authenticateJWT, messageController.sendPrivateMessage);

/**
 * 应用启动函数
 */
async function startApp() {
  try {
    // 初始化数据库
    await initDatabase();
    logger.info('数据库初始化成功');
    
    // 监听客户端连接
    socketIO.on('connection', (socket) => {
      logger.info(`新连接: ${socket.id}`);
      
      // 处理用户加入
      socket.on('join', async (userData: { token?: string }) => {
        try {
          const { token } = userData || {};
          
          // 检查是否提供了令牌
          if (!token) {
            socket.emit('auth_error', { message: '未提供认证令牌，请先登录' });
            return;
          }
          
          // 验证用户Token
          const authData = await authService.verifyToken(token);
          
          if (!authData) {
            socket.emit('auth_error', { message: '认证失败，无效的令牌' });
            return;
          }
          
          const userId = authData.userId;
          const username = authData.username;
          
          // 记录用户信息到socket
          socket.data.user = authData;
          
          // 检查用户是否已经在其他客户端登录
          const onlineUsers = messageController.getOnlineUsers();
          const existingSockets = Array.from(onlineUsers.entries())
            .filter(([_, user]) => user.userId === userId);
          
          // 如果存在其他登录会话，将它们全部踢下线
          if (existingSockets.length > 0) {
            // 通知其他客户端被踢下线
            existingSockets.forEach(([socketId, _]) => {
              socketIO.to(socketId).emit('force_logout', {
                message: '您的账号在其他设备登录，如非本人操作，请立即修改密码！',
                reason: 'account_login_elsewhere'
              });
              
              // 从在线用户列表中移除这些会话
              onlineUsers.delete(socketId);
            });
            
            // 更新在线用户列表
            socketIO.emit('userList', Array.from(onlineUsers.values()).map(user => ({
              userId: user.userId,
              username: user.username,
              joinTime: user.joinTime
            })));
            socketIO.emit('userCount', onlineUsers.size);
            
            // 记录日志
            logger.warn(`用户 ${username}(${userId}) 在新设备登录，已将旧会话踢下线`);
          }
          
          // 存储用户信息
          onlineUsers.set(socket.id, {
            socketId: socket.id,
            userId,
            username,
            joinTime: new Date()
          });
          
          // 发送认证成功消息
          socket.emit('auth_success', { userId, username });
          
          // 广播系统消息
          const welcomeContent = `欢迎加入聊天, ${username}!`;
          const joinContent = `${username} 加入了聊天`;
          
          // 发送欢迎消息给用户
          socket.emit('message', {
            id: Date.now().toString() + '-welcome',
            type: 'system',
            content: welcomeContent,
            time: new Date()
          });
          
          // 广播用户加入消息
          socket.broadcast.emit('message', {
            id: Date.now().toString() + '-join',
            type: 'system',
            content: joinContent,
            time: new Date()
          });
          
          // 更新所有客户端的在线用户列表
          socketIO.emit('userList', Array.from(onlineUsers.values()).map(user => ({
            userId: user.userId,
            username: user.username,
            joinTime: user.joinTime
          })));
          
          // 发送当前在线人数
          socketIO.emit('userCount', onlineUsers.size);
        } catch (error) {
          logger.error(`Token验证错误:`, error);
          socket.emit('auth_error', { message: '认证过程中发生错误，请重试' });
        }
      });
      
      // 处理断开连接
      socket.on('disconnect', () => {
        const onlineUsers = messageController.getOnlineUsers();
        const user = onlineUsers.get(socket.id);
        
        if (user) {
          logger.info(`用户下线: ${user.username} (${user.userId})`);
          
          // 从在线用户列表移除
          onlineUsers.delete(socket.id);
          
          // 广播用户离开消息
          socketIO.emit('message', {
            id: Date.now().toString() + '-leave',
            type: 'system',
            content: `${user.username} 离开了聊天`,
            time: new Date()
          });
          
          // 广播用户下线事件
          socket.broadcast.emit('userLeave', {
            type: 'userLeave',
            userId: user.userId,
            username: user.username,
            time: new Date(),
            count: onlineUsers.size
          });
          
          // 更新在线用户列表
          socketIO.emit('userList', Array.from(onlineUsers.values()).map(user => ({
            userId: user.userId,
            username: user.username,
            joinTime: user.joinTime
          })));
          
          // 更新在线人数
          socketIO.emit('userCount', onlineUsers.size);
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
          
          const { content, type = 'text' } = data || {};
          
          if (!content) {
            socket.emit('error', { message: '消息内容不能为空' });
            return;
          }
          
          // 使用控制器处理保存消息
          const messageCache = messageController.getMessageCache();
          const onlineUsers = messageController.getOnlineUsers();
          
          // 调用messageStore直接保存消息
          const { messageStore } = await import('./models/message');
          const savedMessage = await messageStore.saveMessage(
            user.userId, 
            user.username, 
            content
          );
          
          // 创建广播消息
          const broadcastMessage = {
            id: savedMessage.id,
            senderId: user.userId,
            sender: user.username,
            content: savedMessage.content,
            type: type || 'text',
            time: savedMessage.timestamp
          };
          
          // 缓存消息
          messageCache.push(broadcastMessage);
          if (messageCache.length > 100) {
            messageCache.shift(); // 保持缓存不超过100条
          }
          
          // 广播消息给所有客户端
          socketIO.emit('message', broadcastMessage);
        } catch (error) {
          logger.error('处理聊天消息失败:', error);
          socket.emit('error', { message: '发送消息失败' });
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
          
          const { content, receiverId } = data || {};
          
          if (!content) {
            socket.emit('error', { message: '消息内容不能为空' });
            return;
          }
          
          if (!receiverId) {
            socket.emit('error', { message: '接收者ID不能为空' });
            return;
          }
          
          // 查找目标用户
          const { query } = await import('./utils/initDatabase');
          const targetUserResponse = await query('SELECT username FROM users WHERE id = ?', [receiverId]);
          if (!targetUserResponse || targetUserResponse.length === 0) {
            socket.emit('error', { message: '目标用户不存在' });
            return;
          }
          
          const receiverName = targetUserResponse[0].username;
          const onlineUsers = messageController.getOnlineUsers();
          
          // 保存私聊消息到数据库
          const { messageStore } = await import('./models/message');
          const savedMessage = await messageStore.saveMessage(
            user.userId, 
            user.username, 
            content, 
            'private', 
            receiverId, 
            receiverName
          );
          
          // 创建私聊消息
          const privateMessage = {
            id: savedMessage.id,
            senderId: user.userId,
            sender: user.username,
            receiverId: savedMessage.receiverId,
            receiver: savedMessage.receiverName,
            content: savedMessage.content,
            type: 'private',
            time: savedMessage.timestamp
          };
          
          // 查找接收者的socket连接
          const receiverSockets = Array.from(onlineUsers.entries())
            .filter(([_, user]) => user.userId === receiverId)
            .map(([socketId, _]) => socketId);
          
          // 向接收者发送私聊消息
          receiverSockets.forEach(socketId => {
            socketIO.to(socketId).emit('privateMessage', privateMessage);
          });
          
          // 向发送者的socket发送私聊消息的确认
          socket.emit('privateMessage', privateMessage);
        } catch (error) {
          logger.error('处理私聊消息失败:', error);
          socket.emit('error', { message: '发送私聊消息失败' });
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