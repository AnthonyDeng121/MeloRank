"""Run an actual RMVPE smoke test against known tones and silence."""
import tempfile
from pathlib import Path
import json
import subprocess
import sys

import numpy as np

with tempfile.TemporaryDirectory(prefix='melorank-pitch-check-') as folder:
    pcm = Path(folder) / 'test.pcm'
    signal = np.concatenate([
        np.zeros(16000),
        .2 * np.sin(2 * np.pi * 220 * np.arange(32000) / 16000),
        .2 * np.sin(2 * np.pi * 523.251 * np.arange(32000) / 16000),
        np.zeros(16000),
    ]).astype('<f4')
    signal.tofile(pcm)
    process = subprocess.run([sys.executable, str(Path(__file__).with_name('analyze.py')), str(pcm)], capture_output=True, text=True, check=True)
    result = json.loads(process.stdout)
    values = np.asarray(result['hz'])
    assert len(values) == 600
    assert not np.any(values[:80]) and not np.any(values[530:])
    for section, expected in [(values[150:250], 220), (values[350:450], 523.251)]:
        assert np.mean(section > 0) > .9
        cents = 1200 * np.log2(np.median(section[section > 0]) / expected)
        assert abs(cents) < 25, cents
    print(json.dumps({key: value for key, value in result.items() if key != 'hz'}))
    print('PASS: A3 / C5 within 25 cents, silence empty, frame timing correct')
