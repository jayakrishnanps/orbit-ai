import React, { useState, useEffect } from 'react';

interface AnimatedHeadingProps {
  text: string;
  className?: string;
}

export default function AnimatedHeading({ text, className = '' }: AnimatedHeadingProps) {
  const [blackIndex, setBlackIndex] = useState(-1);

  useEffect(() => {
    let timeouts: ReturnType<typeof setTimeout>[] = [];

    const runAnimation = () => {
      timeouts = [];
      for (let scan = 0; scan < 3; scan++) {
        for (let i = 0; i <= text.length; i++) {
          const timeout = setTimeout(() => {
            setBlackIndex(i === text.length ? -1 : i);
          }, (scan * text.length + i) * 70);
          timeouts.push(timeout);
        }
      }
      // After 3 scans, pause then repeat
      const pauseTimeout = setTimeout(runAnimation, 3 * text.length * 70 + 1200);
      timeouts.push(pauseTimeout);
    };

    runAnimation();

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [text]);

  return (
    <h2 className={`text-4xl font-semibold tracking-tighter ${className}`}>
      {text.split('').map((char, i) => (
        <span
          key={i}
          className={i === blackIndex ? 'text-black' : 'text-white'}
          style={{ transition: 'color 50ms linear' }}
        >
          {char}
        </span>
      ))}
    </h2>
  );
}
