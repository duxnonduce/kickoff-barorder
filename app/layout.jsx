import "./globals.css";

export const metadata = {
  title: "KickOff Ordina",
  description: "Ordina dal tuo posto — Centro Sportivo KickOff",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "KickOff Ordina",
  },
};

export const viewport = {
  themeColor: "#0E4A47",
};

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body className="bg-stone-50 text-stone-900">{children}</body>
    </html>
  );
}
