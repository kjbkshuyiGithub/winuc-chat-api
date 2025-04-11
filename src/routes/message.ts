import express, { Request, Response, NextFunction } from 'express';
import { authenticateJWT, optionalAuthenticateJWT } from '../middlewares/auth';
import * as messageController from '../controllers/messageController';

const router = express.Router();

// 获取消息历史
router.get('/', optionalAuthenticateJWT, messageController.getMessageHistory);

// 发送消息 - 需要认证
router.post('/', authenticateJWT, messageController.sendMessage);

// 发送系统广播 - 需要认证
router.post('/broadcast', authenticateJWT, messageController.sendBroadcast);

// 获取私聊会话列表
router.get('/private', authenticateJWT, messageController.getPrivateChatSessions);

// 获取与特定用户的私聊消息历史
router.get('/private/:targetUserId', authenticateJWT, messageController.getPrivateMessages);

// 发送私聊消息
router.post('/private', authenticateJWT, messageController.sendPrivateMessage);

export default router; 