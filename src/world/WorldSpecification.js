import { z } from 'zod'
import { DEFAULT_WORLD_LIMITS } from './limits.js'
import { CompositionSchema, sanitizeComposition } from './CompositionSchema.js'
import { AnimationSchema, sanitizeAnimation } from './AnimationSchema.js'
import { InteractionsSchema, sanitizeInteractions } from './InteractionSchema.js'
import {
  GenericAppearanceSchema,
  GenericBehaviorSchema,
  GenericGeometrySchema,
  OBJECT_CATEGORIES,
  PRIMARY_FORMS,
  sanitizeGenericDescriptor,
} from '../procedural/objects/GenericDescriptor.js'

const noInventedPath = (value) =>
  !/^https?:\/\//i.test(value) && !value.startsWith('/') && !value.includes('\\') && !value.includes('..')

const Vec3 = z.tuple([z.number().min(-80).max(80), z.number().min(-40).max(40), z.number().min(-80).max(80)])

const SCALE_MIN = 0.2
const SCALE_MAX = 16

function clampNumber(value, min, max, fallback = min) {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) {
    return fallback
  }
  return Math.min(max, Math.max(min, n))
}

function clampScale(value) {
  if (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) {
    return clampNumber(value, SCALE_MIN, SCALE_MAX, 1)
  }
  if (Array.isArray(value) && value.length >= 3) {
    return [
      clampNumber(value[0], SCALE_MIN, SCALE_MAX, 1),
      clampNumber(value[1], SCALE_MIN, SCALE_MAX, 1),
      clampNumber(value[2], SCALE_MIN, SCALE_MAX, 1),
    ]
  }
  return undefined
}

function clampVec3(value, ranges, fallback = [0, 0, 0]) {
  if (!Array.isArray(value) || value.length < 3) {
    return undefined
  }
  return [
    clampNumber(value[0], ranges[0][0], ranges[0][1], fallback[0]),
    clampNumber(value[1], ranges[1][0], ranges[1][1], fallback[1]),
    clampNumber(value[2], ranges[2][0], ranges[2][1], fallback[2]),
  ]
}

function clipText(value, max) {
  const text = String(value ?? '').trim()
  if (!text) {
    return ''
  }
  return text.length > max ? text.slice(0, max) : text
}

/**
 * Soft-fix common LLM numeric / length mistakes before Zod validation.
 * Keeps a usable world instead of falling back to the heuristic director.
 */
