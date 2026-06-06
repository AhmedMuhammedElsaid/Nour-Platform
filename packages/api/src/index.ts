// Curated public barrel for @repo/api. ARCHITECTURE.md §2: this is the
// only place outside `apps/*` that may re-export across subpaths. Apps
// should still prefer the subpath imports (e.g., `@repo/api/errors`,
// `@repo/api/auth`) so tree-shaking stays effective.
export { AppError } from "./errors/index";
export type { AppErrorCode, SerializedAppError } from "./errors/index";
export { getDb, disconnectDb } from "./db/client";
export { auth, signIn, signOut, handlers, requireSession } from "./auth/index";
export type { User, UserRole, Credentials } from "./schemas/user";
export { LOCALES, DEFAULT_LOCALE, localeSchema, isLocale } from "./schemas/locale";
export type { Locale } from "./schemas/locale";
export type {
  Playlist,
  PlaylistStatus,
  PlaylistCreateInput,
  PlaylistUpdateInput,
} from "./schemas/playlist";
export type {
  Track,
  TrackCreateInput,
  TrackUpdateInput,
} from "./schemas/track";
export type {
  Media,
  MediaMimeType,
  MediaStatus,
  MediaCreateInput,
  MediaUpdateInput,
} from "./schemas/media";
export type {
  Category,
  CategoryCreateInput,
  CategoryUpdateInput,
} from "./schemas/category";
export type {
  Azkar,
  DhikrItem,
  AzkarKind,
  AzkarStatus,
  AzkarCreateInput,
  AzkarUpdateInput,
} from "./schemas/azkar";
export {
  findAll as findAllCategories,
  findBySlug as findCategoryBySlug,
  findById as findCategoryById,
  create as createCategory,
  updateById as updateCategoryById,
  deleteById as deleteCategoryById,
} from "./repositories/category.repo";
