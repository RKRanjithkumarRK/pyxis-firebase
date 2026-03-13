'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Gamepad2, Pause, Play, RotateCcw } from 'lucide-react'
import {
  advanceGame,
  createInitialGameState,
  queueDirection,
  type Direction,
} from '@/lib/snake/game'

const GRID_SIZE = 20
const TICK_MS = 140

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  a: 'left',
  s: 'down',
  d: 'right',
  W: 'up',
  A: 'left',
  S: 'down',
  D: 'right',
}

function ControlButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="h-10 w-10 rounded-lg bg-surface border border-border text-text-primary text-sm"
      type="button"
    >
      {label}
    </button>
  )
}

export default function SnakePage() {
  const [game, setGame] = useState(() => createInitialGameState(GRID_SIZE, GRID_SIZE))
  const [isPaused, setIsPaused] = useState(false)

  const restart = useCallback(() => {
    setGame(createInitialGameState(GRID_SIZE, GRID_SIZE))
    setIsPaused(false)
  }, [])

  const applyDirection = useCallback((direction: Direction) => {
    setGame(prev => queueDirection(prev, direction))
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === ' ') {
        event.preventDefault()
        setIsPaused(prev => !prev)
        return
      }

      if (event.key.toLowerCase() === 'r') {
        event.preventDefault()
        restart()
        return
      }

      const direction = KEY_TO_DIRECTION[event.key]
      if (!direction) return

      event.preventDefault()
      applyDirection(direction)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [applyDirection, restart])

  useEffect(() => {
    if (game.isGameOver || isPaused) return

    const id = window.setInterval(() => {
      setGame(prev => advanceGame(prev))
    }, TICK_MS)

    return () => window.clearInterval(id)
  }, [game.isGameOver, isPaused])

  const snakeCells = useMemo(() => {
    return new Set(game.snake.map(segment => `${segment.x},${segment.y}`))
  }, [game.snake])

  return (
    <div className="h-full overflow-y-auto bg-bg text-text-primary">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3 border border-border bg-surface rounded-xl px-4 py-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-hover flex items-center justify-center">
              <Gamepad2 size={16} />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Snake</h1>
              <p className="text-xs text-text-tertiary">Arrow keys / WASD to move</p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs text-text-tertiary">Score</p>
            <p className="text-lg font-semibold leading-none">{game.score}</p>
          </div>
        </div>

        <div className="border border-border bg-surface rounded-xl p-3">
          <div
            className="grid rounded-lg overflow-hidden border border-border bg-bg"
            style={{ gridTemplateColumns: `repeat(${game.width}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: game.width * game.height }, (_, idx) => {
              const x = idx % game.width
              const y = Math.floor(idx / game.width)
              const key = `${x},${y}`
              const isFood = game.food.x === x && game.food.y === y
              const isSnake = snakeCells.has(key)
              const isHead = isSnake && game.snake[0].x === x && game.snake[0].y === y

              return (
                <div
                  key={key}
                  className="aspect-square border border-border/30"
                  style={{
                    backgroundColor: isFood
                      ? 'var(--danger)'
                      : isHead
                        ? 'var(--accent)'
                        : isSnake
                          ? 'var(--surface-active)'
                          : 'transparent',
                  }}
                />
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button
              type="button"
              onClick={() => setIsPaused(prev => !prev)}
              disabled={game.isGameOver}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-surface-hover text-sm disabled:opacity-40"
            >
              {isPaused ? <Play size={14} /> : <Pause size={14} />}
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              type="button"
              onClick={restart}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-surface-hover text-sm"
            >
              <RotateCcw size={14} />
              Restart
            </button>
            <p className="text-xs text-text-tertiary">Space: pause/resume • R: restart</p>
          </div>

          {game.isGameOver && (
            <p className="mt-3 text-sm text-red-400">Game over. Press restart or R to play again.</p>
          )}
        </div>

        <div className="md:hidden mt-4 border border-border bg-surface rounded-xl p-3">
          <p className="text-xs text-text-tertiary mb-2">Touch controls</p>
          <div className="flex flex-col items-center gap-2">
            <ControlButton label="?" onClick={() => applyDirection('up')} />
            <div className="flex items-center gap-2">
              <ControlButton label="?" onClick={() => applyDirection('left')} />
              <ControlButton label="?" onClick={() => applyDirection('down')} />
              <ControlButton label="?" onClick={() => applyDirection('right')} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
