import { Request, Response } from 'express';
import { messageStore } from '../models/message';
import { logger } from '../utils/logger';
import { Server } from 'socket.io';
import { query } from '../utils/initDatabase';

// 在线用户列表类型
interface OnlineUser {
  socketId: string;
  userId: string;
  username: string;
  joinTime: Date;
}

// 消息接口
interface ChatMessage {
  id: string;
  senderId?: string;
  sender?: string;
  content: string;
  type: string;
  time: Date;
}

// 保存在内存中的数据
const onlineUsers: Map<string, OnlineUser> = new Map();
const messageCache: ChatMessage[] = [];

// 设置Socket.IO实例
let io: Server;

export const setSocketIO = (socketIoServer: Server) => {
  io = socketIoServer;
};

export const getOnlineUsers = () => onlineUsers;
export const getMessageCache = () => messageCache;

// 获取在线用户列表
export const getOnlineUsersList = (req: Request, res: Response) => {
  res.json({
    count: onlineUsers.size,
    users: Array.from(onlineUsers.values()).map(user => ({
      userId: user.userId,
      username: user.username,
      joinTime: user.joinTime
    }))
  });
};

// 获取消息历史
export const getMessageHistory = async (req: Request, res: Response) => {
  try {
    // 支持简单分页
    const limit = parseInt(req.query.limit as string) || 50;
    
    // 从数据库获取消息历史
    const messages = await messageStore.getRecentMessages(limit);
    
    // 转换为前端需要的格式
    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      senderId: msg.userId,
      sender: msg.username,
      content: msg.content,
      type: 'text',
      time: msg.timestamp
    }));
    
    res.json({
      total: formattedMessages.length,
      messages: formattedMessages
    });
  } catch (error) {
    logger.error('获取消息历史失败:', error);
    res.status(500).json({ error: '获取消息历史失败' });
  }
};

// 获取私聊会话列表
export const getPrivateChatSessions = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    
    // 获取用户的所有私聊会话
    const sessions = await messageStore.getUserChatSessions(userId);
    
    res.json({
      success: true,
      sessions
    });
  } catch (error) {
    logger.error('获取私聊会话列表失败:', error);
    res.status(500).json({ error: '获取私聊会话列表失败' });
  }
};

// 获取与特定用户的私聊消息历史
export const getPrivateMessages = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const targetUserId = req.params.targetUserId;
    
    // 支持简单分页
    const limit = parseInt(req.query.limit as string) || 50;
    
    // 获取两个用户之间的私聊消息
    const messages = await messageStore.getPrivateMessages(userId, targetUserId, limit);
    
    // 转换为前端需要的格式
    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      senderId: msg.userId,
      sender: msg.username,
      receiverId: msg.receiverId,
      receiver: msg.receiverName,
      content: msg.content,
      type: 'private',
      time: msg.timestamp
    }));
    
    res.json({
      total: formattedMessages.length,
      messages: formattedMessages
    });
  } catch (error) {
    logger.error('获取私聊消息历史失败:', error);
    res.status(500).json({ error: '获取私聊消息历史失败' });
  }
};

// 发送消息API
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    const userId = req.user!.userId;
    const username = req.user!.username;
    
    if (!content) {
      res.status(400).json({ error: '消息内容不能为空' });
      return;
    }
    
    // 保存消息到数据库
    const message = await messageStore.saveMessage(userId, username, content);
    
    // 创建用于广播的消息格式
    const broadcastMessage: ChatMessage = {
      id: message.id,
      senderId: message.userId,
      sender: message.username,
      content: message.content,
      type: 'text',
      time: message.timestamp
    };
    
    // 缓存最近的消息用于广播
    messageCache.push(broadcastMessage);
    if (messageCache.length > 100) {
      messageCache.shift(); // 保持缓存不超过100条
    }
    
    // 通过WebSocket广播
    io.emit('message', broadcastMessage);
    
    res.status(201).json({ 
      success: true, 
      message: '消息发送成功',
      messageId: message.id
    });
  } catch (error) {
    logger.error('发送消息失败:', error);
    res.status(500).json({ error: '发送消息失败' });
  }
};

// 发送系统广播
export const sendBroadcast = async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    const userId = req.user!.userId;
    const username = req.user!.username;
    
    if (!content) {
      res.status(400).json({ error: '广播内容不能为空' });
      return;
    }
    
    // 创建系统广播消息
    const broadcastMessage: ChatMessage = {
      id: Date.now().toString(),
      senderId: userId,
      sender: username,
      content: content,
      type: 'system',
      time: new Date()
    };
    
    // 通过WebSocket广播
    io.emit('broadcast', broadcastMessage);
    
    res.status(201).json({ 
      success: true, 
      message: '系统广播发送成功'
    });
  } catch (error) {
    logger.error('发送系统广播失败:', error);
    res.status(500).json({ error: '发送系统广播失败' });
  }
};

// 发送私聊消息
export const sendPrivateMessage = async (req: Request, res: Response) => {
  try {
    const { content, receiverId } = req.body;
    const userId = req.user!.userId;
    const username = req.user!.username;
    
    if (!content) {
      res.status(400).json({ error: '消息内容不能为空' });
      return;
    }
    
    if (!receiverId) {
      res.status(400).json({ error: '接收者ID不能为空' });
      return;
    }
    
    // 获取接收者信息
    try {
      const users = await query('SELECT username FROM users WHERE id = ?', [receiverId]);
      if (!users || users.length === 0) {
        return res.status(404).json({ error: '接收者不存在' });
      }
      
      const receiverName = users[0].username;
      
      // 保存私聊消息到数据库，使用已有的saveMessage方法
      const message = await messageStore.saveMessage(userId, username, content, 'private', receiverId, receiverName);
      
      // 查找接收者的socket连接
      let receiverSocketId: string | null = null;
      for (const [_, user] of onlineUsers.entries()) {
        if (user.userId === receiverId) {
          receiverSocketId = user.socketId;
          break;
        }
      }
      
      // 创建用于发送的消息格式
      const privateMessage = {
        id: message.id,
        senderId: message.userId,
        sender: message.username,
        receiverId: message.receiverId,
        content: message.content,
        type: 'private',
        time: message.timestamp
      };
      
      // 如果接收者在线，就发送私聊消息
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('privateMessage', privateMessage);
      }
      
      // 同时发送给发送者
      for (const [_, user] of onlineUsers.entries()) {
        if (user.userId === userId) {
          io.to(user.socketId).emit('privateMessage', privateMessage);
          break;
        }
      }
      
      res.status(201).json({ 
        success: true, 
        message: '私聊消息发送成功',
        messageId: message.id
      });
    } catch (error) {
      logger.error('获取接收者信息失败:', error);
      res.status(500).json({ error: '发送私聊消息失败' });
    }
  } catch (error) {
    logger.error('发送私聊消息失败:', error);
    res.status(500).json({ error: '发送私聊消息失败' });
  }
}; 