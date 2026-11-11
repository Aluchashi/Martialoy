import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import {
  motion,
  useMotionValue,
  useTransform,
  useMotionTemplate,
  useReducedMotion,
} from 'motion/react'
import type { MotionValue, PanInfo } from 'motion/react'
import merConcept from './rover 3.jpg'
import curiosityConcept from './rover 2.jpg'
import curiositySlope from './download.jpg'

export interface HeroSlide {
  id: string
  src: string
  alt: string
  label: string
}

const SLIDES: HeroSlide[] = [
  {
    id: 'mer-concept',
    src: merConcept,
    alt: 'Artist concept of a Mars Exploration Rover on rocky terrain with hazy hills',
    label: 'MER artist concept',
  },
  {
    id: 'curiosity-concept',
    src: curiosityConcept,
    alt: 'Artist concept of the Curiosity rover studying a rock on Mars',
    label: 'Curiosity artist concept',
  },
  {
    id: 'curiosity-slope',
    src: curiositySlope,
    alt: 'Curiosity rover from behind on a rocky slope with hazy hills',
    label: 'Curiosity on the slopes',
  },
]

const DRAG_BUFFER = 60
const VELOCITY_THRESHOLD = 500

function HeroCard({
  slide,
  i,
  x,
  cardWidth,
  gap,
  centerOffset,
  reduceMotion,
}: {
  slide: HeroSlide
  i: number
  x: MotionValue<number>
  cardWidth: number
  gap: number
  centerOffset: number
  reduceMotion: boolean | null
}) {
  const center = centerOffset - i * (cardWidth + gap)
  const distance = useTransform(x, (v: number) => v - center)

  const rotate = useTransform(
    distance,
    [-cardWidth, -cardWidth * 0.1, 0, cardWidth * 0.1, cardWidth],
    [10, 10, 0, -10, -10],
  )
  const blur = useTransform(
    distance,
    [-cardWidth, -cardWidth * 0.2, 0, cardWidth * 0.2, cardWidth],
    [4, 2, 0, 2, 4],
  )
  const opacity = useTransform(
    distance,
    [-cardWidth, -cardWidth * 0.2, 0, cardWidth * 0.2, cardWidth],
    [0, 0.8, 1, 0.8, 0],
  )
  const filter = useMotionTemplate`blur(${blur}px)`

  return (
    <motion.figure
      className="hg-card"
      style={{
        opacity,
        rotate: reduceMotion ? undefined : rotate,
        filter: reduceMotion ? undefined : filter,
        minWidth: cardWidth,
      }}
    >
      <img className="hg-image" src={slide.src} alt={slide.alt} draggable={false} />
      <figcaption className="hg-caption">
        <span className="hg-label">{slide.label}</span>
      </figcaption>
    </motion.figure>
  )
}

export function HeroGallery() {
  const [index, setIndex] = useState(1)
  const [dimensions, setDimensions] = useState({ cardWidth: 320, gap: 84 })
  const [viewportWidth, setViewportWidth] = useState(0)
  const viewportRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const updateDimensions = () => {
      const width = window.innerWidth
      if (width < 640) {
        setDimensions({ cardWidth: Math.min(width - 64, 300), gap: 40 })
      } else {
        setDimensions({ cardWidth: 320, gap: 84 })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const observer = new ResizeObserver(([entry]) => {
      setViewportWidth(entry.contentRect.width)
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  const { cardWidth, gap } = dimensions
  const centerOffset = Math.max(0, (viewportWidth - cardWidth) / 2)
  const slideOffset = centerOffset - index * (cardWidth + gap)
  const x = useMotionValue(slideOffset)

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const offset = info.offset.x
    const velocity = info.velocity.x

    if (offset < -DRAG_BUFFER || velocity < -VELOCITY_THRESHOLD) {
      setIndex((prev) => Math.min(prev + 1, SLIDES.length - 1))
    } else if (offset > DRAG_BUFFER || velocity > VELOCITY_THRESHOLD) {
      setIndex((prev) => Math.max(prev - 1, 0))
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      setIndex((prev) => Math.min(prev + 1, SLIDES.length - 1))
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setIndex((prev) => Math.max(prev - 1, 0))
    }
  }

  return (
    <div
      className="hero-gallery"
      role="region"
      aria-roledescription="carousel"
      aria-label="Mars rover gallery"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="hg-viewport" ref={viewportRef}>
        <motion.div
          className="hg-track"
          drag="x"
          dragConstraints={{
            left: centerOffset - (SLIDES.length - 1) * (cardWidth + gap),
            right: centerOffset,
          }}
          style={{ x, gap: `${gap}px`, perspective: 1000 }}
          animate={{ x: slideOffset }}
          transition={
            reduceMotion
              ? { duration: 0.2, ease: 'easeOut' }
              : { type: 'spring', stiffness: 300, damping: 40 }
          }
          onDragEnd={handleDragEnd}
        >
          {SLIDES.map((slide, i) => (
            <HeroCard
              key={slide.id}
              slide={slide}
              i={i}
              x={x}
              cardWidth={cardWidth}
              gap={gap}
              centerOffset={centerOffset}
              reduceMotion={reduceMotion}
            />
          ))}
        </motion.div>
      </div>

      <div className="hg-dots">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            className="hg-dot"
            aria-label={`Go to slide ${i + 1}: ${slide.label}`}
            aria-current={i === index ? 'true' : undefined}
            onClick={() => setIndex(i)}
          >
            <span />
          </button>
        ))}
      </div>

      <p className="hg-live" aria-live="polite">
        Slide {index + 1} of {SLIDES.length}: {SLIDES[index].label}
      </p>
    </div>
  )
}
