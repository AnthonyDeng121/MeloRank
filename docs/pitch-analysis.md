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

VerseViva 当前配置为 Demucs `htdemucs`。Visual Pitch Trainer 提供可选 Demucs / RoFormer 分离路线，但应用本身不保证更好的分离质量。原曲 RMVPE 面板继续保留，复杂和声、合唱和乐器可能影响结果。

## 主唱分离对比（2026-11-20）

播放器和音频实验室均在原曲 RMVPE 面板下方增加独立对比面板。使用 `python-audio-separator==0.48.0`，依次运行：

1. `model_bs_roformer_ep_317_sdr_12.9755.ckpt`：分离伴奏与全部人声。
2. `UVR_MDXNET_KARA_2.onnx`：对全部人声运行主唱／背景和声分离。
3. 将主唱送入同一 RMVPE 实现，沿用原曲播放时间。主唱、和声、伴奏可分别试听。

独立环境安装（PowerShell）：

```powershell
python -m venv "$env:USERPROFILE/.melorank-pitch/separator-venv"
& "$env:USERPROFILE/.melorank-pitch/separator-venv/Scripts/python.exe" -m pip install -r backend/pitch/requirements-separator.txt
& "$env:USERPROFILE/.melorank-pitch/separator-venv/Scripts/python.exe" backend/pitch/separate.py --setup
```

默认从上述环境启动分离任务，也可用 `MELORANK_SEPARATOR_PYTHON` 指定独立解释器。需要系统 FFmpeg。两个模型由库下载到 `.melorank-pitch/separator-models` 并按库的 SHA256 清单校验；首次准备时间不计入后续缓存读取耗时。补充声明 `audioread` 依赖，因为当前安装组合的库源码会直接导入该包。

浏览器发送单／双声道 44.1 kHz、16-bit WAV，保留分离所需的立体声；原曲直接 RMVPE 路线仍发送单声道 16 kHz PCM。两条路线的缓存键分别计算，算法和模型版本加入键中，不会互相覆盖。暂不替换播放音源，也不会自动开启分离。

新接口提交后立即返回任务 ID，客户端每 1.5 秒查询阶段和已用时间。推理进程 55 分钟硬性超时，Node 有一小时的兜底时限，避免 Windows 虚拟环境启动器留下孤立推理进程；同一音频复用正在进行的任务，最多并行一个分离任务。切歌或离开页面会停止前端等待，已启动的后台任务继续完成以便下次命中缓存。原曲上传文件和中间全部人声在任务结束后删除；音高结果与三条输出 WAV 在 `.melorank-pitch/separated` 持久缓存，可通过删除此目录清理。

分离试听不会自动暂停原曲；请先暂停原曲再试听，同一面板内三条试听轨互斥播放。分离得到的“和声”是模型估计的背景成分，可能包括主唱叠录、混响或残余伴奏，不能保证是干净的音乐学和声。应通过同一片段的试听和曲线比较评估实际效果。

`node scripts/check-pitch-separation.cjs` 检查真实 HTTP 路由的输入验证、去重、并发保护、阶段查询、缓存、音轨访问与输入清理；该检查用替身进程代替昂贵的模型推理，不能作为模型效果证据。

`node scripts/check-pitch-wav.cjs` 检查实际前端服务函数的立体声交错、幅度限幅、WAV 头、任务轮询、试听地址和中止等待。

本机已安装独立环境并准备两个模型。另用六秒实际音频片段运行真实 Karaoke 2 与 RMVPE，成功生成 `lead.wav`、`backing.wav` 和 600 帧音高；核对了 Karaoke 2 的主输出标签为 Instrumental、次输出为 Vocals，因此将后者作为主唱。这是接口、时长和衔接验证，不代表主唱分离的准确率已达到要求。

完整三步流程也已在同一六秒片段上实跑通过，三条输出音轨均生成，最终得到 600 帧音高。单线程、与另一整曲分离任务并行的压力条件下，分离耗时 501.862 秒，RMVPE 加载 1.892 秒、推理 1.025 秒。该数据说明当前机器 CPU 路线开销很高，不能直接当作独占运行或 GPU 上的速度；默认继续手动启动，建议先在实验室修剪短片段比较质量。可用 `MELORANK_SEPARATOR_THREADS` 指定 PyTorch 线程数（1～4，默认 2）。

本次浏览器控制服务不可用，未完成实际页面的字体、尺寸、对齐和点击交互检查；需要在本地页面补充确认。
