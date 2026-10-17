let ctx: AudioContext | null = null;
function tone(freq: number, start: number, dur: number, vol: number) {
  ctx ??= new AudioContext();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  const t = ctx.currentTime + start;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur);
}
export const ding = () => { tone(880, 0, 0.35, 0.08); tone(1320, 0.12, 0.45, 0.06); };
export const tick = () => tone(1600, 0, 0.06, 0.03);
