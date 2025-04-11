import jwt from 'jsonwebtoken';
import { User, userStore } from '../models/user';
import { ensureJwtSecret } from '../utils/keyGenerator';

// 确保JWT密钥已生成
ensureJwtSecret();

// 默认的token有效期
const TOKEN_EXPIRES_IN = process.env.TOKEN_EXPIRES_IN || '24h';

export interface AuthTokenPayload {
  userId: string;
  username: string;
}

export interface TokenResponse {
  token: string;
  expiresIn: string;
  userId: string;
  username: string;
  success: boolean;
  error?: string;
}

/**
 * 认证服务类
 */
export class AuthService {
  /**
   * 生成JWT Token
   */
  generateToken(user: User): TokenResponse {
    const payload: AuthTokenPayload = {
      userId: user.id,
      username: user.username
    };

    // 使用自动生成的JWT密钥
    const token = (jwt as any).sign(payload, process.env.JWT_SECRET, {
      expiresIn: TOKEN_EXPIRES_IN
    });

    return {
      token,
      expiresIn: TOKEN_EXPIRES_IN,
      userId: user.id,
      username: user.username,
      success: true
    };
  }

  /**
   * 验证JWT Token
   */
  async verifyToken(token: string): Promise<AuthTokenPayload | null> {
    try {
      if (!token || token.trim() === '') {
        console.log('提供的Token为空');
        return null;
      }
      
      // 检查JWT密钥是否存在
      if (!process.env.JWT_SECRET) {
        console.error('JWT密钥未设置，无法验证Token');
        throw new Error('JWT密钥未配置');
      }
      
      // 使用自动生成的JWT密钥
      const decoded = (jwt as any).verify(token, process.env.JWT_SECRET) as AuthTokenPayload;
      return decoded;
    } catch (error) {
      console.error('Token验证失败:', error);
      return null;
    }
  }

  /**
   * 注册新用户
   */
  async register(username: string, password: string): Promise<TokenResponse> {
    try {
      // 检查用户名是否已存在
      const existingUser = await userStore.findByUsername(username);
      if (existingUser) {
        return {
          token: '',
          expiresIn: '',
          userId: '',
          username: '',
          success: false,
          error: '用户名已存在'
        };
      }

      // 创建用户
      const user = await userStore.createUser(username, password);
      
      // 检查用户是否创建成功
      if (!user) {
        return {
          token: '',
          expiresIn: '',
          userId: '',
          username: '',
          success: false,
          error: '用户创建失败'
        };
      }
      
      // 生成Token
      return this.generateToken(user);
    } catch (error) {
      console.error('用户注册失败:', error);
      return {
        token: '',
        expiresIn: '',
        userId: '',
        username: '',
        success: false,
        error: '注册过程中发生错误'
      };
    }
  }

  /**
   * 用户登录
   */
  async login(username: string, password: string): Promise<TokenResponse> {
    try {
      // 验证用户凭据
      const user = await userStore.validateUser(username, password);
      
      if (!user) {
        return {
          token: '',
          expiresIn: '',
          userId: '',
          username: '',
          success: false,
          error: '用户名或密码错误'
        };
      }
      
      // 生成Token
      return this.generateToken(user);
    } catch (error) {
      console.error('用户登录失败:', error);
      return {
        token: '',
        expiresIn: '',
        userId: '',
        username: '',
        success: false,
        error: '登录过程中发生错误'
      };
    }
  }
}

// 单例模式
export const authService = new AuthService(); 