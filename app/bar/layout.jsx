export const metadata = {
  manifest: "/manifest-bar.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "KickOff Ordina",
  },
};

export const viewport = {
  themeColor: "#0E4A47",
};

export default function BarLayout({ children }) {
  return children;
}
