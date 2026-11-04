# 网易云登录备用方式

## 新增的三种入口

- **Go 网页扫码**：实际调用 `chaunsin/netease-cloud-music v0.8.1` 的 `weapi` 接口，生成与轮询均使用 `type=1`，二维码使用 Web 模式。区别于 Node 库默认的 `type=3` 流程。需要额外运行一个仅监听本机 5001 端口的 Go 服务。根目录执行 `npm run dev:netease-go`，需要 Go 1.26+（也可用 `MELORANK_GO_BIN` 指定 go 可执行文件）。Go 的会话凭证放在系统临时目录，按会话隔离并在过期后清理，不能提交到仓库。
- **手机号登录**：输入已有网易云账号的国家区号、手机号，主动点击获取短信验证码，再输入验证码登录。发送存在 60 秒冷却，验证码登录限制尝试次数；未接入密码或新用户注册。若平台要求额外安全验证，请改用官网。实机发送与登录必须由用户操作，测试不向虚构号码发送短信。
- **官网登录凭证 → 打开官网并自动连接**：先加载下述浏览器扩展，再点击按钮。扩展打开网易云官网，登录成功后将自己的网易云凭证自动传回 MeloRank，后端验证成功才保存。已在官网有登录态时会使用当前登录账号。仍保留手动输入作为备用。

## 安装自动登录助手（Chrome / Edge）

1. 在与 MeloRank 相同的浏览器中打开 `chrome://extensions` 或 `edge://extensions`。
2. 开启开发者模式，点击“加载已解压的扩展程序”，选择项目中的 `browser-extension/netease-login` 文件夹。
3. 扩展需要网易云域名的 Cookie 权限，以及本机页面的内容脚本权限。此权限可在扩展管理页撤销。
4. 刷新 `http://127.0.0.1:5188/` 或 `http://localhost:5188/`，点击“登录 → 网易云 → 官网登录凭证 → 打开官网并自动连接”。
5. 在新打开的官方页面完成登录；页面会自动回到 MeloRank 并验证账号。可点击“取消连接”停止等待。

扩展只在按钮触发后允许读取，等待窗口为 3 分钟，每次只传递一次。只选择 `MUSIC_U`、`__csrf`、`NMTID`、`MUSIC_A`，不将凭证写入扩展存储、剪贴板或日志。目标限制为本机 5188 端口的顶层页面，不支持线上站点、其他端口或 iframe。其后的账号验证仍会向 MeloRank 配置的后端发送凭证。普通网页无法直接读取其他站点 Cookie，因此不能省略扩展安装步骤。不要关闭浏览器安全设置来实现跨站读取。

目前自动化检查覆盖协议、会话隔离、输入限制、扩展来源限制和凭证传递；真实手机扫码、接收短信、安装扩展后的官方账号登录仍需实机确认。

当第三方扫码二维码被网易云 App 拦截时，可先在网易云官网正常登录，再将自己的登录凭证导入 MeloRank。此方式需要真实账号验证，不能保证平台一定接受后续接口请求。

## 使用步骤

1. 在 Chrome 或 Edge 中打开 https://music.163.com/#/login ，通过页面提供的方式完成登录。若使用 QQ、微信等方式，应确认进入的是自己原有的网易云账号；不同账号的曲库不会自动合并。注册新账号也不会继承旧账号曲库。
2. 确认官网显示自己的账号后，按 F12 打开开发者工具，进入“应用 / Application”→“存储 / Storage”→“Cookie”，选择 `https://music.163.com`。如果看不到“应用”，可在开发者工具顶部的 `>>` 菜单里寻找。
3. 找到名称为 `MUSIC_U` 的 Cookie，复制它的“值 / Value”。不要复制名称、域名或整行表格。
4. 返回 MeloRank，打开“登录”→“网易云”→“官网登录凭证”，填入 `MUSIC_U=复制的值;`，点击“验证并连接”。
5. 验证成功后，到“我的音乐”选择“网易云音乐”，检查账号和曲库是否正确。若凭证失效，请重新在官网登录并导入。

Cookie 是登录凭证，不是账号 ID。不要发到聊天中，不要截图分享，不要放入代码或提交仓库。导入的凭证会发送到当前配置的 MeloRank 后端验证，并仅保存在当前标签页的 sessionStorage 中；断开连接会清除。网页不能直接读取网易云官网的 Cookie，因此仅打开官网完成登录不会让 MeloRank 自动登录。

## 方案来源和限制

- [接口库维护者的说明](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced/issues/4)：在官方网页完成登录，再使用登录 Cookie。
- [SPlayer 的凭证登录界面](https://github.com/imsyy/SPlayer/blob/dev/src/components/Modal/Login/LoginCookie.vue)：网页手动输入，桌面版额外支持自动获取。
- [SPlayer-Next 的登录窗口](https://github.com/SPlayer-Dev/SPlayer-Next/blob/main/electron/main/window/login.ts)：由 Electron 在独立会话中打开官网并读取登录 Cookie；MeloRank 当前是普通网页，不能直接使用这种桌面能力。
- [SPlayer 的手机号登录](https://github.com/imsyy/SPlayer/blob/dev/src/components/Modal/Login/LoginPhone.vue)：短信验证码登录也是候选路径，但接口存在并不代表当前账号和网络一定可用。MeloRank 已提供发送验证码和登录入口，没有实现新账号注册。

QQ 音乐的登录凭证不能用于网易云。若网易云官网提供 QQ/微信授权入口，需要在官网完成对网易云的授权并取得网易云自己的登录凭证。

## 验证

`node scripts/check-netease-cookie.cjs` 检查输入规范化、无关 Cookie 过滤、后端账号校验、失败不覆盖已有登录态、取消后不保存凭证。真实账号登录及曲库读取仍需用户在页面中完成验证。
