import { useEffect } from 'react'
import { useAnnotations } from '../../state/AnnotationContext'
import { isTypingTarget } from '../../lib/hooks'

/** P toggles drawing, Ctrl/Cmd+Z undoes, Esc stops drawing (handled before page shortcuts). */
export function useAnnotationShortcuts(enabled = true) {
  const { active, setActive, undo } = useAnnotations()
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || document.querySelector('dialog[open]')) return
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        setActive(!active)
      } else if (e.key === 'Escape' && active) {
        e.preventDefault()
        e.stopImmediatePropagation()
        setActive(false)
      }
    }
    // capture phase so Esc can stop drawing before it ends a presentation
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [enabled, active, setActive, undo])
}
