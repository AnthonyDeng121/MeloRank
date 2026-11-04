# 网易云登录备用方式

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
- [SPlayer 的手机号登录](https://github.com/imsyy/SPlayer/blob/dev/src/components/Modal/Login/LoginPhone.vue)：短信验证码登录也是候选路径，但接口存在并不代表当前账号和网络一定可用。MeloRank 本次没有新增短信发送或注册行为。

QQ 音乐的登录凭证不能用于网易云。若网易云官网提供 QQ/微信授权入口，需要在官网完成对网易云的授权并取得网易云自己的登录凭证。

## 验证

`node scripts/check-netease-cookie.cjs` 检查输入规范化、无关 Cookie 过滤、后端账号校验、失败不覆盖已有登录态、取消后不保存凭证。真实账号登录及曲库读取仍需用户在页面中完成验证。
