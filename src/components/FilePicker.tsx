import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useDocument } from '../state/DocumentContext'
import { Icon } from './ui/Icon'

const PickerCtx = createContext<() => void>(() => {})

// eslint-disable-next-line react-refresh/only-export-components
export const useFilePicker = () => useContext(PickerCtx)

/**
 * One hidden file input for the whole app plus a window-level drop target,
 * so a PDF can be opened from the dashboard or dropped onto the viewer.
 */
export function FilePickerProvider({ children }: { children: ReactNode }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { openFile } = useDocument()
  const [dragging, setDragging] = useState(false)
  const depth = useRef(0)

  const open = useCallback(() => inputRef.current?.click(), [])

  useEffect(() => {
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth.current++
      setDragging(true)
    }
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setDragging(false)
    }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth.current = 0
      setDragging(false)
      const file = e.dataTransfer?.files?.[0]
      if (file) void openFile(file)
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [openFile])

  return (
    <PickerCtx.Provider value={open}>
      {children}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="file-input"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = '' // allow re-selecting the same file
          if (file) void openFile(file)
        }}
      />
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-[60] grid place-items-center bg-ink/55 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-accent/80 bg-ink/70 px-14 py-12 text-canvas">
            <Icon name="upload" size={32} />
            <p className="font-display text-2xl">Drop PDF to open</p>
            <p className="text-sm text-canvas/70">It stays on this device</p>
          </div>
        </div>
      )}
    </PickerCtx.Provider>
  )
}
