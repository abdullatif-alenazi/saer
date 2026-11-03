import type { CSSProperties } from "react";
import type { LucideProps } from "lucide-react";

export default function MosqueIcon({ size = 24, className, style, ...props }: LucideProps) {
  const mask = "url('/prayer-mosque.png')";
  return <span
    className={className}
    style={{
      display: "inline-block",
      flex: "0 0 auto",
      width: size,
      height: size,
      backgroundColor: "currentColor",
      WebkitMaskImage: mask,
      maskImage: mask,
      WebkitMaskRepeat: "no-repeat",
      maskRepeat: "no-repeat",
      WebkitMaskPosition: "center",
      maskPosition: "center",
      WebkitMaskSize: "contain",
      maskSize: "contain",
      ...style,
    } as CSSProperties}
    aria-hidden={props["aria-hidden"] ?? true}
  />;
}
