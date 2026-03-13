export type Direction = 'up' | 'down' | 'left' | 'right'

export interface Point {
  x: number
  y: number
}

export interface SnakeGameState {
  width: number
  height: number
  snake: Point[]
  direction: Direction
  queuedDirection: Direction | null
  food: Point
  score: number
  isGameOver: boolean
}

export const DEFAULT_GRID_SIZE = 20

const DIRECTIONS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

export function pointsEqual(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y
}

export function isOppositeDirection(a: Direction, b: Direction): boolean {
  return (
    (a === 'up' && b === 'down') ||
    (a === 'down' && b === 'up') ||
    (a === 'left' && b === 'right') ||
    (a === 'right' && b === 'left')
  )
}

function randomInt(maxExclusive: number, random: () => number): number {
  return Math.floor(random() * maxExclusive)
}

export function placeFood(width: number, height: number, snake: Point[], random: () => number = Math.random): Point {
  const occupied = new Set(snake.map(segment => `${segment.x},${segment.y}`))
  const freeCells: Point[] = []

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const key = `${x},${y}`
      if (!occupied.has(key)) {
        freeCells.push({ x, y })
      }
    }
  }

  if (freeCells.length === 0) {
    return snake[snake.length - 1] ?? { x: 0, y: 0 }
  }

  return freeCells[randomInt(freeCells.length, random)]
}

export function createInitialGameState(
  width: number = DEFAULT_GRID_SIZE,
  height: number = DEFAULT_GRID_SIZE,
  random: () => number = Math.random,
): SnakeGameState {
  const centerX = Math.floor(width / 2)
  const centerY = Math.floor(height / 2)

  const snake: Point[] = [
    { x: centerX, y: centerY },
    { x: centerX - 1, y: centerY },
    { x: centerX - 2, y: centerY },
  ]

  return {
    width,
    height,
    snake,
    direction: 'right',
    queuedDirection: null,
    food: placeFood(width, height, snake, random),
    score: 0,
    isGameOver: false,
  }
}

export function queueDirection(state: SnakeGameState, nextDirection: Direction): SnakeGameState {
  if (state.isGameOver) {
    return state
  }

  if (isOppositeDirection(state.direction, nextDirection)) {
    return state
  }

  return {
    ...state,
    queuedDirection: nextDirection,
  }
}

export function advanceGame(state: SnakeGameState, random: () => number = Math.random): SnakeGameState {
  if (state.isGameOver) {
    return state
  }

  const direction =
    state.queuedDirection && !isOppositeDirection(state.direction, state.queuedDirection)
      ? state.queuedDirection
      : state.direction

  const vector = DIRECTIONS[direction]
  const head = state.snake[0]
  const nextHead = {
    x: head.x + vector.x,
    y: head.y + vector.y,
  }

  const hitWall =
    nextHead.x < 0 ||
    nextHead.x >= state.width ||
    nextHead.y < 0 ||
    nextHead.y >= state.height

  const willGrow = pointsEqual(nextHead, state.food)
  const collisionBody = willGrow ? state.snake : state.snake.slice(0, -1)
  const hitSelf = collisionBody.some(segment => pointsEqual(segment, nextHead))

  if (hitWall || hitSelf) {
    return {
      ...state,
      direction,
      queuedDirection: null,
      isGameOver: true,
    }
  }

  const movedSnake = [nextHead, ...state.snake.slice(0, willGrow ? state.snake.length : state.snake.length - 1)]

  return {
    ...state,
    snake: movedSnake,
    direction,
    queuedDirection: null,
    food: willGrow ? placeFood(state.width, state.height, movedSnake, random) : state.food,
    score: willGrow ? state.score + 1 : state.score,
  }
}
