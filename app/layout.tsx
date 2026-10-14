import { cn } from "@/lib/utils"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Lora, PT_Sans } from "next/font/google"
import type { ReactNode } from "react"
import { allowedOrigins } from "@/lib/embed-origins"

// Gaya visual Kompas: Lora untuk judul & teks, PT Sans untuk keyword & elemen UI
const lora = Lora({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-lora" })
const ptSans = PT_Sans({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-pt-sans" })

export const metadata = {
  title: "Chatbot Berita Kompas.id",
  description: "Chatbot untuk menjawab pertanyaan berdasarkan berita di Kompas.id.",
    generator: 'v0.dev'
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <head>
        {/* Komunikasi lintas origin: hanya dengan origin yang ada di allowlist */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                var allowed = ${JSON.stringify(allowedOrigins)};
                function parentOrigin() {
                  if (window.parent === window) return null;
                  var o = '';
                  if (window.location.ancestorOrigins && window.location.ancestorOrigins.length) {
                    o = window.location.ancestorOrigins[0];
                  } else if (document.referrer) {
                    try { o = new URL(document.referrer).origin; } catch (e) {}
                  }
                  return allowed.indexOf(o) !== -1 ? o : null;
                }
                window.addEventListener('message', function (event) {
                  if (allowed.indexOf(event.origin) === -1) return;
                  if (event.data && event.data.type === 'resize') {
                    var height = Number(event.data.height);
                    if (height && !isNaN(height)) document.body.style.height = height + 'px';
                  }
                });
                window.addEventListener('load', function () {
                  var origin = parentOrigin();
                  if (origin) window.parent.postMessage({ type: 'ready', from: 'kompas-chatbot' }, origin);
                });
              })();
            `,
          }}
        />
      </head>
      <body className={cn("flex min-h-svh flex-col bg-white font-serif text-black antialiased", lora.variable, ptSans.variable)}>
        <TooltipProvider delayDuration={0}>{children}</TooltipProvider>
      </body>
    </html>
  )
}


import './globals.css'