# KinEcho MiniApp

这是 KinEcho 微信小程序端，包含老人、家属、服务人员三端。

## 页面结构

- 老人端：`pages/elderly/*`
- 家属端：`pages/family/*`
- 服务人员端：`pages/service/*`
- 角色入口：`pages/role/index`

老人端的 AI 陪伴页支持“录音输入 -> Java 后端识别 -> AI 回复 -> 小程序播放语音”。不再依赖旧的外部渲染或 Python 语音链路。

## 运行

1. 安装依赖

```bash
npm install
```

2. 配置接口地址

复制 `.env.example` 为 `.env`，按实际后端地址修改：

```bash
TARO_APP_API_BASE_URL=http://127.0.0.1:8000/api
TARO_APP_API_TOKEN=
```

真机或正式环境不能直接访问 `127.0.0.1`，需要替换为微信小程序合法域名中配置过的后端地址。
如果 Java 后端开启了 `kinecho.api-token-enabled`，这里的 `TARO_APP_API_TOKEN` 必须与后端 `kinecho.api-token` 一致。

3. 构建微信小程序

```bash
npm run build:weapp
```

4. 在微信开发者工具中打开 `miniapp` 目录，并确认 `project.config.json` 的 `miniprogramRoot` 指向 `dist/weapp`。

开发联调时，也可以在 `miniapp` 目录运行：

```bash
npm run dev:weapp
```

## 后端依赖

小程序接口统一调用 Java 后端：

- `POST /api/elderly/ai/voice-chat`
- `POST /api/elderly/ai/chat`
- `POST /api/elderly/ai/speak`
- 其他老人、家属、服务人员业务接口也在 `server-java` 中提供
