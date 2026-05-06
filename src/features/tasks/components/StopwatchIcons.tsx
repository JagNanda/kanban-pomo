interface StopwatchIconsProps {
  count: number;
  tone: "estimated" | "completed";
  size?: "sm" | "md";
}

const getDimensions = (size: StopwatchIconsProps["size"]): number =>
  size === "sm" ? 16 : 18;

const StopwatchSvg = ({
  tone,
  size = "md"
}: {
  tone: StopwatchIconsProps["tone"];
  size?: StopwatchIconsProps["size"];
}): JSX.Element => {
  const dimension = getDimensions(size);

  return (
    <svg
      aria-hidden="true"
      className={`stopwatch-icon stopwatch-icon--${tone}`}
      height={dimension}
      viewBox="0 0 24 24"
      width={dimension}
    >
      <circle cx="12" cy="13" fill="none" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 6V4.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M9.6 3.6h4.8" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M15.9 8.3l1.2-1.2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M12 13l2.2-2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
};

export const StopwatchIcons = ({
  count,
  tone,
  size = "md"
}: StopwatchIconsProps): JSX.Element => {
  if (count <= 0) {
    return <span className="stopwatch-empty">0</span>;
  }

  return (
    <span className="stopwatch-list stopwatch-list--counted" role="img">
      <StopwatchSvg size={size} tone={tone} />
      <span className="stopwatch-count">x{count}</span>
    </span>
  );
};
