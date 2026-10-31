#!/usr/bin/env python3
"""
No.44 · 字符剧场 · CHARACTER THEATER × SOLO LAB
Room-shared theatrical sound effects (sfx_palette) + 116 BPM theatrical minimal-electro groove.
"""
import json
import math
import sys
import wave
import numpy as np

SR = 48000


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def pan_stereo(mono: np.ndarray, pan: float = 0.0) -> np.ndarray:
    pan = clamp(pan, -1.0, 1.0)
    ang = (pan + 1.0) * (math.pi / 4.0)
    gl = math.cos(ang)
    gr = math.sin(ang)
    out = np.zeros((len(mono), 2), dtype=np.float32)
    out[:, 0] = mono * gl
    out[:, 1] = mono * gr
    return out


def biquad_bandpass(x: np.ndarray, f0: float, q: float = 2.0) -> np.ndarray:
    f0 = clamp(f0, 40.0, SR * 0.45)
    w0 = 2.0 * math.pi * f0 / SR
    alpha = math.sin(w0) / (2.0 * max(0.2, q))
    b0 = alpha
    b1 = 0.0
    b2 = -alpha
    a0 = 1.0 + alpha
    a1 = -2.0 * math.cos(w0)
    a2 = 1.0 - alpha
    b0 /= a0
    b1 /= a0
    b2 /= a0
    a1 /= a0
    a2 /= a0
    y = np.zeros_like(x, dtype=np.float32)
    x1 = x2 = y1 = y2 = 0.0
    for i in range(len(x)):
        xi = float(x[i])
        yi = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        y[i] = yi
        x2, x1 = x1, xi
        y2, y1 = y1, yi
    return y


def sfx_bubble(freq=580.0, dur=0.075, amp=0.26, seed=1):
    n = int(SR * dur)
    t = np.arange(n, dtype=np.float32) / SR
    f_inst = freq * (1.0 + 0.85 * (t / dur) ** 1.3)
    phase = 2.0 * math.pi * np.cumsum(f_inst) / SR
    env = np.sin(math.pi * (t / dur)) ** 0.7 * np.exp(-t * 14.0)
    return (np.sin(phase) * env * amp).astype(np.float32)


def sfx_wood_tick(freq=920.0, dur=0.032, amp=0.22, seed=1):
    rng = np.random.default_rng(seed)
    n = int(SR * dur)
    t = np.arange(n, dtype=np.float32) / SR
    noise = rng.standard_normal(n).astype(np.float32)
    body = biquad_bandpass(noise, freq, q=4.5)
    tone = np.sin(2.0 * math.pi * freq * t) * np.exp(-t * 120.0)
    env = np.exp(-t * 110.0)
    return ((body * 0.55 + tone * 0.8) * env * amp).astype(np.float32)


def sfx_stamp_slam(freq=110.0, dur=0.24, amp=0.42, seed=2):
    rng = np.random.default_rng(seed)
    n = int(SR * dur)
    t = np.arange(n, dtype=np.float32) / SR
    f_sweep = freq * np.exp(-t * 12.0) + 42.0
    phase = 2.0 * math.pi * np.cumsum(f_sweep) / SR
    thud = np.sin(phase) * np.exp(-t * 16.0)
    snap = biquad_bandpass(rng.standard_normal(n).astype(np.float32), 1450.0, q=2.2) * np.exp(-t * 48.0)
    return ((thud * 0.85 + snap * 0.45) * amp).astype(np.float32)


def sfx_big_impact(dur=0.58, amp=0.55, seed=7):
    rng = np.random.default_rng(seed)
    n = int(SR * dur)
    t = np.arange(n, dtype=np.float32) / SR
    f_sweep = 135.0 * np.exp(-t * 9.0) + 36.0
    phase = 2.0 * math.pi * np.cumsum(f_sweep) / SR
    sub = np.tanh(np.sin(phase) * 1.6) * np.exp(-t * 6.5)
    crack = biquad_bandpass(rng.standard_normal(n).astype(np.float32), 1900.0, q=1.8) * np.exp(-t * 32.0)
    return ((sub * 0.85 + crack * 0.35) * amp).astype(np.float32)


