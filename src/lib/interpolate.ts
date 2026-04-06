import type { Keyframe, Easing, Stroke } from '../types'

function ease(t: number, easing: Easing): number {
  switch (easing) {
    case 'linear':       return t
    case 'ease-in':      return t * t
    case 'ease-out':     return t * (2 - t)
    case 'ease-in-out':  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export type ObjectState = {
  x: number
  y: number
  scaleX: number
  scaleY: number
  rotation: number
  alpha: number
}

// Returns the strokes from the keyframe at-or-before the given frame (hold interpolation).
export function getActiveStrokes(keyframes: Keyframe[], frame: number): Stroke[] {
  if (keyframes.length === 0) return []
  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame)
  const cel = [...sorted].reverse().find((kf) => kf.frame <= frame)
  return cel?.strokes ?? sorted[0].strokes
}

export function interpolateLayer(keyframes: Keyframe[], frame: number): ObjectState | null {
  if (keyframes.length === 0) return null

  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame)

  if (frame <= sorted[0].frame) {
    const kf = sorted[0]
    return { x: kf.x, y: kf.y, scaleX: kf.scaleX, scaleY: kf.scaleY, rotation: kf.rotation, alpha: kf.alpha }
  }

  if (frame >= sorted[sorted.length - 1].frame) {
    const kf = sorted[sorted.length - 1]
    return { x: kf.x, y: kf.y, scaleX: kf.scaleX, scaleY: kf.scaleY, rotation: kf.rotation, alpha: kf.alpha }
  }

  let lo = sorted[0]
  let hi = sorted[1]
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].frame <= frame && frame < sorted[i + 1].frame) {
      lo = sorted[i]
      hi = sorted[i + 1]
      break
    }
  }

  const raw = (frame - lo.frame) / (hi.frame - lo.frame)
  const t = ease(raw, lo.easing)

  return {
    x:        lerp(lo.x,        hi.x,        t),
    y:        lerp(lo.y,        hi.y,        t),
    scaleX:   lerp(lo.scaleX,   hi.scaleX,   t),
    scaleY:   lerp(lo.scaleY,   hi.scaleY,   t),
    rotation: lerp(lo.rotation, hi.rotation, t),
    alpha:    lerp(lo.alpha,    hi.alpha,    t),
  }
}
