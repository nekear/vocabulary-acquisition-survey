"use client";

import { useEffect, useMemo, useState } from "react";
import spinners from "unicode-animations";

type SpinnerName = keyof typeof spinners;

interface InlineSpinnerProps {
  label: string;
  name?: SpinnerName;
  className?: string;
}

export function InlineSpinner({
  label,
  name = "helix",
  className,
}: InlineSpinnerProps) {
  const spinner = useMemo(() => spinners[name], [name]);
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % spinner.frames.length);
    }, spinner.interval);

    return () => window.clearInterval(timer);
  }, [spinner.frames.length, spinner.interval]);

  return (
    <span className={className}>
      <span aria-hidden="true" className="mr-2 font-mono text-[13px]">
        {spinner.frames[frameIndex]}
      </span>
      {label}
    </span>
  );
}
