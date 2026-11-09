/**
 * Fast-steg-løkke: fysikken kjører alltid med samme dt, uansett skjermens fps.
 * render() får alpha (0–1) for å interpolere mellom forrige og nåværende tilstand.
 */
export function createLoop(opts: {
  hz: number;
  step: (dt: number) => void;
  render: (alpha: number, frameDt: number) => void;
  maxStepsPerFrame?: number;
}) {
  const dt = 1 / opts.hz;
  const maxSteps = opts.maxStepsPerFrame ?? 32;
  let acc = 0;
  let last = -1;
  let raf = 0;

  function frame(now: number) {
    const t = now / 1000;
    const frameDt = last < 0 ? 0 : Math.min(t - last, 0.25);
    last = t;
    acc += frameDt;
    let n = 0;
    while (acc >= dt && n < maxSteps) {
      opts.step(dt);
      acc -= dt;
      n++;
    }
    if (n === maxSteps) acc = 0; // ikke bygg opp gjeld etter en pause
    opts.render(acc / dt, frameDt);
    raf = requestAnimationFrame(frame);
  }

  return {
    start() { raf = requestAnimationFrame(frame); },
    stop() { cancelAnimationFrame(raf); last = -1; acc = 0; },
  };
}
