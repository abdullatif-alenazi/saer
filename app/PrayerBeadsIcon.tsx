import type { LucideProps } from "lucide-react";

export default function PrayerBeadsIcon({ size = 24, strokeWidth = 1.8, ...props }: LucideProps) {
  // The reference is a doubled, intertwined rosary loop with a side tassel,
  // rather than the circular ring used by the generic bead icon.
  const beads = [
    [5.1, 11.8], [5.6, 9.1], [7, 6.8], [9.2, 5.1], [11.9, 4.1],
    [14.6, 4], [17.2, 4.9], [19.1, 6.7], [20.2, 9.1], [20.1, 11.7],
    [19, 14], [17.1, 15.7], [14.8, 16.7], [12.4, 17.2], [10.3, 18.1],
    [9, 19.8], [9.1, 21.8], [10.4, 23.4], [12.6, 24.2], [15.1, 24],
    [17.6, 23], [19.5, 21.2], [20.8, 18.8], [21.4, 16], [21.2, 13.3],
    [20.1, 10.8], [18.2, 8.8], [16.2, 7.3], [14, 6.7], [11.8, 7.1],
    [10, 8.5], [8.9, 10.4], [8.6, 12.5],
  ];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M5.1 11.8C5.7 8.7 7 6.8 9.2 5.1c2-1.3 5.4-1.1 8 .1 2.3.8 3.6 3.2 3 6.5-.5 3.2-3.1 5-5.4 5-2.4.5-4.5 1.4-5.8 3.1-1.6 2.1.1 4.4 3.6 4.4 4.3 0 7.2-2.7 7.8-8.2.4-4.5-2.4-8-5.2-8.7-2.7-1-6.1.2-7.3 3.1-.6 1.5-.5 3.1.3 4.6" />
      {beads.map(([cx, cy], index) => <circle key={index} cx={cx} cy={cy} r="0.72" fill="currentColor" stroke="none" />)}
      <path d="M5.3 13.4c-.2 2.2.4 4.2 1.8 5.8 1.1-.8 1.8-1.8 2.2-3.1" fill="currentColor" stroke="none" />
    </svg>
  );
}
