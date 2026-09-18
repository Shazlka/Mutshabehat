// Part 8/24/26: data access abstraction. The prototype is fixture-backed (same shape as
// packages/quran-data/mushaf1441/pageWordsIndex.ts + pageLoader.ts) because this sandbox has no
// reachability to the self-hosted Supabase backend, and because Mushaf page data itself is already
// fixture-based — see docs/qiraat/00-existing-architecture.md. A future `SupabaseQiraatRepository`
// implementing the same interface (backed by the qiraat_variants/qiraat_variant_readings tables in
// docs/qiraat/03-database-schema.md) is a drop-in replacement; nothing above this interface needs
// to change when that happens.
import type { QiraatRule, QiraatRuling, QiraatVariant } from './types'
import { variantsForToken as engineVariantsForToken, type EngineOptions } from './engine'

export interface QiraatRepository {
  getVariantsForPage(pageNumber: number, options?: EngineOptions): Promise<QiraatVariant[]>
  getRulesForPage(pageNumber: number, options?: EngineOptions): Promise<QiraatRule[]>
  getRulingsForPage(pageNumber: number, options?: EngineOptions): Promise<QiraatRuling[]>
}

type PageVariantsModule = { default: QiraatVariant[] }
type PageVariantsLoader = () => Promise<PageVariantsModule>
type PageRulesModule = { default: QiraatRule[] }
type PageRulesLoader = () => Promise<PageRulesModule>
type PageRulingsModule = { default: QiraatRuling[] }
type PageRulingsLoader = () => Promise<PageRulingsModule>

