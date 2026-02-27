import './globals.css';

export const metadata = {
    title: 'Creator Studio — AI Content Creator',
    description: 'Creator Studio - เครื่องมือสร้างคอนเทนต์ด้วย AI สำหรับ YouTube Shorts, Podcast และ TikTok',
};

export default function RootLayout({ children }) {
    return (
        <html lang="th">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body>
                {children}
            </body>
        </html>
    );
}
