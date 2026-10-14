"use client"

import React, { useState, useEffect, Suspense, useRef, useCallback } from "react"
import { cn } from "@/lib/utils"
import { useChat } from "ai/react"
import { ArrowRight, ArrowUpIcon, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { AutoResizeTextarea } from "@/components/autoresize-textarea"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import { useEmbedMode } from "@/hooks/use-embed-mode"
import { trackArticleClick } from "@/lib/track-click"
import { getParentOrigin } from "@/lib/embed-origins"

type Source = {
  title: string
  url: string
}

type RetrievedSource = Source & { ref: number }

// Ambil daftar artikel hasil retrieval dari message annotation yang dikirim /api/chat
function getRetrievedSources(message: { annotations?: unknown[] }): RetrievedSource[] {
  for (const annotation of message.annotations ?? []) {
    const a = annotation as { type?: string; sources?: RetrievedSource[] }
    if (a?.type === "sources" && Array.isArray(a.sources)) return a.sources
  }
  return []
}

// Komponen loading fallback
function ChatFormSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[35rem] flex-col items-stretch h-svh max-h-svh bg-white text-black rounded-lg shadow-md border border-gray-200">
      <div className="flex-1 content-center overflow-y-auto px-6">
        <div className="m-auto flex max-w-96 flex-col gap-5 text-center">
          <div className="h-8 w-64 bg-gray-200 rounded-md mx-auto animate-pulse"></div>
          <div className="h-4 w-80 bg-gray-200 rounded-md mx-auto animate-pulse"></div>
        </div>
      </div>
      <div className="relative mx-6 mb-6 h-10 rounded-[16px] border bg-gray-100 animate-pulse"></div>
    </div>
  )
}