// Only page 1 (the prototype page) is wired today. Adding a page is: drop a new
// `fixtures/pages/page-NNN.json`, add one line here — nothing else changes (repository consumers,
// the API route, and the UI are all page-count-agnostic).
const PAGE_VARIANT_LOADERS: Record<number, PageVariantsLoader> = {
  1: () => import('./fixtures/pages/page-001.json') as unknown as Promise<PageVariantsModule>,
  2: () => import('./fixtures/pages/page-002.json') as unknown as Promise<PageVariantsModule>,
  3: () => import('./fixtures/pages/page-003.json') as unknown as Promise<PageVariantsModule>,
  4: () => import('./fixtures/pages/page-004.json') as unknown as Promise<PageVariantsModule>,
  5: () => import('./fixtures/pages/page-005.json') as unknown as Promise<PageVariantsModule>,
  6: () => import('./fixtures/pages/page-006.json') as unknown as Promise<PageVariantsModule>,
  7: () => import('./fixtures/pages/page-007.json') as unknown as Promise<PageVariantsModule>,
  8: () => import('./fixtures/pages/page-008.json') as unknown as Promise<PageVariantsModule>,
  9: () => import('./fixtures/pages/page-009.json') as unknown as Promise<PageVariantsModule>,
  10: () => import('./fixtures/pages/page-010.json') as unknown as Promise<PageVariantsModule>,
  11: () => import('./fixtures/pages/page-011.json') as unknown as Promise<PageVariantsModule>,
  12: () => import('./fixtures/pages/page-012.json') as unknown as Promise<PageVariantsModule>,
  13: () => import('./fixtures/pages/page-013.json') as unknown as Promise<PageVariantsModule>,
  14: () => import('./fixtures/pages/page-014.json') as unknown as Promise<PageVariantsModule>,
  15: () => import('./fixtures/pages/page-015.json') as unknown as Promise<PageVariantsModule>,
  16: () => import('./fixtures/pages/page-016.json') as unknown as Promise<PageVariantsModule>,
  17: () => import('./fixtures/pages/page-017.json') as unknown as Promise<PageVariantsModule>,
  18: () => import('./fixtures/pages/page-018.json') as unknown as Promise<PageVariantsModule>,
  19: () => import('./fixtures/pages/page-019.json') as unknown as Promise<PageVariantsModule>,
  20: () => import('./fixtures/pages/page-020.json') as unknown as Promise<PageVariantsModule>,
  21: () => import('./fixtures/pages/page-021.json') as unknown as Promise<PageVariantsModule>,
  22: () => import('./fixtures/pages/page-022.json') as unknown as Promise<PageVariantsModule>,
  23: () => import('./fixtures/pages/page-023.json') as unknown as Promise<PageVariantsModule>,
  24: () => import('./fixtures/pages/page-024.json') as unknown as Promise<PageVariantsModule>,
  25: () => import('./fixtures/pages/page-025.json') as unknown as Promise<PageVariantsModule>,
  26: () => import('./fixtures/pages/page-026.json') as unknown as Promise<PageVariantsModule>,
  27: () => import('./fixtures/pages/page-027.json') as unknown as Promise<PageVariantsModule>,
  28: () => import('./fixtures/pages/page-028.json') as unknown as Promise<PageVariantsModule>,
  29: () => import('./fixtures/pages/page-029.json') as unknown as Promise<PageVariantsModule>,
  30: () => import('./fixtures/pages/page-030.json') as unknown as Promise<PageVariantsModule>,
  31: () => import('./fixtures/pages/page-031.json') as unknown as Promise<PageVariantsModule>,
  32: () => import('./fixtures/pages/page-032.json') as unknown as Promise<PageVariantsModule>,
  33: () => import('./fixtures/pages/page-033.json') as unknown as Promise<PageVariantsModule>,
  34: () => import('./fixtures/pages/page-034.json') as unknown as Promise<PageVariantsModule>,
  35: () => import('./fixtures/pages/page-035.json') as unknown as Promise<PageVariantsModule>,
  36: () => import('./fixtures/pages/page-036.json') as unknown as Promise<PageVariantsModule>,
  37: () => import('./fixtures/pages/page-037.json') as unknown as Promise<PageVariantsModule>,
  38: () => import('./fixtures/pages/page-038.json') as unknown as Promise<PageVariantsModule>,
  39: () => import('./fixtures/pages/page-039.json') as unknown as Promise<PageVariantsModule>,
  40: () => import('./fixtures/pages/page-040.json') as unknown as Promise<PageVariantsModule>,
  41: () => import('./fixtures/pages/page-041.json') as unknown as Promise<PageVariantsModule>,
  42: () => import('./fixtures/pages/page-042.json') as unknown as Promise<PageVariantsModule>,
  43: () => import('./fixtures/pages/page-043.json') as unknown as Promise<PageVariantsModule>,
  44: () => import('./fixtures/pages/page-044.json') as unknown as Promise<PageVariantsModule>,
  45: () => import('./fixtures/pages/page-045.json') as unknown as Promise<PageVariantsModule>,
  46: () => import('./fixtures/pages/page-046.json') as unknown as Promise<PageVariantsModule>,
  47: () => import('./fixtures/pages/page-047.json') as unknown as Promise<PageVariantsModule>,
  48: () => import('./fixtures/pages/page-048.json') as unknown as Promise<PageVariantsModule>,
  49: () => import('./fixtures/pages/page-049.json') as unknown as Promise<PageVariantsModule>,
  50: () => import('./fixtures/pages/page-050.json') as unknown as Promise<PageVariantsModule>,
  51: () => import('./fixtures/pages/page-051.json') as unknown as Promise<PageVariantsModule>,
  52: () => import('./fixtures/pages/page-052.json') as unknown as Promise<PageVariantsModule>,
  53: () => import('./fixtures/pages/page-053.json') as unknown as Promise<PageVariantsModule>,
  54: () => import('./fixtures/pages/page-054.json') as unknown as Promise<PageVariantsModule>,
  55: () => import('./fixtures/pages/page-055.json') as unknown as Promise<PageVariantsModule>,
  56: () => import('./fixtures/pages/page-056.json') as unknown as Promise<PageVariantsModule>,
  57: () => import('./fixtures/pages/page-057.json') as unknown as Promise<PageVariantsModule>,
  58: () => import('./fixtures/pages/page-058.json') as unknown as Promise<PageVariantsModule>,
  59: () => import('./fixtures/pages/page-059.json') as unknown as Promise<PageVariantsModule>,
  60: () => import('./fixtures/pages/page-060.json') as unknown as Promise<PageVariantsModule>,
  61: () => import('./fixtures/pages/page-061.json') as unknown as Promise<PageVariantsModule>,
  62: () => import('./fixtures/pages/page-062.json') as unknown as Promise<PageVariantsModule>,
  63: () => import('./fixtures/pages/page-063.json') as unknown as Promise<PageVariantsModule>,
  64: () => import('./fixtures/pages/page-064.json') as unknown as Promise<PageVariantsModule>,
  65: () => import('./fixtures/pages/page-065.json') as unknown as Promise<PageVariantsModule>,
  66: () => import('./fixtures/pages/page-066.json') as unknown as Promise<PageVariantsModule>,
  67: () => import('./fixtures/pages/page-067.json') as unknown as Promise<PageVariantsModule>,
  68: () => import('./fixtures/pages/page-068.json') as unknown as Promise<PageVariantsModule>,
  69: () => import('./fixtures/pages/page-069.json') as unknown as Promise<PageVariantsModule>,
  70: () => import('./fixtures/pages/page-070.json') as unknown as Promise<PageVariantsModule>,
  71: () => import('./fixtures/pages/page-071.json') as unknown as Promise<PageVariantsModule>,
  72: () => import('./fixtures/pages/page-072.json') as unknown as Promise<PageVariantsModule>,
  73: () => import('./fixtures/pages/page-073.json') as unknown as Promise<PageVariantsModule>,
  74: () => import('./fixtures/pages/page-074.json') as unknown as Promise<PageVariantsModule>,
  75: () => import('./fixtures/pages/page-075.json') as unknown as Promise<PageVariantsModule>,
  76: () => import('./fixtures/pages/page-076.json') as unknown as Promise<PageVariantsModule>,
  77: () => import('./fixtures/pages/page-077.json') as unknown as Promise<PageVariantsModule>,
  78: () => import('./fixtures/pages/page-078.json') as unknown as Promise<PageVariantsModule>,
  79: () => import('./fixtures/pages/page-079.json') as unknown as Promise<PageVariantsModule>,
  80: () => import('./fixtures/pages/page-080.json') as unknown as Promise<PageVariantsModule>,
  81: () => import('./fixtures/pages/page-081.json') as unknown as Promise<PageVariantsModule>,
  82: () => import('./fixtures/pages/page-082.json') as unknown as Promise<PageVariantsModule>,
  83: () => import('./fixtures/pages/page-083.json') as unknown as Promise<PageVariantsModule>,
  84: () => import('./fixtures/pages/page-084.json') as unknown as Promise<PageVariantsModule>,
  85: () => import('./fixtures/pages/page-085.json') as unknown as Promise<PageVariantsModule>,
  86: () => import('./fixtures/pages/page-086.json') as unknown as Promise<PageVariantsModule>,
  87: () => import('./fixtures/pages/page-087.json') as unknown as Promise<PageVariantsModule>,
  88: () => import('./fixtures/pages/page-088.json') as unknown as Promise<PageVariantsModule>,
  89: () => import('./fixtures/pages/page-089.json') as unknown as Promise<PageVariantsModule>,
  90: () => import('./fixtures/pages/page-090.json') as unknown as Promise<PageVariantsModule>,
  91: () => import('./fixtures/pages/page-091.json') as unknown as Promise<PageVariantsModule>,
  92: () => import('./fixtures/pages/page-092.json') as unknown as Promise<PageVariantsModule>,
  93: () => import('./fixtures/pages/page-093.json') as unknown as Promise<PageVariantsModule>,
  94: () => import('./fixtures/pages/page-094.json') as unknown as Promise<PageVariantsModule>,
  95: () => import('./fixtures/pages/page-095.json') as unknown as Promise<PageVariantsModule>,
  96: () => import('./fixtures/pages/page-096.json') as unknown as Promise<PageVariantsModule>,
  97: () => import('./fixtures/pages/page-097.json') as unknown as Promise<PageVariantsModule>,
  98: () => import('./fixtures/pages/page-098.json') as unknown as Promise<PageVariantsModule>,
  99: () => import('./fixtures/pages/page-099.json') as unknown as Promise<PageVariantsModule>,
  100: () => import('./fixtures/pages/page-100.json') as unknown as Promise<PageVariantsModule>,
  101: () => import('./fixtures/pages/page-101.json') as unknown as Promise<PageVariantsModule>,
  102: () => import('./fixtures/pages/page-102.json') as unknown as Promise<PageVariantsModule>,
  103: () => import('./fixtures/pages/page-103.json') as unknown as Promise<PageVariantsModule>,
  104: () => import('./fixtures/pages/page-104.json') as unknown as Promise<PageVariantsModule>,
  105: () => import('./fixtures/pages/page-105.json') as unknown as Promise<PageVariantsModule>,
  106: () => import('./fixtures/pages/page-106.json') as unknown as Promise<PageVariantsModule>,
  107: () => import('./fixtures/pages/page-107.json') as unknown as Promise<PageVariantsModule>,
  108: () => import('./fixtures/pages/page-108.json') as unknown as Promise<PageVariantsModule>,
  109: () => import('./fixtures/pages/page-109.json') as unknown as Promise<PageVariantsModule>,
  110: () => import('./fixtures/pages/page-110.json') as unknown as Promise<PageVariantsModule>,
  111: () => import('./fixtures/pages/page-111.json') as unknown as Promise<PageVariantsModule>,
  112: () => import('./fixtures/pages/page-112.json') as unknown as Promise<PageVariantsModule>,
  113: () => import('./fixtures/pages/page-113.json') as unknown as Promise<PageVariantsModule>,
  114: () => import('./fixtures/pages/page-114.json') as unknown as Promise<PageVariantsModule>,
  115: () => import('./fixtures/pages/page-115.json') as unknown as Promise<PageVariantsModule>,
  116: () => import('./fixtures/pages/page-116.json') as unknown as Promise<PageVariantsModule>,
  117: () => import('./fixtures/pages/page-117.json') as unknown as Promise<PageVariantsModule>,
  118: () => import('./fixtures/pages/page-118.json') as unknown as Promise<PageVariantsModule>,
  119: () => import('./fixtures/pages/page-119.json') as unknown as Promise<PageVariantsModule>,
  120: () => import('./fixtures/pages/page-120.json') as unknown as Promise<PageVariantsModule>,
  121: () => import('./fixtures/pages/page-121.json') as unknown as Promise<PageVariantsModule>,
  122: () => import('./fixtures/pages/page-122.json') as unknown as Promise<PageVariantsModule>,
  123: () => import('./fixtures/pages/page-123.json') as unknown as Promise<PageVariantsModule>,
  124: () => import('./fixtures/pages/page-124.json') as unknown as Promise<PageVariantsModule>,
  125: () => import('./fixtures/pages/page-125.json') as unknown as Promise<PageVariantsModule>,
  126: () => import('./fixtures/pages/page-126.json') as unknown as Promise<PageVariantsModule>,
  127: () => import('./fixtures/pages/page-127.json') as unknown as Promise<PageVariantsModule>,
  128: () => import('./fixtures/pages/page-128.json') as unknown as Promise<PageVariantsModule>,
  129: () => import('./fixtures/pages/page-129.json') as unknown as Promise<PageVariantsModule>,
  130: () => import('./fixtures/pages/page-130.json') as unknown as Promise<PageVariantsModule>,
  131: () => import('./fixtures/pages/page-131.json') as unknown as Promise<PageVariantsModule>,
  132: () => import('./fixtures/pages/page-132.json') as unknown as Promise<PageVariantsModule>,
  133: () => import('./fixtures/pages/page-133.json') as unknown as Promise<PageVariantsModule>,
  134: () => import('./fixtures/pages/page-134.json') as unknown as Promise<PageVariantsModule>,
  135: () => import('./fixtures/pages/page-135.json') as unknown as Promise<PageVariantsModule>,
  136: () => import('./fixtures/pages/page-136.json') as unknown as Promise<PageVariantsModule>,
  137: () => import('./fixtures/pages/page-137.json') as unknown as Promise<PageVariantsModule>,
  138: () => import('./fixtures/pages/page-138.json') as unknown as Promise<PageVariantsModule>,
  139: () => import('./fixtures/pages/page-139.json') as unknown as Promise<PageVariantsModule>,
  140: () => import('./fixtures/pages/page-140.json') as unknown as Promise<PageVariantsModule>,
  141: () => import('./fixtures/pages/page-141.json') as unknown as Promise<PageVariantsModule>,
  142: () => import('./fixtures/pages/page-142.json') as unknown as Promise<PageVariantsModule>,
  143: () => import('./fixtures/pages/page-143.json') as unknown as Promise<PageVariantsModule>,
  144: () => import('./fixtures/pages/page-144.json') as unknown as Promise<PageVariantsModule>,
  145: () => import('./fixtures/pages/page-145.json') as unknown as Promise<PageVariantsModule>,
  146: () => import('./fixtures/pages/page-146.json') as unknown as Promise<PageVariantsModule>,
  147: () => import('./fixtures/pages/page-147.json') as unknown as Promise<PageVariantsModule>,
  148: () => import('./fixtures/pages/page-148.json') as unknown as Promise<PageVariantsModule>,
  149: () => import('./fixtures/pages/page-149.json') as unknown as Promise<PageVariantsModule>,
  150: () => import('./fixtures/pages/page-150.json') as unknown as Promise<PageVariantsModule>,
  151: () => import('./fixtures/pages/page-151.json') as unknown as Promise<PageVariantsModule>,
  152: () => import('./fixtures/pages/page-152.json') as unknown as Promise<PageVariantsModule>,
  153: () => import('./fixtures/pages/page-153.json') as unknown as Promise<PageVariantsModule>,
  154: () => import('./fixtures/pages/page-154.json') as unknown as Promise<PageVariantsModule>,
  155: () => import('./fixtures/pages/page-155.json') as unknown as Promise<PageVariantsModule>,
  156: () => import('./fixtures/pages/page-156.json') as unknown as Promise<PageVariantsModule>,
  157: () => import('./fixtures/pages/page-157.json') as unknown as Promise<PageVariantsModule>,
  158: () => import('./fixtures/pages/page-158.json') as unknown as Promise<PageVariantsModule>,
  159: () => import('./fixtures/pages/page-159.json') as unknown as Promise<PageVariantsModule>,
  160: () => import('./fixtures/pages/page-160.json') as unknown as Promise<PageVariantsModule>,
  161: () => import('./fixtures/pages/page-161.json') as unknown as Promise<PageVariantsModule>,
  162: () => import('./fixtures/pages/page-162.json') as unknown as Promise<PageVariantsModule>,
  163: () => import('./fixtures/pages/page-163.json') as unknown as Promise<PageVariantsModule>,
  164: () => import('./fixtures/pages/page-164.json') as unknown as Promise<PageVariantsModule>,
  165: () => import('./fixtures/pages/page-165.json') as unknown as Promise<PageVariantsModule>,
}

