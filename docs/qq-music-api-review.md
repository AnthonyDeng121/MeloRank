# QQ 音乐接口核对（2026-10-26）

项目当前使用 `Rain120/qq-music-api` 的 JavaScript 1.0.5 副本，并有本地扫码登录、播放等修改。仓库来源由 `qq-music-api-main/package.json` 的 repository 字段及前端配置确认。

| 仓库 | 本次读取到的默认分支最近提交 | 对 MeloRank 的价值 |
| --- | --- | --- |
| [Rain120/qq-music-api](https://github.com/Rain120/qq-music-api) | next：2026-08-21，README 徽章修复；2026-08-14 有搜索空列表修复 | next 已迁移 TypeScript，提供 API Explorer、动态参数表单、响应预览和会话请求日志。main 保留 JavaScript 版本。 |
| [L-1124/QQMusicApi](https://github.com/L-1124/QQMusicApi) | main：2026-10-05，分页参数与默认页数上限优化 | Python 实现且有 Web 层；2026-10-04 新增音响力与听歌榜模块及 Web 路由，可进一步验证后用于个人听歌统计。 |
| [jsososo/QQMusicApi](https://github.com/jsososo/QQMusicApi) | master：2022-07-09，增加 Jest 和修复 | 文档及实现可参考微信登录、登录刷新等能力；本次读取到的主分支更新较旧。 |
| [copws/qq-music-api](https://github.com/copws/qq-music-api) | main：2025-09-14，更新音乐请求实现 | 轻量 fetch 实现，可参考专辑曲目、MV、带翻译歌词解析。作者称 2025-09 验证过接口；本次没有验证所有接口当前仍可用。 |

本次通过 Firecrawl 搜索并读取以上 GitHub 页面及上游 README。日期是读取到的分支提交日期，不代表所有功能均经过现场调用验证。

建议先使用当前服务已提供但前端尚未充分利用的接口：相似歌手、歌手专辑、MV 播放、新碟、热搜、歌单分类与推荐。专辑详情和关联搜索建议已在本次改动中接入。

不直接覆盖本地接口目录：上游 next 的目录结构已改变，且登录与个人信息仍被列为未完善能力；覆盖会丢失本地扫码登录和播放适配。后续迁移应保留这两部分并逐项验证。

本次运行验证：Kesha《.》通过歌手专辑列表匹配到普通版 `001Wp3u34YzuUk`，获取 11 首曲目，从 FREEDOM. 开始；浏览器中播放成功，整张专辑按顺序进入队列；该歌曲已成功导入音频实验室。会员和版权权限仍由实际音源接口决定。

昵称改为解析 QQ 扫码成功回调中的昵称，并持久化到浏览器。已有的通用昵称需要重新扫码一次更新；真实扫码流程需要用户本人完成，自动化检查使用模拟回调覆盖中文、转义字符、Unicode 和等待状态。
