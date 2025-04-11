// 导入http模块替代node-fetch
const http = require('http');

// 测试API函数
function testApi(method, path, data) {
  return new Promise((resolve, reject) => {
    // 请求选项
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

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
      
      // 响应数据
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      // 响应结束
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(responseData);
          console.log('响应内容:', jsonData);
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

// 运行测试
async function runTests() {
  console.log('开始API测试');
  console.log('============================');
  
  try {
    // 1. 测试用户注册
    console.log('\n1. 用户注册');
    const registerData = await testApi('POST', '/api/users/register', {
      username: 'testuser2',
      password: 'password123'
    });
    
    // 保存token
    let token = registerData.token;
    
    // 如果注册失败（用户可能已存在），尝试登录
    if (!token) {
      console.log('\n2. 用户登录');
      const loginData = await testApi('POST', '/api/users/login', {
        username: 'testuser2',
        password: 'password123'
      });
      
      token = loginData.token;
    }
    
    if (!token) {
      console.error('无法获取验证令牌，测试终止');
      return;
    }
    
    console.log('\n获取到Token:', token);
    
    // 测试结束
    console.log('\n============================');
    console.log('测试完成!');
    
  } catch (error) {
    console.error('测试出错:', error);
  }
}

// 执行测试
runTests(); 