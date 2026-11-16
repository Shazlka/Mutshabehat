import { MemorizationStatus } from '../../../packages/memorization-core/types'
import type { MushafAppearance } from '../../app/mushaf-1441/_components/mushafTheme'

/**
 * Exact colors matching iOS MemorizationTheme.swift:
 * - mastered: light #1A6B4A / dark #6BBD8F
 * - memorizedWithErrors: light #804F05 / #E0B359
 * - needsMushaf: light #54697A / #9EB0C2
 * - notMemorized: light #5C5C5C / #9E9E9E
 */
export const MEMORIZATION_THEME_COLORS = {
  [MemorizationStatus.mastered]: {
    light: '#1A6B4A',
    dark: '#6BBD8F',
  },
  [MemorizationStatus.memorizedWithErrors]: {
    light: '#804F05',
    dark: '#E0B359',
  },
  [MemorizationStatus.needsMushaf]: {
    light: '#54697A',
    dark: '#9EB0C2',
  },
  [MemorizationStatus.notMemorized]: {
    light: '#5C5C5C',
    dark: '#9E9E9E',
  },
} as const

/**
 * Shape marks so color is never the only visual cue (iOS PageStatusMark / MemorizationTheme):
 * - mastered: ✓✓
 * - memorizedWithErrors: !
 * - needsMushaf: ◐
 * - notMemorized: ○
 */
export const MEMORIZATION_THEME_SHAPES = {
  [MemorizationStatus.mastered]: '✓✓',
  [MemorizationStatus.memorizedWithErrors]: '!',
  [MemorizationStatus.needsMushaf]: '◐',
  [MemorizationStatus.notMemorized]: '○',
} as const

export const MEMORIZATION_THEME_LABELS = {
  [MemorizationStatus.mastered]: 'متقن',
  [MemorizationStatus.memorizedWithErrors]: 'محفوظ مع أخطاء',
  [MemorizationStatus.needsMushaf]: 'يحتاج المصحف',
  [MemorizationStatus.notMemorized]: 'غير محفوظ',
} as const

export const MEMORIZATION_THEME_SHORT_LABELS = {
  [MemorizationStatus.mastered]: 'متقن',
  [MemorizationStatus.memorizedWithErrors]: 'مع أخطاء',
  [MemorizationStatus.needsMushaf]: 'يحتاج المصحف',
  [MemorizationStatus.notMemorized]: 'غير محفوظ',
} as const

export function getStatusThemeColor(status: MemorizationStatus, isDark: boolean): string {
  return isDark
    ? MEMORIZATION_THEME_COLORS[status].dark
    : MEMORIZATION_THEME_COLORS[status].light
}

/**
 * Injected in the root of the memorization route.
 * Defines the 4 status colors as CSS variables `--memo-*` under all appearances,
 * and adds fallback rules for >= 768px (desktop) so that the phone-width tokens from
 * globals.css apply cleanly to wide viewports as well without editing globals.css.
 */
