# 项目简介

## 多平台曲库与音频编辑（2026-10）

- 顶部“我的音乐”支持连接 QQ 音乐、网易云音乐和 Spotify，展示本人创建的歌单、喜欢的歌曲、收藏专辑，并支持分页读取。Spotify 的“我的歌单”包括自己创建及关注的歌单。网易云和 Spotify 项目当前提供曲库展示与平台跳转，不将其音源伪装成 QQ 音乐播放。
- QQ 音乐凭证通过 `X-QQ-Music-Cookie` 按请求传递，服务端使用 `AsyncLocalStorage` 隔离，不再回退到全局账号或向浏览器重新注入旧 Cookie。退出会清空本地状态、缓存并停止当前播放。
- 完整音源不可用时尝试申请平台的 `RS02` 试听片段；仅在平台实际提供链接时试听，最长 30 秒。没有试听资源的歌曲会显示原因，试听资源不能作为完整歌曲下载或导入实验室。
- 实验室倍速可在 0.25–2 之间按 0.01 步长拖动；每隔 0.25 的刻度可直接点击。裁剪弹窗支持细边界拖动、秒数微调、同步歌词、单句选择和 Shift 连续选句；本地音频可导入对应的 LRC。按句裁剪依据行级时间戳，精度取决于平台歌词，不等同于逐字或语音边界检测。

### 本地启动和账号配置

根目录执行 `npm install`，`backend` 和 `qq-music-api-main` 也分别安装依赖。三个服务分别运行根目录 `npm run dev`（5188）、`backend` 内 `npm run dev`（5000）、`qq-music-api-main` 内 `npm start`（3200）。网易云 API 库已集成到 5000 后端，无需启动第四个服务。

按根目录 `.env.example` 配置服务地址。Spotify 需要自行创建开发者应用，并将 `http://127.0.0.1:5188/` 精确加入 Redirect URI 白名单；Client ID 可在“我的音乐 → Spotify”填写，或配置 `VITE_SPOTIFY_CLIENT_ID`。不需要 Client Secret。旧的 HTTP 局域网回调配置会被忽略，改用合规的 loopback 地址。开发模式白名单、账号条件及接口权限仍受 Spotify 限制。

网易云和 Spotify 凭证只保存在当前浏览器会话的 sessionStorage 中；QQ 登录态由原有 localStorage 保存，退出时清除。不要将真实 Cookie、Token、`.env` 或本地登录态文件提交到仓库。

### 回归验证

`npm run typecheck`、`npm run build`，以及 `node scripts/check-auth-preview.cjs`、`node scripts/check-platform-library.cjs`、`node scripts/check-spotify-pkce.cjs`、`node scripts/check-lyrics.cjs`、`node scripts/check-audio-processing.cjs`。平台库和 OAuth 测试使用模拟响应；真实登录及私人曲库需通过实际账号授权后验证。

MeloRank是一个有别于传统的音乐网站，既包含传统的音乐搜索、播放等功能，也包含评价歌曲、快速搜索并“制作导出用户自己的年度榜单”、“上传音频并实行变调变速的音频实验”等功能。

- **登录**：用户通过“QQ”扫码登录（不是QQ音乐扫码登录），即可自动获取cookie并连接到用户QQ音乐曲库服务
- **编者推荐**：项目内嵌项目团队推荐的歌单及艺人，点击即可播放
- **搜索**：支持一键搜索歌曲、艺术家等，点击播放
- **播放器**：支持歌曲播放、暂停、音量控制、查看/导出歌词等基本功能
- **年度榜单（核心功能）**：提供用户DIY年度歌曲/专辑/艺人/MV排行榜的功能，可以一键保存+导出为docx
- **音频实验室**：处理音频效果
- **响应式设计**：适配不同屏幕尺寸

## 技术栈

### 前端
- **框架**：React
- **开发语言**：TypeScript
- **构建工具**：Vite 6.3.5
- **样式方案**：Tailwind CSS 4.1.12
- **UI组件库**：
  - Radix UI
  - Material UI Icons
- **路由管理**：React Router 7.11.0
- **状态管理**：React Context API
- **其他库**：
  - Recharts (图表)
  - React Slick (轮播)
  - Sonner (通知)
  - 等等

### QQ音乐API服务
- **框架**：Koa 2.7.0
- **开发语言**：Node.js
- **构建工具**：Nodemon (开发环境)
- **依赖**：
  - axios (HTTP请求)
  - koa-router (路由)
  - koa-static (静态文件服务)
  - 等等

## 项目结构

```
├── src/
│   ├── app/
│   │   ├── components/     # 组件
│   │   ├── contexts/       # 上下文
│   │   ├── pages/          # 页面
│   │   ├── services/       # 服务
│   │   └── App.tsx         # 应用入口
│   ├── styles/             # 样式文件
│   ├── main.tsx            # 主入口
│   └── vite-env.d.ts       # Vite类型声明
├── qq-music-api/           # QQ音乐API服务
│   ├── config/             # 配置文件
│   ├── middlewares/        # 中间件
│   ├── module/             # 模块
│   ├── routers/            # 路由
│   ├── util/               # 工具函数
│   ├── app.js              # API服务入口
│   └── package.json        # API服务配置
├── index.html              # HTML模板
├── package.json            # 项目配置
├── tsconfig.json           # TypeScript配置
├── vite.config.ts          # Vite配置
└── README.md               # 项目说明
```

## 项目启动步骤

### 1. 前端访问
前端已部署在Netlify上，可直接通过以下网址访问：

```bash
https://melorank.netlify.app/
```

### 2. 安装QQ音乐API服务依赖
由于前端需要连接本地的QQ音乐API服务，需要先安装API服务依赖：

```bash
cd qq-music-api
npm install
cd ..
```

### 3. 启动QQ音乐API服务
在新终端中启动QQ音乐API服务：

```bash
# 在新终端中运行
cd qq-music-api
npm run dev
```

API服务将在 `http://localhost:3200` 上运行。

## 功能模块

### 主页 (Home)
- 项目简介
- 推荐榜单

### 播放器 (Player)
- 歌曲播放
- 歌词显示
- 歌词导出
- 音量控制
- 一键评分

### 搜索 (Search)
- 关键词搜索

### 年度排行榜 (YearlyRanking)
- 年度歌曲
- 年度专辑
- 年度MV
- 年度艺人

### 音频实验室 (AudioLab)
- 音频处理
- 音效调整

## 注意事项

- **QQ音乐API服务**：必须先启动QQ音乐API服务，否则前端应用无法获取音乐数据
- **网络连接**：项目使用了QQ音乐API进行数据获取，请确保网络连接正常
- **开发环境**：Vite会自动热更新代码变更，Nodemon会自动重启API服务
- **依赖安装**：生产构建前，请确保所有依赖已正确安装
