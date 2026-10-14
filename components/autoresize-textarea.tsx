"use client"

import { cn } from "@/lib/utils"
import React, { useRef, useEffect, type TextareaHTMLAttributes } from "react"

interface AutoResizeTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> {
  value: string
  onChange: (value: string) => void
}

export function AutoResizeTextarea({ className, value, onChange, ...props }: AutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [currentHeight, setCurrentHeight] = React.useState(40)

  const resizeTextarea = React.useCallback(() => {
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current)
    }
    
    resizeTimeoutRef.current = setTimeout(() => {
      const textarea = textareaRef.current
      if (textarea) {
        // Temporarily set height to auto to get scrollHeight
        const originalHeight = textarea.style.height
        textarea.style.height = "auto"
        const scrollHeight = textarea.scrollHeight
        textarea.style.height = originalHeight
        
        const newHeight = Math.min(Math.max(scrollHeight, 40), 320) // min 40px, max 320px
        
        if (newHeight !== currentHeight) {
          setCurrentHeight(newHeight)
        }
      }
    }, 10) // Small delay to prevent excessive calls
  }, [currentHeight])

  useEffect(() => {
    resizeTextarea()
    
    return () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }
    }
  }, [value, resizeTextarea])

  return (
    <div className="relative flex-1" style={{ minHeight: '40px' }}>
      <textarea
        {...props}
        value={value}
        ref={textareaRef}
        rows={1}
        onChange={(e) => {
          onChange(e.target.value)
          resizeTextarea()
        }}
        className={cn(
          "resize-none w-full border-0 outline-0 bg-transparent transition-all duration-200 ease-out",
          "focus:outline-none focus:ring-0 focus:border-0",
          className
        )}
        style={{
          minHeight: '40px',
          height: `${currentHeight}px`,
          padding: '8px 0',
          lineHeight: '1.5'
        }}
      />
    </div>
  )
}
