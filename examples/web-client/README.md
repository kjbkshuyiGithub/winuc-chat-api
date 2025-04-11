# WinUC Chat Web客户端示例

这是一个使用HTML、CSS和JavaScript开发的简单Web客户端，演示如何使用JWT认证连接到WinUC Chat API服务。

## 功能特性

- 用户注册和登录
- JWT身份验证
- 实时消息接收和发送
- 在线用户列表
- 消息历史记录加载

## 使用方法

1. 确保WinUC Chat API服务器已启动并运行在 http://localhost:3000

2. 打开客户端

   有两种方式可以运行客户端：

   **方式一：使用本地Web服务器**
   
   ```bash
   # 使用Node.js的http-server（需要先安装）
   npm install -g http-server
   cd examples/web-client
   http-server
   ```
   
   然后在浏览器中访问 http://localhost:8080
   
   **方式二：直接打开HTML文件**
   
   直接在浏览器中打开 `index.html` 文件即可使用。

## 实现细节

- **用户认证**：使用JWT令牌实现身份验证，令牌存储在localStorage中
- **WebSocket连接**：使用Socket.IO客户端库，通过JWT令牌进行身份验证
- **响应式设计**：使用Flexbox布局，适应不同屏幕尺寸

## 示例代码片段

### JWT认证连接

```javascript
// 连接到聊天服务器
function connectToChat() {
  if (!token) return;
  
  // 创建Socket.IO连接，传递JWT令牌
  socket = io(API_URL, {
    auth: {
      token: token
    }
  });
  
  // 连接事件处理...
}
```

### 发送消息

```javascript
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
```

## 自定义配置

如果需要连接到其他服务器，请修改 `chat-client.js` 文件中的 `API_URL` 变量：

```javascript
// 修改为您的服务器地址
const API_URL = 'http://your-server-address:3000';
``` 