// Page-level rules (عدّ الآي, الإدغام الكبير, أوجه الوصل بين السورتين, …) live in a separate fixture
// tree from per-word variants — a different domain, not anchored to one Quran token (see the
// `QiraatRule` doc comment in types.ts). Only page 1 has rule data today; adding a page follows the
// same one-line pattern as `PAGE_VARIANT_LOADERS`.
const PAGE_RULE_LOADERS: Record<number, PageRulesLoader> = {
  1: () => import('./fixtures/rules/page-001.json') as unknown as Promise<PageRulesModule>,
}

// Per-occurrence أصول rulings (الممال، الإدغام، الترقيق، السكت …). Each one is its own verified
// record anchored to a real token — a rule is written once in the catalogue but NEVER auto-applied,
// because it genuinely does not hold at every occurrence of the same word.
const PAGE_RULING_LOADERS: Record<number, PageRulingsLoader> = {
  1: () => import('./fixtures/rulings/page-001.json') as unknown as Promise<PageRulingsModule>,
  2: () => import('./fixtures/rulings/page-002.json') as unknown as Promise<PageRulingsModule>,
  3: () => import('./fixtures/rulings/page-003.json') as unknown as Promise<PageRulingsModule>,
  4: () => import('./fixtures/rulings/page-004.json') as unknown as Promise<PageRulingsModule>,
  5: () => import('./fixtures/rulings/page-005.json') as unknown as Promise<PageRulingsModule>,
  6: () => import('./fixtures/rulings/page-006.json') as unknown as Promise<PageRulingsModule>,
  7: () => import('./fixtures/rulings/page-007.json') as unknown as Promise<PageRulingsModule>,
  8: () => import('./fixtures/rulings/page-008.json') as unknown as Promise<PageRulingsModule>,
  9: () => import('./fixtures/rulings/page-009.json') as unknown as Promise<PageRulingsModule>,
  10: () => import('./fixtures/rulings/page-010.json') as unknown as Promise<PageRulingsModule>,
  11: () => import('./fixtures/rulings/page-011.json') as unknown as Promise<PageRulingsModule>,
  12: () => import('./fixtures/rulings/page-012.json') as unknown as Promise<PageRulingsModule>,
  13: () => import('./fixtures/rulings/page-013.json') as unknown as Promise<PageRulingsModule>,
  14: () => import('./fixtures/rulings/page-014.json') as unknown as Promise<PageRulingsModule>,
  15: () => import('./fixtures/rulings/page-015.json') as unknown as Promise<PageRulingsModule>,
  16: () => import('./fixtures/rulings/page-016.json') as unknown as Promise<PageRulingsModule>,
  17: () => import('./fixtures/rulings/page-017.json') as unknown as Promise<PageRulingsModule>,
  18: () => import('./fixtures/rulings/page-018.json') as unknown as Promise<PageRulingsModule>,
  19: () => import('./fixtures/rulings/page-019.json') as unknown as Promise<PageRulingsModule>,
  20: () => import('./fixtures/rulings/page-020.json') as unknown as Promise<PageRulingsModule>,
  21: () => import('./fixtures/rulings/page-021.json') as unknown as Promise<PageRulingsModule>,
  22: () => import('./fixtures/rulings/page-022.json') as unknown as Promise<PageRulingsModule>,
  23: () => import('./fixtures/rulings/page-023.json') as unknown as Promise<PageRulingsModule>,
  24: () => import('./fixtures/rulings/page-024.json') as unknown as Promise<PageRulingsModule>,
  25: () => import('./fixtures/rulings/page-025.json') as unknown as Promise<PageRulingsModule>,
  26: () => import('./fixtures/rulings/page-026.json') as unknown as Promise<PageRulingsModule>,
  27: () => import('./fixtures/rulings/page-027.json') as unknown as Promise<PageRulingsModule>,
  28: () => import('./fixtures/rulings/page-028.json') as unknown as Promise<PageRulingsModule>,
  29: () => import('./fixtures/rulings/page-029.json') as unknown as Promise<PageRulingsModule>,
  30: () => import('./fixtures/rulings/page-030.json') as unknown as Promise<PageRulingsModule>,
  31: () => import('./fixtures/rulings/page-031.json') as unknown as Promise<PageRulingsModule>,
  32: () => import('./fixtures/rulings/page-032.json') as unknown as Promise<PageRulingsModule>,
  33: () => import('./fixtures/rulings/page-033.json') as unknown as Promise<PageRulingsModule>,
  34: () => import('./fixtures/rulings/page-034.json') as unknown as Promise<PageRulingsModule>,
  35: () => import('./fixtures/rulings/page-035.json') as unknown as Promise<PageRulingsModule>,
  36: () => import('./fixtures/rulings/page-036.json') as unknown as Promise<PageRulingsModule>,
  37: () => import('./fixtures/rulings/page-037.json') as unknown as Promise<PageRulingsModule>,
  38: () => import('./fixtures/rulings/page-038.json') as unknown as Promise<PageRulingsModule>,
  39: () => import('./fixtures/rulings/page-039.json') as unknown as Promise<PageRulingsModule>,
  40: () => import('./fixtures/rulings/page-040.json') as unknown as Promise<PageRulingsModule>,
  41: () => import('./fixtures/rulings/page-041.json') as unknown as Promise<PageRulingsModule>,
  42: () => import('./fixtures/rulings/page-042.json') as unknown as Promise<PageRulingsModule>,
  43: () => import('./fixtures/rulings/page-043.json') as unknown as Promise<PageRulingsModule>,
  44: () => import('./fixtures/rulings/page-044.json') as unknown as Promise<PageRulingsModule>,
  45: () => import('./fixtures/rulings/page-045.json') as unknown as Promise<PageRulingsModule>,
  46: () => import('./fixtures/rulings/page-046.json') as unknown as Promise<PageRulingsModule>,
  47: () => import('./fixtures/rulings/page-047.json') as unknown as Promise<PageRulingsModule>,
  48: () => import('./fixtures/rulings/page-048.json') as unknown as Promise<PageRulingsModule>,
  49: () => import('./fixtures/rulings/page-049.json') as unknown as Promise<PageRulingsModule>,
  50: () => import('./fixtures/rulings/page-050.json') as unknown as Promise<PageRulingsModule>,
  51: () => import('./fixtures/rulings/page-051.json') as unknown as Promise<PageRulingsModule>,
  52: () => import('./fixtures/rulings/page-052.json') as unknown as Promise<PageRulingsModule>,
  53: () => import('./fixtures/rulings/page-053.json') as unknown as Promise<PageRulingsModule>,
  54: () => import('./fixtures/rulings/page-054.json') as unknown as Promise<PageRulingsModule>,
  55: () => import('./fixtures/rulings/page-055.json') as unknown as Promise<PageRulingsModule>,
  56: () => import('./fixtures/rulings/page-056.json') as unknown as Promise<PageRulingsModule>,
  57: () => import('./fixtures/rulings/page-057.json') as unknown as Promise<PageRulingsModule>,
  58: () => import('./fixtures/rulings/page-058.json') as unknown as Promise<PageRulingsModule>,
  59: () => import('./fixtures/rulings/page-059.json') as unknown as Promise<PageRulingsModule>,
  60: () => import('./fixtures/rulings/page-060.json') as unknown as Promise<PageRulingsModule>,
  61: () => import('./fixtures/rulings/page-061.json') as unknown as Promise<PageRulingsModule>,
  62: () => import('./fixtures/rulings/page-062.json') as unknown as Promise<PageRulingsModule>,
  63: () => import('./fixtures/rulings/page-063.json') as unknown as Promise<PageRulingsModule>,
  64: () => import('./fixtures/rulings/page-064.json') as unknown as Promise<PageRulingsModule>,
  65: () => import('./fixtures/rulings/page-065.json') as unknown as Promise<PageRulingsModule>,
  66: () => import('./fixtures/rulings/page-066.json') as unknown as Promise<PageRulingsModule>,
  67: () => import('./fixtures/rulings/page-067.json') as unknown as Promise<PageRulingsModule>,
  68: () => import('./fixtures/rulings/page-068.json') as unknown as Promise<PageRulingsModule>,
  69: () => import('./fixtures/rulings/page-069.json') as unknown as Promise<PageRulingsModule>,
  70: () => import('./fixtures/rulings/page-070.json') as unknown as Promise<PageRulingsModule>,
  71: () => import('./fixtures/rulings/page-071.json') as unknown as Promise<PageRulingsModule>,
  72: () => import('./fixtures/rulings/page-072.json') as unknown as Promise<PageRulingsModule>,
  73: () => import('./fixtures/rulings/page-073.json') as unknown as Promise<PageRulingsModule>,
  74: () => import('./fixtures/rulings/page-074.json') as unknown as Promise<PageRulingsModule>,
  75: () => import('./fixtures/rulings/page-075.json') as unknown as Promise<PageRulingsModule>,
  76: () => import('./fixtures/rulings/page-076.json') as unknown as Promise<PageRulingsModule>,
  77: () => import('./fixtures/rulings/page-077.json') as unknown as Promise<PageRulingsModule>,
  78: () => import('./fixtures/rulings/page-078.json') as unknown as Promise<PageRulingsModule>,
  79: () => import('./fixtures/rulings/page-079.json') as unknown as Promise<PageRulingsModule>,
  80: () => import('./fixtures/rulings/page-080.json') as unknown as Promise<PageRulingsModule>,
  81: () => import('./fixtures/rulings/page-081.json') as unknown as Promise<PageRulingsModule>,
  82: () => import('./fixtures/rulings/page-082.json') as unknown as Promise<PageRulingsModule>,
  83: () => import('./fixtures/rulings/page-083.json') as unknown as Promise<PageRulingsModule>,
  84: () => import('./fixtures/rulings/page-084.json') as unknown as Promise<PageRulingsModule>,
  85: () => import('./fixtures/rulings/page-085.json') as unknown as Promise<PageRulingsModule>,
  86: () => import('./fixtures/rulings/page-086.json') as unknown as Promise<PageRulingsModule>,
  87: () => import('./fixtures/rulings/page-087.json') as unknown as Promise<PageRulingsModule>,
  88: () => import('./fixtures/rulings/page-088.json') as unknown as Promise<PageRulingsModule>,
  89: () => import('./fixtures/rulings/page-089.json') as unknown as Promise<PageRulingsModule>,
  90: () => import('./fixtures/rulings/page-090.json') as unknown as Promise<PageRulingsModule>,
  91: () => import('./fixtures/rulings/page-091.json') as unknown as Promise<PageRulingsModule>,
  92: () => import('./fixtures/rulings/page-092.json') as unknown as Promise<PageRulingsModule>,
  93: () => import('./fixtures/rulings/page-093.json') as unknown as Promise<PageRulingsModule>,
  94: () => import('./fixtures/rulings/page-094.json') as unknown as Promise<PageRulingsModule>,
  95: () => import('./fixtures/rulings/page-095.json') as unknown as Promise<PageRulingsModule>,
  96: () => import('./fixtures/rulings/page-096.json') as unknown as Promise<PageRulingsModule>,
  97: () => import('./fixtures/rulings/page-097.json') as unknown as Promise<PageRulingsModule>,
  98: () => import('./fixtures/rulings/page-098.json') as unknown as Promise<PageRulingsModule>,
  99: () => import('./fixtures/rulings/page-099.json') as unknown as Promise<PageRulingsModule>,
  100: () => import('./fixtures/rulings/page-100.json') as unknown as Promise<PageRulingsModule>,
  101: () => import('./fixtures/rulings/page-101.json') as unknown as Promise<PageRulingsModule>,
  102: () => import('./fixtures/rulings/page-102.json') as unknown as Promise<PageRulingsModule>,
  103: () => import('./fixtures/rulings/page-103.json') as unknown as Promise<PageRulingsModule>,
  104: () => import('./fixtures/rulings/page-104.json') as unknown as Promise<PageRulingsModule>,
  105: () => import('./fixtures/rulings/page-105.json') as unknown as Promise<PageRulingsModule>,
  106: () => import('./fixtures/rulings/page-106.json') as unknown as Promise<PageRulingsModule>,
  107: () => import('./fixtures/rulings/page-107.json') as unknown as Promise<PageRulingsModule>,
  108: () => import('./fixtures/rulings/page-108.json') as unknown as Promise<PageRulingsModule>,
  109: () => import('./fixtures/rulings/page-109.json') as unknown as Promise<PageRulingsModule>,
  110: () => import('./fixtures/rulings/page-110.json') as unknown as Promise<PageRulingsModule>,
  111: () => import('./fixtures/rulings/page-111.json') as unknown as Promise<PageRulingsModule>,
  112: () => import('./fixtures/rulings/page-112.json') as unknown as Promise<PageRulingsModule>,
  113: () => import('./fixtures/rulings/page-113.json') as unknown as Promise<PageRulingsModule>,
  114: () => import('./fixtures/rulings/page-114.json') as unknown as Promise<PageRulingsModule>,
  115: () => import('./fixtures/rulings/page-115.json') as unknown as Promise<PageRulingsModule>,
  116: () => import('./fixtures/rulings/page-116.json') as unknown as Promise<PageRulingsModule>,
  117: () => import('./fixtures/rulings/page-117.json') as unknown as Promise<PageRulingsModule>,
  118: () => import('./fixtures/rulings/page-118.json') as unknown as Promise<PageRulingsModule>,
  119: () => import('./fixtures/rulings/page-119.json') as unknown as Promise<PageRulingsModule>,
  120: () => import('./fixtures/rulings/page-120.json') as unknown as Promise<PageRulingsModule>,
  121: () => import('./fixtures/rulings/page-121.json') as unknown as Promise<PageRulingsModule>,
  122: () => import('./fixtures/rulings/page-122.json') as unknown as Promise<PageRulingsModule>,
  123: () => import('./fixtures/rulings/page-123.json') as unknown as Promise<PageRulingsModule>,
  124: () => import('./fixtures/rulings/page-124.json') as unknown as Promise<PageRulingsModule>,
  125: () => import('./fixtures/rulings/page-125.json') as unknown as Promise<PageRulingsModule>,
  126: () => import('./fixtures/rulings/page-126.json') as unknown as Promise<PageRulingsModule>,
  127: () => import('./fixtures/rulings/page-127.json') as unknown as Promise<PageRulingsModule>,
  128: () => import('./fixtures/rulings/page-128.json') as unknown as Promise<PageRulingsModule>,
  129: () => import('./fixtures/rulings/page-129.json') as unknown as Promise<PageRulingsModule>,
  130: () => import('./fixtures/rulings/page-130.json') as unknown as Promise<PageRulingsModule>,
  131: () => import('./fixtures/rulings/page-131.json') as unknown as Promise<PageRulingsModule>,
  132: () => import('./fixtures/rulings/page-132.json') as unknown as Promise<PageRulingsModule>,
  133: () => import('./fixtures/rulings/page-133.json') as unknown as Promise<PageRulingsModule>,
  134: () => import('./fixtures/rulings/page-134.json') as unknown as Promise<PageRulingsModule>,
  135: () => import('./fixtures/rulings/page-135.json') as unknown as Promise<PageRulingsModule>,
  136: () => import('./fixtures/rulings/page-136.json') as unknown as Promise<PageRulingsModule>,
  137: () => import('./fixtures/rulings/page-137.json') as unknown as Promise<PageRulingsModule>,
  138: () => import('./fixtures/rulings/page-138.json') as unknown as Promise<PageRulingsModule>,
  139: () => import('./fixtures/rulings/page-139.json') as unknown as Promise<PageRulingsModule>,
  140: () => import('./fixtures/rulings/page-140.json') as unknown as Promise<PageRulingsModule>,
  141: () => import('./fixtures/rulings/page-141.json') as unknown as Promise<PageRulingsModule>,
  142: () => import('./fixtures/rulings/page-142.json') as unknown as Promise<PageRulingsModule>,
  143: () => import('./fixtures/rulings/page-143.json') as unknown as Promise<PageRulingsModule>,
  144: () => import('./fixtures/rulings/page-144.json') as unknown as Promise<PageRulingsModule>,
  145: () => import('./fixtures/rulings/page-145.json') as unknown as Promise<PageRulingsModule>,
  146: () => import('./fixtures/rulings/page-146.json') as unknown as Promise<PageRulingsModule>,
  147: () => import('./fixtures/rulings/page-147.json') as unknown as Promise<PageRulingsModule>,
  148: () => import('./fixtures/rulings/page-148.json') as unknown as Promise<PageRulingsModule>,
  149: () => import('./fixtures/rulings/page-149.json') as unknown as Promise<PageRulingsModule>,
  150: () => import('./fixtures/rulings/page-150.json') as unknown as Promise<PageRulingsModule>,
  151: () => import('./fixtures/rulings/page-151.json') as unknown as Promise<PageRulingsModule>,
  152: () => import('./fixtures/rulings/page-152.json') as unknown as Promise<PageRulingsModule>,
  153: () => import('./fixtures/rulings/page-153.json') as unknown as Promise<PageRulingsModule>,
  154: () => import('./fixtures/rulings/page-154.json') as unknown as Promise<PageRulingsModule>,
  155: () => import('./fixtures/rulings/page-155.json') as unknown as Promise<PageRulingsModule>,
  156: () => import('./fixtures/rulings/page-156.json') as unknown as Promise<PageRulingsModule>,
  157: () => import('./fixtures/rulings/page-157.json') as unknown as Promise<PageRulingsModule>,
  158: () => import('./fixtures/rulings/page-158.json') as unknown as Promise<PageRulingsModule>,
  159: () => import('./fixtures/rulings/page-159.json') as unknown as Promise<PageRulingsModule>,
  160: () => import('./fixtures/rulings/page-160.json') as unknown as Promise<PageRulingsModule>,
  161: () => import('./fixtures/rulings/page-161.json') as unknown as Promise<PageRulingsModule>,
  162: () => import('./fixtures/rulings/page-162.json') as unknown as Promise<PageRulingsModule>,
  163: () => import('./fixtures/rulings/page-163.json') as unknown as Promise<PageRulingsModule>,
  164: () => import('./fixtures/rulings/page-164.json') as unknown as Promise<PageRulingsModule>,
  165: () => import('./fixtures/rulings/page-165.json') as unknown as Promise<PageRulingsModule>,
}

