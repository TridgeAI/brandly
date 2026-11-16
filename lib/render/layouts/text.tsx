// Text-led layouts: big number, quote, checklist, myth/fact.
import { AccentMark, applyCase, CornerLogo, edgePad, Frame, Headline, PAD, scheme, Subline, type LayoutProps } from "./shared";

export function BigNumber(p: LayoutProps) {
  const s = scheme(p);
  const stat = p.stat || p.headline.match(/[\d.,]+\s?[%x×+kKmM]?/)?.[0] || "1";
  const statSize = Math.round((stat.length <= 3 ? 340 : stat.length <= 5 ? 260 : stat.length <= 8 ? 190 : 140) * (p.width / 1080));
  return (
    <Frame bg={s.bg} style={{ flexDirection: "column", justifyContent: "center", padding: PAD, ...edgePad(p) }}>
      <div style={{ display: "flex", fontFamily: p.fonts.heading, fontWeight: 700, fontSize: statSize, lineHeight: 1, color: s.accent, letterSpacing: -6 }}>{stat}</div>
      <Headline p={p} color={s.fg} size={Math.min(72, Math.round(4000 / Math.max(p.headline.length, 16)) + 20)} style={{ marginTop: 36, maxWidth: p.width - PAD * 2 }} />
      <Subline p={p} color={s.muted} size={34} />
      <CornerLogo p={p} color={s.fg} />
    </Frame>
  );
}

export function Quote(p: LayoutProps) {
  const s = scheme(p);
  const text = applyCase(p.headline, p.kit.headlineCase === "upper" ? "sentence" : p.kit.headlineCase);
  return (
    <Frame bg={s.bg} style={{ flexDirection: "column", justifyContent: "center", padding: PAD * 1.2, ...edgePad(p, PAD * 1.2) }}>
      <div style={{ display: "flex", fontFamily: p.fonts.heading, fontWeight: 700, fontSize: 260, lineHeight: 0.8, color: s.accent, height: 150 }}>“</div>
      <div style={{ display: "flex", fontFamily: p.fonts.heading, fontWeight: 700, fontSize: Math.min(76, Math.round(5200 / Math.max(text.length, 24)) + 22), lineHeight: 1.18, color: s.fg }}>
        {text}
      </div>
      {p.subline ? (
        <div style={{ display: "flex", alignItems: "center", marginTop: 48 }}>
          <div style={{ display: "flex", width: 48, height: 4, background: s.accent, marginRight: 20 }} />
          <div style={{ display: "flex", fontFamily: p.fonts.body, fontSize: 32, color: s.muted }}>{p.subline}</div>
        </div>
      ) : null}
      <CornerLogo p={p} color={s.fg} />
    </Frame>
  );
}

export function Checklist(p: LayoutProps) {
  const s = scheme(p);
  const items = (p.items?.length ? p.items : [p.subline ?? ""]).filter(Boolean).slice(0, 6);
  const boxR = Math.min(p.kit.radius / 2, 12);
  return (
    <Frame bg={s.bg} style={{ flexDirection: "column", justifyContent: "center", padding: PAD, ...edgePad(p) }}>
      <AccentMark p={p} color={s.accent} />
      <Headline p={p} color={s.fg} size={Math.min(78, Math.round(4200 / Math.max(p.headline.length, 18)) + 20)} />
      <div style={{ display: "flex", flexDirection: "column", marginTop: 56 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", marginTop: i ? 30 : 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 56,
                height: 56,
                flexShrink: 0,
                borderRadius: boxR,
                background: s.accent,
                color: s.onAccent,
                fontFamily: p.fonts.heading,
                fontWeight: 700,
                fontSize: 30,
                marginRight: 28,
              }}
            >
              {i + 1}
            </div>
            <div style={{ display: "flex", fontFamily: p.fonts.body, fontSize: 38, lineHeight: 1.25, color: s.fg }}>{it}</div>
          </div>
        ))}
      </div>
      <CornerLogo p={p} color={s.fg} />
    </Frame>
  );
}

export function MythFact(p: LayoutProps) {
  const s = scheme(p);
  const [myth, fact] = [p.items?.[0] ?? p.headline, p.items?.[1] ?? p.subline ?? ""];
  const r = p.kit.radius;
  const label = (t: string, bg: string, fg: string) => (
    <div style={{ display: "flex", alignSelf: "flex-start", padding: "8px 20px", background: bg, color: fg, fontFamily: p.fonts.heading, fontWeight: 700, fontSize: 26, letterSpacing: 2, borderRadius: Math.min(r, 20) }}>
      {t}
    </div>
  );
  return (
    <Frame bg={s.bg} style={{ flexDirection: "column", padding: PAD, justifyContent: "center", ...edgePad(p) }}>
      <div style={{ display: "flex", flexDirection: "column", padding: 48, borderRadius: r, background: s.fg === "#FFFFFF" ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.05)" }}>
        {label("MYTH", s.muted, s.bg)}
        <div style={{ display: "flex", marginTop: 24, fontFamily: p.fonts.heading, fontWeight: 700, fontSize: 52, lineHeight: 1.2, color: s.muted, textDecoration: "line-through" }}>{myth}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", padding: 48, marginTop: 32, borderRadius: r, background: s.accent }}>
        {label("FACT", s.onAccent, s.accent)}
        <div style={{ display: "flex", marginTop: 24, fontFamily: p.fonts.heading, fontWeight: 700, fontSize: 56, lineHeight: 1.2, color: s.onAccent }}>{fact}</div>
      </div>
      <CornerLogo p={p} color={s.fg} />
    </Frame>
  );
}
