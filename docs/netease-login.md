# 多平台登录与站内播放

QQ 音乐、网易云音乐、Spotify 的登录凭证独立保存，允许同时连接。顶部用户名和“我的音乐”账号使用同一状态源；“切换账号平台”决定搜索所用的平台，“我的音乐”的平台标签也同步切换。退出只清除对应平台的登录态。再次点击已登录平台时显示“已登录该平台账号”，不会重复生成二维码。

## 网易云

只保留已实机确认可用的 Go 网页扫码。已删除 Node 扫码、手机号登录、手动导入 Cookie 和浏览器扩展自动读取方案的代码与入口。

根目录运行 `npm run dev:netease-go`，需要 Go 1.26+，也可用 `MELORANK_GO_BIN` 指定 go 可执行文件。服务只监听本机 5001 端口，通过 Node 后端 5000 端口代理。Go 库固定为 `chaunsin/netease-cloud-music v0.8.1`，采用 `weapi + type=1`，每个二维码使用隔离会话。

网易云曲库、搜索、播放地址和歌词请求使用当前浏览器会话的网易云凭证，不调用 QQ 接口匹配替代音源。歌曲标识带平台前缀，避免不同平台相同 ID 混入队列。播放地址由平台根据账号权限返回；版权、会员限制和试听状态如实处理。

## Spotify

登录使用官方 OAuth PKCE。需要配置 Client ID，将 `http://127.0.0.1:5188/` 加入回调白名单。站内播放通过官方 Web Playback SDK，需要 Premium、应用访问资格和 `streaming` 等播放权限。

旧会话若仅授予曲库权限，登录面板会提供“更新播放授权”；仍可保持其他平台登录。Spotify 不提供完整音频文件下载，下载和实验室导入不会回退到 QQ 音源。

## 曲库交互

歌单详情左上角提供返回与播放图标，歌曲行提供播放／暂停图标，显示封面、歌手、专辑和时长。歌单播放会读取其余分页后建立队列。页面不再提供“在平台打开／播放”的跳转。

切换当前平台会停止已有播放并清空队列、搜索结果，阻止上个平台的未完成请求覆盖当前结果。返回曲库保留平台登录状态。

## 验证

- `npm run typecheck`、`npm run build`
- `node scripts/check-platform-accounts.cjs`：同时登录、平台切换、独立退出和旧账号响应隔离。
- `node scripts/check-platform-library.cjs`：网易云曲库、搜索、播放权限、歌词及 Go 登录代理。
- `node scripts/check-platform-songs.cjs`：歌曲平台标识、搜索／音源／歌词分发及禁止跨平台回退。
- `node scripts/check-spotify-pkce.cjs`、`node scripts/check-spotify-playback.cjs`：OAuth 和官方播放设备请求。
- `node scripts/check-queue-clear.cjs`：停止播放与迟到音源响应隔离。

上述自动化测试使用模拟账号。真实曲库、受会员限制的资源和实际声音输出仍需在用户已登录的浏览器内检查。Cookie、Token 和系统临时会话不能提交仓库。
