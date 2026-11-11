# 播放器、作品浏览与个人乐评

## 使用方式

- 禁用按钮统一使用禁止光标。悬停时直接显示不能操作的具体原因，如空榜单、未输入搜索词、正在同步歌单、筛选期间不能排序。
- 年度榜单只保留一个「导出」，弹窗选择 Word、PDF、长图片或每页图片；原有导出格式保持可用。
- 编辑平台歌单时，可从已读取歌曲的专辑封面中选择，也可继续上传本地图片。重复封面合并显示，选中后先预览，点击「保存到平台」才提交。
- 播放器顶部可切换歌曲、专辑、歌手。歌曲页缩小封面、间距和控件；专辑、歌手页显示基本信息及曲目列表，支持播放全部或点击单曲。平台有更多曲目时显示「加载更多曲目」。
- 搜索支持歌曲、专辑、歌手三类，点击专辑或歌手结果会打开播放器中的对应内容。歌手界面显示平台提供的热门歌曲。
- 歌曲、专辑可打开「评分 / 导出乐评卡」，使用 0–10 分制，专辑支持逐曲评分与文字乐评，导出 PNG。评分保存到当前浏览器，不会写入年度榜单，也不会同步到平台。专辑需要加载完整曲目后才开放评分。
- 搜索中的旧评分入口明确标为「加入年度榜单」，保留原有年度榜单流程。

## 实现要点

1. `catalog.ts` 将 QQ、网易云、Spotify 的专辑、歌手、曲目统一映射为包含平台和稳定 ID 的模型；从当前歌曲打开详情时传递真实 ID，避免同名作品误匹配。Spotify 曲目补齐 `albumId`。
2. 搜索使用请求序号处理异步结果，切换类型后旧请求不会覆盖新结果。详情页在卸载后忽略已过期响应，错误支持重试。
3. `WorkReview` 使用独立的 `melorank:work-review:v1:*` 存储键，按平台、作品类型和 ID 隔离。Canvas 按标题、评论和曲目数计算高度，生成整体评分圆环与逐曲评分图片。
4. 专辑封面复用受控图片转换、裁剪及上传校验；远程封面读取失败时明确报错，不将占位图保存为歌单封面。
5. 统一弹窗支持 Escape、焦点约束、关闭后恢复焦点及背景滚动锁定；禁用原因同时写入原生 title，并在恢复可用时还原标题。

## 播放是否计入真实平台

- **QQ / 网易云**：当前实现获取音源 URL 后使用本站 HTMLAudioElement 播放；没有主动提交播放完成、听歌时长或听歌记录的逻辑。不能保证进入对应平台的个人听歌排行、年度报告或有效播放量；也不能仅凭本站代码判断平台是否根据服务端请求统计了部分数据。
- **Spotify**：当前实现通过官方 Web Playback SDK 创建 Spotify Connect 播放设备，音频由官方播放链路处理。按这一机制，正常播放应走官方统计流程，但最终有效播放判断由 Spotify 决定。官方说明歌曲播放至少 30 秒才计一次 stream；这不等于承诺所有个人报表都会立即更新。
- 是否计数应按**实际播放来源**判断，不能根据搜索来源或封面所属平台判断。此次改动没有增加模拟上报行为。

参考：[Spotify Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk)、[Spotify 播放统计说明](https://support.spotify.com/om-en/artists/article/how-your-streams-are-counted/)。

## 验证

```powershell
npm run typecheck
npm run build
node scripts/check-catalog-behavior.cjs
node scripts/check-platform-library.cjs
node scripts/check-platform-songs.cjs
npm run check:playlist
npm run check:export
```

浏览器测试使用隔离的 Playwright profile 和模拟平台响应，不读取现有登录状态、不修改真实平台歌单。先运行本地前端，然后使用可用的 Playwright Core 和 Chromium 浏览器：

```powershell
npm install --prefix "$env:TEMP/melorank-ui-qa" playwright-core --no-audit --no-fund
$env:MELORANK_PLAYWRIGHT_MODULE = "$env:TEMP/melorank-ui-qa/node_modules/playwright-core"
node scripts/check-music-experience-browser.cjs
```

默认使用本机 Edge，也可设置 `MELORANK_BROWSER_PATH`。测试检查 1440×900、1366×768、1024×768 桌面布局和 390px 移动布局、禁用原因、作品跳转、评分持久化、歌曲及专辑 PNG 下载、导出格式弹窗；截图和图片写入系统临时目录。真实账号的版权、会员限制以及平台最终统计结果仍需在对应账号中验证。
