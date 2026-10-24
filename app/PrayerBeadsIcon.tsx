import type { LucideProps } from "lucide-react";

export default function PrayerBeadsIcon({ size = 24, strokeWidth = 1.8, ...props }: LucideProps) {
  const beads = [
    [12, 3.2], [16.4, 4.4], [19.5, 7.7], [20.7, 12], [19.5, 16.3],
    [16.4, 19.6], [12, 20.8], [7.6, 19.6], [4.5, 16.3], [3.3, 12],
    [4.5, 7.7], [7.6, 4.4],
  ];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="8.1" />
      {beads.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1" fill="currentColor" stroke="none" />)}
      <path d="M12 20.2v1.3" />
      <path d="m10.9 22.1 1.1.9 1.1-.9" />
    </svg>
  );
}
