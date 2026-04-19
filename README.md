# KinEcho

KinEcho 当前精简为三部分：

- `miniapp/`：微信小程序端，包含老人、家属、服务人员三端
- `server-java/`：Java/Spring Boot 后端
- `src/admin/`：后台监控数据 Web 端

老人端 AI 陪伴支持语音输入和语音回复，不再依赖旧的外部渲染或 Python 语音链路。Java 后端采用 `controller -> service -> mapper` 分层，mapper 层接入 MyBatis-Plus，数据源通过 Spring Boot 标准 `spring.datasource.*` 配置。

## 后端配置

后端不再通过 `.env` 文件配置。当前配置文件放在：

- `server-java/src/main/resources/application.yml`：公共配置
- `server-java/src/main/resources/application-local.yml`：本地开发配置，默认启用
- `server-java/src/main/resources/application-prod.yml`：生产配置模板

当前 AI 三个功能均使用阿里云百炼：

| 功能 | 模型 |
| --- | --- |
| 语音识别 | `paraformer-v2` |
| 文本对话 | `qwen3.5-plus` |
| 语音合成 | `qwen3-tts-flash` |

本地开发时，直接修改 `application-local.yml`：

```yaml
spring:
  datasource:
    url: jdbc:mysql://127.0.0.1:3306/kinecho?useUnicode=true&characterEncoding=utf8mb4&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true
    username: root
    password: your-mysql-password

kinecho:
  bailian-api-key: sk-your-bailian-api-key
  bailian-asr-file-base-url: ''
```

`bailian-asr-file-base-url` 用于给百炼访问录音文件。生产环境建议配置为你的公网域名，例如：

```yaml
kinecho:
  bailian-asr-file-base-url: https://api.example.com
```

生产环境修改 `application-prod.yml`，并以 `prod` profile 启动：

```bash
java -jar target/kinecho-server.jar --spring.profiles.active=prod
```

Redis 只作为可选缓存配置，核心业务数据统一写入 MySQL。

## 启动

后端：

```bash
npm run server:build
npm run server:start
```

后台监控：

```bash
npm run dev:admin
```

小程序：

```bash
cd miniapp
npm install
npm run build:weapp
```

然后用微信开发者工具打开 `miniapp` 目录。
