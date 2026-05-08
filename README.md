# KinEcho

KinEcho 当前精简为三部分：

- `miniapp/`：微信小程序端，包含老人、家属、服务人员三端
- `server-java/`：Java/Spring Boot 后端
- `src/admin/`：后台监控数据 Web 端

老人端 AI 陪伴支持语音输入和语音回复，不再依赖旧的外部渲染或 Python 语音链路。Java 后端采用 `controller -> service -> mapper` 分层，mapper 层接入 MyBatis-Plus，数据源通过 Spring Boot 标准 `spring.datasource.*` 配置。

## 后端配置

后端不再通过 `.env` 文件配置。当前配置文件放在：

- `server-java/src/main/resources/application.yml`：公共配置
- `server-java/src/main/resources/application-local.yml`：本地开发配置，默认启用，已加入忽略列表
- `server-java/src/main/resources/application-prod.example.yml`：生产配置示例，只使用环境变量占位

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
  api-token-enabled: false
  api-token: ''
  bailian-api-key: sk-your-bailian-api-key
  bailian-asr-file-base-url: ''
```

生产环境应从 `application-prod.example.yml` 复制出本机的 `application-prod.yml`，并只通过环境变量注入数据库、口令和 API Key。生产环境应开启 API Token 校验，并在管理端、小程序端配置同一个 Token：

```yaml
kinecho:
  api-token-enabled: true
  api-token: ${KINECHO_API_TOKEN}
  session-signing-key: ${KINECHO_SESSION_SIGNING_KEY}
  family-scope-session-required: ${KINECHO_FAMILY_SCOPE_SESSION_REQUIRED}
  phone-suffix-login-enabled: ${KINECHO_PHONE_SUFFIX_LOGIN_ENABLED}
```

前端请求会通过 `Authorization: Bearer ...` 和 `X-KinEcho-Token` 发送 Token。

## 登录接口

后端现已提供统一登录接口：

- `POST /api/auth/login`
- `GET /api/me`

支持四种角色：

- `elderly`：老人端，使用老人姓名或手机号登录
- `family`：家属端，使用家属姓名或手机号登录
- `service`：服务端，使用服务账号登录
- `admin`：管理端，使用后台账号登录

本地演示环境默认规则：

- 老人端、家属端密码可使用手机号后 6 位；如无手机号，可使用 `kinecho.demo-login-password`
- 服务端默认账号来自 `kinecho.service-username` / `kinecho.service-password`
- 管理端默认账号来自 `kinecho.admin-username` / `kinecho.admin-password`

服务端还新增了聚合概况接口：

- `GET /api/service/overview?family_id=family_001`
- `GET /api/admin/service-summary?family_id=family_001`
- `GET /api/admin/analytics?family_id=family_001&months=6&days=7`

用于服务人员中心展示待处理工单、风险个案和随访统计，同时为管理端服务协同页和数据分析页提供真实后端汇总数据。

登录成功后后端会返回 `session_token`，客户端可通过 `X-KinEcho-Session` 调用 `GET /api/me` 获取当前角色、用户、家庭和老人绑定状态。`session_token` 是服务端签名令牌，不替代全局 API Token；生产环境仍应同时开启 `X-KinEcho-Token`。

封闭试点上线时建议设置 `KINECHO_FAMILY_SCOPE_SESSION_REQUIRED=true`，让所有带 `family_id` 的家庭数据请求必须携带有效 session，并拒绝跨家庭访问。
同时建议设置 `KINECHO_PHONE_SUFFIX_LOGIN_ENABLED=false`，关闭手机号后 6 位的演示登录方式。
家庭上传媒体不再通过公开 `/uploads/**` 访问，后端会返回 `/api/family/media/{id}/file` 和 `/thumbnail` 受控下载地址。AI TTS 播放音频通过 `/api/ai/audio/{filename}?token=...` 短期签名 URL 下载；ASR 语音上传临时文件仍保留专用 `/uploads/ai-voice/**` 路径供百炼转写服务读取。
AI 陪伴文本或语音转写中命中轻生、自伤等高风险关键词时，后端会跳过普通聊天回复，生成 `ai_crisis` 高风险家庭提醒并写入照护审计，返回安全提示和 `crisis_detected` 标记供小程序展示。
隐私合规补充了 `consent_records` 和 `privacy_requests`：小程序可记录协议/隐私/心理筛查同意，家属可导出家庭数据包，并提交导出、删除或更正请求，所有动作写入照护审计。
封闭试点备份可执行 `npm run backup:pilot`，脚本会生成数据库 dump、上传目录归档和 `manifest.json`。恢复演练步骤见 [docs/封闭试点备份恢复演练.md](docs/封闭试点备份恢复演练.md)。
封闭试点名单、非医学诊断表述和上线检查项见 [docs/封闭试点上线准备.md](docs/封闭试点上线准备.md)。

`bailian-asr-file-base-url` 用于给百炼访问录音文件。生产环境建议配置为你的公网域名，例如：

```yaml
kinecho:
  bailian-asr-file-base-url: https://api.example.com
```

生产环境修改本机未提交的 `application-prod.yml`，并以 `prod` profile 启动：

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
