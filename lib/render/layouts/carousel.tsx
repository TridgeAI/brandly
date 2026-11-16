// Carousel cover and inner slides.
import { AccentMark, CornerLogo, Frame, Headline, logoSpace, PAD, Photo, scheme, Subline, type LayoutProps } from "./shared";

/** Cover: photo on one side, big headline, "swipe" cue. */
export function CarouselCover(p: LayoutProps) {
  const s = scheme(p);
  const photoH = Math.round(p.height * 0.42);
  return (
    <Frame bg={s.bg} style={{ flexDirection: "column" }}>
      {p.photo ? <Photo p={p} style={{ width: p.width, height: photoH }} /> : null}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flexGrow: 1, padding: PAD, paddingBottom: PAD + logoSpace(p, "bottom") }}>
        <AccentMark p={p} color={s.accent} />
        <Headline p={p} color={s.fg} size={p.photo ? Math.min(88, Math.round(4800 / Math.max(p.headline.length, 18)) + 22) : undefined} />
        <Subline p={p} color={s.muted} size={34} />
        <div style={{ display: "flex", alignItems: "center", marginTop: 40, fontFamily: p.fonts.body, fontWeight: 700, fontSize: 28, color: s.accent }}>
          Swipe →
        </div>
      </div>
      <CornerLogo p={p} color={s.fg} />
    </Frame>
  );
}

/** Inner slide: number, headline, short body, progress dots. */
export function CarouselSlide(p: LayoutProps) {
  const s = scheme(p);
  const { index = 2, total = 5 } = p.slide ?? {};
  const last = index === total;
  return (
    <Frame bg={s.bg} style={{ flexDirection: "column", padding: PAD, paddingTop: PAD * 1.4 }}>
      <div style={{ display: "flex", fontFamily: p.fonts.heading, fontWeight: 700, fontSize: 120, lineHeight: 1, color: s.accent }}>
        {String(index - 1).padStart(2, "0")}
      </div>
      <Headline p={p} color={s.fg} size={Math.min(80, Math.round(4400 / Math.max(p.headline.length, 16)) + 22)} style={{ marginTop: 40 }} />
      <Subline p={p} color={s.muted} size={36} />
      {last && p.cta ? (
        <div style={{ display: "flex", alignSelf: "flex-start", marginTop: 48, padding: "18px 34px", background: s.accent, color: s.onAccent, fontFamily: p.fonts.body, fontWeight: 700, fontSize: 30, borderRadius: Math.min(p.kit.radius * 2, 40) }}>
          {p.cta.length > 42 ? p.cta.slice(0, 40).replace(/\s+\S*$/, "") + "…" : p.cta}
        </div>
      ) : null}
      <div style={{ display: "flex", position: "absolute", bottom: PAD * 0.8, right: PAD }}>
        {Array.from({ length: total }, (_, i) => (
          <div key={i} style={{ display: "flex", width: i + 1 === index ? 36 : 12, height: 12, borderRadius: 6, marginLeft: 10, background: i + 1 === index ? s.accent : s.muted, opacity: i + 1 === index ? 1 : 0.4 }} />
        ))}
      </div>
      <CornerLogo p={{ ...p, kit: { ...p.kit, logoPosition: "bottom-left" } }} color={s.fg} size={60} />
    </Frame>
  );
}
