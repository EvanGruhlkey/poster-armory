import React from "react";

export function MapAttribution() {
  return (
    <p
      data-testid="map-attribution"
      className="text-[9px] leading-none text-[#18344b]/55"
    >
      Map data ©{" "}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        className="underline decoration-current/40 underline-offset-2 hover:text-[#18344b]"
      >
        OpenStreetMap
      </a>{" "}
      ·{" "}
      <a
        href="https://openfreemap.org/"
        target="_blank"
        rel="noreferrer"
        className="underline decoration-current/40 underline-offset-2 hover:text-[#18344b]"
      >
        OpenFreeMap
      </a>
    </p>
  );
}
