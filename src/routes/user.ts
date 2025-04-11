import express from 'express';
import { authService } from '../services/auth';
import { userStore } from '../models/user';
import { authenticateJWT } from '../middlewares/auth';

const router = express.Router();

/**
 * 用户注册
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      res.status(400).json({ error: '用户名和密码不能为空' });
      return;
    }
    
    // 检查用户名长度
    if (username.length < 3 || username.length > 20) {
      res.status(400).json({ error: '用户名长度必须在3-20个字符之间' });
      return;
    }
    
    // 检查密码长度
    if (password.length < 6) {
      res.status(400).json({ error: '密码长度不能少于6个字符' });
      return;
    }
    
    const result = await authService.register(username, password);
    
    if (result.success) {
      res.status(201).json({ 
        message: '注册成功',
        token: result.token 
      });
    } else {
      res.status(400).json({ error: result.error || '注册失败' });
    }
  } catch (error) {
    console.error('用户注册错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * 用户登录
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      res.status(400).json({ error: '用户名和密码不能为空' });
      return;
    }
    
    const result = await authService.login(username, password);
    
    if (result.success) {
      res.json({ 
        message: '登录成功',
        token: result.token 
      });
    } else {
      res.status(401).json({ error: result.error || '登录失败' });
    }
  } catch (error) {
    console.error('用户登录错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/**
 * 获取当前用户信息
 */
router.get('/me', authenticateJWT, async (req, res) => {
  console.log('处理/me请求，用户ID:', req.user?.userId);
  
  try {
    // authenticateJWT中间件已经验证了Token并添加了用户信息
    const user = await userStore.findById(req.user!.userId);
    
    if (user) {
      res.json({
        id: user.id,
        username: user.username,
        created_at: user.created_at,
        last_login: user.last_login
      });
    } else {
      res.status(404).json({ error: '用户不存在' });
    }
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

export default router; 