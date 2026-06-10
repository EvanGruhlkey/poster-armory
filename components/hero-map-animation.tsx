export function HeroMapAnimation() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="hero-map-grid absolute -inset-32" />
      <div className="hero-map-grid-fine absolute -inset-32" />
    </div>
  );
}
