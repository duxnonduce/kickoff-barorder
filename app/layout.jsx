import "./globals.css";

export const metadata = {
  title: "KickOff Ordina",
  description: "Ordina dal tuo posto — Centro Sportivo KickOff",
};

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body className="bg-stone-50 text-stone-900">{children}</body>
    </html>
  );
}