// In-memory module caches — each dynamic import() is resolved at most once per process lifetime.
// The fixture JSONs are immutable reference data, so caching them forever is safe and eliminates
// the ~5-15ms per-import overhead on repeated page visits.
const variantModuleCache = new Map<number, Promise<PageVariantsModule>>()
const rulingModuleCache = new Map<number, Promise<PageRulingsModule>>()
const ruleModuleCache = new Map<number, Promise<PageRulesModule>>()

function cachedLoadVariants(pageNumber: number): Promise<PageVariantsModule> | undefined {
  const load = PAGE_VARIANT_LOADERS[pageNumber]
  if (!load) return undefined
  let cached = variantModuleCache.get(pageNumber)
  if (!cached) { cached = load(); variantModuleCache.set(pageNumber, cached) }
  return cached
}

function cachedLoadRulings(pageNumber: number): Promise<PageRulingsModule> | undefined {
  const load = PAGE_RULING_LOADERS[pageNumber]
  if (!load) return undefined
  let cached = rulingModuleCache.get(pageNumber)
  if (!cached) { cached = load(); rulingModuleCache.set(pageNumber, cached) }
  return cached
}

function cachedLoadRules(pageNumber: number): Promise<PageRulesModule> | undefined {
  const load = PAGE_RULE_LOADERS[pageNumber]
  if (!load) return undefined
  let cached = ruleModuleCache.get(pageNumber)
  if (!cached) { cached = load(); ruleModuleCache.set(pageNumber, cached) }
  return cached
}

