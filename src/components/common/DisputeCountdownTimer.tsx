import React, { useState, useEffect } from 'react';
import { Clock, ShieldAlert } from 'lucide-react';

interface DisputeCountdownTimerProps {
  deadline?: string;
  showIcon?: boolean;
  className?: string;
  expiredLabel?: string;
}

export const DisputeCountdownTimer: React.FC<DisputeCountdownTimerProps> = ({
  deadline,
  showIcon = false,
  className = '',
  expiredLabel = 'Plazo vencido (Listo para liquidar)',
}) => {
  const calculate = () => {
    if (!deadline) {
      return { totalMs: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
    }
    const diff = new Date(deadline).getTime() - Date.now();
    if (diff <= 0) {
      return { totalMs: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
    }
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return { totalMs: diff, hours, minutes, seconds, isExpired: false };
  };

  const [timeLeft, setTimeLeft] = useState(calculate);

  useEffect(() => {
    setTimeLeft(calculate());
    const interval = setInterval(() => {
      setTimeLeft(calculate());
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (timeLeft.isExpired) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-amber-300 font-mono font-semibold ${className}`}>
        {showIcon && <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
        <span>{expiredLabel}</span>
      </span>
    );
  }

  const formatted =
    timeLeft.hours > 0
      ? `${timeLeft.hours}h ${String(timeLeft.minutes).padStart(2, '0')}m ${String(timeLeft.seconds).padStart(2, '0')}s`
      : `${String(timeLeft.minutes).padStart(2, '0')}:${String(timeLeft.seconds).padStart(2, '0')}`;

  return (
    <span className={`inline-flex items-center gap-1.5 font-mono tabular-nums ${className}`}>
      {showIcon && <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
      <span>{formatted}</span>
    </span>
  );
};
