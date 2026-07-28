type DirectionalArrowProps = {
  diagonal?: boolean;
  direction?: "forward" | "backward";
  className?: string;
};

export function DirectionalArrow({
  diagonal = false,
  direction = "forward",
  className = "",
}: DirectionalArrowProps) {
  return (
    <span
      aria-hidden="true"
      className={`directional-arrow ${className}`.trim()}
      data-direction={diagonal ? "diagonal" : direction}
    >
      {diagonal ? "↗" : direction === "backward" ? "←" : "→"}
    </span>
  );
}
