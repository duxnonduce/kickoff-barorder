export const metadata = {
  manifest: "/manifest-admin.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "KickOff Ordina",
  },
};

export const viewport = {
  themeColor: "#0E4A47",
};

export default function AdminLayout({ children }) {
  return children;
}
