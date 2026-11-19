/* Tiny WebAudio bleeps. No samples, no network. */
(function (root) {
  'use strict';

  var ctx = null;
  var master = null;
  var muted = false;
  var started = false;

  function ensure() {
    if (ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.22;
    master.connect(ctx.destination);
  }

  function resume() {
    ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    started = true;
  }

  function setMute(v) {
    muted = !!v;
    if (master) master.gain.value = muted ? 0 : 0.22;
  }

  function isMuted() { return muted; }

  function tone(o) {
    if (!ctx || muted) return;
    var t = ctx.currentTime + (o.delay || 0);
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t + o.dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.2, t + Math.min(0.02, o.dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + o.dur + 0.02);
    osc.onended = function () { osc.disconnect(); g.disconnect(); };
  }

  function noise(dur, vol, freq) {
    if (!ctx || muted) return;
    var n = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 1.6);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq || 900;
    filter.Q.value = 0.7;
    var g = ctx.createGain();
    g.gain.value = vol || 0.3;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start();
    src.onended = function () { src.disconnect(); filter.disconnect(); g.disconnect(); };
  }

  var NOTES = [523.25, 659.25, 783.99, 1046.5];

  function play(name, extra) {
    if (!started) return;
    resume();
    if (!ctx || muted) return;
    if (name === 'rotate') tone({ type: 'square', freq: 480, dur: 0.045, vol: 0.08 });
    else if (name === 'place') tone({ type: 'triangle', freq: 320, to: 540, dur: 0.09, vol: 0.16 });
    else if (name === 'yank') tone({ type: 'sine', freq: 280, to: 140, dur: 0.08, vol: 0.12 });
    else if (name === 'power') tone({ type: 'sine', freq: 680, dur: 0.07, vol: 0.1 });
    else if (name === 'on') {
      var i = (extra || 0) % NOTES.length;
      tone({ type: 'triangle', freq: NOTES[i], dur: 0.16, vol: 0.16 });
      tone({ type: 'sine', freq: NOTES[i] * 2, dur: 0.12, vol: 0.05 });
    } else if (name === 'win') {
      [523, 659, 784, 1046].forEach(function (f, i) {
        tone({ type: 'triangle', freq: f, dur: 0.22, vol: 0.16, delay: i * 0.09 });
      });
    } else if (name === 'zap') {
      noise(0.28, 0.45, 1400);
      tone({ type: 'sawtooth', freq: 220, to: 40, dur: 0.32, vol: 0.12 });
    } else if (name === 'dog') {
      tone({ type: 'square', freq: 160, dur: 0.08, vol: 0.08 });
      tone({ type: 'square', freq: 110, dur: 0.12, vol: 0.08, delay: 0.1 });
    } else if (name === 'shoo') tone({ type: 'sine', freq: 620, to: 880, dur: 0.1, vol: 0.12 });
    else if (name === 'drip') tone({ type: 'sine', freq: 980, to: 420, dur: 0.09, vol: 0.07 });
    else if (name === 'off') tone({ type: 'sine', freq: 130, dur: 0.14, vol: 0.18 });
    else if (name === 'breaker') {
      tone({ type: 'square', freq: 240, dur: 0.05, vol: 0.1 });
      tone({ type: 'sine', freq: 520, dur: 0.08, vol: 0.08, delay: 0.03 });
    } else if (name === 'tick') tone({ type: 'square', freq: 980, dur: 0.03, vol: 0.05 });
    else if (name === 'hint') tone({ type: 'triangle', freq: 520, to: 780, dur: 0.12, vol: 0.12 });
    else tone({ type: 'sine', freq: 740, dur: 0.06, vol: 0.1 });
  }

  root.SparkyAudio = {
    resume: resume,
    setMute: setMute,
    isMuted: isMuted,
    play: play
  };
})(window);