export function getMemorizationThemeStyles(): string {
  return `
/* Status colors for light appearances */
[data-mushaf-appearance="light"],
[data-mushaf-appearance="whitePage"] {
  --memo-mastered: #1A6B4A;
  --memo-with-errors: #804F05;
  --memo-needs-mushaf: #54697A;
  --memo-not-memorized: #5C5C5C;
}

/* Status colors for dark appearances */
[data-mushaf-appearance="dark"],
[data-mushaf-appearance="blackPage"] {
  --memo-mastered: #6BBD8F;
  --memo-with-errors: #E0B359;
  --memo-needs-mushaf: #9EB0C2;
  --memo-not-memorized: #9E9E9E;
}

/* Status colors for system appearance (default light, media query switches to dark) */
[data-mushaf-appearance="system"],
:root {
  --memo-mastered: #1A6B4A;
  --memo-with-errors: #804F05;
  --memo-needs-mushaf: #54697A;
  --memo-not-memorized: #5C5C5C;
}

@media (prefers-color-scheme: dark) {
  [data-mushaf-appearance="system"] {
    --memo-mastered: #6BBD8F;
    --memo-with-errors: #E0B359;
    --memo-needs-mushaf: #9EB0C2;
    --memo-not-memorized: #9E9E9E;
  }
}

/* Desktop fallbacks (>= 768px) for reader and card tokens defined only in media (max-width: 767px) */
@media (min-width: 768px) {
  [data-mushaf-appearance="system"],
  [data-mushaf-appearance="light"] {
    --mushaf-paper: rgb(100% 99.2% 96.5%);
    --mushaf-desk: var(--mushaf-paper);
    --mushaf-ink: rgb(9% 9% 9%);
    --mushaf-brown: rgb(34.9% 27.5% 11.4%);
    --mushaf-gold: rgb(78% 62% 24%);
    --app-progress: #1A7340;
    --app-progress-fill: #1A7340;
    --app-caution: #A14D07;
    --app-caution-fill: #A14D07;
    --app-info: #1B5FC1;
    --app-insight: #6A3DB0;
    --app-favorite: #8F6A00;
    --app-danger: #B4232A;
    --qiraat-card-fill: #FFFEFA;
    --qiraat-card-stroke: #D9C99B;
    --qiraat-variant-ink: #7A1F1A;
    --qiraat-badge-ink: #6B4A00;
    --qiraat-badge-fill: #F1E2B6;
    --qiraat-review-ink: #8A2F10;
    --qiraat-review-fill: #F7D2C4;
    --qiraat-on-fill-light: #FFFFFF;
    --qiraat-on-fill-dark: #16110A;
  }

  [data-mushaf-appearance="dark"] {
    --mushaf-paper: rgb(11% 10.5% 9%);
    --mushaf-desk: var(--mushaf-paper);
    --mushaf-ink: rgb(92% 91% 86%);
    --mushaf-brown: rgb(82% 74% 55%);
    --mushaf-gold: rgb(88% 75% 42%);
    --app-progress: #5FD38D;
    --app-progress-fill: #23854D;
    --app-caution: #F7A65E;
    --app-caution-fill: #A8530C;
    --app-info: #80B4FF;
    --app-insight: #C3A5F7;
    --app-favorite: #F2C94C;
    --app-danger: #FF8A8A;
    --qiraat-card-fill: #27241E;
    --qiraat-card-stroke: #5A5036;
    --qiraat-variant-ink: #F2A9A1;
    --qiraat-badge-ink: #F0D58A;
    --qiraat-badge-fill: #4A3A12;
    --qiraat-review-ink: #FFC1A8;
    --qiraat-review-fill: #5C2616;
    --qiraat-on-fill-light: #FFFFFF;
    --qiraat-on-fill-dark: #16110A;
  }

  [data-mushaf-appearance="whitePage"] {
    --mushaf-paper: #FFFFFF;
    --mushaf-desk: #FFFFFF;
    --mushaf-ink: #000000;
    --mushaf-brown: #333333;
    --mushaf-gold: rgb(72% 55% 20%);
    --app-progress: #1A7340;
    --app-progress-fill: #1A7340;
    --app-caution: #A14D07;
    --app-caution-fill: #A14D07;
    --app-info: #1B5FC1;
    --app-insight: #6A3DB0;
    --app-favorite: #8F6A00;
    --app-danger: #B4232A;
    --qiraat-card-fill: #FFFEFA;
    --qiraat-card-stroke: #D9C99B;
    --qiraat-variant-ink: #7A1F1A;
    --qiraat-badge-ink: #6B4A00;
    --qiraat-badge-fill: #F1E2B6;
    --qiraat-review-ink: #8A2F10;
    --qiraat-review-fill: #F7D2C4;
    --qiraat-on-fill-light: #FFFFFF;
    --qiraat-on-fill-dark: #16110A;
  }

  [data-mushaf-appearance="blackPage"] {
    --mushaf-paper: #000000;
    --mushaf-desk: #000000;
    --mushaf-ink: #FFFFFF;
    --mushaf-brown: rgb(78% 78% 78%);
    --mushaf-gold: rgb(85% 72% 38%);
    --app-progress: #5FD38D;
    --app-progress-fill: #23854D;
    --app-caution: #F7A65E;
    --app-caution-fill: #A8530C;
    --app-info: #80B4FF;
    --app-insight: #C3A5F7;
    --app-favorite: #F2C94C;
    --app-danger: #FF8A8A;
    --qiraat-card-fill: #27241E;
    --qiraat-card-stroke: #5A5036;
    --qiraat-variant-ink: #F2A9A1;
    --qiraat-badge-ink: #F0D58A;
    --qiraat-badge-fill: #4A3A12;
    --qiraat-review-ink: #FFC1A8;
    --qiraat-review-fill: #5C2616;
    --qiraat-on-fill-light: #FFFFFF;
    --qiraat-on-fill-dark: #16110A;
  }

  @media (prefers-color-scheme: dark) {
    [data-mushaf-appearance="system"] {
      --mushaf-paper: rgb(11% 10.5% 9%);
      --mushaf-desk: var(--mushaf-paper);
      --mushaf-ink: rgb(92% 91% 86%);
      --mushaf-brown: rgb(82% 74% 55%);
      --mushaf-gold: rgb(88% 75% 42%);
      --app-progress: #5FD38D;
      --app-progress-fill: #23854D;
      --app-caution: #F7A65E;
      --app-caution-fill: #A8530C;
      --app-info: #80B4FF;
      --app-insight: #C3A5F7;
      --app-favorite: #F2C94C;
      --app-danger: #FF8A8A;
      --qiraat-card-fill: #27241E;
      --qiraat-card-stroke: #5A5036;
      --qiraat-variant-ink: #F2A9A1;
      --qiraat-badge-ink: #F0D58A;
      --qiraat-badge-fill: #4A3A12;
      --qiraat-review-ink: #FFC1A8;
      --qiraat-review-fill: #5C2616;
    }
  }

  [data-mushaf-appearance] {
    --mushaf-paper-tinted: var(--mushaf-paper);
    --mushaf-rule: var(--qiraat-card-stroke);
    --mushaf-rule-soft: color-mix(in srgb, var(--qiraat-card-stroke) 55%, transparent);
    --mushaf-cream: var(--mushaf-paper-tinted);
    --mushaf-cream-2: var(--qiraat-card-fill);
    --mushaf-cream-3: var(--mushaf-paper-tinted);
    --mushaf-gold-ink: var(--mushaf-gold);
    --mushaf-gold-deep: var(--mushaf-brown);
    --mushaf-gold-light: var(--mushaf-gold);
    --mushaf-muted: var(--mushaf-brown);
    --qx-muted: var(--mushaf-brown);
    --qx-err: var(--app-danger);
    background: var(--mushaf-paper-tinted);
    color: var(--mushaf-ink);
  }
}
`
}
