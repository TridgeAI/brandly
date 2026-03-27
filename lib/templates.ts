import type { ContentTemplate } from "./types";

export const CONTENT_TEMPLATES: ContentTemplate[] = [
  {
    id: "product_launch",
    label: "Product Launch",
    icon: "🚀",
    description: "Announce a new product or service with excitement",
    promptHint: "Focus on the key benefit, create urgency, include a strong CTA",
  },
  {
    id: "announcement",
    label: "Announcement",
    icon: "📣",
    description: "Share brand news, milestones or updates",
    promptHint: "Conversational, celebratory tone — make followers feel part of the journey",
  },
  {
    id: "engagement",
    label: "Engagement",
    icon: "💬",
    description: "Spark conversation with questions or polls",
    promptHint: "Ask one clear question, make it easy and fun to answer",
  },
  {
    id: "educational",
    label: "Educational",
    icon: "💡",
    description: "Teach your audience something valuable",
    promptHint: "Use 3-5 clear tips or steps, establish expertise without being dry",
  },
  {
    id: "behind_scenes",
    label: "Behind the Scenes",
    icon: "🎬",
    description: "Show how the brand works internally",
    promptHint: "Personal, authentic, humanise the brand — show process not perfection",
  },
  {
    id: "testimonial",
    label: "Testimonial",
    icon: "⭐",
    description: "Share a customer story or review",
    promptHint: "Lead with the result, make it relatable, include social proof elements",
  },
  {
    id: "seasonal",
    label: "Seasonal / Trending",
    icon: "🌟",
    description: "Tie into a current event, holiday or trend",
    promptHint: "Connect the trend to the brand naturally — avoid forced relevance",
  },
  {
    id: "ugc",
    label: "UGC / Repost",
    icon: "🤝",
    description: "Celebrate community and user content",
    promptHint: "Grateful, community-focused tone — give credit and invite more",
  },
];

export const PLATFORM_LIMITS = {
  instagram: { caption: 2200, hashtags: 30 },
  facebook: { caption: 63206, hashtags: 0 },
  linkedin: { caption: 3000, hashtags: 5 },
  twitter: { caption: 280, hashtags: 2 },
};

export const PLATFORM_LABELS = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  twitter: "X / Twitter",
};

export const PLATFORM_ICONS: Record<string, string> = {
  instagram: "📸",
  facebook: "👥",
  linkedin: "💼",
  twitter: "🐦",
};
