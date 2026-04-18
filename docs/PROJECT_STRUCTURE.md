# 项目结构

```text
Kin/
├─ apps/web/                 # Vite 多页面 HTML 入口
├─ config/                   # Vite 构建配置
├─ docs/                     # 项目说明、原型、数据库文档和 README 图片资源
├─ mcp_server/elderly_mcp/   # 老人端 MCP 服务
├─ miniapp/                  # Taro/微信小程序端
├─ scripts/                  # 本地启动和停止脚本
├─ server/                   # Flask 后端、本地数据库和上传目录
└─ src/                      # Web 前端源码
```

根目录只保留包管理、TypeScript/Tailwind/PostCSS 等项目级配置，以及 README、LICENSE、环境变量示例这类入口文件。

运行脚本：

```bash
npm run dev:elderly:web
npm run dev:family
npm run dev:admin
npm run start:all
```

构建产物、依赖目录、本地日志、虚拟环境、本地数据库和上传文件都由 `.gitignore` 保护，不进入版本库。
