/**
 * WinUC Chat API Web客户端示例
 * 这个示例展示如何使用JWT认证连接到聊天服务
 */

// 服务器配置
const API_URL = 'http://localhost:3000';
let token = localStorage.getItem('chat_token');
let socket = null;
let currentUser = null;

// DOM元素
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const chatContainer = document.getElementById('chat-container');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const messagesContainer = document.getElementById('messages');
const onlineUsersContainer = document.getElementById('online-users');
const errorMessage = document.getElementById('error-message');
const userInfoContainer = document.getElementById('user-info');

// 显示错误信息
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = 'block';
  setTimeout(() => {
    errorMessage.style.display = 'none';
  }, 5000);
}

// 用户注册
async function register(username, password) {
  try {
    const response = await fetch(`${API_URL}/api/users/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || '注册失败');
    }
    
    // 保存token
    token = data.token;
    localStorage.setItem('chat_token', token);
    
    // 获取用户信息
    await getUserInfo();
    
    return data;
  } catch (error) {
    showError(error.message);
    throw error;
  }
}

// 用户登录
async function login(username, password) {
  try {
    const response = await fetch(`${API_URL}/api/users/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || '登录失败');
    }
    
    // 保存token
    token = data.token;
    localStorage.setItem('chat_token', token);
    
    // 获取用户信息
    await getUserInfo();
    
    return data;
  } catch (error) {
    showError(error.message);
    throw error;
  }
}

// 获取当前用户信息
async function getUserInfo() {
  try {
    const response = await fetch(`${API_URL}/api/users/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('获取用户信息失败');
    }
    
    const data = await response.json();
    currentUser = data;
    
    // 显示用户信息
    userInfoContainer.innerHTML = `
      <span>当前用户: ${currentUser.username}</span>
      <button id="logout-btn">退出登录</button>
    `;
    
    document.getElementById('logout-btn').addEventListener('click', logout);
    
    return data;
  } catch (error) {
    console.error('获取用户信息失败:', error);
    token = null;
    localStorage.removeItem('chat_token');
    return null;
  }
}

// 退出登录
function logout() {
  token = null;
  currentUser = null;
  localStorage.removeItem('chat_token');
  
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  
  showLoginForm();
}

// 连接到聊天服务器
function connectToChat() {
  if (!token) return;
  
  // 创建Socket.IO连接
  socket = io(API_URL);
  
  // 连接事件处理
  socket.on('connect', () => {
    console.log('已连接到聊天服务器');
    
    // 发送join事件进行认证
    socket.emit('join', { token });
    
    // 加载聊天历史
    loadChatHistory();
  });
  
  // 连接错误处理
  socket.on('connect_error', (error) => {
    console.error('连接失败:', error);
    showError('连接到聊天服务器失败');
    logout();
  });
  
  // 认证成功事件
  socket.on('auth_success', (userData) => {
    console.log('认证成功:', userData);
    // 更新用户信息（如果需要）
    if (userData.userId && userData.username) {
      currentUser = currentUser || {};
      currentUser.id = userData.userId;
      currentUser.username = userData.username;
    }
  });
  
  // 认证错误事件
  socket.on('auth_error', (error) => {
    console.error('认证失败:', error);
    showError(error.message || '认证失败，请重新登录');
    logout();
  });
  
  // 消息事件处理
  socket.on('message', (message) => {
    addMessageToChat(message);
  });
  
  // 在线用户事件处理
  socket.on('userList', (users) => {
    updateOnlineUsers(users);
  });
  
  // 用户数量更新
  socket.on('userCount', (count) => {
    console.log('在线用户数:', count);
    // 更新UI显示用户数量（如果需要）
  });
  
  // 断开连接事件处理
  socket.on('disconnect', () => {
    console.log('已断开连接');
  });
}

// 加载聊天历史
async function loadChatHistory() {
  try {
    const response = await fetch(`${API_URL}/api/messages`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('加载聊天历史失败');
    }
    
    const messages = await response.json();
    
    // 清空消息容器
    messagesContainer.innerHTML = '';
    
    // 按时间顺序添加消息
    messages.reverse().forEach(message => {
      addMessageToChat(message);
    });
  } catch (error) {
    console.error('加载聊天历史失败:', error);
    showError('加载聊天历史失败');
  }
}

// 发送消息
async function sendMessage(content) {
  if (!socket || !content.trim()) return;
  
  try {
    const response = await fetch(`${API_URL}/api/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ content })
    });
    
    if (!response.ok) {
      throw new Error('发送消息失败');
    }
  } catch (error) {
    console.error('发送消息失败:', error);
    showError('发送消息失败');
  }
}

// 在聊天窗口添加消息
function addMessageToChat(message) {
  const messageElement = document.createElement('div');
  messageElement.className = 'message';
  
  // 判断是否是当前用户发送的消息
  if (currentUser && message.userId === currentUser.id) {
    messageElement.classList.add('own-message');
  }
  
  const time = new Date(message.timestamp).toLocaleTimeString();
  
  messageElement.innerHTML = `
    <div class="message-header">
      <span class="username">${message.username}</span>
      <span class="time">${time}</span>
    </div>
    <div class="message-content">${message.content}</div>
  `;
  
  messagesContainer.appendChild(messageElement);
  
  // 滚动到最新消息
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 更新在线用户列表
function updateOnlineUsers(users) {
  onlineUsersContainer.innerHTML = '<h3>在线用户</h3>';
  
  const userList = document.createElement('ul');
  users.forEach(user => {
    const userItem = document.createElement('li');
    userItem.textContent = user.username;
    
    // 标记当前用户
    if (currentUser && user.id === currentUser.id) {
      userItem.classList.add('current-user');
    }
    
    userList.appendChild(userItem);
  });
  
  onlineUsersContainer.appendChild(userList);
}

// 显示聊天界面
function showChatInterface() {
  loginForm.style.display = 'none';
  registerForm.style.display = 'none';
  chatContainer.style.display = 'flex';
  
  // 连接到聊天服务器
  connectToChat();
}

// 显示登录表单
function showLoginForm() {
  loginForm.style.display = 'block';
  registerForm.style.display = 'none';
  chatContainer.style.display = 'none';
}

// 显示注册表单
function showRegisterForm() {
  loginForm.style.display = 'none';
  registerForm.style.display = 'block';
  chatContainer.style.display = 'none';
}

// 页面加载时检查是否已登录
window.addEventListener('DOMContentLoaded', async () => {
  // 如果有token，尝试获取用户信息
  if (token) {
    const user = await getUserInfo();
    if (user) {
      showChatInterface();
    } else {
      showLoginForm();
    }
  } else {
    showLoginForm();
  }
  
  // 登录表单提交事件
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    try {
      await login(username, password);
      showChatInterface();
    } catch (error) {
      console.error('登录失败:', error);
    }
  });
  
  // 注册表单提交事件
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    
    try {
      await register(username, password);
      showChatInterface();
    } catch (error) {
      console.error('注册失败:', error);
    }
  });
  
  // 显示注册表单链接
  document.getElementById('show-register').addEventListener('click', (e) => {
    e.preventDefault();
    showRegisterForm();
  });
  
  // 显示登录表单链接
  document.getElementById('show-login').addEventListener('click', (e) => {
    e.preventDefault();
    showLoginForm();
  });
  
  // 发送消息表单提交事件
  messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const content = messageInput.value;
    
    if (content.trim()) {
      sendMessage(content);
      messageInput.value = '';
    }
  });
}); 