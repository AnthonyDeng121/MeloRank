# 登录、曲库与音频修复记录

本次目标：统一三平台登录体验，提供站内歌单和专辑详情，纠正失效试听提示，减少升调拼接伪影，并核查付费专辑接口。

## 修改前后

- 艺人推荐“大树之母”改为“卢克杯子”。
- 顶部、首页及我的音乐共用三平台登录弹窗。QQ/网易云二维码与 Spotify 授权配置放在相同布局中；关闭或切换平台会停止轮询，晚到的响应不能保存登录态。
- 播放、下载错误及试听提示改为顶部提示，约5秒自动消失。只有音频开始播放后才显示试听提示。
- 原先把非空 `purl` 当作可用音源；现对试听链接请求少量字节，检查 HTTP 成功和 MP3/M4A 文件头，拒绝 CDN 返回的 JSON 错误。补充使用 `media_mid` 的新版 VKey 请求及 AAC 候选，仍以平台实际授权为准。
- 歌单、专辑增加站内歌曲列表和分页。QQ 歌曲复用已有播放器与权限检查；网易云、Spotify 可在站内浏览歌曲，播放入口仍跳转对应平台，未实现它们的站内完整播放。
- SoundTouch 离线处理关闭 quickSeek，使用60ms序列、20ms搜索窗口和16ms交叉淡化。原先为自动长序列、粗略搜索和8ms重叠。

## 升调“卡顿”的分析及限制

当前先生成完整 WAV 再试听，没有边听边运行变调算法。SoundTouch 在升调时通过时间拉伸补偿重采样导致的时长变化；波形拼接和瞬态重复可能产生类似卡顿的听感。默认粗略搜索可能错过更好的拼接位置。此次调整提高匹配精度并缩短重复序列，但这是基于算法的改进，不能仅凭源码断定用户原曲的唯一原因。

代价是离线处理更慢。44.1/48kHz 下独立变调、变速、组合裁剪和输出时长测试通过；未完成设备上的主观听感对比，不能保证所有歌曲的伪影均已消除。

## 试听实测

游客请求 Taylor Swift《Patient Zero》（`0003mjnm10HxDz`），旧 RS02 地址非空，但 CDN 返回404和 JSON 错误，Content-Type 甚至标为 audio/mpeg。进一步核查确认真实媒体标识为 `001WtnUf04DBe0`，新版接口的试听文件名应使用单个媒体标识，且 `sip` 可能为空，需要采用上游库相同的默认 CDN `https://isure.stream.qqmusic.qq.com/`。修复后本地接口返回 `isPreview=true`、30秒上限，实际音频范围请求206、256字节且包含有效 MP3 帧头。该样本已获得有效游客试听资源；本机浏览器播放仍未验收。

免费样本《义勇军进行曲（合唱）》（`003h45Yk3yWjLk`）仍返回可用地址，音频范围请求206、256字节。不能把“支持平台提供的试听”理解为“所有付费歌曲都能试听30秒”。

另对《Patient Zero》的试听音源执行了完整文件检查：ffprobe 识别为44.1kHz、双声道 MP3，平台资源本身为60秒，网站仍按30秒上限播放；ffmpeg 完整解码通过。这比只检查链接非空更能说明资源有效，但不替代浏览器的播放验收。

## GitHub 仓库核查

核查日期：2026-10-29。仓库访问量不对外完整公开，采用 stars 作为关注度参考；这不是全 GitHub 穷举，也不是访问量排行榜。

| 仓库 | 关注度参考 | 核查结果 |
| --- | --- | --- |
| [jsososo/QQMusicApi](https://github.com/jsososo/QQMusicApi) | 页面约1.6k stars | `routes/song.js` 调用 `vkey.GetVkeyServer/CgiGetVkey`，从 `sip` 和 `purl` 拼链接，需账号 Cookie；未发现独立于平台授权的付费专辑解决方案。 |
| [Rain120/qq-music-api](https://github.com/Rain120/qq-music-api) | GitHub API：1115 stars | 本项目旧接口来源，同样依赖 VKey 和平台下发的 `purl`。 |
| [L-1124/QQMusicApi](https://github.com/L-1124/QQMusicApi) | GitHub API：523 stars | 实现较新的 `music.vkey.GetVkey/UrlGetVkey` 和加密音源 EVKey；文档仍明确列出无权限和设备受限结果码。 |

主要源码及文档：

- [jsososo song.js](https://github.com/jsososo/QQMusicApi/blob/master/routes/song.js)
- [Rain120 getMusicPlay.js](https://github.com/Rain120/qq-music-api/blob/master/routers/context/getMusicPlay.js)
- [L-1124 song.py](https://github.com/L-1124/QQMusicApi/blob/main/qqmusic_api/modules/song.py)
- [L-1124 下载权限说明](https://github.com/L-1124/QQMusicApi/blob/main/docs/tutorial/download.md)

链接通常由 CDN 基址 `sip` 与文件路径 `purl` 拼成；文件名编码音质及媒体标识，查询参数包含临时 VKey、请求身份等信息，不能当作永久静态 URL。非空地址也不保证 CDN 中有该文件，需要验证实际响应。

`104003` 表示无权限，`104004` 是 VKey 获取失败，`104013` 是设备受限。EVKey 面向加密音源，拿到链接后也未必能由浏览器直接解码。现有证据支持继续排查已购买账号的接口兼容性；不支持宣称换仓库就能让未购买账号获得付费专辑完整播放权限，也不支持宣称所有仓库都永远无解。

## 验证与可汇报技术点

- 请求作用域隔离账号 Cookie，配合异步轮询取消标记，避免关闭弹窗后恢复旧登录态。
- 用资源级验证区分“控制接口成功”和“媒体文件可播放”，新增失效 CDN 回归测试。
- 统一弹窗组件与事件入口；全局提示复用 Sonner，减少页面分散状态。
- 站内集合详情复用标准歌曲结构、已有播放器、分页及请求代次校验，避免切换账号后旧歌曲列表回填。
- 真实 QQ 账号读取歌单与专辑详情均为200，抽查分别返回3首、15首歌曲；未在记录中保存账号凭据。
- 网易云集合接口已做鉴权、无效标识、分页与字段映射测试；未进行真实账号扫码授权。Spotify 无用户提供的 Client ID，未完成真实 OAuth 联调。
- 浏览器控制服务两次返回 `The browser access host is unavailable`，本次无法完成实际界面的美观性、弹窗交互与提示5秒消失检查，也无法进行实际听感验收。
