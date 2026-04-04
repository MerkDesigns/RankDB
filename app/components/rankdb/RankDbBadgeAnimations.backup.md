# RankDB Badge Animations Backup

Backup of the rank badge animation logic from `RankDbApp.vue` before rework.

## Script Logic

```ts
const getRankBadgeShineClass = (tier: RankTier) => {
  if (!badgeAnimationsEnabled.value) {
    return ''
  }

  switch (tier) {
    case 'Grandmaster':
      return 'rank-badge-shine-grandmaster'
    case 'Champion':
      return 'rank-badge-shine-champion'
    default:
      return ''
  }
}

const hasRankBadgeShine = (tier: RankTier) => (
  badgeAnimationsEnabled.value && (tier === 'Grandmaster' || tier === 'Champion')
)

const getRankBadgeSparkleClass = (tier: RankTier) => {
  if (!badgeAnimationsEnabled.value) {
    return ''
  }

  switch (tier) {
    case 'Master':
      return 'rank-badge-sparkle-master'
    case 'Grandmaster':
      return 'rank-badge-sparkle-grandmaster'
    case 'Champion':
      return 'rank-badge-sparkle-champion'
    default:
      return ''
  }
}

const hasRankBadgeSparkles = (tier: RankTier) => (
  badgeAnimationsEnabled.value && (tier === 'Master' || tier === 'Grandmaster' || tier === 'Champion')
)

const hasRankBadgeExtraSparkles = (tier: RankTier) => (
  badgeAnimationsEnabled.value && tier === 'Champion'
)

const getRankBadgeMaskStyle = (tier: RankTier) => ({
  '--rank-badge-mask-image': `url("${rankIcons[tier]}")`
})
```

## CSS Logic

```css
.rank-badge-shine {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  overflow: hidden;
  mix-blend-mode: screen;
  -webkit-mask-image: var(--rank-badge-mask-image);
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  -webkit-mask-size: contain;
  mask-image: var(--rank-badge-mask-image);
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: contain;
}

.rank-badge-shine::before {
  content: '';
  position: absolute;
  inset: -28% -42%;
  opacity: 0;
  transform: translateX(-160%) rotate(16deg);
  background:
    linear-gradient(
      100deg,
      transparent 0%,
      transparent 35%,
      rgba(255, 255, 255, 0.04) 42%,
      rgba(255, 255, 255, 0.26) 48%,
      rgba(255, 255, 255, 0.55) 52%,
      rgba(255, 255, 255, 0.22) 57%,
      transparent 65%,
      transparent 100%
    );
}

.rank-badge-shine-grandmaster .rank-badge-shine::before {
  background:
    linear-gradient(
      100deg,
      transparent 0%,
      transparent 35%,
      rgba(225, 196, 255, 0.06) 42%,
      rgba(182, 118, 255, 0.28) 48%,
      rgba(244, 235, 255, 0.58) 52%,
      rgba(152, 94, 255, 0.3) 57%,
      transparent 65%,
      transparent 100%
    );
  animation: rank-badge-shine-sweep 4.2s ease-in-out infinite;
}

.rank-badge-shine-champion .rank-badge-shine::before {
  background:
    linear-gradient(
      100deg,
      transparent 0%,
      transparent 35%,
      rgba(255, 212, 238, 0.06) 42%,
      rgba(255, 142, 205, 0.3) 48%,
      rgba(255, 240, 247, 0.62) 52%,
      rgba(255, 102, 186, 0.32) 57%,
      transparent 65%,
      transparent 100%
    );
  animation: rank-badge-shine-sweep-bounce 4.2s ease-in-out infinite;
}

.rank-badge-sparkles {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  --rank-badge-sparkle-color: rgba(255, 255, 255, 0.55);
}

.rank-badge-sparkles::before,
.rank-badge-sparkles::after {
  content: '';
  position: absolute;
  width: 11px;
  height: 11px;
  opacity: 0;
  border-radius: 999px;
  background:
    radial-gradient(circle, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.75) 20%, transparent 62%),
    linear-gradient(transparent 44%, var(--rank-badge-sparkle-color) 44%, var(--rank-badge-sparkle-color) 56%, transparent 56%),
    linear-gradient(90deg, transparent 44%, var(--rank-badge-sparkle-color) 44%, var(--rank-badge-sparkle-color) 56%, transparent 56%);
  filter: drop-shadow(0 0 4px var(--rank-badge-sparkle-color));
  transform: scale(0.55) rotate(0deg);
}

.rank-badge-sparkles::before {
  top: 10px;
  left: 18px;
  animation: rank-badge-sparkle-twinkle 2.4s ease-in-out infinite;
}

.rank-badge-sparkles::after {
  top: 7px;
  right: 21px;
  width: 8px;
  height: 8px;
  animation: rank-badge-sparkle-twinkle 2.4s ease-in-out 1.15s infinite;
}

.rank-badge-sparkles-secondary::before {
  top: 16px;
  left: 47px;
  width: 9px;
  height: 9px;
  animation-delay: 0.55s;
}

.rank-badge-sparkles-secondary::after {
  top: 12px;
  right: 43px;
  width: 7px;
  height: 7px;
  animation-delay: 1.65s;
}

.rank-badge-sparkle-master .rank-badge-sparkles {
  --rank-badge-sparkle-color: rgba(134, 255, 171, 0.65);
}

.rank-badge-sparkle-grandmaster .rank-badge-sparkles {
  --rank-badge-sparkle-color: rgba(190, 128, 255, 0.68);
}

.rank-badge-sparkle-champion .rank-badge-sparkles {
  --rank-badge-sparkle-color: rgba(255, 135, 208, 0.68);
}

@keyframes rank-badge-shine-sweep {
  0%,
  10% {
    opacity: 0;
    transform: translateX(-160%) rotate(16deg);
  }

  16% {
    opacity: 0.85;
  }

  34% {
    opacity: 0.2;
    transform: translateX(155%) rotate(16deg);
  }

  58% {
    opacity: 0;
    transform: translateX(155%) rotate(16deg);
  }

  100% {
    opacity: 0;
    transform: translateX(155%) rotate(16deg);
  }
}

@keyframes rank-badge-shine-sweep-bounce {
  0%,
  8% {
    opacity: 0;
    transform: translateX(-160%) rotate(16deg);
  }

  14% {
    opacity: 0.88;
  }

  28% {
    opacity: 0.26;
    transform: translateX(150%) rotate(16deg);
  }

  36% {
    opacity: 0.74;
  }

  52% {
    opacity: 0.18;
    transform: translateX(-145%) rotate(16deg);
  }

  62%,
  100% {
    opacity: 0;
    transform: translateX(-145%) rotate(16deg);
  }
}

@keyframes rank-badge-sparkle-twinkle {
  0%,
  58%,
  100% {
    opacity: 0;
    transform: scale(0.55) rotate(0deg);
  }

  66% {
    opacity: 0.72;
    transform: scale(1) rotate(12deg);
  }

  76% {
    opacity: 0.22;
    transform: scale(0.78) rotate(20deg);
  }
}
```
