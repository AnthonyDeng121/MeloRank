"""RMVPE ONNX inference. Input: mono 16 kHz float32 PCM; output: JSON."""
import hashlib
import json
import os
from pathlib import Path
import sys
import time
import urllib.request

import numpy as np
import onnxruntime as ort
from scipy.signal import windows

MODEL_SHA = '5370e71ac80af8b4b7c793d27efd51fd8bf962de3a7ede0766dac0befa3660fd'
MODEL_URL = 'https://huggingface.co/lj1995/VoiceConversionWebUI/resolve/main/rmvpe.onnx'
ROOT = Path(os.environ.get('MELORANK_PITCH_DATA', Path.home() / '.melorank-pitch'))


def model_path():
    ROOT.mkdir(parents=True, exist_ok=True)
    target = ROOT / 'rmvpe.onnx'
    if not target.exists():
        temporary = ROOT / 'rmvpe.download'
        with urllib.request.urlopen(MODEL_URL, timeout=60) as response, temporary.open('wb') as output:
            while chunk := response.read(1024 * 1024):
                output.write(chunk)
        if hashlib.sha256(temporary.read_bytes()).hexdigest() != MODEL_SHA:
            temporary.unlink(missing_ok=True)
            raise ValueError('RMVPE 模型校验失败')
        temporary.replace(target)
    if hashlib.sha256(target.read_bytes()).hexdigest() != MODEL_SHA:
        raise ValueError('RMVPE 模型校验失败，请删除本地模型后重新分析')
    return target


def features(audio):
    padded = np.pad(audio, (512, 512), mode='reflect')
    frames = np.lib.stride_tricks.sliding_window_view(padded, 1024)[::160]
    magnitude = np.abs(np.fft.rfft(frames * windows.hann(1024, sym=False), axis=1)).T
    frequencies = np.arange(513) * 16000 / 1024
    edges = 700 * (10 ** (np.linspace(2595 * np.log10(1 + 30 / 700), 2595 * np.log10(1 + 8000 / 700), 130) / 2595) - 1)
    ramps = np.maximum(0, np.minimum((frequencies[None, :] - edges[:-2, None]) / np.diff(edges)[:-1, None], (edges[2:, None] - frequencies[None, :]) / np.diff(edges)[1:, None]))
    ramps *= (2 / (edges[2:] - edges[:-2]))[:, None]
    return np.log(np.maximum(ramps @ magnitude, 1e-5)).astype(np.float32)


def analyze(audio, session):
    # Bounded chunks with context keep memory stable on long songs.
    result = []
    for start in range(0, len(audio), 16000 * 15):
        left = max(0, start - 16000)
        end = min(len(audio), start + 16000 * 15)
        right = min(len(audio), end + 16000)
        mel = features(audio[left:right])
        count = mel.shape[1]
        mel = np.pad(mel, ((0, 0), (0, (-count) % 32)))
        activation = session.run(None, {session.get_inputs()[0].name: mel[None]})[0][0]
        for frame in range((start - left) // 160, (end - left + 159) // 160):
            values = activation[frame]
            peak = int(values.argmax())
            indices = np.arange(max(0, peak - 4), min(360, peak + 5))
            weights = values[indices]
            cents = np.sum((indices * 20 + 1997.3794084376191) * weights) / max(float(weights.sum()), 1e-8)
            hz = float(10 * 2 ** (cents / 1200)) if values[peak] >= .03 else 0
            sample = audio[left + frame * 160:left + frame * 160 + 160]
            if not len(sample) or np.sqrt(np.mean(sample ** 2)) < .002:
                hz = 0
            result.append(round(hz, 2))
    return result


if __name__ == '__main__':
    if sys.argv[1] == '--setup':
        print(model_path())
    else:
        started = time.perf_counter()
        audio = np.fromfile(sys.argv[1], dtype='<f4')
        if not len(audio) or not np.isfinite(audio).all():
            raise ValueError('无效音频数据')
        options = ort.SessionOptions()
        options.intra_op_num_threads = 2
        session = ort.InferenceSession(str(model_path()), sess_options=options, providers=['CPUExecutionProvider'])
        loaded = time.perf_counter()
        hz = analyze(audio, session)
        print(json.dumps({'version': 1, 'hop': .01, 'hz': hz, 'duration': len(audio) / 16000, 'loadSeconds': round(loaded - started, 3), 'analysisSeconds': round(time.perf_counter() - loaded, 3)}))
