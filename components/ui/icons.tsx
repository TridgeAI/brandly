"use client";
import {
  Camera,
  Clapperboard,
  Facebook,
  GraduationCap,
  Handshake,
  Instagram,
  Linkedin,
  Megaphone,
  MessagesSquare,
  PackageSearch,
  Quote,
  Repeat,
  Rocket,
  Rss,
  Sun,
  Twitter,
  type LucideIcon,
} from "lucide-react";

const PLATFORM: Record<string, LucideIcon> = { instagram: Instagram, facebook: Facebook, linkedin: Linkedin, twitter: Twitter };
const TEMPLATE: Record<string, LucideIcon> = {
  product_launch: Rocket,
  announcement: Megaphone,
  engagement: MessagesSquare,
  educational: GraduationCap,
  behind_scenes: Clapperboard,
  testimonial: Quote,
  seasonal: Sun,
  ugc: Handshake,
};
const TRIGGER: Record<string, LucideIcon> = { rss: Rss, recurring: Repeat, product_update: PackageSearch };

export function PlatformIcon({ platform, size = 14 }: { platform: string; size?: number }) {
  const I = PLATFORM[platform] ?? Camera;
  return <I size={size} strokeWidth={1.75} className="inline-block shrink-0 -mt-px" aria-hidden />;
}
export function TemplateIcon({ id, size = 16 }: { id: string; size?: number }) {
  const I = TEMPLATE[id] ?? Rocket;
  return <I size={size} strokeWidth={1.75} className="shrink-0" aria-hidden />;
}
export function TriggerIcon({ type, size = 18 }: { type: string; size?: number }) {
  const I = TRIGGER[type] ?? Repeat;
  return <I size={size} strokeWidth={1.75} className="shrink-0" aria-hidden />;
}
