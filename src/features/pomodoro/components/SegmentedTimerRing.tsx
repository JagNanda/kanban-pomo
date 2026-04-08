interface SegmentedTimerRingProps {
  progress: number;
  tone: "work" | "short_break" | "long_break" | "idle";
}

const totalSegments = 60;

const getAngle = (index: number): number => (360 / totalSegments) * index;

export const SegmentedTimerRing = ({
  progress,
  tone
}: SegmentedTimerRingProps): JSX.Element => {
  const filledCount = Math.round(Math.max(0, Math.min(1, progress)) * totalSegments);

  return (
    <div className={`timer-ring timer-ring--${tone}`} aria-hidden="true">
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
