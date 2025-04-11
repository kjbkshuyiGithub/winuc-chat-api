import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { query } from '../utils/initDatabase';
import { logger } from '../utils/logger';

export interface User {
  id: string;
  username: string;
  password: string;
  created_at: Date;
  last_login?: Date;
}

/**
 * MySQL实现的用户数据存储
 */
export class UserStore {
  /**
   * 创建新用户
   * @param username 用户名
   * @param password 密码（未加密）
   * @returns 创建的用户对象或null
   */
  async createUser(username: string, password: string): Promise<User | null> {
    try {
      // 首先检查用户名是否已存在
      const existingUser = await this.findByUsername(username);
      if (existingUser) {
        return null;
      }

      // 密码加密
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // 创建用户
      const userId = uuidv4();
      const now = new Date();
      
      // 使用新的查询函数
      await query(
        'INSERT INTO users (id, username, password, created_at) VALUES (?, ?, ?, ?)',
        [userId, username, hashedPassword, now]
      );
      
      // 查询创建的用户数据
      const rows = await query(
        'SELECT * FROM users WHERE id = ?',
        [userId]
      );
      
      if (!rows || rows.length === 0) {
        return null;
      }
      
      return this.mapRowToUser(rows[0]);
    } catch (error) {
      logger.error('创建用户失败:', error);
      return null;
    }
  }

  /**
   * 验证用户凭据
   * @param username 用户名
   * @param password 密码（未加密）
   * @returns 验证通过返回用户对象，否则返回null
   */
  async validateUser(username: string, password: string): Promise<User | null> {
    try {
      // 查找用户
      const rows = await query(
        'SELECT * FROM users WHERE username = ?',
        [username]
      );
      
      if (!rows || rows.length === 0) {
        return null;
      }
      
      const user = this.mapRowToUser(rows[0]);
      
      // 验证密码
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return null;
      }
      
      // 更新最后登录时间
      const now = new Date();
      await query(
        'UPDATE users SET last_login = ? WHERE id = ?',
        [now, user.id]
      );
      
      // 更新用户对象中的最后登录时间
      user.last_login = now;
      
      return user;
    } catch (error) {
      logger.error('验证用户失败:', error);
      return null;
    }
  }

  /**
   * 通过ID查找用户
   * @param id 用户ID
   * @returns 找到的用户或undefined
   */
  async findById(id: string): Promise<User | undefined> {
    try {
      const rows = await query(
        'SELECT * FROM users WHERE id = ?', 
        [id]
      );
      
      if (!rows || rows.length === 0) {
        return undefined;
      }
      
      return this.mapRowToUser(rows[0]);
    } catch (error) {
      logger.error('通过ID查找用户失败:', error);
      return undefined;
    }
  }

  /**
   * 通过用户名查找用户
   * @param username 用户名
   * @returns 找到的用户或undefined
   */
  async findByUsername(username: string): Promise<User | undefined> {
    try {
      const rows = await query(
        'SELECT * FROM users WHERE username = ?',
        [username]
      );
      
      if (!rows || rows.length === 0) {
        return undefined;
      }
      
      return this.mapRowToUser(rows[0]);
    } catch (error) {
      logger.error('通过用户名查找用户失败:', error);
      return undefined;
    }
  }

  /**
   * 获取所有用户
   * @returns 用户数组
   */
  async getAllUsers(): Promise<User[]> {
    try {
      const rows = await query('SELECT * FROM users');
      
      if (!rows) {
        return [];
      }
      
      return rows.map(row => this.mapRowToUser(row));
    } catch (error) {
      logger.error('获取所有用户失败:', error);
      return [];
    }
  }
  
  /**
   * 将数据库行转换为用户对象
   * @param row 数据库行
   * @returns 用户对象
   */
  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      username: row.username,
      password: row.password,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
      last_login: row.last_login ? new Date(row.last_login) : undefined
    };
  }
}

// 单例模式
export const userStore = new UserStore(); 