# 项目结构

```text
Kin/
├─ apps/web/                 # 后台监控页 HTML 入口
├─ config/                   # 后台监控页 Vite 配置
├─ docs/                     # 项目说明和业务文档
├─ miniapp/                  # Taro/微信小程序端，包含老人、家属、服务人员三端
├─ scripts/                  # 本地启动和停止脚本
├─ server-java/              # Java/Spring Boot 后端
├─ src/admin/                # 后台监控数据 Web 端
└─ src/index.css             # 后台监控页共享样式
```

当前保留的运行面只有：

- 小程序端：`miniapp`
- Java 后端：`server-java`
- 后台监控页：`src/admin`

Java 后端分层：

- `controller`：接口路由和请求参数
- `service`：业务逻辑
- `mapper`：MyBatis-Plus mapper 和数据库访问
- `entity`：数据库实体

旧的老人/家属 H5、外部语音服务、MCP 服务和渲染页面已经移除。

常用命令：

```bash
npm run server:build
npm run server:start
npm run dev:admin
npm run build:admin
```

小程序构建在 `miniapp` 目录内运行：

```bash
npm run build:weapp
```
