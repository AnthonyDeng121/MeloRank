# 项目简介

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