export function sanitizeWorldCandidate(input, limits = DEFAULT_WORLD_LIMITS) {
  if (!input || typeof input !== 'object') {
    return input
  }

  const rooms = Array.isArray(input.rooms) ? input.rooms.slice(0, limits.maxRooms) : []

  return {
    ...input,
    theme: clipText(input.theme, limits.maxThemeLength) || 'world',
    description: clipText(input.description, limits.maxDescriptionLength) || 'A generated world',
    rooms: rooms.map((room, index) => {
      if (!room || typeof room !== 'object') {
        return room
      }
      const objects = Array.isArray(room.objects) ? room.objects.slice(0, limits.maxObjectsPerRoom) : []
      const hotspots = Array.isArray(room.hotspots) ? room.hotspots.slice(0, limits.maxHotspotsPerRoom) : []
      const interactionsRaw = room.interactions
      return {
        ...room,
        id: clipText(room.id, 64) || `room${index + 1}`,
        name: clipText(room.name, limits.maxDescriptionLength) || `Room ${index + 1}`,
        environment: {
          type: 'panorama',
          description:
            clipText(room.environment?.description, limits.maxDescriptionLength) ||
            'Atmospheric panoramic environment',
          tags: Array.isArray(room.environment?.tags)
            ? room.environment.tags
                .map((tag) => clipText(tag, 40))
                .filter(Boolean)
                .slice(0, limits.maxTagsPerNeed)
            : [],
        },
        objects: objects
          .filter((object) => object && typeof object === 'object')
          .map((object) => {
            const scale = object.scale === undefined ? undefined : clampScale(object.scale)
            const position = clampVec3(object.position, [
              [-80, 80],
              [-40, 40],
              [-80, 80],
            ])
            const rotation = clampVec3(object.rotation, [
              [-80, 80],
              [-40, 40],
              [-80, 80],
            ])
            const next = {
              ...object,
              type: clipText(object.type, 40) || 'rock',
              description: clipText(object.description, limits.maxDescriptionLength) || 'Scene object',
              tags: Array.isArray(object.tags)
                ? object.tags
                    .map((tag) => clipText(tag, 40))
                    .filter(Boolean)
                    .slice(0, limits.maxTagsPerNeed)
                : [],
            }
            if (object.name !== undefined) {
              next.name = clipText(object.name, 80) || undefined
            }
            if (scale !== undefined) {
              next.scale = scale
            }
            if (position) {
              next.position = position
            }
            if (rotation) {
              next.rotation = rotation
            }
            if (object.material !== undefined) {
              next.material = clipText(object.material, 40) || undefined
            }
            if (object.detail !== undefined) {
              const detail = String(object.detail).toLowerCase()
              next.detail = ['low', 'medium', 'high'].includes(detail) ? detail : 'medium'
            }
            if (object.category || object.form || object.appearance || object.geometry || object.behavior) {
              const descriptor = sanitizeGenericDescriptor(object)
              next.category = descriptor.category
              next.form = descriptor.form
              next.appearance = descriptor.appearance
              next.geometry = descriptor.geometry
              next.behavior = descriptor.behavior
            }
            return next
          }),
        hotspots: hotspots
          .filter((hotspot) => hotspot && typeof hotspot === 'object')
          .map((hotspot) => ({
            ...hotspot,
            id: hotspot.id !== undefined ? clipText(hotspot.id, 64) || undefined : undefined,
            label: clipText(hotspot.label, limits.maxDescriptionLength) || 'Go',
            targetRoom: clipText(hotspot.targetRoom, 64) || 'room1',
            description:
              hotspot.description !== undefined
                ? clipText(hotspot.description, limits.maxDescriptionLength) || undefined
                : undefined,
          })),
        composition: room.composition ? sanitizeComposition(room.composition) : undefined,
        animation: room.animation ? sanitizeAnimation(room.animation) : undefined,
        interactions: interactionsRaw ? sanitizeInteractions(interactionsRaw) : undefined,
      }
    }),
  }
}

export function createWorldSpecificationSchema(limits = DEFAULT_WORLD_LIMITS) {
  const SemanticText = z
    .string()
    .trim()
    .min(1)
    .max(limits.maxDescriptionLength)
    .refine(noInventedPath, { message: 'Descriptions cannot contain URLs or file paths.' })

  const EnvironmentNeed = z.object({
    type: z.literal('panorama'),
    description: SemanticText,
    tags: z.array(z.string().trim().min(1).max(40)).max(limits.maxTagsPerNeed).default([]),
  })

  const ObjectNeed = z.object({
    type: z.string().trim().min(1).max(40),
    name: z.string().trim().min(1).max(80).optional(),
    description: SemanticText,
    tags: z.array(z.string().trim().min(1).max(40)).max(limits.maxTagsPerNeed).default([]),
    position: Vec3.optional(),
    scale: z
      .union([
        z.number().min(SCALE_MIN).max(SCALE_MAX),
        z.tuple([
          z.number().min(SCALE_MIN).max(SCALE_MAX),
          z.number().min(SCALE_MIN).max(SCALE_MAX),
          z.number().min(SCALE_MIN).max(SCALE_MAX),
        ]),
      ])
      .optional(),
    rotation: Vec3.optional(),
    material: z.string().trim().min(1).max(40).optional(),
    detail: z.enum(['low', 'medium', 'high']).optional(),
    color: z.string().trim().min(1).max(40).optional(),
    params: z
      .object({
        colors: z.array(z.string().trim().min(1).max(40)).max(16).optional(),
        styled: z.boolean().optional(),
      })
      .passthrough()
      .optional(),
    // Level-2 generic procedural description (unknown concepts)
    category: z.enum(OBJECT_CATEGORIES).optional(),
    form: z.enum(PRIMARY_FORMS).optional(),
    appearance: GenericAppearanceSchema.optional(),
    geometry: GenericGeometrySchema.optional(),
    behavior: GenericBehaviorSchema.optional(),
  })

  const HotspotNeed = z.object({
    id: z.string().trim().min(1).max(64).optional(),
    label: SemanticText,
    targetRoom: z.string().trim().min(1).max(64),
    description: SemanticText.optional(),
  })

  const RoomNeed = z.object({
    id: z.string().trim().min(1).max(64),
    name: SemanticText,
    environment: EnvironmentNeed,
    composition: CompositionSchema.optional(),
    animation: AnimationSchema.optional(),
    interactions: InteractionsSchema.optional(),
    objects: z.array(ObjectNeed).max(limits.maxObjectsPerRoom).default([]),
    hotspots: z.array(HotspotNeed).max(limits.maxHotspotsPerRoom).default([]),
  })

  return z.object({
    theme: z.string().trim().min(1).max(limits.maxThemeLength),
    description: SemanticText,
    rooms: z.array(RoomNeed).min(1).max(limits.maxRooms),
    /** Original user prompt — used for style/palette inference at build time. */
    prompt: z.string().trim().min(1).max(limits.maxDescriptionLength).optional(),
    /** Stable per-request seed for composer scatter variety. */
    seed: z.number().int().nonnegative().optional(),
    /** Extra entropy so re-runs of the same prompt can differ. */
    entropy: z.union([z.string(), z.number()]).optional(),
  })
}

