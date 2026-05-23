import type { CSSProperties } from "react";

interface SegmentedTimerRingProps {
  progress: number;
  tone:
    | "work"
    | "short_break"
    | "long_break"
    | "procrastination"
    | "interruption"
    | "ai_work"
    | "idle";
}

const totalSegments = 60;

const getAngle = (index: number): number => (360 / totalSegments) * index;

export const SegmentedTimerRing = ({
  progress,
  tone
}: SegmentedTimerRingProps): JSX.Element => {
  const normalizedProgress = Math.max(0, Math.min(1, progress));
  const filledCount = Math.round(normalizedProgress * totalSegments);
  const progressStyle = {
    "--timer-progress": `${normalizedProgress * 360}deg`
  } as CSSProperties;
  const isEmpty = normalizedProgress === 0;

  return (
    <div
      className={`timer-ring timer-ring--${tone}${isEmpty ? " is-empty" : ""}`}
      aria-hidden="true"
      style={progressStyle}
    >
      <span className="timer-ring-halo timer-ring-halo--outer" />
      <span className="timer-ring-halo timer-ring-halo--inner" />
      <span className="timer-ring-core" />
      <span className="timer-ring-track" />
      <span className="timer-ring-progress" />
      <span className="timer-ring-progress-dot" />
      {Array.from({ length: totalSegments }).map((_, index) => (
        <span
          key={index}
          className={`timer-ring-segment${index < filledCount ? " is-filled" : ""}`}
          style={{
            transform:
              `translate(-50%, -50%) rotate(${getAngle(index)}deg) ` +
              "translateY(calc(var(--ring-radius) * -1))"
          }}
        />
      ))}
    </div>
  );
};