def sfx_glass_chime(notes=(587.33, 880.0, 1174.66), dur=0.55, amp=0.24):
    n = int(SR * dur)
    t = np.arange(n, dtype=np.float32) / SR
    sig = np.zeros(n, dtype=np.float32)
    for i, f in enumerate(notes):
        delay = int(i * 0.045 * SR)
        rem = n - delay
        if rem <= 0:
            continue
        tt = np.arange(rem, dtype=np.float32) / SR
        tone = (
            np.sin(2.0 * math.pi * f * tt) * np.exp(-tt * 6.5)
            + 0.35 * np.sin(2.0 * math.pi * (f * 2.0) * tt) * np.exp(-tt * 14.0)
        )
        sig[delay:] += tone
    return (sig * (amp / max(1, len(notes)))).astype(np.float32)


def sfx_whoosh(f0=260.0, f1=1280.0, dur=0.28, amp=0.22, seed=9):
    rng = np.random.default_rng(seed)
    n = int(SR * dur)
    t = np.arange(n, dtype=np.float32) / SR
    noise = rng.standard_normal(n).astype(np.float32)
    mid = biquad_bandpass(noise, (f0 + f1) * 0.5, q=1.6)
    env = np.sin(math.pi * (t / dur)) ** 1.4
    return (mid * env * amp).astype(np.float32)


def apply_room_reverb(stereo: np.ndarray, wet: float = 0.16) -> np.ndarray:
    delays_ms = [19.0, 31.0, 47.0, 73.0, 113.0]
    gains = [0.36, 0.27, 0.19, 0.13, 0.08]
    out = stereo.copy()
    rev = np.zeros_like(stereo)
    for d_ms, g in zip(delays_ms, gains):
        d = int(SR * d_ms / 1000.0)
        if d < len(stereo):
            rev[d:, 0] += stereo[:-d, 1] * g
            rev[d:, 1] += stereo[:-d, 0] * g * 0.94
    return np.clip(out * (1.0 - wet * 0.3) + rev * wet, -0.95, 0.95)


def write_wav(path: str, stereo: np.ndarray):
    pcm = np.clip(stereo * 32767.0, -32767, 32767).astype(np.int16)
    with wave.open(path, 'wb') as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(pcm.tobytes())


