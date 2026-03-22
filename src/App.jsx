import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { fetchSounds, getSoundUrl } from './supabase'
import './App.css'

export default function App() {
  const [sounds, setSounds] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [loading, setLoading] = useState(true)
  const audioRef = useRef(null)

  useEffect(() => {
    fetchSounds()
      .then((data) => {
        setSounds(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to fetch sounds:', err)
        setLoading(false)
      })
  }, [])

  const current = sounds[currentIndex]

  const play = useCallback(() => {
    if (!current || !audioRef.current) return
    audioRef.current.src = getSoundUrl(current.file_path)
    audioRef.current.play()
    setIsPlaying(true)
  }, [current])

  const stop = useCallback(() => {
    if (!audioRef.current) return
    audioRef.current.pause()
    audioRef.current.currentTime = 0
    setIsPlaying(false)
  }, [])

  const next = useCallback(() => {
    if (sounds.length === 0) return
    stop()
    setCurrentIndex((i) => (i + 1) % sounds.length)
  }, [sounds.length, stop])

  const prev = useCallback(() => {
    if (sounds.length === 0) return
    stop()
    setCurrentIndex((i) => (i - 1 + sounds.length) % sounds.length)
  }, [sounds.length, stop])

  const handleEnded = () => setIsPlaying(false)

  // Fake spectrogram bars
  const NUM_BARS = 32
  const barsRef = useRef(null)
  const barHeights = useRef(new Float32Array(NUM_BARS).fill(10))
  const barTargets = useRef(new Float32Array(NUM_BARS).fill(10))

  useEffect(() => {
    if (!isPlaying) {
      // Reset bars when stopped
      if (barsRef.current) {
        const bars = barsRef.current.children
        for (let i = 0; i < bars.length; i++) {
          bars[i].style.height = '10%'
        }
      }
      barHeights.current.fill(10)
      barTargets.current.fill(10)
      return
    }

    let frameId
    let lastTargetUpdate = 0
    const lerp = 0.18

    const animate = (time) => {
      // Update targets every ~80ms for a natural look
      if (time - lastTargetUpdate > 80) {
        for (let i = 0; i < NUM_BARS; i++) {
          // Shape: louder in low-mid frequencies, quieter at extremes
          const freqCurve = Math.sin((i / NUM_BARS) * Math.PI) * 0.6 + 0.4
          barTargets.current[i] = (Math.random() * 85 + 15) * freqCurve
        }
        lastTargetUpdate = time
      }

      // Smooth interpolation toward targets
      const bars = barsRef.current?.children
      if (bars) {
        for (let i = 0; i < bars.length; i++) {
          barHeights.current[i] += (barTargets.current[i] - barHeights.current[i]) * lerp
          bars[i].style.height = `${barHeights.current[i]}%`
        }
      }

      frameId = requestAnimationFrame(animate)
    }

    frameId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameId)
  }, [isPlaying])

  // Jog wheel rotation
  const wheelRef = useRef(null)
  const [wheelAngle, setWheelAngle] = useState(0)
  const wheelState = useRef({ active: false, startAngle: 0, lastAngle: 0, accumulated: 0 })

  const getAngle = useCallback((e, el) => {
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - cx
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - cy
    return Math.atan2(y, x) * (180 / Math.PI)
  }, [])

  const stepThreshold = 40

  const onWheelStart = useCallback((e) => {
    e.preventDefault()
    const el = wheelRef.current
    if (!el) return
    const angle = getAngle(e, el)
    wheelState.current = { active: true, startAngle: angle, lastAngle: angle, accumulated: 0 }
  }, [getAngle])

  const onWheelMove = useCallback((e) => {
    if (!wheelState.current.active) return
    e.preventDefault()
    const el = wheelRef.current
    if (!el) return
    const angle = getAngle(e, el)
    let delta = angle - wheelState.current.lastAngle
    if (delta > 180) delta -= 360
    if (delta < -180) delta += 360
    wheelState.current.lastAngle = angle
    wheelState.current.accumulated += delta
    setWheelAngle((a) => a + delta)

    if (wheelState.current.accumulated > stepThreshold) {
      next()
      wheelState.current.accumulated = 0
    } else if (wheelState.current.accumulated < -stepThreshold) {
      prev()
      wheelState.current.accumulated = 0
    }
  }, [getAngle, next, prev])

  const onWheelEnd = useCallback(() => {
    wheelState.current.active = false
  }, [])

  useEffect(() => {
    const onMove = (e) => onWheelMove(e)
    const onUp = () => onWheelEnd()
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [onWheelMove, onWheelEnd])

  return (
    <div className="walkman">
      <audio ref={audioRef} onEnded={handleEnded} />

      {/* Display */}
      <div className="display">
        <div className="display-screen">
          {loading ? (
            <div className="display-text">Loading...</div>
          ) : sounds.length === 0 ? (
            <div className="display-text">No sounds</div>
          ) : (
            <>
              <div className="display-counter">
                {currentIndex + 1} / {sounds.length}
              </div>
              <div className="display-title">{current?.name}</div>
              <div className="display-desc">{current?.description}</div>
              {isPlaying && <div className="display-playing">▶ PLAYING</div>}
            </>
          )}
        </div>
        <div className="display-bars" ref={barsRef}>
          {Array.from({ length: NUM_BARS }).map((_, i) => (
            <div key={i} className="bar" style={{ height: '10%' }} />
          ))}
        </div>
      </div>

      {/* Speaker grille */}
      <div className="speaker-section">
        <div className="speaker-grille">
          {Array.from({ length: 100 }).map((_, i) => (
            <div key={i} className="speaker-dot" />
          ))}
        </div>
      </div>

      {/* Jog wheel */}
      <div className="wheel-container">
        <div
          className="wheel"
          ref={wheelRef}
          onMouseDown={onWheelStart}
          onTouchStart={onWheelStart}
        >
          <div className="wheel-surface" style={{ transform: `rotate(${wheelAngle}deg)` }}>
            <div className="wheel-notch" />
          </div>
          <div className="wheel-hub" />
        </div>
      </div>

      {/* Controls */}
      <div className="controls">
        <button className="btn" onClick={prev} aria-label="Previous">
          <span className="btn-icon">{'\u23EE\uFE0E'}</span>
        </button>
        <button className="btn btn-play" onClick={isPlaying ? stop : play} aria-label={isPlaying ? 'Stop' : 'Play'}>
          <span className="btn-icon">{isPlaying ? '\u23F9\uFE0E' : '\u25B6\uFE0E'}</span>
        </button>
        <button className="btn" onClick={next} aria-label="Next">
          <span className="btn-icon">{'\u23ED\uFE0E'}</span>
        </button>
      </div>
    </div>
  )
}
