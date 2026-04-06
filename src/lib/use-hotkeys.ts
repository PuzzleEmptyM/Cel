import { useEffect } from 'react'

type HotkeyMap = Record<string, () => void>

function matchesKey(e: KeyboardEvent, combo: string): boolean {
  const parts = combo.toLowerCase().split('+')
  const key = parts[parts.length - 1]
  const needsCtrl  = parts.includes('ctrl')
  const needsShift = parts.includes('shift')
  const needsAlt   = parts.includes('alt')
  return (
    e.key.toLowerCase() === key &&
    e.ctrlKey  === needsCtrl &&
    e.shiftKey === needsShift &&
    e.altKey   === needsAlt
  )
}

export function useHotkeys(map: HotkeyMap): void {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't fire when typing in an input
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      for (const [combo, handler] of Object.entries(map)) {
        if (matchesKey(e, combo)) {
          e.preventDefault()
          handler()
          return
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