export const WorldSpecificationSchema = createWorldSpecificationSchema()

export function parseWorldSpecification(input, schema = WorldSpecificationSchema, limits = DEFAULT_WORLD_LIMITS) {
  return schema.parse(sanitizeWorldCandidate(input, limits))
}

export function safeParseWorldSpecification(input, schema = WorldSpecificationSchema, limits = DEFAULT_WORLD_LIMITS) {
  return schema.safeParse(sanitizeWorldCandidate(input, limits))
}

export function assertWorldSizeLimits(specification, limits = DEFAULT_WORLD_LIMITS) {
  const rooms = specification?.rooms
  if (!Array.isArray(rooms) || rooms.length < 1) {
    throw new Error('World specification must include at least one room.')
  }
  if (rooms.length > limits.maxRooms) {
    throw new Error(`World exceeds max rooms (${limits.maxRooms}).`)
  }
  for (const room of rooms) {
    if ((room.objects?.length ?? 0) > limits.maxObjectsPerRoom) {
      throw new Error(`Room "${room.id ?? room.name}" exceeds max objects (${limits.maxObjectsPerRoom}).`)
    }
    if ((room.hotspots?.length ?? 0) > limits.maxHotspotsPerRoom) {
      throw new Error(`Room "${room.id ?? room.name}" exceeds max hotspots (${limits.maxHotspotsPerRoom}).`)
    }
  }
  return specification
}

export function countAssetNeeds(specification) {
  return (specification.rooms ?? []).reduce((total, room) => {
    const panorama = room.environment ? 1 : 0
    return total + panorama + (room.objects?.length ?? 0)
  }, 0)
}

export function extractJsonObject(text) {
  const trimmed = String(text ?? '').trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : trimmed
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) {
    throw new Error('No JSON object in model output.')
  }
  return JSON.parse(candidate.slice(start, end + 1))
}

export function formatWorldValidationError(error) {
  if (!error) {
    return 'invalid world'
  }
  if (typeof error.message === 'string' && !error.message.trim().startsWith('[')) {
    return error.message
  }
  const issues = error.issues ?? error.errors
  if (Array.isArray(issues) && issues.length > 0) {
    const first = issues[0]
    const path = Array.isArray(first.path) ? first.path.join('.') : ''
    return `${path ? `${path}: ` : ''}${first.message || first.code || 'invalid value'}`
  }
  return String(error.message || error).slice(0, 160)
}
