/**
 * 数据库连接测试脚本
 * 用于测试数据库连接和创建表结构
 */

const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// 加载环境变量
dotenv.config();

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'winuc_chat',
  waitForConnections: true,
  connectionLimit: 1,
  queueLimit: 0
};

// 创建用户表的SQL语句
const CREATE_USERS_TABLE = `
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

// 创建消息表的SQL语句
const CREATE_MESSAGES_TABLE = `
CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  username VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

// 打印当前配置
console.log('数据库配置:');
console.log(`- 主机: ${dbConfig.host}`);
console.log(`- 用户: ${dbConfig.user}`);
console.log(`- 密码: ${dbConfig.password ? '已设置' : '未设置'}`);
console.log(`- 数据库: ${dbConfig.database}`);
console.log('-----------------------------------');

async function testConnection() {
  // 不指定数据库的连接配置
  const rootConfig = {
    host: dbConfig.host,
    user: dbConfig.user,
    password: dbConfig.password
  };
  
  try {
    console.log('1. 测试基本连接...');
    const tempConnection = await mysql.createConnection(rootConfig);
    console.log('   ✓ 基本连接成功');
    
    // 检查数据库是否存在
    console.log(`2. 检查数据库 ${dbConfig.database} 是否存在...`);
    const [databases] = await tempConnection.query(`SHOW DATABASES LIKE '${dbConfig.database}'`);
    
    if (databases.length === 0) {
      console.log(`   × 数据库 ${dbConfig.database} 不存在`);
      console.log(`   - 尝试创建数据库...`);
      
      await tempConnection.query(
        `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` 
         CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );
      console.log(`   ✓ 数据库 ${dbConfig.database} 创建成功`);
    } else {
      console.log(`   ✓ 数据库 ${dbConfig.database} 已存在`);
    }
    
    await tempConnection.end();
    
    // 连接到指定数据库
    console.log('3. 连接到指定数据库...');
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database
    });
    console.log(`   ✓ 成功连接到数据库 ${dbConfig.database}`);
    
    // 创建表
    console.log('4. 创建用户表...');
    await connection.query(CREATE_USERS_TABLE);
    console.log('   ✓ 用户表创建成功');
    
    console.log('5. 创建消息表...');
    await connection.query(CREATE_MESSAGES_TABLE);
    console.log('   ✓ 消息表创建成功');
    
    // 检查表是否存在
    console.log('6. 验证表是否存在...');
    const [tables] = await connection.query('SHOW TABLES');
    console.log('   现有表:');
    tables.forEach(table => {
      const tableName = table[`Tables_in_${dbConfig.database}`];
      console.log(`   - ${tableName}`);
    });
    
    await connection.end();
    console.log('-----------------------------------');
    console.log('✅ 所有测试通过，数据库配置正确！');
    return true;
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    
    // 提供友好的错误提示
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n访问被拒绝: 用户名或密码不正确');
      console.error(`检查.env文件中的 DB_USER 和 DB_PASSWORD 配置`);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n无法连接到MySQL服务器');
      console.error('确保MySQL服务已启动并监听在配置的主机和端口上');
    }
    
    return false;
  }
}

// 执行测试
testConnection()
  .then(success => {
    if (!success) {
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('执行测试过程中发生错误:', error);
    process.exit(1);
  }); 