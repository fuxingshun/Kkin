# KinEcho Java Backend

This is the Java/Spring Boot implementation of the KinEcho backend. It serves the mini program, the admin monitor, and the lightweight AI voice companion.

- API base: `http://127.0.0.1:8000/api`
- Health check: `GET /api/health`
- Upload files: `server/uploads`
- Database: MySQL
- Backend layers: `controller -> service -> mapper`
- Mapper framework: MyBatis-Plus
- Configuration files: `application.yml`, `application-local.yml`, `application-prod.yml`

## Configuration

The backend no longer reads `server-java/.env`. Configure it directly through Spring Boot YAML files:

- `src/main/resources/application.yml`: common settings, MyBatis-Plus settings, shared KinEcho settings
- `src/main/resources/application-local.yml`: local development settings, loaded by default
- `src/main/resources/application-prod.yml`: production template

The AI companion now uses Alibaba Cloud Bailian for all three AI functions:

| Function | Model |
| --- | --- |
| ASR | `paraformer-v2` |
| Chat | `qwen3.5-plus` |
| TTS | `qwen3-tts-flash` |

Local development example:

```yaml
spring:
  datasource:
    driver-class-name: com.mysql.cj.jdbc.Driver
    url: jdbc:mysql://127.0.0.1:3306/kinecho?useUnicode=true&characterEncoding=utf8mb4&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true
    username: root
    password: your-mysql-password

kinecho:
  api-token-enabled: false
  api-token: ''
  bailian-api-key: sk-your-bailian-api-key
  bailian-asr-file-base-url: ''
```

Production should enable API token protection:

```yaml
kinecho:
  api-token-enabled: true
  api-token: your-long-random-token
```

Clients can send the token through either `Authorization: Bearer ...` or `X-KinEcho-Token`.

## Auth and overview APIs

The backend now exposes:

- `POST /api/auth/login`
- `GET /api/service/overview?family_id=family_001`
- `GET /api/admin/service-summary?family_id=family_001`
- `GET /api/admin/analytics?family_id=family_001&months=6&days=7`

`/api/auth/login` supports `elderly`, `family`, `service`, and `admin` roles.

For the local demo environment:

- elderly/family users can log in with their name or phone number
- the default password can use the last 6 digits of the phone number
- service/admin credentials come from Spring config under:
  - `kinecho.service-username`
  - `kinecho.service-password`
  - `kinecho.service-family-id`
  - `kinecho.admin-username`
  - `kinecho.admin-password`

Use `kinecho.service-family-id` to bind the service miniapp to the correct family context instead of relying on the demo default `family_001`.

Override these values in `application-local.yml` or `application-prod.yml` before deployment.

`/api/admin/service-summary` is used by the admin service collaboration page to aggregate service staff capacity, active followups, pending alerts, and high-risk elderly cases.

`/api/admin/analytics` is used by the admin analytics page to return real user growth data plus recent followup and media activity trends.

`bailian-asr-file-base-url` should be set to a public origin when Bailian needs to download uploaded voice files, for example:

```yaml
kinecho:
  bailian-asr-file-base-url: https://api.example.com
```

Create the MySQL database before starting the backend. Redis is optional and should be used only for cache-style data.

## Build

```bash
mvn -q -DskipTests package
```

From the project root you can also run:

```bash
npm run server:build
```

## Start

Local profile is the default:

```bash
mvn spring-boot:run
```

Or:

```bash
java -jar target/kinecho-server.jar
```

Production profile:

```bash
java -jar target/kinecho-server.jar --spring.profiles.active=prod
```

From the project root:

```bash
npm run server:start
```

Voice AI uses the Java backend directly. The mini program records audio and calls:

- `POST /api/elderly/ai/voice-chat`
- `POST /api/elderly/ai/chat`
- `POST /api/elderly/ai/speak`