export class FixtureQiraatRepository implements QiraatRepository {
  async getVariantsForPage(pageNumber: number, options?: EngineOptions): Promise<QiraatVariant[]> {
    const promise = cachedLoadVariants(pageNumber)
    if (!promise) return []
    const mod = await promise
    const all = mod.default
    if (options?.includeUnpublished) return all
    return all.filter((variant) => variant.verificationStatus === 'VERIFIED' || variant.verificationStatus === 'PUBLISHED')
  }

  async getRulingsForPage(pageNumber: number, options?: EngineOptions): Promise<QiraatRuling[]> {
    const promise = cachedLoadRulings(pageNumber)
    if (!promise) return []
    const mod = await promise
    const all = mod.default
    if (options?.includeUnpublished) return all
    return all.filter((r) => r.verificationStatus === 'VERIFIED' || r.verificationStatus === 'PUBLISHED')
  }

  async getRulesForPage(pageNumber: number, options?: EngineOptions): Promise<QiraatRule[]> {
    const promise = cachedLoadRules(pageNumber)
    if (!promise) return []
    const mod = await promise
    const all = mod.default
    if (options?.includeUnpublished) return all
    return all.filter((rule) => rule.verificationStatus === 'VERIFIED' || rule.verificationStatus === 'PUBLISHED')
  }

  /** Eagerly load and cache fixture modules for the given pages in the current runtime. */
  prefetchPages(pages: number[]): void {
    for (const p of pages) {
      cachedLoadVariants(p)
      cachedLoadRulings(p)
      cachedLoadRules(p)
    }
  }
}

export const defaultQiraatRepository: QiraatRepository = new FixtureQiraatRepository()

/** Convenience filter reused by the legacy ayahKey-scoped adapter and by UI selection lookups. */
export function variantsForAyah(variants: readonly QiraatVariant[], surah: number, ayah: number): QiraatVariant[] {
  return variants.filter((variant) => variant.surah === surah && variant.ayah === ayah)
}

export { engineVariantsForToken as variantsForToken }
