# KinEcho MiniApp

这是为当前仓库新增的小程序子工程，目标是先把“家属端 + 老人端”的核心能力迁移到微信小程序，再逐步补齐高级能力。

## 当前已落地

- 家属端页面
  - `pages/family/dashboard/index` 概览
  - `pages/family/moods/index` 情绪历史
  - `pages/family/interactions/index` 互动历史
  - `pages/family/messages/index` 定时留言
  - `pages/family/care/index` 护理计划
  - `pages/family/alerts/index` 通知处理
  - `pages/family/media/index` 媒体上传与列表
- 老人端页面
  - `pages/elderly/home/index` 心情记录、联系家人、紧急求助、今日提醒、推荐媒体
- 身份入口
  - `pages/role/index`

## 运行

1. 安装依赖

```bash
npm install
```

2. 构建微信小程序

```bash
npm run build:weapp
```

开发联调也可以直接在仓库根目录运行：

```powershell
G:\Kin\start-miniapp-dev.cmd
```

它会自动启动：

- `server/app.py`
- `miniapp` 的一次性 `npm run build:weapp`

停止时运行：

```powershell
G:\Kin\stop-miniapp-dev.cmd
```

3. 在微信开发者工具中打开当前目录，并确认 `project.config.json` 中的 `miniprogramRoot` 指向 `dist/weapp`

## 环境变量

复制 `.env.example` 为你自己的环境文件，并按实际部署修改：

```bash
TARO_APP_API_BASE_URL=http://127.0.0.1:8000/api
```

注意：

- 真机或正式环境不能直接访问 `127.0.0.1`
- 需要替换成可被微信小程序合法域名配置放行的后端地址
- 互动历史页现在通过 `server/app.py` 代理访问 `Fay` 服务；如果 `Fay` 没启动，页面会提示“暂时还拿不到互动记录”，但不会影响概览页正常打开
- 如果你要持续监听源码改动，建议单独在 `miniapp` 目录手动运行 `npm run dev:weapp`
- 微信开发者工具如果出现 `prebundle/*` 缺失报错，先确认已经重新导入项目并执行“清缓存并重新编译”；本项目默认已关闭 `enhance`，避免工具的增强编译误读旧缓存

## 当前迁移策略

- 家属端优先保证“能管、能传、能看、能处理”
- 老人端优先保证“能提醒、能记录、能求助、能回看”
- 原 Electron/数字人 相关能力暂时没有直接迁入小程序：
  - `xmov` / WebGL 数字人渲染
  - 常驻全屏沉浸层
  - 本地桌面级窗口与透明覆盖层

## 建议的下一阶段

1. 把家属端的媒体标签策略继续迁移，并补更多互动筛选能力
2. 给老人端补视频播放页与更完整的提醒状态流转
3. 抽离当前 Web/H5 与小程序共享的 service/type 层，减少双端维护成本
