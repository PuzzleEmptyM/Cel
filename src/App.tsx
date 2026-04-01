import { useEffect } from 'react'
import { useStore } from './store/use-store'
import { Toolbar } from './components/toolbar'
import { CanvasView } from './components/canvas-view'
import { LayersPanel } from './components/layers-panel'
import { Inspector } from './components/inspector'
import { Timeline } from './components/timeline'

export default function App() {
  const initProject = useStore((s) => s.initProject)

  useEffect(() => {
    initProject()
  }, [initProject])

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '240px 1fr 280px',
        gridTemplateRows: '48px 1fr 220px',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {/* Toolbar — full width top */}
      <div style={{ gridColumn: '1 / -1', gridRow: '1' }}>
        <Toolbar />
      </div>

      {/* Layers panel — left */}
      <div style={{ gridColumn: '1', gridRow: '2' }}>
        <LayersPanel />
      </div>

      {/* Canvas — center */}
      <div style={{ gridColumn: '2', gridRow: '2' }}>
        <CanvasView />
      </div>

      {/* Inspector — right */}
      <div style={{ gridColumn: '3', gridRow: '2' }}>
        <Inspector />
      </div>

      {/* Timeline — full width bottom */}
      <div style={{ gridColumn: '1 / -1', gridRow: '3', overflow: 'hidden' }}>
        <Timeline />
      </div>
    </div>
  )
}
