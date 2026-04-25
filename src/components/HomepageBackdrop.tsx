const HomepageBackdrop = () => (
  <div
    className="absolute inset-x-0 top-0 z-0 h-[1100px] pointer-events-none overflow-hidden"
    style={{
      contain: "paint",
      background:
        "radial-gradient(circle at 12% 8%, hsl(var(--primary) / 0.12) 0, hsl(var(--primary) / 0.06) 24%, transparent 52%), radial-gradient(circle at 88% 12%, hsl(var(--color-vivid-orange) / 0.11) 0, hsl(var(--color-vivid-orange) / 0.05) 22%, transparent 48%), linear-gradient(168deg, hsl(214 35% 95%) 0%, hsl(216 38% 93%) 44%, hsl(218 32% 94%) 100%)",
    }}
    aria-hidden="true"
  />
);

export default HomepageBackdrop;