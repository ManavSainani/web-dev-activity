import "./globals.css";

export const metadata = {
  title: "Fieldnote — Criminology recording room",
  description: "Secure field recording workspace for the Criminology Department.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
