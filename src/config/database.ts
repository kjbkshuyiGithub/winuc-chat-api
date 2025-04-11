import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

// 加载环境变量
dotenv.config();

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'winuc_chat',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// 创建数据库连接池
const pool = mysql.createPool(dbConfig);

// 初始化数据库
export async function initDatabase() {
  try {
    // 检查连接
    const connection = await pool.getConnection();
    console.log('数据库连接成功');
    
    // 检查表是否存在，不存在则创建
    await createTables(connection);
    
    connection.release();
  } catch (error) {
    console.error('数据库初始化失败:', error);
    process.exit(1);
  }
}

// 创建必要的表
async function createTables(connection: mysql.PoolConnection) {
  // 用户表
  await connection.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_login TIMESTAMP NULL
    )
  `);
  
  // 消息表
  await connection.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id VARCHAR(36) PRIMARY KEY,
      sender_id VARCHAR(36) NULL,
      sender VARCHAR(50) NULL,
      content TEXT NOT NULL,
      type VARCHAR(20) NOT NULL DEFAULT 'text',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);
  
  console.log('数据库表创建/验证完成');
}

export default pool; 