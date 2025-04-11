# C++ 聊天客户端接入指南

本文档提供了使用C++语言接入聊天服务的详细指南，支持Windows和macOS系统。

## 开发环境准备

### Windows环境

1. **安装Visual Studio**
   - 下载并安装[Visual Studio Community](https://visualstudio.microsoft.com/vs/community/)
   - 安装时选择"使用C++的桌面开发"工作负载

2. **安装vcpkg包管理器**
   ```bash
   git clone https://github.com/Microsoft/vcpkg.git
   cd vcpkg
   bootstrap-vcpkg.bat
   vcpkg integrate install
   ```

3. **安装依赖库**
   ```bash
   vcpkg install nlohmann-json:x64-windows
   vcpkg install cpr:x64-windows
   vcpkg install websocketpp:x64-windows
   vcpkg install asio:x64-windows
   ```

### macOS环境

1. **安装Xcode命令行工具**
   ```bash
   xcode-select --install
   ```

2. **安装Homebrew**
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

3. **安装依赖库**
   ```bash
   brew install nlohmann-json
   brew install cmake
   brew install openssl
   brew install cpr
   ```

4. **安装WebSocket++**
   ```bash
   git clone https://github.com/zaphoyd/websocketpp.git
   cd websocketpp
   mkdir build
   cd build
   cmake ..
   make
   make install
   ```

## C++聊天客户端实现

### 1. 项目结构

```
cpp-chat-client/
├── CMakeLists.txt
├── src/
│   ├── main.cpp
│   ├── chat_client.h
│   ├── chat_client.cpp
│   ├── rest_api.h
│   └── rest_api.cpp
└── build/
```

### 2. CMakeLists.txt

```cmake
cmake_minimum_required(VERSION 3.10)
project(ChatClient VERSION 1.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# 查找依赖库
find_package(nlohmann_json REQUIRED)
find_package(cpr REQUIRED)

# WebSocket++ 是头文件库，只需要指定include路径
# 在Windows上，通过vcpkg安装后会自动找到
# 在Mac上，需要指定安装位置
if(APPLE)
    include_directories(/usr/local/include)
    link_directories(/usr/local/lib)
endif()

# 添加可执行文件
add_executable(chat_client 
    src/main.cpp
    src/chat_client.cpp
    src/rest_api.cpp
)

# 链接库
target_link_libraries(chat_client PRIVATE
    nlohmann_json::nlohmann_json
    cpr::cpr
)

# 在Windows上添加额外的链接
if(WIN32)
    target_link_libraries(chat_client PRIVATE ws2_32 wsock32)
endif()

# 包含头文件目录
target_include_directories(chat_client PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src)
```

### 3. REST API客户端 (rest_api.h)

```cpp
#pragma once

#include <string>
#include <vector>
#include <cpr/cpr.h>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

class ChatRestAPI {
public:
    ChatRestAPI(const std::string& baseUrl = "http://localhost:3000/api");
    
    // 获取在线用户列表
    json getUsers();
    
    // 获取消息历史
    json getMessages(int limit = 50, int offset = 0);
    
    // 发送消息
    json sendMessage(const std::string& userId, const std::string& username, 
                    const std::string& content, const std::string& type = "text");
    
    // 发送系统广播
    json sendBroadcast(const std::string& content);
    
private:
    std::string baseUrl;
};
```

### 4. REST API客户端实现 (rest_api.cpp)

```cpp
#include "rest_api.h"
#include <iostream>

ChatRestAPI::ChatRestAPI(const std::string& baseUrl) : baseUrl(baseUrl) {}

json ChatRestAPI::getUsers() {
    cpr::Response r = cpr::Get(
        cpr::Url{baseUrl + "/users"},
        cpr::Header{{"Content-Type", "application/json"}}
    );
    
    if (r.status_code != 200) {
        std::cerr << "Error: " << r.status_code << " - " << r.text << std::endl;
        return json::object();
    }
    
    return json::parse(r.text);
}

json ChatRestAPI::getMessages(int limit, int offset) {
    cpr::Response r = cpr::Get(
        cpr::Url{baseUrl + "/messages"},
        cpr::Parameters{{"limit", std::to_string(limit)}, {"offset", std::to_string(offset)}},
        cpr::Header{{"Content-Type", "application/json"}}
    );
    
    if (r.status_code != 200) {
        std::cerr << "Error: " << r.status_code << " - " << r.text << std::endl;
        return json::object();
    }
    
    return json::parse(r.text);
}

json ChatRestAPI::sendMessage(const std::string& userId, const std::string& username, 
                            const std::string& content, const std::string& type) {
    json data = {
        {"userId", userId},
        {"username", username},
        {"content", content},
        {"type", type}
    };
    
    cpr::Response r = cpr::Post(
        cpr::Url{baseUrl + "/messages"},
        cpr::Header{{"Content-Type", "application/json"}},
        cpr::Body{data.dump()}
    );
    
    if (r.status_code != 201) {
        std::cerr << "Error: " << r.status_code << " - " << r.text << std::endl;
        return json::object();
    }
    
    return json::parse(r.text);
}

json ChatRestAPI::sendBroadcast(const std::string& content) {
    json data = {
        {"content", content}
    };
    
    cpr::Response r = cpr::Post(
        cpr::Url{baseUrl + "/broadcast"},
        cpr::Header{{"Content-Type", "application/json"}},
        cpr::Body{data.dump()}
    );
    
    if (r.status_code != 200) {
        std::cerr << "Error: " << r.status_code << " - " << r.text << std::endl;
        return json::object();
    }
    
    return json::parse(r.text);
}
```

### 5. WebSocket客户端 (chat_client.h)

```cpp
#pragma once

#include <string>
#include <functional>
#include <thread>
#include <atomic>
#include <websocketpp/config/asio_client.hpp>
#include <websocketpp/client.hpp>
#include <nlohmann/json.hpp>

using json = nlohmann::json;
using websocketpp::lib::placeholders::_1;
using websocketpp::lib::placeholders::_2;
using websocketpp::lib::bind;

typedef websocketpp::client<websocketpp::config::asio_tls_client> wss_client;
typedef websocketpp::client<websocketpp::config::asio_client> ws_client;

class ChatClient {
public:
    ChatClient(const std::string& serverUrl = "ws://localhost:3000");
    ~ChatClient();
    
    // 连接到聊天服务器
    bool connect();
    
    // 加入聊天
    bool join(const std::string& userId, const std::string& username);
    
    // 发送消息
    bool sendMessage(const std::string& content, const std::string& type = "text");
    
    // 设置消息处理回调
    void setMessageCallback(std::function<void(const json&)> callback);
    
    // 设置用户列表更新回调
    void setUserListCallback(std::function<void(const json&)> callback);
    
    // 设置用户数量更新回调
    void setUserCountCallback(std::function<void(int)> callback);
    
    // 关闭连接
    void close();
    
private:
    std::string serverUrl;
    bool useSSL;
    
    std::unique_ptr<ws_client> ws_client_;
    std::unique_ptr<wss_client> wss_client_;
    
    websocketpp::connection_hdl connection;
    std::thread ws_thread;
    std::atomic<bool> running;
    
    std::string userId;
    std::string username;
    
    std::function<void(const json&)> messageCallback;
    std::function<void(const json&)> userListCallback;
    std::function<void(int)> userCountCallback;
    
    // 消息处理
    void onMessage(websocketpp::connection_hdl hdl, ws_client::message_ptr msg);
    void onMessageWSS(websocketpp::connection_hdl hdl, wss_client::message_ptr msg);
    
    // 连接处理
    void onOpen(websocketpp::connection_hdl hdl);
    void onOpenWSS(websocketpp::connection_hdl hdl);
    
    // 关闭处理
    void onClose(websocketpp::connection_hdl hdl);
    void onCloseWSS(websocketpp::connection_hdl hdl);
    
    // 心跳定时器
    void startHeartbeat();
};
```

### 6. WebSocket客户端实现 (chat_client.cpp)

```cpp
#include "chat_client.h"
#include <iostream>
#include <chrono>

ChatClient::ChatClient(const std::string& serverUrl) : serverUrl(serverUrl), running(false) {
    // 检查是否使用SSL
    useSSL = (serverUrl.substr(0, 3) == "wss");
    
    if (useSSL) {
        wss_client_ = std::make_unique<wss_client>();
        wss_client_->clear_access_channels(websocketpp::log::alevel::all);
        wss_client_->set_access_channels(websocketpp::log::alevel::connect);
        wss_client_->set_access_channels(websocketpp::log::alevel::disconnect);
        wss_client_->set_access_channels(websocketpp::log::alevel::app);
        wss_client_->init_asio();
        
        wss_client_->set_message_handler(bind(&ChatClient::onMessageWSS, this, ::_1, ::_2));
        wss_client_->set_open_handler(bind(&ChatClient::onOpenWSS, this, ::_1));
        wss_client_->set_close_handler(bind(&ChatClient::onCloseWSS, this, ::_1));
    } else {
        ws_client_ = std::make_unique<ws_client>();
        ws_client_->clear_access_channels(websocketpp::log::alevel::all);
        ws_client_->set_access_channels(websocketpp::log::alevel::connect);
        ws_client_->set_access_channels(websocketpp::log::alevel::disconnect);
        ws_client_->set_access_channels(websocketpp::log::alevel::app);
        ws_client_->init_asio();
        
        ws_client_->set_message_handler(bind(&ChatClient::onMessage, this, ::_1, ::_2));
        ws_client_->set_open_handler(bind(&ChatClient::onOpen, this, ::_1));
        ws_client_->set_close_handler(bind(&ChatClient::onClose, this, ::_1));
    }
}

ChatClient::~ChatClient() {
    close();
}

bool ChatClient::connect() {
    try {
        if (useSSL) {
            wss_client::connection_ptr con = wss_client_->get_connection(serverUrl, nullptr);
            wss_client_->connect(con);
            
            running = true;
            ws_thread = std::thread([this]() {
                this->wss_client_->run();
            });
        } else {
            ws_client::connection_ptr con = ws_client_->get_connection(serverUrl, nullptr);
            ws_client_->connect(con);
            
            running = true;
            ws_thread = std::thread([this]() {
                this->ws_client_->run();
            });
        }
        
        // 启动心跳
        startHeartbeat();
        return true;
    } catch (const std::exception& e) {
        std::cerr << "Error connecting to server: " << e.what() << std::endl;
        return false;
    }
}

bool ChatClient::join(const std::string& userId, const std::string& username) {
    this->userId = userId;
    this->username = username;
    
    json joinData = {
        {"userId", userId},
        {"username", username}
    };
    
    try {
        if (useSSL) {
            wss_client_->send(connection, joinData.dump(), websocketpp::frame::opcode::text);
        } else {
            ws_client_->send(connection, joinData.dump(), websocketpp::frame::opcode::text);
        }
        return true;
    } catch (const std::exception& e) {
        std::cerr << "Error joining chat: " << e.what() << std::endl;
        return false;
    }
}

bool ChatClient::sendMessage(const std::string& content, const std::string& type) {
    json messageData = {
        {"content", content},
        {"type", type}
    };
    
    try {
        if (useSSL) {
            wss_client_->send(connection, messageData.dump(), websocketpp::frame::opcode::text);
        } else {
            ws_client_->send(connection, messageData.dump(), websocketpp::frame::opcode::text);
        }
        return true;
    } catch (const std::exception& e) {
        std::cerr << "Error sending message: " << e.what() << std::endl;
        return false;
    }
}

void ChatClient::setMessageCallback(std::function<void(const json&)> callback) {
    messageCallback = callback;
}

void ChatClient::setUserListCallback(std::function<void(const json&)> callback) {
    userListCallback = callback;
}

void ChatClient::setUserCountCallback(std::function<void(int)> callback) {
    userCountCallback = callback;
}

void ChatClient::close() {
    if (running) {
        running = false;
        
        try {
            if (useSSL) {
                wss_client_->close(connection, websocketpp::close::status::normal, "Client closing");
                wss_client_->stop();
            } else {
                ws_client_->close(connection, websocketpp::close::status::normal, "Client closing");
                ws_client_->stop();
            }
            
            if (ws_thread.joinable()) {
                ws_thread.join();
            }
        } catch (const std::exception& e) {
            std::cerr << "Error closing connection: " << e.what() << std::endl;
        }
    }
}

void ChatClient::onMessage(websocketpp::connection_hdl hdl, ws_client::message_ptr msg) {
    try {
        std::string payload = msg->get_payload();
        json data = json::parse(payload);
        
        // 处理不同类型的事件
        if (data.contains("type") && data["type"] == "system") {
            // 系统消息
            if (messageCallback) messageCallback(data);
        } else if (msg->get_opcode() == websocketpp::frame::opcode::text) {
            // 普通消息
            if (messageCallback) messageCallback(data);
        }
    } catch (const std::exception& e) {
        std::cerr << "Error parsing message: " << e.what() << std::endl;
    }
}

void ChatClient::onMessageWSS(websocketpp::connection_hdl hdl, wss_client::message_ptr msg) {
    try {
        std::string payload = msg->get_payload();
        
        // 处理 pong 响应
        if (payload == "pong") return;
        
        json data = json::parse(payload);
        
        // 判断消息类型
        if (data.is_object()) {
            if (data.contains("type")) {
                // 消息
                if (messageCallback) messageCallback(data);
            } else if (data.is_array()) {
                // 用户列表
                if (userListCallback) userListCallback(data);
            } else if (data.is_number()) {
                // 用户数量
                if (userCountCallback) userCountCallback(data.get<int>());
            }
        }
    } catch (const std::exception& e) {
        std::cerr << "Error parsing message: " << e.what() << std::endl;
    }
}

void ChatClient::onOpen(websocketpp::connection_hdl hdl) {
    connection = hdl;
    std::cout << "Connection established" << std::endl;
    
    // 如果已有用户信息，自动加入
    if (!userId.empty() && !username.empty()) {
        join(userId, username);
    }
}

void ChatClient::onOpenWSS(websocketpp::connection_hdl hdl) {
    connection = hdl;
    std::cout << "Secure connection established" << std::endl;
    
    // 如果已有用户信息，自动加入
    if (!userId.empty() && !username.empty()) {
        join(userId, username);
    }
}

void ChatClient::onClose(websocketpp::connection_hdl hdl) {
    std::cout << "Connection closed" << std::endl;
    running = false;
}

void ChatClient::onCloseWSS(websocketpp::connection_hdl hdl) {
    std::cout << "Secure connection closed" << std::endl;
    running = false;
}

void ChatClient::startHeartbeat() {
    std::thread([this]() {
        while (running) {
            std::this_thread::sleep_for(std::chrono::seconds(30));
            
            if (!running) break;
            
            try {
                if (useSSL) {
                    wss_client_->send(connection, "ping", websocketpp::frame::opcode::text);
                } else {
                    ws_client_->send(connection, "ping", websocketpp::frame::opcode::text);
                }
            } catch (const std::exception& e) {
                std::cerr << "Error sending heartbeat: " << e.what() << std::endl;
            }
        }
    }).detach();
}
```

### 7. 主程序 (main.cpp)

```cpp
#include <iostream>
#include <string>
#include <thread>
#include <chrono>
#include <atomic>
#include <mutex>
#include <condition_variable>
#include "chat_client.h"
#include "rest_api.h"

// 格式化时间
std::string formatTime(const std::string& timeStr) {
    try {
        // 简单格式化，实际应用中可以使用更完善的时间解析
        size_t pos = timeStr.find('T');
        size_t endPos = timeStr.find('.');
        if (pos != std::string::npos && endPos != std::string::npos) {
            return timeStr.substr(pos + 1, endPos - pos - 1);
        }
        return timeStr;
    } catch (...) {
        return timeStr;
    }
}

int main() {
    std::cout << "C++ 聊天客户端示例" << std::endl;
    std::cout << "====================" << std::endl;
    
    std::string serverUrl = "ws://localhost:3000";
    std::string apiUrl = "http://localhost:3000/api";
    
    // 创建REST API客户端
    ChatRestAPI api(apiUrl);
    
    // 获取用户信息
    std::string userId = "cpp_user_" + std::to_string(time(nullptr));
    std::string username;
    
    std::cout << "请输入您的用户名: ";
    std::getline(std::cin, username);
    
    if (username.empty()) {
        username = "C++用户";
    }
    
    // 创建WebSocket客户端
    ChatClient client(serverUrl);
    
    // 设置消息回调
    client.setMessageCallback([](const json& message) {
        try {
            std::string type = message.value("type", "text");
            std::string timeStr = formatTime(message.value("time", ""));
            
            if (type == "system") {
                std::cout << "[系统] " << message["content"].get<std::string>() 
                          << " (" << timeStr << ")" << std::endl;
            } else {
                std::string sender = message.value("sender", "未知用户");
                std::cout << "[" << sender << "] " << message["content"].get<std::string>() 
                          << " (" << timeStr << ")" << std::endl;
            }
        } catch (const std::exception& e) {
            std::cerr << "Error processing message: " << e.what() << std::endl;
        }
    });
    
    // 设置用户列表回调
    client.setUserListCallback([](const json& users) {
        std::cout << "在线用户:" << std::endl;
        for (const auto& user : users) {
            std::cout << "- " << user["username"].get<std::string>() << std::endl;
        }
    });
    
    // 设置用户数量回调
    client.setUserCountCallback([](int count) {
        std::cout << "当前在线人数: " << count << std::endl;
    });
    
    // 连接到服务器
    if (!client.connect()) {
        std::cerr << "无法连接到服务器!" << std::endl;
        return 1;
    }
    
    // 加入聊天
    if (!client.join(userId, username)) {
        std::cerr << "加入聊天失败!" << std::endl;
        return 1;
    }
    
    // 获取消息历史
    std::cout << "获取历史消息..." << std::endl;
    json history = api.getMessages(10, 0);
    
    if (history.contains("messages") && history["messages"].is_array()) {
        std::cout << "最近消息:" << std::endl;
        for (const auto& msg : history["messages"]) {
            std::string type = msg.value("type", "text");
            std::string timeStr = formatTime(msg.value("time", ""));
            
            if (type == "system") {
                std::cout << "[系统] " << msg["content"].get<std::string>() 
                          << " (" << timeStr << ")" << std::endl;
            } else {
                std::string sender = msg.value("sender", "未知用户");
                std::cout << "[" << sender << "] " << msg["content"].get<std::string>() 
                          << " (" << timeStr << ")" << std::endl;
            }
        }
    }
    
    // 消息发送循环
    std::cout << "\n开始聊天 (输入 'quit' 退出):" << std::endl;
    std::string input;
    while (true) {
        std::getline(std::cin, input);
        
        if (input == "quit") {
            break;
        } else if (input.empty()) {
            continue;
        }
        
        // 发送消息
        client.sendMessage(input);
    }
    
    // 关闭连接
    client.close();
    std::cout << "已断开连接" << std::endl;
    
    return 0;
}
```

### 8. 编译和运行

#### Windows (Visual Studio)

1. 创建一个新的C++ CMake项目
2. 复制上述文件到项目中
3. 使用CMake构建项目
4. 运行编译后的可执行文件

```bash
mkdir build
cd build
cmake .. -DCMAKE_TOOLCHAIN_FILE=[vcpkg安装路径]/scripts/buildsystems/vcpkg.cmake
cmake --build . --config Release
```

#### macOS (命令行)

```bash
mkdir build
cd build
cmake ..
make
./chat_client
```

## 功能测试

1. **连接服务器**：客户端将连接到聊天服务器并显示连接状态
2. **加入聊天**：输入用户名后加入聊天室
3. **接收历史消息**：显示最近的10条历史消息
4. **发送消息**：在命令行中输入消息并发送
5. **接收实时消息**：显示其他用户发送的消息和系统通知

## 扩展功能

可以进一步扩展客户端功能：

1. 添加图形用户界面
2. 实现消息过滤和搜索
3. 添加文件传输功能
4. 实现私聊功能
5. 添加用户认证和安全连接

## 故障排除

1. **连接失败**
   - 检查服务器地址和端口是否正确
   - 确认服务器是否正在运行
   - 检查防火墙设置

2. **编译错误**
   - 确保所有依赖库正确安装
   - 检查CMake路径和配置

3. **消息接收或发送失败**
   - 检查网络连接
   - 验证WebSocket事件处理是否正确
   - 检查服务器日志查找可能的错误 