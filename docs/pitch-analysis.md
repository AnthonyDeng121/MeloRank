# RMVPE 人声音高实验

播放器音量条下方与音频实验室共用 PitchPanel，点击“分析音高”后读取音频，浏览器解码并降混为单声道、重采样到 16 kHz，再向本地后端发送 float32 PCM。不会通过麦克风采集声音。分析期间可以继续播放；完成后按播放时间显示科学音高记号（A4=440 Hz）、音分与连续曲线。低置信度和静音留空。Spotify 官方播放器不开放可读取音源，因此当前不支持。

## 运行

需要 Python 3.10+：

```powershell
python -m pip install -r backend/pitch/requirements.txt
python backend/pitch/analyze.py --setup
python backend/pitch/check.py
```

随后按原方式启动前后端即可。可使用 MELORANK_PYTHON 指定 Python 可执行文件，MELORANK_PITCH_DATA 指定模型和结果缓存目录。默认目录是用户主目录下的 `.melorank-pitch`，不在 Git 仓库内。首次模型下载约 362 MB，需要网络；下载后验证 SHA256。建议部署前先执行 setup，避免用户首次分析触发下载。

服务使用 ONNX Runtime CPU 推理，不要求 CUDA。15 秒一块、前后各 1 秒上下文，限制单次推理内存。原始 PCM 在分析结束或失败后删除，结果按 PCM 内容和算法版本的 SHA256 缓存。模型与音高 JSON 缓存会持续保留，可手动清理目录内的 JSON 释放结果缓存。浏览器内额外缓存最近 10 个音源结果；刷新后再次分析时仍可命中后端缓存。音源需要能跨域读取。当前试验版限制 10 分钟音频，后端单任务执行，超时 15 分钟。

## 本机验证（2026-11-19）

- 6 秒测试音频：A4 中位数 439.65 Hz，静音片段无音高。
- 60 秒合成音频：模型加载 1.735 秒，特征提取与推理共 5.321 秒。
- 6 秒 HTTP 分析：首次约 5.90 秒，缓存命中约 0.19 秒。包括请求等开销，不包含浏览器下载音源、解码耗时。
- 首次冷加载另一次测得 6.824 秒，耗时会受磁盘缓存与负载影响。

以上是合成信号的链路与性能验证，不代表真实带伴奏歌曲的主唱识别准确率。暂时使用手动分析，待真实歌曲测试后再决定自动分析策略。暂停、跳转依赖播放器当前时间，变调/变速/裁剪后的实验室预览作为新音源分析。

## 模型与来源

- [原始 RMVPE 研究代码](https://github.com/Dream-High/RMVPE)，Apache-2.0；[论文](https://arxiv.org/abs/2306.15412)专门研究带伴奏音乐的人声音高。
- 本实现使用 [VoiceConversionWebUI 的 RMVPE ONNX 模型](https://huggingface.co/lj1995/VoiceConversionWebUI/blob/main/rmvpe.onnx)。模型与应用代码分别受各自发布条款约束；权重不加入 Git。
- [Visual Pitch Trainer](https://github.com/iuill/visual-pitch-trainer)，MIT，作为浏览器文件分析、模型地址、SHA256 和推理接口的参考。本次未整体移植该应用。

VerseViva 当前配置为 Demucs `htdemucs`。Visual Pitch Trainer 提供可选 Demucs / RoFormer 分离路线，但应用本身不保证更好的分离质量。本次直接使用 RMVPE，没有新增分离模型；复杂和声、合唱和乐器仍可能影响结果。

本次浏览器控制服务不可用，未完成实际页面的字体、尺寸、对齐和点击交互检查；需要在本地页面补充确认。
