import type { LucideProps } from "lucide-react";

export default function PrayerBeadsIcon({ size = 24, className, style, ...props }: LucideProps) {
  return (
    <img
      src="/prayer-beads.png"
      width={size}
      height={size}
      className={className}
      style={style}
      aria-hidden={props["aria-hidden"] ?? true}
    />
  );
}
