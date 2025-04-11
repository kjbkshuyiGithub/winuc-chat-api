# Python 聊天客户端接入指南

本文档提供了使用Python语言接入聊天服务的详细指南，支持Windows和macOS系统。

## 开发环境准备

### Windows环境

1. **安装Python**
   - 下载并安装最新版Python (3.8+): [Python官网](https://www.python.org/downloads/windows/)
   - 安装时勾选"Add Python to PATH"选项

2. **安装依赖包**
   ```bash
   pip install websocket-client requests python-socketio
   ```

### macOS环境

1. **安装Python**
   ```bash
   # 如果没有安装Homebrew
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   
   # 使用Homebrew安装Python
   brew install python
   ```

2. **安装依赖包**
   ```bash
   pip3 install websocket-client requests python-socketio
   ```

## Python聊天客户端实现

### 1. 项目结构

```
python-chat-client/
├── chat_client.py
├── rest_api.py
└── main.py
```

### 2. REST API客户端 (rest_api.py)

```python
import requests
import json
from typing import Dict, List, Any, Optional

class ChatRestAPI:
    """聊天服务REST API客户端"""
    
    def __init__(self, base_url: str = "http://localhost:3000/api"):
        """初始化REST API客户端
        
        Args:
            base_url: API基础URL
        """
        self.base_url = base_url
        self.headers = {
            "Content-Type": "application/json"
        }
    
    def get_users(self) -> Dict[str, Any]:
        """获取在线用户列表
        
        Returns:
            包含用户列表的字典
        """
        try:
            response = requests.get(f"{self.base_url}/users", headers=self.headers)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"获取用户列表失败: {e}")
            return {"count": 0, "users": []}
    
    def get_messages(self, limit: int = 50, offset: int = 0) -> Dict[str, Any]:
        """获取消息历史
        
        Args:
            limit: 每页消息数量
            offset: 起始位置偏移量
            
        Returns:
            包含消息列表的字典
        """
        try:
            params = {
                "limit": limit,
                "offset": offset
            }
            response = requests.get(
                f"{self.base_url}/messages", 
                params=params,
                headers=self.headers
            )
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"获取消息历史失败: {e}")
            return {"total": 0, "messages": []}
    
    def send_message(self, user_id: str, username: str, content: str, message_type: str = "text") -> Dict[str, Any]:
        """发送聊天消息
        
        Args:
            user_id: 用户ID
            username: 用户名
            content: 消息内容
            message_type: 消息类型
            
        Returns:
            服务器响应
        """
        try:
            data = {
                "userId": user_id,
                "username": username,
                "content": content,
                "type": message_type
            }
            response = requests.post(
                f"{self.base_url}/messages",
                headers=self.headers,
                json=data
            )
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"发送消息失败: {e}")
            return {"success": False}
    
    def send_broadcast(self, content: str) -> Dict[str, Any]:
        """发送系统广播
        
        Args:
            content: 广播内容
            
        Returns:
            服务器响应
        """
        try:
            data = {
                "content": content
            }
            response = requests.post(
                f"{self.base_url}/broadcast",
                headers=self.headers,
                json=data
            )
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"发送广播失败: {e}")
            return {"success": False}
```

### 3. WebSocket客户端 (chat_client.py)

```python
import socketio
import json
import time
import threading
from typing import Callable, Dict, Any, Optional

class ChatClient:
    """聊天WebSocket客户端"""
    
    def __init__(self, server_url: str = "http://localhost:3000"):
        """初始化聊天客户端
        
        Args:
            server_url: 服务器URL
        """
        self.server_url = server_url
        self.sio = socketio.Client()
        self.connected = False
        self.user_id = ""
        self.username = ""
        
        # 注册事件处理器
        self.sio.on("connect", self._on_connect)
        self.sio.on("disconnect", self._on_disconnect)
        self.sio.on("message", self._on_message)
        self.sio.on("userList", self._on_user_list)
        self.sio.on("userCount", self._on_user_count)
        self.sio.on("pong", self._on_pong)
        
        # 回调函数
        self.message_callback = None
        self.user_list_callback = None
        self.user_count_callback = None
        
        # 心跳线程
        self.heartbeat_thread = None
        self.running = False
    
    def connect(self) -> bool:
        """连接到聊天服务器
        
        Returns:
            连接是否成功
        """
        try:
            self.sio.connect(self.server_url)
            self.connected = True
            self.running = True
            
            # 启动心跳
            self._start_heartbeat()
            return True
        except Exception as e:
            print(f"连接服务器失败: {e}")
            return False
    
    def join(self, user_id: str, username: str) -> bool:
        """加入聊天
        
        Args:
            user_id: 用户ID
            username: 用户名
            
        Returns:
            是否成功加入
        """
        if not self.connected:
            print("未连接到服务器")
            return False
        
        self.user_id = user_id
        self.username = username
        
        try:
            self.sio.emit("join", {"userId": user_id, "username": username})
            return True
        except Exception as e:
            print(f"加入聊天失败: {e}")
            return False
    
    def send_message(self, content: str, message_type: str = "text") -> bool:
        """发送消息
        
        Args:
            content: 消息内容
            message_type: 消息类型
            
        Returns:
            是否成功发送
        """
        if not self.connected:
            print("未连接到服务器")
            return False
        
        try:
            self.sio.emit("message", {"content": content, "type": message_type})
            return True
        except Exception as e:
            print(f"发送消息失败: {e}")
            return False
    
    def close(self):
        """关闭连接"""
        self.running = False
        if self.connected:
            try:
                self.sio.disconnect()
            except Exception as e:
                print(f"断开连接失败: {e}")
        self.connected = False
    
    def set_message_callback(self, callback: Callable[[Dict[str, Any]], None]):
        """设置消息回调函数
        
        Args:
            callback: 回调函数，接收消息字典
        """
        self.message_callback = callback
    
    def set_user_list_callback(self, callback: Callable[[list], None]):
        """设置用户列表回调函数
        
        Args:
            callback: 回调函数，接收用户列表
        """
        self.user_list_callback = callback
    
    def set_user_count_callback(self, callback: Callable[[int], None]):
        """设置用户数量回调函数
        
        Args:
            callback: 回调函数，接收用户数量
        """
        self.user_count_callback = callback
    
    def _on_connect(self):
        """连接建立时的回调"""
        print("已连接到服务器")
        self.connected = True
    
    def _on_disconnect(self):
        """连接断开时的回调"""
        print("已断开连接")
        self.connected = False
        self.running = False
    
    def _on_message(self, data):
        """收到消息时的回调
        
        Args:
            data: 消息数据
        """
        if self.message_callback:
            self.message_callback(data)
    
    def _on_user_list(self, data):
        """收到用户列表更新时的回调
        
        Args:
            data: 用户列表数据
        """
        if self.user_list_callback:
            self.user_list_callback(data)
    
    def _on_user_count(self, count):
        """收到用户数量更新时的回调
        
        Args:
            count: 用户数量
        """
        if self.user_count_callback:
            self.user_count_callback(count)
    
    def _on_pong(self):
        """收到心跳响应时的回调"""
        pass
    
    def _start_heartbeat(self):
        """开始心跳检测"""
        def heartbeat_loop():
            while self.running:
                try:
                    if self.connected:
                        self.sio.emit("ping")
                    time.sleep(30)  # 每30秒发送一次心跳
                except Exception as e:
                    print(f"心跳发送失败: {e}")
                    if not self.connected:
                        break
        
        self.heartbeat_thread = threading.Thread(target=heartbeat_loop)
        self.heartbeat_thread.daemon = True
        self.heartbeat_thread.start()
```

### 4. 主程序 (main.py)

```python
import time
import datetime
import uuid
import sys
from chat_client import ChatClient
from rest_api import ChatRestAPI

def format_time(time_str):
    """格式化时间字符串"""
    try:
        dt = datetime.datetime.fromisoformat(time_str.replace('Z', '+00:00'))
        return dt.strftime('%H:%M:%S')
    except Exception:
        return time_str

def print_message(message):
    """打印消息"""
    try:
        msg_type = message.get('type', 'text')
        time_str = format_time(message.get('time', ''))
        
        if msg_type == 'system':
            print(f"[系统] {message['content']} ({time_str})")
        else:
            sender = message.get('sender', '未知用户')
            print(f"[{sender}] {message['content']} ({time_str})")
    except Exception as e:
        print(f"处理消息失败: {e}")

def main():
    """主函数"""
    print("Python 聊天客户端示例")
    print("====================")
    
    server_url = "http://localhost:3000"
    api_url = "http://localhost:3000/api"
    
    # 创建REST API客户端
    api = ChatRestAPI(api_url)
    
    # 获取用户信息
    user_id = f"py_user_{int(time.time())}"
    username = input("请输入您的用户名: ").strip()
    
    if not username:
        username = "Python用户"
    
    # 创建WebSocket客户端
    client = ChatClient(server_url)
    
    # 设置消息回调
    client.set_message_callback(print_message)
    
    # 设置用户列表回调
    def on_user_list(users):
        print("在线用户:")
        for user in users:
            if user.get('userId') == user_id:
                print(f"- {user['username']} (我)")
            else:
                print(f"- {user['username']}")
    
    client.set_user_list_callback(on_user_list)
    
    # 设置用户数量回调
    def on_user_count(count):
        print(f"当前在线人数: {count}")
    
    client.set_user_count_callback(on_user_count)
    
    # 连接到服务器
    if not client.connect():
        print("无法连接到服务器!")
        return
    
    # 加入聊天
    if not client.join(user_id, username):
        print("加入聊天失败!")
        client.close()
        return
    
    # 获取消息历史
    print("获取历史消息...")
    history = api.get_messages(10, 0)
    
    if history and 'messages' in history:
        print("最近消息:")
        for msg in history['messages']:
            print_message(msg)
    
    print("\n开始聊天 (输入 'quit' 退出):")
    try:
        while True:
            message = input()
            
            if message.lower() == 'quit':
                break
            
            if message:
                client.send_message(message)
    except KeyboardInterrupt:
        print("\n退出中...")
    finally:
        client.close()
        print("已断开连接")

if __name__ == "__main__":
    main()
```

## 使用方法

### 运行Python聊天客户端

1. 将上述三个文件保存到相同目录中
2. 打开命令行或终端，导航到文件所在目录
3. 运行主程序

```bash
# Windows
python main.py

# macOS/Linux
python3 main.py
```

### 功能说明

1. **连接服务器**：客户端将自动连接到聊天服务器
2. **加入聊天**：输入用户名后加入聊天室
3. **接收历史消息**：显示最近的10条历史消息
4. **发送消息**：在命令行中输入消息并按回车发送
5. **接收实时消息**：实时显示其他用户发送的消息和系统通知
6. **退出**：输入'quit'退出聊天

## 扩展示例

### 1. 使用GUI界面的聊天客户端 (使用Tkinter)

```python
import tkinter as tk
from tkinter import scrolledtext, simpledialog
import threading
import time
from chat_client import ChatClient
from rest_api import ChatRestAPI

class ChatGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Python聊天客户端")
        self.root.geometry("800x600")
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
        
        # 创建聊天客户端
        self.server_url = "http://localhost:3000"
        self.api_url = "http://localhost:3000/api"
        self.client = ChatClient(self.server_url)
        self.api = ChatRestAPI(self.api_url)
        
        # 用户信息
        self.user_id = f"py_gui_{int(time.time())}"
        
        # 创建界面
        self.create_widgets()
        
        # 设置回调
        self.client.set_message_callback(self.on_message)
        self.client.set_user_list_callback(self.on_user_list)
        self.client.set_user_count_callback(self.on_user_count)
        
        # 请求用户名
        self.username = simpledialog.askstring("用户名", "请输入您的用户名:", parent=self.root)
        if not self.username:
            self.username = "GUI用户"
        
        # 连接到服务器
        self.connect_thread = threading.Thread(target=self.connect_and_join)
        self.connect_thread.daemon = True
        self.connect_thread.start()
    
    def create_widgets(self):
        # 创建分割窗口
        self.paned_window = tk.PanedWindow(self.root, orient=tk.HORIZONTAL)
        self.paned_window.pack(fill=tk.BOTH, expand=True)
        
        # 创建消息区域框架
        self.message_frame = tk.Frame(self.paned_window)
        self.paned_window.add(self.message_frame, weight=3)
        
        # 创建用户列表框架
        self.user_frame = tk.Frame(self.paned_window)
        self.paned_window.add(self.user_frame, weight=1)
        
        # 消息显示区域
        self.message_area = scrolledtext.ScrolledText(self.message_frame, wrap=tk.WORD)
        self.message_area.pack(fill=tk.BOTH, expand=True)
        self.message_area.config(state=tk.DISABLED)
        
        # 输入区域
        self.input_frame = tk.Frame(self.message_frame)
        self.input_frame.pack(fill=tk.X, pady=5)
        
        self.message_entry = tk.Entry(self.input_frame)
        self.message_entry.pack(side=tk.LEFT, fill=tk.X, expand=True)
        self.message_entry.bind("<Return>", self.send_message)
        
        self.send_button = tk.Button(self.input_frame, text="发送", command=self.send_message)
        self.send_button.pack(side=tk.RIGHT, padx=5)
        
        # 用户列表区域
        self.user_label = tk.Label(self.user_frame, text="在线用户 (0)")
        self.user_label.pack(fill=tk.X, pady=5)
        
        self.user_listbox = tk.Listbox(self.user_frame)
        self.user_listbox.pack(fill=tk.BOTH, expand=True)
    
    def connect_and_join(self):
        # 连接到服务器
        if not self.client.connect():
            self.add_message("[系统] 无法连接到服务器")
            return
        
        # 加入聊天
        if not self.client.join(self.user_id, self.username):
            self.add_message("[系统] 加入聊天失败")
            self.client.close()
            return
        
        # 获取消息历史
        self.add_message("[系统] 获取历史消息...")
        history = self.api.get_messages(10, 0)
        
        if history and 'messages' in history:
            self.add_message("[系统] 最近消息:")
            for msg in history['messages']:
                self.on_message(msg)
    
    def add_message(self, message):
        self.message_area.config(state=tk.NORMAL)
        self.message_area.insert(tk.END, message + "\n")
        self.message_area.see(tk.END)
        self.message_area.config(state=tk.DISABLED)
    
    def send_message(self, event=None):
        message = self.message_entry.get().strip()
        if message:
            self.client.send_message(message)
            self.message_entry.delete(0, tk.END)
    
    def on_message(self, message):
        try:
            msg_type = message.get('type', 'text')
            
            if 'time' in message:
                time_str = format_time(message['time'])
            else:
                time_str = time.strftime('%H:%M:%S')
            
            if msg_type == 'system':
                self.add_message(f"[系统] {message['content']} ({time_str})")
            else:
                sender = message.get('sender', '未知用户')
                if message.get('senderId') == self.user_id:
                    sender += " (我)"
                self.add_message(f"[{sender}] {message['content']} ({time_str})")
        except Exception as e:
            self.add_message(f"[错误] 处理消息失败: {e}")
    
    def on_user_list(self, users):
        self.user_listbox.delete(0, tk.END)
        for user in users:
            display_name = user['username']
            if user.get('userId') == self.user_id:
                display_name += " (我)"
            self.user_listbox.insert(tk.END, display_name)
    
    def on_user_count(self, count):
        self.user_label.config(text=f"在线用户 ({count})")
    
    def on_closing(self):
        self.client.close()
        self.root.destroy()

def format_time(time_str):
    try:
        dt = datetime.datetime.fromisoformat(time_str.replace('Z', '+00:00'))
        return dt.strftime('%H:%M:%S')
    except Exception:
        return time.strftime('%H:%M:%S')

# 主程序
if __name__ == "__main__":
    root = tk.Tk()
    app = ChatGUI(root)
    root.mainloop()
```

### 2. 机器人客户端示例

```python
import time
import random
from chat_client import ChatClient
from rest_api import ChatRestAPI

# 机器人响应列表
RESPONSES = [
    "你好！",
    "很高兴认识你！",
    "今天天气真不错！",
    "有什么我可以帮助你的吗？",
    "我是一个简单的聊天机器人。",
    "请告诉我更多关于你自己的事情。",
    "这个聊天室真热闹啊！"
]

def main():
    server_url = "http://localhost:3000"
    api_url = "http://localhost:3000/api"
    
    # 创建REST API客户端
    api = ChatRestAPI(api_url)
    
    # 获取机器人信息
    bot_id = f"chatbot_{int(time.time())}"
    bot_name = "聊天机器人"
    
    # 创建WebSocket客户端
    client = ChatClient(server_url)
    
    # 自动回复逻辑
    def auto_reply(message):
        # 如果是文本消息且不是自己发的
        if (message.get('type') == 'text' and 
            message.get('senderId') != bot_id and
            '机器人' in message.get('content', '').lower()):
            
            # 随机等待1-3秒，模拟打字
            time.sleep(random.uniform(1, 3))
            
            # 随机回复
            response = random.choice(RESPONSES)
            client.send_message(response)
    
    # 设置消息回调
    client.set_message_callback(auto_reply)
    
    # 连接到服务器
    if not client.connect():
        print("无法连接到服务器!")
        return
    
    # 加入聊天
    if not client.join(bot_id, bot_name):
        print("加入聊天失败!")
        client.close()
        return
    
    # 发送问候消息
    client.send_message("大家好！我是聊天机器人，@我可以跟我聊天哦！")
    
    print(f"机器人 {bot_name} 已启动...")
    
    try:
        # 保持程序运行
        while True:
            time.sleep(60)
            # 每分钟发送一次状态消息
            print("机器人运行中...")
    except KeyboardInterrupt:
        print("\n退出中...")
    finally:
        client.send_message("机器人下线了，下次再见！")
        client.close()
        print("已断开连接")

if __name__ == "__main__":
    main()
```

## 故障排除

### 连接问题

1. **无法连接到服务器**
   - 检查服务器地址和端口是否正确
   - 确认聊天服务器是否正在运行
   - 检查防火墙设置

2. **WebSocket连接断开**
   - 检查网络连接稳定性
   - 验证心跳机制是否正常工作
   - 增加自动重连机制

### 安装问题

1. **依赖包安装失败**
   
   Windows:
   ```bash
   # 使用国内镜像
   pip install -i https://pypi.tuna.tsinghua.edu.cn/simple websocket-client requests python-socketio
   
   # 或尝试升级pip
   python -m pip install --upgrade pip
   ```
   
   macOS:
   ```bash
   # 使用国内镜像
   pip3 install -i https://pypi.tuna.tsinghua.edu.cn/simple websocket-client requests python-socketio
   ```

2. **Python版本兼容性**
   - 建议使用Python 3.7+版本
   - 如果使用较旧版本，可能需要安装额外的兼容库

### 消息处理问题

1. **消息未显示**
   - 检查回调函数是否正确设置
   - 打印原始消息数据进行调试
   - 验证JSON解析是否正确

2. **无法发送消息**
   - 确认已成功连接到服务器
   - 检查网络连接
   - 验证消息格式是否正确 