import { z } from "zod";

export const EntityRefSchema = z.object({
  id: z.number(),
  name: z.string()
});

export const GameSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string().optional(),
  cover: z.object({ url: z.string() }).optional(),
  rating: z.number().optional(),
  summary: z.string().optional(),
  storyline: z.string().optional(),
  releaseDate: z.string().optional(),
  genres: z.array(EntityRefSchema).optional(),
  platforms: z.array(EntityRefSchema).optional(),
  engines: z.array(EntityRefSchema).optional(),
  trailerVideoId: z.string().optional(),
  externalLinks: z
    .object({
      steam: z.string().optional(),
      gog: z.string().optional(),
      epic: z.string().optional(),
      playstation: z.string().optional(),
      xbox: z.string().optional()
    })
    .optional(),
  screenshots: z
    .array(z.object({ image_id: z.union([z.string(), z.number()]), url: z.string() }))
    .optional(),
  language_supports: z
    .array(
      z.object({
        language: z.string().nullable(),
        language_support_type: z.number()
      })
    )
    .optional(),
  similar_games: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        slug: z.string().optional(),
        cover: z.object({ url: z.string() }).nullable().optional(),
        rating: z.number().optional()
      })
    )
    .optional(),
  websites: z.array(z.object({ id: z.number().optional(), url: z.string(), category: z.number().optional() })).optional(),
  artworks: z
    .array(z.union([z.object({ image_id: z.union([z.string(), z.number()]), url: z.string().optional() }), z.string(), z.number()]))
    .optional(),
  alternative_names: z.array(z.union([z.object({ name: z.string().optional() }), z.string(), z.number()])).optional(),
  themes: z.array(z.union([z.object({ id: z.number().optional(), name: z.string().optional() }), z.string(), z.number()])).optional(),
  game_modes: z.array(z.union([z.object({ id: z.number().optional(), name: z.string().optional() }), z.string(), z.number()])).optional(),
  tags: z.array(z.number()).optional(),
  keywords: z.array(z.union([z.object({ id: z.number().optional(), name: z.string().optional() }), z.string(), z.number()])).optional(),
  player_perspectives: z
    .array(z.union([z.object({ id: z.number().optional(), name: z.string().optional() }), z.string(), z.number()]))
    .optional(),
  hypes: z.number().optional(),
  created_at: z.number().optional(),
  updated_at: z.number().optional(),
  checksum: z.string().optional(),
  url: z.string().optional(),
  external_games: z.array(z.number()).optional(),
  release_dates: z.array(z.number()).optional()
});

export const UserSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  name: z.string(),
  role: z.string().optional()
});

export const CommentSchema = z.object({
  id: z.number(),
  game_id: z.number(),
  comment_text: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  user_id: z.number(),
  user_name: z.string(),
  user_email: z.string().email().or(z.string())
});

export const FavoriteSchema = z.object({
  user_id: z.number(),
  game_id: z.number()
});

export const FilterSchema = z.object({
  search: z.string().default(""),
  genres: z.array(z.number()).default([]),
  platforms: z.array(z.number()).default([]),
  engines: z.array(z.number()).default([]),
  sellers: z.array(z.number()).default([]),
  sellerGameIds: z.array(z.number()).optional(),
  ratingMin: z.number().default(0),
  ratingMax: z.number().default(100),
  releaseDateMin: z.string().optional(),
  releaseDateMax: z.string().optional(),
  sortBy: z.string().default("release-desc")
});

export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(6)
});

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const CommentCreateRequestSchema = z.object({
  gameId: z.number(),
  text: z.string().min(1),
  parentId: z.number().optional()
});

export const FavoriteBulkCheckRequestSchema = z.object({
  gameIds: z.array(z.number())
});

export const GamesBulkRequestSchema = z.object({
  ids: z.array(z.number())
});

export const GamesResponseSchema = z.array(GameSchema);

export const FilterStatsResponseSchema = z.object({
  genres: z.array(z.object({ id: z.number(), name: z.string(), count: z.number() })),
  platforms: z.array(z.object({ id: z.number(), name: z.string(), count: z.number() })),
  engines: z.array(z.object({ id: z.number(), name: z.string(), count: z.number() }))
});

export const GamesQuerySchema = z.object({
  limit: z.coerce.number().optional(),
  offset: z.coerce.number().optional(),
  search: z.string().optional(),
  ratingMin: z.coerce.number().optional(),
  ratingMax: z.coerce.number().optional(),
  genres: z.string().optional(),
  platforms: z.string().optional(),
  engines: z.string().optional(),
  sortBy: z.string().optional()
});

export const GameIdParamsSchema = z.object({
  gameId: z.coerce.number()
});

export const CommentIdParamsSchema = z.object({
  commentId: z.coerce.number()
});

export type Game = z.infer<typeof GameSchema>;
export type User = z.infer<typeof UserSchema>;
export type Comment = z.infer<typeof CommentSchema>;
export type Favorite = z.infer<typeof FavoriteSchema>;
export type Filter = z.infer<typeof FilterSchema>;
export type FilterStatsResponse = z.infer<typeof FilterStatsResponseSchema>;
