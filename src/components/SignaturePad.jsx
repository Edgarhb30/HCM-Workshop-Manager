import { useEffect, useRef } from 'react'
import { Eraser } from 'lucide-react'

export default function SignaturePad({ value, onChange }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    const ratio = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    canvas.width = width * ratio
    canvas.height = height * ratio
    context.scale(ratio, ratio)
    context.lineWidth = 2.4
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = '#111'

    if (value) {
      const image = new Image()
      image.onload = () => context.drawImage(image, 0, 0, width, height)
      image.src = value
    }
  }, [])

  function point(event) {
    const rect = canvasRef.current.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  function start(event) {
    drawing.current = true
    canvasRef.current.setPointerCapture(event.pointerId)
    const context = canvasRef.current.getContext('2d')
    const { x, y } = point(event)
    context.beginPath()
    context.moveTo(x, y)
  }

  function move(event) {
    if (!drawing.current) return
    const context = canvasRef.current.getContext('2d')
    const { x, y } = point(event)
    context.lineTo(x, y)
    context.stroke()
  }

  function end() {
    if (!drawing.current) return
    drawing.current = false
    onChange(canvasRef.current.toDataURL('image/png'))
  }

  function clear() {
    const canvas = canvasRef.current
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    onChange('')
  }

  return (
    <div className="signature-pad-wrap">
      <canvas
        ref={canvasRef}
        className="signature-pad"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      />
      <button className="secondary compact" type="button" onClick={clear}>
        <Eraser size={16} />Limpiar firma
      </button>
    </div>
  )
}
