"use client";

import { useEffect, useRef, useState } from "react";

interface ProtectedImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  watermark?: boolean;
  bgColor?: string;
  textColor?: string;
}

export function ProtectedImage({
  src,
  alt,
  className,
  containerClassName,
  watermark = false,
  bgColor,
  textColor,
}: ProtectedImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [blurred, setBlurred] = useState(false);

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "hidden") {
        setBlurred(true);
      } else {
        setTimeout(() => setBlurred(false), 300);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.key === "PrintScreen" ||
        (e.metaKey && e.shiftKey && (e.key === "3" || e.key === "4" || e.key === "5")) ||
        (e.ctrlKey && e.key === "PrintScreen")
      ) {
        setBlurred(true);
        setTimeout(() => setBlurred(false), 1500);
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const wmColor = textColor || "currentColor";

  return (
    <div
      ref={containerRef}
      className={`protected-image-container relative select-none ${containerClassName || ""}`}
      style={{ lineHeight: 0 }}
    >
      <img
        src={src}
        alt={alt}
        className={className}
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
        style={{
          pointerEvents: "none",
          filter: blurred ? "blur(30px)" : "none",
          transition: "filter 0.15s ease-out",
        }}
      />

      {bgColor && (
        <>
          <div
            className="absolute inset-x-0 top-0 z-[5] h-[18%]"
            style={{
              background: `linear-gradient(to bottom, ${bgColor}, transparent)`,
              pointerEvents: "none",
            }}
          />
          <div
            className="absolute inset-x-0 bottom-0 z-[5] h-[18%]"
            style={{
              background: `linear-gradient(to top, ${bgColor}, transparent)`,
              pointerEvents: "none",
            }}
          />
        </>
      )}

      {watermark && (
        <div
          className="absolute inset-0 z-10 overflow-hidden"
          style={{ pointerEvents: "none" }}
        >
          <div
            className="absolute -inset-[50%] flex flex-wrap items-center justify-center gap-x-10 gap-y-6"
            style={{
              transform: "rotate(-35deg)",
              opacity: 0.12,
            }}
          >
            {Array.from({ length: 48 }).map((_, i) => (
              <span
                key={i}
                className="whitespace-nowrap text-base font-extrabold tracking-[0.2em]"
                style={{ color: wmColor }}
              >
                POSTER ARMORY
              </span>
            ))}
          </div>
        </div>
      )}

      <div
        className="absolute inset-0 z-20"
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}
