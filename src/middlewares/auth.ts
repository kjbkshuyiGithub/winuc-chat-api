import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth';

// 扩展Request类型，添加用户信息
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        username: string;
      };
    }
  }
}

/**
 * 验证JWT Token中间件
 */
export const authenticateJWT = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 从请求头中获取Token
    const authHeader = req.headers.authorization;
    
    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        res.status(401).json({ error: 'Authorization格式无效，应为Bearer Token' });
        return;
      }
      
      const token = parts[1];
      
      const user = await authService.verifyToken(token);
      
      if (user) {
        // 如果Token有效，将用户信息添加到请求对象
        req.user = user;
        next();
      } else {
        // Token无效
        res.status(401).json({ error: '无效的访问令牌' });
      }
    } else {
      // 没有提供Token
      res.status(401).json({ error: '需要认证' });
    }
  } catch (error) {
    console.error('JWT认证过程中发生错误:', error);
    res.status(500).json({ error: '认证过程中发生错误' });
  }
};

/**
 * 可选的JWT验证中间件
 * 如果提供了Token则验证，但不提供也不会阻止请求
 */
export const optionalAuthenticateJWT = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 从请求头中获取Token
    const authHeader = req.headers.authorization;
    
    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        const token = parts[1];
        
        const user = await authService.verifyToken(token);
        
        if (user) {
          // 如果Token有效，将用户信息添加到请求对象
          req.user = user;
        }
      }
    }
    
    // 无论Token是否有效，都继续处理请求
    next();
  } catch (error) {
    console.error('可选JWT认证过程中发生错误:', error);
    // 即使发生错误，也继续处理请求
    next();
  }
}; 