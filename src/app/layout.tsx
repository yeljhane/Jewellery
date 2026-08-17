import type { Metadata } from "next";
import { Cormorant_Garamond, Source_Sans_3 } from "next/font/google";
import { headers } from "next/headers";
import { AppSidebar } from "@/components/AppSidebar";
import { auth } from "@/lib/auth";
import "./globals.css";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
});

const body = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Avenue JOAILLERIE ERP",
  description: "Shop & manufacturing ERP for jewellery businesses",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "/";
  const isLogin = pathname === "/login";
  const session = isLogin ? null : await auth();

  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} antialiased`}>
        {isLogin ? (
          <main className="min-h-screen">
            <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">{children}</div>
          </main>
        ) : (
          <div className="flex min-h-screen">
            <AppSidebar
              currentPath={pathname}
              userName={session?.user?.name}
              userRole={session?.user?.role}
            />
            <main className="flex-1 overflow-x-hidden">
              <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">{children}</div>
            </main>
          </div>
        )}
      </body>
    </html>
  );
}
