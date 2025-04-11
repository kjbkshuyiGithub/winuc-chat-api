import { v4 as uuidv4 } from 'uuid';
import { query } from '../utils/initDatabase';
import { logger } from '../utils/logger';

// 消息接口定义
export interface Message {
  id: string;
  userId: string;
  username: string;
  content: string;
  timestamp: Date;
  // 新增字段: 消息类型
  type?: 'text' | 'system' | 'private';
  // 新增字段: 私聊接收者ID
  receiverId?: string;
  // 新增字段: 私聊接收者用户名
  receiverName?: string;
}

// 消息存储类
export class MessageStore {
  // 保存消息到数据库
  async saveMessage(userId: string, username: string, content: string, type: string = 'text', receiverId?: string, receiverName?: string): Promise<Message> {
    try {
      const id = uuidv4();
      const timestamp = new Date();
      
      // 特殊处理系统消息，不依赖外键约束
      if (userId === 'system') {
        // 构造一个消息对象，但不保存到数据库
        logger.info(`系统消息已创建: ${id}`);
        
        return {
          id,
          userId,
          username,
          content,
          timestamp,
          type: 'system'
        };
      }
      
      // 构建基本的消息对象
      const message: Message = {
        id,
        userId,
        username,
        content,
        timestamp,
        type: type as any
      };
      
      // 如果是私聊消息，添加接收者信息
      if (type === 'private' && receiverId && receiverName) {
        message.receiverId = receiverId;
        message.receiverName = receiverName;
        
        // 插入私聊消息到数据库
        await query(
          'INSERT INTO messages (id, userId, username, content, created_at, type, receiverId, receiverName) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [id, userId, username, content, timestamp, type, receiverId, receiverName]
        );
        
        logger.info(`私聊消息已保存: ${id}, 发送人: ${username}, 接收人: ${receiverName}`);
      } else {
        // 插入普通用户消息到数据库
        await query(
          'INSERT INTO messages (id, userId, username, content, created_at, type) VALUES (?, ?, ?, ?, ?, ?)',
          [id, userId, username, content, timestamp, type]
        );
        
        logger.info(`消息已保存: ${id}`);
      }
      
      return message;
    } catch (error) {
      logger.error('保存消息失败:', error);
      throw new Error('保存消息失败');
    }
  }
  
  // 获取最近的消息历史
  async getRecentMessages(limit: number = 50): Promise<Message[]> {
    try {
      // 确保limit是整数
      const safeLimit = parseInt(String(limit), 10);
      
      // 使用非参数化的方式执行查询，避免类型错误
      const messages = await query(
        `SELECT id, userId, username, content, created_at FROM messages ORDER BY created_at DESC LIMIT ${safeLimit}`
      );
      
      return messages.map((msg: any) => ({
        id: msg.id,
        userId: msg.userId,
        username: msg.username,
        content: msg.content,
        timestamp: new Date(msg.created_at)
      }));
    } catch (error) {
      logger.error('获取消息历史失败:', error);
      throw new Error('获取消息历史失败');
    }
  }
  
  // 获取指定用户的消息历史
  async getUserMessages(userId: string, limit: number = 50): Promise<Message[]> {
    try {
      // 确保limit是整数
      const safeLimit = parseInt(String(limit), 10);
      
      // 使用非参数化的方式执行userId的查询，避免类型错误
      const messages = await query(
        `SELECT id, userId, username, content, created_at FROM messages WHERE userId = ? ORDER BY created_at DESC LIMIT ${safeLimit}`,
        [userId]
      );
      
      return messages.map((msg: any) => ({
        id: msg.id,
        userId: msg.userId,
        username: msg.username,
        content: msg.content,
        timestamp: new Date(msg.created_at)
      }));
    } catch (error) {
      logger.error(`获取用户(${userId})消息历史失败:`, error);
      throw new Error('获取用户消息历史失败');
    }
  }
  
  // 删除消息
  async deleteMessage(messageId: string, userId: string): Promise<boolean> {
    try {
      // 只允许用户删除自己的消息
      const result = await query(
        'DELETE FROM messages WHERE id = ? AND userId = ?',
        [messageId, userId]
      );
      
      const deleted = (result as any).affectedRows > 0;
      if (deleted) {
        logger.info(`消息已删除: ${messageId}`);
      } else {
        logger.warn(`无法删除消息 ${messageId}: 消息不存在或无权限`);
      }
      
      return deleted;
    } catch (error) {
      logger.error(`删除消息失败 ${messageId}:`, error);
      throw new Error('删除消息失败');
    }
  }
  
  // 获取两个用户之间的私聊消息
  async getPrivateMessages(userId1: string, userId2: string, limit: number = 50): Promise<Message[]> {
    try {
      // 确保limit是整数
      const safeLimit = parseInt(String(limit), 10);
      
      // 查询两个用户之间的私聊消息
      const messages = await query(
        `SELECT id, userId, username, content, created_at, type, receiverId, receiverName 
         FROM messages 
         WHERE type = 'private' AND ((userId = ? AND receiverId = ?) OR (userId = ? AND receiverId = ?)) 
         ORDER BY created_at DESC LIMIT ${safeLimit}`,
        [userId1, userId2, userId2, userId1]
      );
      
      return messages.map((msg: any) => ({
        id: msg.id,
        userId: msg.userId,
        username: msg.username,
        content: msg.content,
        timestamp: new Date(msg.created_at),
        type: msg.type,
        receiverId: msg.receiverId,
        receiverName: msg.receiverName
      }));
    } catch (error) {
      logger.error(`获取私聊消息失败 (${userId1} <-> ${userId2}):`, error);
      throw new Error('获取私聊消息失败');
    }
  }
  
  // 获取用户的所有私聊会话列表
  async getUserChatSessions(userId: string): Promise<Array<{userId: string, username: string, lastMessage: string, lastTime: Date}>> {
    try {
      // 查询用户作为发送者的最近私聊
      const sentSessions = await query(
        `SELECT receiverId AS userId, receiverName AS username, 
                content AS lastMessage, created_at AS lastTime
         FROM messages 
         WHERE type = 'private' AND userId = ?
         GROUP BY receiverId
         ORDER BY MAX(created_at) DESC`,
        [userId]
      );
      
      // 查询用户作为接收者的最近私聊
      const receivedSessions = await query(
        `SELECT userId, username, content AS lastMessage, created_at AS lastTime
         FROM messages 
         WHERE type = 'private' AND receiverId = ?
         GROUP BY userId
         ORDER BY MAX(created_at) DESC`,
        [userId]
      );
      
      // 合并结果并确保没有重复的会话
      const sessionsMap = new Map();
      
      [...sentSessions, ...receivedSessions].forEach(session => {
        const otherUserId = session.userId;
        
        // 如果会话尚未存在或当前会话比已存在的更新，则更新会话
        if (!sessionsMap.has(otherUserId) || 
            new Date(session.lastTime) > new Date(sessionsMap.get(otherUserId).lastTime)) {
          sessionsMap.set(otherUserId, {
            userId: session.userId,
            username: session.username,
            lastMessage: session.lastMessage,
            lastTime: new Date(session.lastTime)
          });
        }
      });
      
      // 转换Map为数组并按最后消息时间排序
      return Array.from(sessionsMap.values())
        .sort((a, b) => b.lastTime.getTime() - a.lastTime.getTime());
    } catch (error) {
      logger.error(`获取用户(${userId})私聊会话列表失败:`, error);
      throw new Error('获取私聊会话列表失败');
    }
  }
}

// 导出单例
export const messageStore = new MessageStore(); 