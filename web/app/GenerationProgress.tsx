"use client";

import { useEffect, useRef, useState } from "react";

type ProgressState = {
  visible: boolean;
  pct: number;
  complete: boolean;
};

export function GenerationProgress({ busy }: { busy: boolean }) {
  const [progress, setProgress] = useState<ProgressState>({
    visible: false,
    pct: 0,
    complete: false,
  });
  const progressRef = useRef(progress);

  useEffect(() => {
    let frame: number | null = null;
    let hideTimeout: number | null = null;

    function updateProgress(next: ProgressState | ((prev: ProgressState) => ProgressState)) {
      setProgress((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        progressRef.current = value;
        return value;
      });
    }

    if (busy) {
      frame = requestAnimationFrame(() => {
        const startedAt = performance.now();
        updateProgress({ visible: true, pct: 6, complete: false });

        function tick() {
          const elapsed = performance.now() - startedAt;
          const estimatedPct = Math.min(94, Math.round(6 + (1 - Math.exp(-elapsed / 18000)) * 88));

          updateProgress((prev) => ({
            visible: true,
            pct: Math.max(prev.pct, estimatedPct),
            complete: false,
          }));
          frame = requestAnimationFrame(tick);
        }

        frame = requestAnimationFrame(tick);
      });
    } else if (progressRef.current.visible || progressRef.current.pct > 0) {
      frame = requestAnimationFrame(() => {
        updateProgress({ visible: true, pct: 100, complete: true });
        hideTimeout = window.setTimeout(() => {
          updateProgress({ visible: false, pct: 0, complete: false });
        }, 700);
      });
    }

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      if (hideTimeout !== null) window.clearTimeout(hideTimeout);
    };
  }, [busy]);

  if (!progress.visible) return null;

  return (
    <div className="gen-progress" role="status" aria-live="polite">
      <div className="gen-progress-head">
        <strong>Gerando variações</strong>
        <span>{progress.pct}%</span>
      </div>

      <div
        className="gen-bar-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.pct}
      >
        <div className="gen-bar-fill" style={{ width: `${progress.pct}%` }} />
      </div>

      <div className="gen-progress-meta">
        <span>{progress.complete ? "Variações prontas." : "Preparando o pacote criativo..."}</span>
      </div>
    </div>
  );
}
