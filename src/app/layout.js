import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// simple language detection
function getLang() {
  const h = headers();
  const lang = h.get("accept-language") || "";

  if (lang.startsWith("zh")) return "zh";
  return "en";
}

export async function generateMetadata() {
  const lang = getLang();

  const dict = {
    en: {
      title: "Badminton Tactics Board",
      description: "Analyze your badminton games",
    },
    zh: {
      title: "羽球赛后总结小画板",
      description: "羽球人赛后总结",
    },
  };

  const t = dict[lang];

  return {
    title: t.title,
    description: t.description,
    icons: {
      icon: "/my-bg.png",
    },
  };
}