// Releases the computer's queued orders over time, mirroring the human's pace (02 §5.4).
export class AIPacer {
  constructor({ wait, rng, now = Date.now() }) {
    this.wait = wait;
    this.rng = rng;
    this.queue = [];
    this.released = [];
    this.interval = 5000 * wait;
    this.last = now;
    this.humanTimes = [];
  }
  start(cmds, now = Date.now()) {
    this.queue = [...cmds];
    this.released = [];
    this.last = now;
    this.humanTimes = [now];
  }
  onHumanCommand(now = Date.now()) {
    this.humanTimes.push(now);
    const t = this.humanTimes;
    const avg = (t[t.length - 1] - t[0]) / (t.length - 1);
    this.interval = Math.max(800, Math.min(30000, avg * this.wait));
  }
  releaseOne() {
    if (!this.queue.length) return null;
    const c = this.queue.splice(Math.floor(this.rng() * this.queue.length), 1)[0];
    this.released.push(c);
    return c;
  }
  tick(now = Date.now()) {
    const out = [];
    while (this.queue.length && now - this.last >= this.interval) { this.last += this.interval; out.push(this.releaseOne()); }
    return out;
  }
  // Human pressed Execute: 0-3 extra orders, then the rest are lost. Returns orders in issue order.
  onHumanReady() {
    const extra = Math.round(3 * this.rng());
    for (let i = 0; i < extra; i++) this.releaseOne();
    this.queue = [];
    return this.released;
  }
}