def build_sfx_and_bgm(timings_path: str, out_sfx_wav: str, out_bgm_wav: str):
    data = json.load(open(timings_path, 'r', encoding='utf-8'))
    total_dur = float(data['totalDurationSec'])
    acts = data['acts']
    total_samples = int(math.ceil(total_dur * SR)) + SR

    sfx_buf = np.zeros((total_samples, 2), dtype=np.float32)
    event_count = 0

    def place(t_sec: float, mono: np.ndarray, pan: float = 0.0):
        nonlocal event_count
        idx = int(max(0.0, t_sec) * SR)
        if idx >= total_samples:
            return
        st = pan_stereo(mono, pan)
        end = min(total_samples, idx + len(st))
        sfx_buf[idx:end] += st[: end - idx]
        event_count += 1

    # Map acts by id
    amap = {a['id']: a for a in acts}

    # Act 1: // 01 — 随便 (Boss chat bubble pop + cursor blink ticks)
    a1 = amap['act1']['startSec']
    d1 = amap['act1']['durationSec']
    place(a1 + 0.15, sfx_bubble(540, 0.08, 0.30, 10), -0.25)
    place(a1 + 0.95, sfx_whoosh(320, 980, 0.24, 0.20, 11), -0.15)
    place(a1 + 1.45, sfx_bubble(720, 0.07, 0.25, 12), 0.0)
    for k in range(6):
        place(a1 + 1.8 + k * 0.38, sfx_wood_tick(880 + k * 55, 0.028, 0.16, 20 + k), -0.3 + k * 0.12)

    # Act 2: // 02 — 翻译一下 (4 Red/Blue Rubber Stamp Slams + Context 100% + Giant 全都要 Impact!)
    a2 = amap['act2']['startSec']
    d2 = amap['act2']['durationSec']
    place(a2 + 0.05, sfx_whoosh(400, 1400, 0.22, 0.24, 30), 0.0)
    for i in range(4):
        st_t = a2 + 0.75 + i * ((d2 * 0.54) / 4.0)
        place(st_t, sfx_stamp_slam(125 - i * 8, 0.22, 0.38, 40 + i), -0.2 + i * 0.14)
    # Context 100% warning tick
    place(a2 + d2 * 0.66, sfx_glass_chime((880.0, 987.77), 0.32, 0.22), 0.35)
    # Giant 全都要 slam!
    place(a2 + d2 * 0.72, sfx_big_impact(0.55, 0.56, 55), 0.0)

    # Act 3: // 03 — 弹药库 (Voice waveform ticks + Museum spotlight switch click + chime)
    a3 = amap['act3']['startSec']
    d3 = amap['act3']['durationSec']
    place(a3 + 0.12, sfx_whoosh(280, 860, 0.25, 0.20, 60), -0.2)
    for i in range(5):
        place(a3 + 0.45 + i * 0.26, sfx_bubble(520 + i * 60, 0.06, 0.18, 61 + i), -0.1 + i * 0.08)
    # Spotlight switch click on the gold-framed self-portrait
    place(a3 + d3 * 0.52, sfx_stamp_slam(160, 0.16, 0.32, 70), 0.15)
    place(a3 + d3 * 0.55, sfx_glass_chime((523.25, 659.25, 783.99, 1046.5), 0.65, 0.24), 0.15)

    # Act 4: // 04 — 交作业 (Laser scan sweep + 24 tile ticks + fold collapse)
    a4 = amap['act4']['startSec']
    d4 = amap['act4']['durationSec']
    place(a4 + 0.15, sfx_whoosh(240, 1600, 0.45, 0.24, 80), -0.4)
    for i in range(8):
        place(a4 + 0.35 + i * 0.28, sfx_wood_tick(960 + (i % 4) * 90, 0.025, 0.15, 81 + i), -0.4 + i * 0.1)
    place(a4 + d4 * 0.68, sfx_bubble(460, 0.09, 0.24, 95), 0.1)

    # Act 5: // 05 — 凌晨 (Late night clock ticks + Boss "非常棒" pop + 100% battery charge chime)
    a5 = amap['act5']['startSec']
    d5 = amap['act5']['durationSec']
    for i in range(4):
        place(a5 + 0.25 + i * 0.55, sfx_wood_tick(740 if i % 2 == 0 else 620, 0.024, 0.18, 100 + i), 0.0)
    place(a5 + d5 * 0.54, sfx_bubble(680, 0.085, 0.32, 110), 0.0)
    place(a5 + d5 * 0.60, sfx_glass_chime((587.33, 739.99, 880.0, 1174.66), 0.68, 0.28), 0.1)

    # Act 6: // 06 — 蜕变 (3 high-contrast showcase cuts + Mosaic assembly cascade)
    a6 = amap['act6']['startSec']
    d6 = amap['act6']['durationSec']
    place(a6 + 0.04, sfx_stamp_slam(115, 0.20, 0.34, 120), -0.2)
    place(a6 + d6 * 0.33, sfx_stamp_slam(105, 0.20, 0.34, 121), 0.2)
    place(a6 + d6 * 0.64, sfx_whoosh(300, 1500, 0.38, 0.28, 122), 0.0)
    place(a6 + d6 * 0.72, sfx_glass_chime((659.25, 830.61, 987.77, 1318.5), 0.62, 0.25), 0.0)

    # Act 7: // 07 — 字符剧场 (Klein Blue title slam + Theatrical curtain swoosh & spotlight click)
    a7 = amap['act7']['startSec']
    d7 = amap['act7']['durationSec']
    place(a7 + 0.05, sfx_big_impact(0.42, 0.42, 130), 0.0)
    for i in range(3):
        place(a7 + 0.65 + i * 0.32, sfx_wood_tick(980 + i * 80, 0.03, 0.20, 131 + i), -0.25 + i * 0.25)
    place(a7 + d7 * 0.52, sfx_whoosh(220, 920, 0.36, 0.26, 135), 0.0)
    place(a7 + d7 * 0.58, sfx_stamp_slam(150, 0.15, 0.28, 136), 0.0)

    # Act 8: // 08 — 适合谁 (4 check ticks + 60 Mini Cursor Clone Pop Chorus!)
    a8 = amap['act8']['startSec']
    d8 = amap['act8']['durationSec']
    for i in range(4):
        place(a8 + 0.45 + i * (d8 * 0.16), sfx_glass_chime((880.0, 1318.5), 0.22, 0.18), -0.2 + i * 0.12)
    # 60 Mini Cursor Clone Pop Chorus
    swarm_t0 = a8 + d8 * 0.56
    for i in range(12):
        place(swarm_t0 + i * 0.065, sfx_bubble(560 + (i % 6) * 75, 0.05, 0.15, 150 + i), -0.45 + (i % 6) * 0.18)

    # Act 9: // 09 — 拿走 (Viewfinder lock + URL typing clacks + sleep yawn + Final Boss "在吗？" ping!)
    a9 = amap['act9']['startSec']
    d9 = amap['act9']['durationSec']
    place(a9 + 0.10, sfx_wood_tick(1150, 0.035, 0.24, 170), 0.0)
    for i in range(8):
        place(a9 + 0.45 + i * 0.11, sfx_wood_tick(900 + (i % 3) * 110, 0.022, 0.15, 171 + i), -0.15 + (i % 3) * 0.15)
    # Final Boss "在吗？" notification chime!
    place(a9 + d9 * 0.78, sfx_glass_chime((987.77, 1479.98), 0.42, 0.34), 0.38)
    place(a9 + d9 * 0.82, sfx_bubble(840, 0.075, 0.28, 185), 0.32)

    sfx_out = apply_room_reverb(sfx_buf[: int(total_dur * SR)], wet=0.16)
    write_wav(out_sfx_wav, sfx_out)
    print(f"[sfx_palette] {out_sfx_wav}: {event_count} theatrical events written ({total_dur:.2f}s)")

    # Build 118 BPM crisp theatrical minimal-tech groove
    n_tot = int(total_dur * SR)
    bgm = np.zeros((n_tot, 2), dtype=np.float32)
    bpm = 118.0
    beat_sec = 60.0 / bpm
    step_sec = beat_sec / 2.0  # 8th notes
    n_steps = int(total_dur / step_sec)
    bass_freqs = [110.0, 110.0, 130.81, 146.83, 98.0, 98.0, 130.81, 164.81]

    for s in range(n_steps):
        t0 = s * step_sec
        idx = int(t0 * SR)
        if idx >= n_tot:
            break
        # Kick on every 2 steps (quarter notes)
        if s % 2 == 0:
            kn = min(int(0.18 * SR), n_tot - idx)
            kt = np.arange(kn, dtype=np.float32) / SR
            kf = 115.0 * np.exp(-kt * 26.0) + 46.0
            kph = 2.0 * math.pi * np.cumsum(kf) / SR
            kick = np.sin(kph) * np.exp(-kt * 14.0) * 0.22
            bgm[idx : idx + kn, 0] += kick
            bgm[idx : idx + kn, 1] += kick
        # Crisp rim/hat on offbeats
        if s % 2 == 1:
            hn = min(int(0.045 * SR), n_tot - idx)
            ht = np.arange(hn, dtype=np.float32) / SR
            hat = np.sin(2.0 * math.pi * 4200.0 * ht) * np.exp(-ht * 95.0) * 0.05
            bgm[idx : idx + hn, 0] += hat * 0.8
            bgm[idx : idx + hn, 1] += hat * 1.1
        # Warm pluck bass
        bf = bass_freqs[(s // 2) % len(bass_freqs)]
        bn = min(int(step_sec * 0.88 * SR), n_tot - idx)
        bt = np.arange(bn, dtype=np.float32) / SR
        bass = (
            np.sin(2.0 * math.pi * bf * bt)
            + 0.35 * np.sin(2.0 * math.pi * (bf * 2.0) * bt) * np.exp(-bt * 12.0)
        ) * np.exp(-bt * 6.5) * 0.14
        bgm[idx : idx + bn, 0] += bass * 0.95
        bgm[idx : idx + bn, 1] += bass * 1.05

    write_wav(out_bgm_wav, np.clip(bgm, -0.9, 0.9))
    print(f"[groove] {out_bgm_wav}: 118 BPM theatrical minimal-electro groove written ({total_dur:.2f}s)")


if __name__ == '__main__':
    build_sfx_and_bgm(sys.argv[1], sys.argv[2], sys.argv[3])
