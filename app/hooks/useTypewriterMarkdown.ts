import { useEffect, useRef, useState } from 'react'

interface UseTypewriterMarkdownOptions {
  fullText: string
  speedMs?: number
  disabled?: boolean
}

interface UseTypewriterMarkdownReturn {
  renderedMarkdown: string
  isDone: boolean
}

/**
 * Progressive typewriter effect for markdown content.
 * Reveals characters one by one while preserving markdown formatting.
 * Respects prefers-reduced-motion media query.
 */
export function useTypewriterMarkdown({
  fullText,
  speedMs = 20,
  disabled = false,
}: UseTypewriterMarkdownOptions): UseTypewriterMarkdownReturn {
  const [renderedMarkdown, setRenderedMarkdown] = useState('')
  const [isDone, setIsDone] = useState(false)
  const indexRef = useRef(0)
  const prefersReducedMotion = useRef(false)

  // Check for prefers-reduced-motion on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
      prefersReducedMotion.current = mediaQuery.matches

      const handleChange = (e: MediaQueryListEvent) => {
        prefersReducedMotion.current = e.matches
      }

      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  useEffect(() => {
    // Reset state when fullText changes
    indexRef.current = 0
    setIsDone(false)

    // If disabled, animation is off, or prefers-reduced-motion, show full text immediately
    if (disabled || prefersReducedMotion.current || !fullText) {
      setRenderedMarkdown(fullText)
      setIsDone(true)
      return
    }

    // Start typewriter animation
    setRenderedMarkdown('')

    const interval = setInterval(() => {
      if (indexRef.current < fullText.length) {
        indexRef.current += 1
        setRenderedMarkdown(fullText.slice(0, indexRef.current))
      } else {
        setIsDone(true)
        clearInterval(interval)
      }
    }, speedMs)

    return () => clearInterval(interval)
  }, [fullText, speedMs, disabled])

  return {
    renderedMarkdown,
    isDone,
  }
}
