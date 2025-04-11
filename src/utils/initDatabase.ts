import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { logger } from './logger';

// 加载环境变量
dotenv.config();

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Qq@2212322123',
  database: process.env.DB_NAME || 'winuc_chat',
  waitForConnections: true,
  connectionLimit: 10,  // 设置合理的连接数上限
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // 添加连接获取和释放的调试日志
  debug: process.env.DB_DEBUG === 'true',
};

// 创建用户表的SQL语句
const CREATE_USERS_TABLE = `
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL,
  last_login DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

// 创建消息表的SQL语句
const CREATE_MESSAGES_TABLE = `
CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(36) PRIMARY KEY,
  userId VARCHAR(36) NOT NULL,
  username VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  type VARCHAR(20) DEFAULT 'text',
  receiverId VARCHAR(36) DEFAULT NULL,
  receiverName VARCHAR(255) DEFAULT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

// 尝试创建数据库
async function tryCreateDatabase(): Promise<boolean> {
  try {
    // 不指定数据库名称的配置
    const rootConfig = {
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    };

    // 创建无数据库名称的连接
    const tempPool = mysql.createPool(rootConfig);
    const connection = await tempPool.getConnection();
    
    // 尝试创建数据库
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database} 
                           CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    
    logger.info(`数据库 ${dbConfig.database} A/已创建或已存在`);
    connection.release();
    await tempPool.end();
    return true;
  } catch (error) {
    logger.error('创建数据库失败:', error);
    return false;
  }
}

// 创建并导出数据库连接池
export const db = mysql.createPool(dbConfig);

// 监听连接事件
db.on('connection', () => {
  logger.debug('新的数据库连接已创建');
});

// 监听获取连接事件
db.on('acquire', (connection: any) => {
  logger.debug('连接 %d 已从池中获取', connection.threadId);
});

// 监听连接释放事件
db.on('release', (connection: any) => {
  logger.debug('连接 %d 已释放回池', connection.threadId);
});

// 监听连接排队事件
db.on('enqueue', () => {
  logger.debug('等待可用连接');
});

// 封装查询函数，确保连接正确释放
export async function query(sql: string, params: any = []): Promise<any> {
  try {
    const [results] = await db.execute(sql, params);
    return results;
  } catch (error) {
    logger.error(`SQL查询错误: ${error}`);
    throw error;
  }
}

// 关闭数据库连接池的函数
export async function closePool(): Promise<void> {
  logger.info('正在关闭数据库连接池...');
  try {
    await db.end();
    logger.info('数据库连接池已成功关闭');
  } catch (error) {
    logger.error('关闭数据库连接池时出错:', error);
    throw error;
  }
}

// 添加进程退出时关闭连接池的处理
process.on('SIGINT', async () => {
  logger.info('接收到SIGINT信号，正在关闭数据库连接...');
  try {
    await closePool();
    process.exit(0);
  } catch (error) {
    logger.error('关闭数据库连接池失败:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  logger.info('接收到SIGTERM信号，正在关闭数据库连接...');
  try {
    await closePool();
    process.exit(0);
  } catch (error) {
    logger.error('关闭数据库连接池失败:', error);
    process.exit(1);
  }
});

// 导出数据库连接池单例
export async function getDbPool(): Promise<mysql.Pool> {
  // 使用已定义的数据库连接池
  return db;
}

// 重置数据库表结构
export async function resetDatabase(): Promise<void> {
  logger.info('重置数据库表...');
  try {
    await query('DROP TABLE IF EXISTS messages');
    await query('DROP TABLE IF EXISTS users');
    logger.info('表已成功删除');
    await initDatabase();
  } catch (error) {
    logger.error('重置数据库时出错:', error);
    throw error;
  }
}

// 初始化数据库函数
export async function initDatabase(): Promise<void> {
  try {
    // 检查环境变量是否设置了重置数据库的标志
    const resetDb = process.env.RESET_DB === 'true';
    
    if (resetDb) {
      logger.info('检测到RESET_DB标志，正在删除现有表...');
      try {
        await query('DROP TABLE IF EXISTS messages');
        await query('DROP TABLE IF EXISTS users');
        logger.info('表已成功删除');
      } catch (error) {
        logger.error('删除表时出错:', error);
        // 继续创建表，即使删除失败
      }
    }

    try {
      // 尝试创建表结构
      logger.info('创建用户表...');
      await query(CREATE_USERS_TABLE);
      
      logger.info('创建消息表...');
      await query(CREATE_MESSAGES_TABLE);
      
      logger.info('数据库表结构初始化完成');
    } catch (error: any) {
      // 如果是"数据库不存在"错误，尝试创建数据库
      if (error.code === 'ER_BAD_DB_ERROR') {
        logger.warn(`数据库 ${dbConfig.database} 不存在，尝试创建...`);
        const created = await tryCreateDatabase();
        if (created) {
          // 尝试重新创建表
          await query(CREATE_USERS_TABLE);
          await query(CREATE_MESSAGES_TABLE);
          logger.info('成功创建数据库和表结构');
        } else {
          throw new Error('无法创建数据库，请手动创建');
        }
      } 
      // 如果是访问被拒绝错误，给出更明确的错误信息
      else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
        logger.error(`数据库访问被拒绝: 用户名或密码不正确。请检查 .env 文件中的 DB_USER 和 DB_PASSWORD 配置。`);
        logger.info(`当前配置: 用户名=${dbConfig.user}, 密码=${dbConfig.password ? '已设置' : '未设置'}`);
        throw new Error('数据库访问被拒绝: 用户名或密码不正确');
      } else {
        // 其他错误
        throw error;
      }
    }
  } catch (error) {
    logger.error('数据库初始化失败:', error);
    throw error;
  }
} 