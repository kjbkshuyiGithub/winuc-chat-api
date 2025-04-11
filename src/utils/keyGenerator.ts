import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { logger } from './logger';

// 加载环境变量
dotenv.config();

/**
 * 生成安全的随机JWT密钥
 * @returns 生成的密钥字符串
 */
function generateJwtSecret(): string {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * 确保.env文件中有JWT_SECRET
 * 如果没有，生成一个并写入.env文件
 */
export async function ensureJwtSecret(): Promise<void> {
  try {
    // 检查是否已有JWT_SECRET环境变量
    if (process.env.JWT_SECRET) {
      logger.info('JWT密钥已存在');
      return;
    }

    // 获取项目根目录的.env文件路径
    const envPath = path.resolve(process.cwd(), '.env');
    let envContent = '';

    // 检查.env文件是否存在
    if (fs.existsSync(envPath)) {
      // 读取现有.env文件内容
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    // 生成新的JWT密钥
    const jwtSecret = generateJwtSecret();
    
    // 检查.env文件中是否已有JWT_SECRET行
    if (envContent.includes('JWT_SECRET=')) {
      // 替换现有的JWT_SECRET行
      envContent = envContent.replace(/JWT_SECRET=.*(\r?\n|$)/g, `JWT_SECRET=${jwtSecret}$1`);
    } else {
      // 添加新的JWT_SECRET行
      envContent += `\nJWT_SECRET=${jwtSecret}\n`;
    }

    // 写入更新后的.env文件
    fs.writeFileSync(envPath, envContent);
    
    // 更新当前进程的环境变量
    process.env.JWT_SECRET = jwtSecret;
    
    logger.info('JWT密钥已生成并保存到.env文件');
  } catch (error) {
    logger.error('JWT密钥生成失败:', error);
    throw error;
  }
} 