const ExampleQuestions = React.memo(function ExampleQuestions({ questions, isLoading, onSelect }: { 
  questions: string[], 
  isLoading: boolean, 
  onSelect: (q: string) => void 
}) {
  if (isLoading) {
    return (
      <div className="mb-6 font-sans">
        <div className="mb-2 h-3 w-28 rounded bg-gray-200 animate-pulse" />
        <div className="divide-y divide-gray-200 border-y border-gray-200">
          {[1, 2, 3].map((i) => (
            <div key={i} className="py-3">
              <div className="h-4 w-3/4 rounded bg-gray-100 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (questions.length === 0) return null;

  return (
    <nav aria-label="Contoh pertanyaan" className="mb-6 font-sans">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-kompas-red">Coba tanyakan</p>
      <ul className="divide-y divide-gray-200 border-y border-gray-200">
        {questions.map((q, idx) => (
          <li key={`${q}-${idx}`}>
            <button
              className="group flex w-full items-center justify-between gap-3 py-3 text-left text-[0.95rem] leading-snug text-black transition-colors hover:text-kompas-blue focus:outline-none focus-visible:text-kompas-blue focus-visible:underline"
              onClick={() => onSelect(q)}
              type="button"
            >
              <span>{q}</span>
              <ArrowRight
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-kompas-blue transition-transform group-hover:translate-x-0.5"
              />
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
})

// Komponen utama dengan Suspense
export function ChatForm({ className, ...props }: React.ComponentProps<"form">) {
  return (
    <Suspense fallback={<ChatFormSkeleton />}>
      <ChatFormContent className={className} {...props} />
    </Suspense>
  )
}

// Komponen konten yang menggunakan useEmbedMode
function ChatFormContent({ className, ...props }: React.ComponentProps<"form">) {
  const isEmbedMode = useEmbedMode()

  const {
    messages: originalMessages,
    input,
    setInput,
    handleSubmit: handleChatSubmit,
    isLoading,
    stop,
    error,
  } = useChat({
    api: "/api/chat",
  })

  const [messageSources, setMessageSources] = useState<Record<string, Source[]>>({})
  const [processedMessages, setProcessedMessages] = useState<typeof originalMessages>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)
  const [showExamples, setShowExamples] = useState(true)
  const [exampleQuestions, setExampleQuestions] = useState<string[]>([])
  const [questionsLoaded, setQuestionsLoaded] = useState(false)
  const [titleData, setTitleData] = useState<{ keyword?: string; title: string; subtitle: string }>({ title: 'Halo, Sahabat Kompas', subtitle: 'Silakan ajukan pertanyaan terkait artikel yang Anda baca. Jawaban dibuat berdasarkan berita di Kompas.id.' })

  // Fetch example questions once on component mount
  useEffect(() => {
    if (!questionsLoaded) {
      fetch('/api/questions')
        .then(res => res.json())
        .then(data => {
          setExampleQuestions(data.questions || [])
          setQuestionsLoaded(true)
        })
        .catch(() => {
          setQuestionsLoaded(true)
        })
    }
  }, [questionsLoaded])

  // Deteksi posisi scroll sebelum pesan baru masuk
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.innerHeight + window.scrollY
      const threshold = document.body.offsetHeight - 100 // 100px dari bawah
      setShouldAutoScroll(scrollPosition >= threshold)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Auto-scroll ke bawah hanya jika user memang di bawah dan pesan terakhir adalah dari user
  useEffect(() => {
    const lastMessage = processedMessages[processedMessages.length - 1]
    if (
      shouldAutoScroll &&
      processedMessages.length > 0 &&
      lastMessage?.role === "user"
    ) {
      setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
      }, 100)
    }
    // Tidak ada auto-scroll jika pesan terakhir dari asisten (chatbot sedang mengetik)
  }, [processedMessages, shouldAutoScroll])

  useEffect(() => {
    // Fetch title data from API
    async function fetchTitleData() {
      try {
        const response = await fetch("/api/title")
        const data = await response.json()
        if (data.title && data.subtitle) {
          setTitleData({ keyword: data.keyword, title: data.title, subtitle: data.subtitle })
        }
      } catch (error) {
        console.error("Failed to fetch title data:", error)
      }
    }

    fetchTitleData()
  }, [])

  useEffect(() => {
    // Deteksi apakah chatbot sedang memproses atau sudah mulai mengetik
    if (isLoading) {
      // Jika tidak ada pesan asisten yang sedang diproses, berarti masih dalam tahap loading awal
      const lastMessage = originalMessages[originalMessages.length - 1]
      if (!lastMessage || lastMessage.role !== "assistant" || lastMessage.content === "") {
        setIsProcessing(true)
      } else {
        // Jika sudah ada konten, berarti sudah mulai mengetik
        setIsProcessing(false)
      }
    } else {
      setIsProcessing(false)
    }
  }, [isLoading, originalMessages])

  useEffect(() => {
    // Process messages to extract sources and clean up content
    const newProcessedMessages = originalMessages.map((message) => {
      if (message.role === "assistant") {
        // Extract article references and clean up the message
        const { cleanContent, articleRefs } = extractAndCleanMessage(message.content)

        // Sumber = artikel yang benar-benar diretrieve server (annotation),
        // disaring ke artikel yang dikutip model lewat kode "ARTIKEL X"
        const retrieved = getRetrievedSources(message)
        if (retrieved.length > 0 && articleRefs.length > 0) {
          const cited = new Set(articleRefs.map((r) => Number.parseInt(r)))
          const sources = retrieved
            .filter((s) => cited.has(s.ref))
            .map(({ title, url }) => ({ title, url }))

          if (sources.length > 0) {
            setMessageSources((prev) => ({
              ...prev,
              [message.id]: sources,
            }))
          }
        }

        // Return the message with cleaned content
        return {
          ...message,
          content: cleanContent,
        }
      }
      return message
    })

    setProcessedMessages(newProcessedMessages)

    // Notify parent window of height changes in embed mode
    const parentOrigin = isEmbedMode ? getParentOrigin() : null
    if (parentOrigin) {
      setTimeout(() => {
        const height = document.body.scrollHeight
        window.parent.postMessage({ type: "resize", height }, parentOrigin)
      }, 100)
    }
  }, [originalMessages, isEmbedMode])

  // Function to extract article references and clean up the message
  function extractAndCleanMessage(content: string): { cleanContent: string; articleRefs: string[] } {
    // Extract article references
    const articleRegex = /ARTIKEL\s+(\d+)/gi
    const matches = Array.from(content.matchAll(articleRegex))
    const articleRefs: string[] = []

    for (const match of matches) {
      if (match[1]) {
        articleRefs.push(match[1])
      }
    }

    // Clean up the content by removing trailing article references
    let cleanContent = content

    // Remove article references at the end of the message
    const trailingArticleRegex = /\s*ARTIKEL\s+\d+(\s+ARTIKEL\s+\d+)*\s*$/
    cleanContent = cleanContent.replace(trailingArticleRegex, "")

    // Remove any remaining "(ARTIKEL X)" references in the text
    cleanContent = cleanContent.replace(/\s*\(ARTIKEL\s+\d+(?:\s*,?\s*ARTIKEL\s+\d+)*\)/gi, "")

    return { cleanContent, articleRefs }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim()) return
    handleChatSubmit(e)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>)
    }
  }

  const handleExampleSelect = useCallback((question: string) => {
    setInput(question)
    setShowExamples(false)
    // Simulasikan submit otomatis
    setTimeout(() => {
      const form = document.getElementById('chat-form-main') as HTMLFormElement | null
      if (form) form.requestSubmit()
    }, 0)
  }, [setInput])

  const welcomeHeader = (
    <header className="m-auto flex max-w-96 flex-col gap-5 text-center py-8">
      {titleData.keyword && (
        <p className="font-sans text-sm font-bold uppercase tracking-wide text-kompas-red">{titleData.keyword}</p>
      )}
      <h1 className="font-serif text-2xl font-bold leading-tight">{titleData.title}</h1>
      <p className="font-serif text-black/80 text-sm">
        {titleData.subtitle}
      </p>
    </header>
  )

  // Pastikan messageList didefinisikan sebelum return
  const messageList = (
    <div className="my-4 flex h-fit min-h-full flex-col gap-4">
      {processedMessages.map((message, index) => (
        <div key={index} className="flex flex-col">
          <div
            data-role={message.role}
            className="max-w-[80%] rounded-xl px-3 py-2 text-sm data-[role=assistant]:self-start data-[role=user]:self-end data-[role=assistant]:bg-gray-100 data-[role=user]:bg-kompas-blue data-[role=assistant]:text-black data-[role=user]:text-white"
          >
            {message.role === "assistant" ? (
              <div className="prose prose-sm max-w-none font-serif text-inherit prose-p:text-inherit prose-li:text-inherit prose-strong:text-inherit prose-headings:font-serif prose-headings:text-inherit prose-a:text-kompas-blue [&>p]:mb-4 [&>ul]:space-y-2 [&>ol]:space-y-2">
                <ReactMarkdown>
                  {message.content}
                </ReactMarkdown>
              </div>
            ) : (
              message.content
            )}
          </div>
          {/* Sources section */}
          {message.role === "assistant" && messageSources[message.id] && messageSources[message.id].length > 0 && (
            <div className="mt-1 self-start font-sans text-xs text-gray-600">
              <p className="font-bold uppercase tracking-wide text-kompas-red mb-2">Sumber</p>
              <ul className="mt-1 space-y-2 list-disc list-inside pl-2">
                {messageSources[message.id].map((source, idx) => (
                  <li key={idx} className="leading-relaxed">
                    <Link
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-kompas-blue hover:underline transition-colors duration-200"
                      onClick={() => {
                        // Track article click without affecting main functionality
                        trackArticleClick({
                          url: source.url,
                          title: source.title,
                          messageId: message.id
                        })
                      }}
                    >
                      {source.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
      {error && !isLoading && (
        <div className="self-start rounded-xl bg-red-50 px-3 py-2 font-sans text-sm text-kompas-red">
          {error.message?.includes("Terlalu banyak")
            ? "Terlalu banyak pertanyaan. Silakan coba lagi sebentar lagi."
            : "Maaf, terjadi kesalahan. Silakan coba lagi."}
        </div>
      )}
      {/* Loading animation - hanya muncul saat memproses, bukan saat mengetik */}
      {isProcessing && (
        <div className="self-start rounded-xl bg-gray-100 px-3 py-2 font-sans text-sm">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-kompas-blue" />
            <span>Sedang menyusun jawaban...</span>
          </div>
        </div>
      )}
    </div>
  )


  return (
    <main
      className={cn(
        "min-h-screen flex flex-col items-center w-full max-w-[35rem] border border-gray-200 rounded-lg shadow-md bg-white mx-auto",
        isEmbedMode ? "h-full" : "",
        className,
      )}
      {...props}
    >
      <div className="flex-1 w-full px-6 flex flex-col" ref={chatContainerRef}>
        {processedMessages.length === 0 ? (
          <>
            {welcomeHeader}
            {showExamples && <ExampleQuestions 
              questions={exampleQuestions} 
              isLoading={!questionsLoaded} 
              onSelect={handleExampleSelect} 
            />}
          </>
        ) : messageList}
      </div>
      <form
        id="chat-form-main"
        onSubmit={handleSubmit}
        className="font-sans border-input bg-background focus-within:ring-kompas-blue/20 relative mb-6 flex items-start rounded-[16px] border text-sm focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-0 w-full max-w-[90%] mx-auto"
        style={{ minHeight: '56px' }}
      >
        <div className="flex-1 px-3 py-2">
          <AutoResizeTextarea
            onKeyDown={handleKeyDown}
            onChange={(v) => setInput(v)}
            value={input}
            placeholder="Ketik pertanyaan Anda..."
            className="placeholder:text-muted-foreground"
          />
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="absolute bottom-1 right-1 size-6 rounded-full bg-kompas-blue text-white hover:bg-kompas-blue/90 hover:text-white disabled:bg-gray-300"
                disabled={!input.trim() || isLoading}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpIcon size={16} />}
              </Button>
            </TooltipTrigger>
            <TooltipContent sideOffset={12}>Kirim</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </form>
      {/* Footer - hide in embed mode if needed */}
      {!isEmbedMode && (
        <footer className="border-t border-gray-200 py-3 text-center font-sans text-xs text-gray-600 w-full">
          Chatbot bisa salah, cek kembali dengan membaca laporan{" "}
          <Link
            href="https://www.kompas.id/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-kompas-blue hover:underline"
          >
            Kompas.id
          </Link>
          .
        </footer>
      )}
    </main>
  )
}
