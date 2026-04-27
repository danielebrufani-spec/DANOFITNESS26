import React, { useEffect, useRef } from 'react';
import { useState } from 'react';
import { Text, TextProps } from 'react-native';

interface Props extends TextProps {
  to: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
}

/** Animated count-up number. Steps from 0 to `to` over `duration` ms. */
export const CountUp: React.FC<Props> = ({ to, duration = 1200, prefix = '', suffix = '', style, ...rest }) => {
  const [val, setVal] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const step = (ts: number) => {
      const elapsed = ts - start;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(to * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [to, duration]);

  return (
    <Text style={style} {...rest}>
      {prefix}
      {val}
      {suffix}
    </Text>
  );
};
