# 第三方组件说明

音频实验室的 MP3 导出使用未经修改的 [@breezystack/lamejs](https://github.com/shijinyu/lamejs)，基于 [LAME](https://lame.sourceforge.net/) 编码器，采用 LGPL-3.0 许可证。组件源码和许可证可通过上述仓库及所安装 npm 包中的 LICENSE 获取，版本记录于 package-lock.json。

编码器由独立 Web Worker 引入。修改或替换编码器后，可运行 `npm run build` 重新构建 Worker；运行 `node scripts/check-mp3-export.mjs` 验证编码结果（需要本地 ffmpeg、ffprobe）。
