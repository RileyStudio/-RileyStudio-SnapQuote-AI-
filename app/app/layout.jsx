import './globals.css';

export const metadata = {
  title: 'SnapQuote AI — Quote the job before you leave the driveway',
  description:
    'Photos and a voice note become a branded estimate the customer can approve from their phone.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper font-body text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
