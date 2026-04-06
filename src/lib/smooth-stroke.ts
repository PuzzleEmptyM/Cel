type Point = { x: number; y: number }

// Chaikin's corner-cutting algorithm. Each iteration doubles the number of points.
// iterations=0 → raw, 2 → smooth, 4 → very smooth.
export function smoothStroke(points: Point[], iterations: number): Point[] {
  if (iterations === 0 || points.length < 3) return points
  let pts = points
  for (let iter = 0; iter < iterations; iter++) {
    const out: Point[] = [pts[0]] // keep first point
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i], p1 = pts[i + 1]
      out.push({ x: 0.75 * p0.x + 0.25 * p1.x, y: 0.75 * p0.y + 0.25 * p1.y })
      out.push({ x: 0.25 * p0.x + 0.75 * p1.x, y: 0.25 * p0.y + 0.75 * p1.y })
    }
    out.push(pts[pts.length - 1]) // keep last point
    pts = out
  }
  return pts
}
