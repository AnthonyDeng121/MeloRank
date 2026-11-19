# 第三方组件说明

人声音高实验使用 [RMVPE](https://github.com/Dream-High/RMVPE)（原研究代码 Apache-2.0）和 [VoiceConversionWebUI 发布的 ONNX 权重](https://huggingface.co/lj1995/VoiceConversionWebUI/blob/main/rmvpe.onnx)，权重单独下载，不随仓库分发。实现参考 [Visual Pitch Trainer](https://github.com/iuill/visual-pitch-trainer)（MIT）的模型接口说明；详情见 [音高分析说明](docs/pitch-analysis.md)。

音频实验室的 MP3 导出使用未经修改的 [@breezystack/lamejs](https://github.com/shijinyu/lamejs)，基于 [LAME](https://lame.sourceforge.net/) 编码器，采用 LGPL-3.0 许可证。组件源码和许可证可通过上述仓库及所安装 npm 包中的 LICENSE 获取，版本记录于 package-lock.json。

编码器由独立 Web Worker 引入。修改或替换编码器后，可运行 `npm run build` 重新构建 Worker；运行 `node scripts/check-mp3-export.mjs` 验证编码结果（需要本地 ffmpeg、ffprobe）。

Go 扫码服务依赖 [chaunsin/netease-cloud-music](https://github.com/chaunsin/netease-cloud-music)，版本固定为 v0.8.1，采用 MIT 许可证；二维码编码依赖 [skip2/go-qrcode](https://github.com/skip2/go-qrcode)，采用 MIT 许可证。依赖版本与校验记录在 backend/netease-go/go.mod、go.sum 中，原始版权及许可保留在对应 Go 模块源码中。本项目调用其公开 API，没有复制其他播放器的实现代码。
