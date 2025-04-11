const fetch = require('node-fetch');

const API_URL = 'http://localhost:3000';

async function testJWTAuth() {
  console.log('测试JWT认证 - WinUC聊天服务');
  console.log('================================');

  try {
    // 1. 注册新用户
    console.log('\n1. 注册新用户');
    const registerResponse = await fetch(`${API_URL}/api/users/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'testuser',
        password: 'password123'
      })
    });

    const registerData = await registerResponse.json();
    console.log('状态码:', registerResponse.status);
    console.log('响应数据:', registerData);

    let token = '';
    if (registerData.token) {
      token = registerData.token;
      console.log('获取到token:', token);
    } else {
      // 如果注册失败（可能用户已存在），尝试登录
      console.log('\n2. 登录已有用户');
      const loginResponse = await fetch(`${API_URL}/api/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: 'testuser',
          password: 'password123'
        })
      });

      const loginData = await loginResponse.json();
      console.log('状态码:', loginResponse.status);
      console.log('响应数据:', loginData);

      if (loginData.token) {
        token = loginData.token;
        console.log('获取到token:', token);
      } else {
        throw new Error('无法获取token');
      }
    }

    // 3. 获取当前用户信息
    console.log('\n3. 获取当前用户信息');
    const userResponse = await fetch(`${API_URL}/api/users/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const userData = await userResponse.json();
    console.log('状态码:', userResponse.status);
    console.log('响应数据:', userData);

    // 4. 发送消息
    console.log('\n4. 发送消息');
    const messageResponse = await fetch(`${API_URL}/api/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        content: '这是一条测试消息',
        type: 'text'
      })
    });

    const messageData = await messageResponse.json();
    console.log('状态码:', messageResponse.status);
    console.log('响应数据:', messageData);

    // 5. 测试未授权访问
    console.log('\n5. 测试未授权访问');
    const unauthorizedResponse = await fetch(`${API_URL}/api/users/me`, {
      method: 'GET'
    });

    const unauthorizedData = await unauthorizedResponse.json();
    console.log('状态码:', unauthorizedResponse.status);
    console.log('响应数据:', unauthorizedData);

    console.log('\n================================');
    console.log('测试完成!');

  } catch (error) {
    console.error('测试过程中发生错误:', error);
  }
}

testJWTAuth(); 