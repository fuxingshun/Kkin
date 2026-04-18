# KinEcho 服务端

基于 Flask + MySQL 的日程同步服务，支持家人端和老人端的护理计划、留言、情绪、媒体、咨询等数据管理。

## 功能特性

### 家人端
- ✅ 创建护理计划/日程
- ✅ 查看所有日程列表
- ✅ 更新日程信息
- ✅ 删除日程
- ✅ 支持重复日程（每日、每周、每月）

### 老人端
- ✅ 查看今日日程
- ✅ 获取即将到来的提醒
- ✅ 标记提醒完成
- ✅ 忽略提醒

## 技术栈

- **Python 3.8+**
- **Flask 3.0** - Web 框架
- **MySQL** - 数据库
- **Flask-CORS** - 跨域支持

## 快速开始

### 1. 安装依赖

```bash
cd server
pip install -r requirements.txt
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

至少需要配置 MySQL 连接信息：

```bash
DB_DRIVER=mysql
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your-mysql-password
MYSQL_DATABASE=kinecho
MYSQL_AUTO_CREATE_DATABASE=true
```

首次启动会自动创建数据库和表结构。`SEED_DEMO_DATA=true` 时会写入默认家庭、提醒、留言和咨询师，便于老人端首屏直接联调。

### 3. 启动服务

```bash
python app.py
```

服务将在 `http://localhost:8000` 启动。

## API 文档

### 家人端 API

#### 获取所有日程
```
GET /api/family/schedules?family_id=xxx
```

#### 创建日程
```
POST /api/family/schedules
Content-Type: application/json

{
  "family_id": "family_001",
  "title": "早晨服药",
  "description": "服用降压药1片",
  "schedule_type": "medication",
  "schedule_time": "2025-11-18 08:00:00",
  "repeat_type": "daily",
  "created_by": 1
}
```

#### 更新日程
```
PUT /api/family/schedules/{schedule_id}
Content-Type: application/json

{
  "title": "早晨服药（已更新）",
  "description": "服用降压药2片"
}
```

#### 删除日程
```
DELETE /api/family/schedules/{schedule_id}
```

### 老人端 API

#### 获取今日日程
```
GET /api/elderly/schedules/today?family_id=xxx
```

#### 获取即将到来的日程
```
GET /api/elderly/schedules/upcoming?family_id=xxx&elderly_id=xxx
```

#### 完成提醒
```
POST /api/elderly/reminders/{reminder_id}/complete
```

#### 忽略提醒
```
POST /api/elderly/reminders/{reminder_id}/dismiss
```

### 用户管理 API

#### 创建用户
```
POST /api/users
Content-Type: application/json

{
  "user_type": "elderly",
  "name": "张奶奶",
  "phone": "13800138000",
  "family_id": "family_001"
}
```

#### 获取家庭成员
```
GET /api/users/{family_id}
```

## 数据库结构

### users 表
- 用户信息（家人和老人）
- 通过 `family_id` 关联

### schedules 表
- 日程/护理计划
- 支持重复类型（once, daily, weekly, monthly）

### reminders 表
- 提醒记录
- 追踪提醒状态（pending, completed, missed, dismissed）

## 日程类型

- `medication` - 用药
- `exercise` - 运动
- `meal` - 饮食
- `checkup` - 检查
- `other` - 其他

## 重复类型

- `once` - 单次
- `daily` - 每天
- `weekly` - 每周（需指定 repeat_days）
- `monthly` - 每月

## 开发说明

### 目录结构
```
server/
├── app.py              # 主应用
├── requirements.txt    # 依赖
├── .env               # 环境配置
├── .env               # MySQL 连接配置
└── README.md          # 文档
```

### 健康检查
```
GET /api/health
```

返回服务状态和当前时间。

## 部署建议

1. 生产环境建议使用 Gunicorn 作为 WSGI 服务器
2. 使用 Nginx 作为反向代理
3. 定期备份 MySQL 数据库
4. 生产环境建议关闭 `SEED_DEMO_DATA`

## License

MIT
