import type { CSSProperties } from "react";

interface CollectionBadgeProps {
  name: string;
  color: string;
  compact?: boolean;
}

export const CollectionBadge = ({
  name,
  color,
  compact = false
}: CollectionBadgeProps): JSX.Element => (
  <span
    className={`collection-badge${compact ? " collection-badge--compact" : ""}`}
    style={
      {
        "--collection-badge-color": color
      } as CSSProperties
    }
  >
    <span className="collection-badge__label">{name}</span>
  </span>
);
