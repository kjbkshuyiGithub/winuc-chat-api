/**
 * JWT认证功能测试脚本
 * 测试用户注册、登录和获取当前用户信息功能
 */

const http = require('http');
const readline = require('readline');

// 创建命令行交互接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 配置参数
const config = {
  host: 'localhost',
  port: 3000,
  token: null
};

// 测试API函数
function callApi(method, path, data) {
  return new Promise((resolve, reject) => {
    // 请求选项
    const options = {
      hostname: config.host,
      port: config.port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    // 如果有token并且不是登录或注册请求，添加Authorization头
    if (config.token && !path.endsWith('/login') && !path.endsWith('/register')) {
      options.headers['Authorization'] = `Bearer ${config.token}`;
    }

    // 如果有数据发送
    let postData = '';
    if (data) {
      postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    // 创建请求
    const req = http.request(options, (res) => {
      console.log(`状态码: ${res.statusCode}`);
      
      let responseData = '';
      
      // 接收响应数据
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      // 响应结束
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(responseData);
          console.log('响应内容:', JSON.stringify(jsonData, null, 2));
          resolve(jsonData);
        } catch (e) {
          console.log('响应内容:', responseData);
          resolve(responseData);
        }
      });
    });

    // 请求错误
    req.on('error', (error) => {
      console.error('请求错误:', error);
      reject(error);
    });

    // 如果有POST数据，发送它
    if (postData) {
      req.write(postData);
    }
    
    // 结束请求
    req.end();
  });
}

// 用户注册
async function register(username, password) {
  console.log('\n--- 测试用户注册 ---');
  console.log(`注册信息: 用户名=${username}, 密码=${password}`);
  
  try {
    const result = await callApi('POST', '/api/users/register', {
      username,
      password
    });
    
    if (result.token) {
      config.token = result.token;
      console.log('注册成功，已获取令牌');
      return true;
    } else {
      console.log('注册失败，未获取令牌');
      return false;
    }
  } catch (error) {
    console.error('注册请求失败:', error);
    return false;
  }
}

// 用户登录
async function login(username, password) {
  console.log('\n--- 测试用户登录 ---');
  console.log(`登录信息: 用户名=${username}, 密码=${password}`);
  
  try {
    const result = await callApi('POST', '/api/users/login', {
      username,
      password
    });
    
    if (result.token) {
      config.token = result.token;
      console.log('登录成功，已获取令牌');
      return true;
    } else {
      console.log('登录失败，未获取令牌');
      return false;
    }
  } catch (error) {
    console.error('登录请求失败:', error);
    return false;
  }
}

// 获取当前用户信息
async function getUserInfo() {
  console.log('\n--- 测试获取用户信息 ---');
  
  if (!config.token) {
    console.log('未登录，无法获取用户信息');
    return false;
  }
  
  try {
    await callApi('GET', '/api/users/me');
    return true;
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return false;
  }
}

// 发送测试消息
async function sendMessage(content) {
  console.log('\n--- 测试发送消息 ---');
  
  if (!config.token) {
    console.log('未登录，无法发送消息');
    return false;
  }
  
  try {
    await callApi('POST', '/api/messages', {
      content,
      type: 'text'
    });
    return true;
  } catch (error) {
    console.error('发送消息失败:', error);
    return false;
  }
}

// 测试未授权访问
async function testUnauthorized() {
  console.log('\n--- 测试未授权访问 ---');
  
  // 临时保存token
  const savedToken = config.token;
  // 清除token模拟未授权状态
  config.token = null;
  
  try {
    await callApi('GET', '/api/users/me');
  } catch (error) {
    console.error('请求错误:', error);
  } finally {
    // 恢复token
    config.token = savedToken;
  }
}

// 主测试函数
async function runTest() {
  console.log('====================================');
  console.log('JWT认证功能测试');
  console.log('====================================');
  
  // 用户输入账号信息
  const username = await new Promise(resolve => {
    rl.question('请输入测试用户名 (默认: testuser): ', (answer) => {
      resolve(answer || 'testuser');
    });
  });
  
  const password = await new Promise(resolve => {
    rl.question('请输入测试密码 (默认: password123): ', (answer) => {
      resolve(answer || 'password123');
    });
  });
  
  // 先尝试注册
  let success = await register(username, password);
  
  // 如果注册失败(可能是用户已存在)，尝试登录
  if (!success) {
    success = await login(username, password);
  }
  
  // 如果登录成功，继续测试其他功能
  if (success) {
    // 获取用户信息
    await getUserInfo();
    
    // 发送测试消息
    await sendMessage('这是一条测试消息，来自JWT认证测试');
    
    // 测试未授权访问
    await testUnauthorized();
  }
  
  console.log('\n====================================');
  console.log('测试完成');
  console.log('====================================');
  
  rl.close();
}

// 运行测试
runTest().catch(error => {
  console.error('测试过程中发生错误:', error);
  rl.close();
}); 