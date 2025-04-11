/**
 * MySQL配置检查工具
 * 用于验证MySQL连接配置是否正确
 */

const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// 创建命令行交互接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 从.env文件加载配置
function loadEnvConfig() {
  try {
    const envPath = path.join(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) {
      console.log('未找到.env文件，将使用默认配置');
      return {
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'winuc_chat'
      };
    }
    
    const envContent = fs.readFileSync(envPath, 'utf8');
    const config = {};
    
    // 解析.env文件
    envContent.split('\n').forEach(line => {
      const match = line.match(/^\s*DB_(\w+)\s*=\s*(.*)$/);
      if (match) {
        const key = match[1].toLowerCase();
        const value = match[2].trim();
        config[key] = value;
      }
    });
    
    return {
      host: config.host || 'localhost',
      user: config.user || 'root',
      password: config.password || '',
      database: config.name || 'winuc_chat'
    };
  } catch (error) {
    console.error('读取配置文件失败:', error);
    return null;
  }
}

// 测试MySQL连接
function testConnection(config) {
  return new Promise((resolve, reject) => {
    // 首先尝试不指定数据库名称的连接
    const connection = mysql.createConnection({
      host: config.host,
      user: config.user,
      password: config.password
    });
    
    connection.connect(err => {
      if (err) {
        connection.end();
        reject(err);
        return;
      }
      
      console.log('MySQL连接测试成功');
      
      // 测试数据库是否存在
      connection.query(`SHOW DATABASES LIKE '${config.database}'`, (err, results) => {
        if (err) {
          connection.end();
          reject(err);
          return;
        }
        
        const dbExists = results.length > 0;
        if (dbExists) {
          console.log(`数据库 ${config.database} 已存在`);
        } else {
          console.log(`数据库 ${config.database} 不存在，需要创建`);
        }
        
        connection.end();
        resolve(dbExists);
      });
    });
  });
}

// 创建数据库
function createDatabase(config) {
  return new Promise((resolve, reject) => {
    const connection = mysql.createConnection({
      host: config.host,
      user: config.user,
      password: config.password,
      multipleStatements: false // 确保不使用多语句查询
    });
    
    connection.connect(err => {
      if (err) {
        console.error('连接数据库失败:', err);
        connection.end();
        reject(err);
        return;
      }
      
      const sql = `CREATE DATABASE IF NOT EXISTS \`${config.database}\` 
                  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;
      
      connection.query(sql, (err, results) => {
        if (err) {
          console.error('创建数据库失败:', err);
          connection.end();
          reject(err);
          return;
        }
        
        console.log(`数据库 ${config.database} 创建成功`);
        connection.end();
        resolve(true);
      });
    });
  });
}

// 保存新配置到.env文件
function saveConfig(config) {
  try {
    const envPath = path.join(process.cwd(), '.env');
    let envContent = '';
    
    // 如果.env文件存在，读取内容
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // 更新数据库配置
    const dbVars = {
      DB_HOST: config.host,
      DB_USER: config.user,
      DB_PASSWORD: config.password,
      DB_NAME: config.database
    };
    
    // 替换或添加配置项
    Object.entries(dbVars).forEach(([key, value]) => {
      const regex = new RegExp(`^\\s*${key}\\s*=.*$`, 'm');
      if (envContent.match(regex)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
      }
    });
    
    // 写入文件
    fs.writeFileSync(envPath, envContent);
    console.log('配置已保存到.env文件');
    return true;
  } catch (error) {
    console.error('保存配置失败:', error);
    return false;
  }
}

// 主函数
async function main() {
  console.log('===================================');
  console.log('MySQL配置检查工具');
  console.log('===================================');
  
  // 加载现有配置
  const config = loadEnvConfig();
  console.log('\n当前配置:');
  console.log(`  主机: ${config.host}`);
  console.log(`  用户: ${config.user}`);
  console.log(`  密码: ${config.password ? '已设置' : '未设置'}`);
  console.log(`  数据库: ${config.database}`);
  
  // 询问是否要修改配置
  const shouldModify = await new Promise(resolve => {
    rl.question('\n是否要修改配置? (y/n): ', answer => {
      resolve(answer.toLowerCase() === 'y');
    });
  });
  
  // 如果需要修改配置
  if (shouldModify) {
    config.host = await new Promise(resolve => {
      rl.question(`数据库主机 (${config.host}): `, answer => {
        resolve(answer || config.host);
      });
    });
    
    config.user = await new Promise(resolve => {
      rl.question(`数据库用户 (${config.user}): `, answer => {
        resolve(answer || config.user);
      });
    });
    
    config.password = await new Promise(resolve => {
      rl.question(`数据库密码 (留空表示不修改): `, answer => {
        // 如果没有输入，保持原密码
        resolve(answer === '' ? config.password : answer);
      });
    });
    
    config.database = await new Promise(resolve => {
      rl.question(`数据库名称 (${config.database}): `, answer => {
        resolve(answer || config.database);
      });
    });
    
    // 保存新配置
    saveConfig(config);
  }
  
  console.log('\n测试MySQL连接...');
  
  try {
    // 测试连接
    const dbExists = await testConnection(config);
    
    // 如果数据库不存在，询问是否创建
    if (!dbExists) {
      const shouldCreate = await new Promise(resolve => {
        rl.question(`是否创建数据库 ${config.database}? (y/n): `, answer => {
          resolve(answer.toLowerCase() === 'y');
        });
      });
      
      if (shouldCreate) {
        await createDatabase(config);
      }
    }
    
    console.log('\n数据库配置检查完成');
    console.log('现在可以启动应用了: npm run dev');
  } catch (error) {
    console.error('\n连接测试失败:', error.message);
    console.log('\n可能的解决方案:');
    console.log('1. 确保MySQL服务已启动');
    console.log('2. 检查用户名和密码是否正确');
    console.log('3. 确认用户有足够的权限');
    console.log('4. 如果使用远程数据库，检查防火墙设置');
  }
  
  rl.close();
}

main().catch(error => {
  console.error('发生错误:', error);
  rl.close();
}); 