"""Separate accompaniment/lead/backing vocals, then run the existing RMVPE."""
import contextlib
import gc
import json
import logging
import math
import os
from pathlib import Path
import sys
import time
import threading

from analyze import ROOT, analyze, model_path

VOCAL_MODEL = 'model_bs_roformer_ep_317_sdr_12.9755.ckpt'
LEAD_MODEL = 'UVR_MDXNET_KARA_2.onnx'


def event(**values):
    print(json.dumps(values), flush=True)


def run(source, output):
    import numpy as np
    import onnxruntime as ort
    import soundfile as sf
    import torch
    from scipy.signal import resample_poly
    from audio_separator.separator import Separator

    torch.set_num_threads(max(1, min(4, int(os.environ.get('MELORANK_SEPARATOR_THREADS', '2')))))
    output.mkdir(parents=True, exist_ok=True)
    started = time.perf_counter()
    info = sf.info(source)
    if info.duration > 600 or info.duration <= 0 or info.channels > 2:
        raise ValueError('仅支持十分钟以内的单声道或立体声音频')
    with contextlib.redirect_stdout(sys.stderr):
        common = dict(output_dir=str(output), model_file_dir=str(ROOT / 'separator-models'), output_format='WAV', use_soundfile=True, log_level=logging.WARNING)
        separator = Separator(**common)
    event(phase='loading-vocals', progress=5)
    with contextlib.redirect_stdout(sys.stderr):
        separator.load_model(model_filename=VOCAL_MODEL)
    event(phase='separating-vocals', progress=15)
    with contextlib.redirect_stdout(sys.stderr):
        separator.separate(str(source), {'Vocals': 'all-vocals', 'Instrumental': 'instrumental'})
        del separator
        gc.collect()
    vocals = output / 'all-vocals.wav'
    if not vocals.is_file():
        raise RuntimeError('人声分离没有生成预期音轨')
    event(phase='loading-lead', progress=50)
    with contextlib.redirect_stdout(sys.stderr):
        separator = Separator(**common)
        separator.load_model(model_filename=LEAD_MODEL)
    event(phase='separating-lead', progress=60)
    with contextlib.redirect_stdout(sys.stderr):
        separator.separate(str(vocals), {'Vocals': 'lead', 'Instrumental': 'backing'})
        del separator
        gc.collect()
    lead, sample_rate = sf.read(output / 'lead.wav', dtype='float32', always_2d=True)
    mono = lead.mean(axis=1)
    divisor = math.gcd(sample_rate, 16000)
    mono = resample_poly(mono, 16000 // divisor, sample_rate // divisor).astype(np.float32)
    # Preserve the original playback clock even if an exporter pads its final block.
    target_length = round(info.duration * 16000)
    mono = np.pad(mono[:target_length], (0, max(0, target_length - len(mono))))
    separated = time.perf_counter()
    event(phase='loading-pitch', progress=85)
    options = ort.SessionOptions()
    options.intra_op_num_threads = 2
    session = ort.InferenceSession(str(model_path()), sess_options=options, providers=['CPUExecutionProvider'])
    loaded = time.perf_counter()
    event(phase='analyzing-pitch', progress=90)
    hz = analyze(mono, session)
    event(result={'version': 1, 'hop': .01, 'hz': hz, 'duration': info.duration,
                  'loadSeconds': round(loaded - separated, 3), 'analysisSeconds': round(time.perf_counter() - loaded, 3),
                  'separationSeconds': round(separated - started, 3), 'models': [VOCAL_MODEL, LEAD_MODEL]})


if __name__ == '__main__':
    if sys.argv[1] == '--setup':
        from audio_separator.separator import Separator
        with contextlib.redirect_stdout(sys.stderr):
            separator = Separator(model_file_dir=str(ROOT / 'separator-models'), log_level=logging.WARNING)
            for model in (VOCAL_MODEL, LEAD_MODEL):
                separator.download_model_files(model)
        event(ready=True)
    else:
        # Windows venv launchers spawn a second python.exe; end the actual model
        # process before the Node watchdog, so a timeout cannot orphan inference.
        watchdog = threading.Timer(55 * 60, lambda: os._exit(124))
        watchdog.daemon = True
        watchdog.start()
        try:
            run(Path(sys.argv[1]), Path(sys.argv[2]))
        finally:
            watchdog.cancel()
