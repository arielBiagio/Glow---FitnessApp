import { useEffect, useRef } from 'react';

interface Props { value: number; loading: boolean; index: number }
const format = new Intl.NumberFormat('es');

export default function AnimatedNumber({ value, loading, index }: Props) {
  const element = useRef<HTMLSpanElement>(null);
  const counter = useRef({ value: 0 });
  const revealed = useRef(false);
  useEffect(() => {
    if (!element.current || loading) return;
    const target = element.current;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.textContent = format.format(Math.round(counter.current.value));
    const firstReveal = !revealed.current;
    revealed.current = true;
    if (reducedMotion || counter.current.value === value) {
      counter.current.value = value;
      target.textContent = format.format(value);
      return;
    }
    const from = counter.current.value;
    const start = performance.now() + (firstReveal ? index * 60 : 0);
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - start) / 900));
      counter.current.value = from + (value - from) * (1 - (1 - progress) ** 3);
      target.textContent = format.format(Math.round(counter.current.value));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); };
  }, [value, loading, index]);
  return <>
    <span ref={element} aria-hidden="true" className={`inline-block min-w-10 ${loading ? 'summary-number-loading' : ''}`}>{revealed.current ? format.format(Math.round(counter.current.value)) : loading ? '—' : '0'}</span>
    <span className="sr-only">{loading ? 'Cargando' : format.format(value)}</span>
  </>;
}
