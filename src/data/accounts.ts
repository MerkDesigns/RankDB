export type RankTier =
  | "Bronze"
  | "Silver"
  | "Gold"
  | "Platinum"
  | "Emerald"
  | "Diamond"
  | "Master"
  | "Grandmaster"
  | "Champion"
  | "Unranked";

export interface Rank {
  readonly tier: RankTier;
  readonly division: number;
  /** A placement-match estimate rather than a real rank (shown faded). */
  readonly predicted: boolean;
  /** Placement games played, 1–10. Only meaningful while `predicted`; 0 otherwise. */
  readonly placements: number;
}

export const PLACEMENT_GAMES = 10;

export function sameRank(a: Rank, b: Rank): boolean {
  return a.tier === b.tier && a.division === b.division && a.predicted === b.predicted && a.placements === b.placements;
}

/**
 * Clean, needs SMS verification, temporarily banned (`suspended`) or banned for good. All but
 * clean have their own section below the list.
 */
export type AccountStatus = "clean" | "sms" | "suspended" | "banned";

export interface Account {
  readonly id: number;
  readonly name: string;
  readonly ranks: readonly [Rank, Rank, Rank];
  readonly sixV6: Rank;
  readonly valuesA: readonly [number, number, number];
  readonly valuesB: readonly [number, number];
  readonly groupId: string | null;
  readonly status: AccountStatus;
  /** Order within its container: the top level (shared with groups), its group, or its section. */
  readonly sortKey: number;
  /** Dodged games counted toward the next leaver penalty. */
  readonly gamesDodged: number;
  /** When a rank was last set (ISO), for the menu's "Last edit". */
  readonly lastRankChangeAt: string | null;
  /** Whether an email / password is saved; the values stay in Rust until asked for. */
  readonly hasEmail: boolean;
  readonly hasPassword: boolean;
}

export interface Group {
  readonly id: string;
  readonly name: string;
  readonly collapsed: boolean;
  /** Its place among the loose accounts. */
  readonly sortKey: number;
}

/** What Rust stores and sends: every account and group. */
export interface Records {
  readonly accounts: readonly Account[];
  readonly groups: readonly Group[];
}

/** One item of the list's top level: a loose account, or a group with its accounts. */
export type ListEntry =
  | { readonly kind: "account"; readonly account: Account }
  | { readonly kind: "group"; readonly group: Group; readonly accounts: readonly Account[] };

/** The list as shown: the top level, then the SMS, temporarily banned and banned sections. */
export interface Roster {
  readonly entries: readonly ListEntry[];
  readonly sms: readonly Account[];
  readonly suspended: readonly Account[];
  readonly banned: readonly Account[];
  readonly total: number;
  /** A role sort is on: the top level is one flat, sorted list (no groups). */
  readonly sorted: boolean;
}

const TIERS: readonly RankTier[] = [
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Emerald",
  "Diamond",
  "Master",
  "Grandmaster",
  "Champion",
];
/** Roughly the shape of a real ladder, skewed up because these are someone's mains and smurfs. */
const TIER_WEIGHTS = [4, 6, 10, 14, 16, 18, 14, 8, 3];

const NAME_HEADS = [
  "Frost", "Shadow", "Pixel", "Turbo", "Lazy", "Crispy", "Sleepy", "Mega", "Neon", "Salty",
  "Quiet", "Lucky", "Hyper", "Cosmic", "Toasty", "Wobbly", "Chud", "Phonk", "Captcha", "Muschi",
  "Tung", "Drool", "Pred", "Windy", "Swag", "Grim", "Snack", "Moist", "Bonk", "Velvet",
];
const NAME_TAILS = [
  "Mercy", "Tracer", "Panda", "Burger", "Knight", "Goblin", "Falcon", "Potato", "Wizard",
  "Noodle", "Viper", "Cactus", "Raccoon", "Pelican", "Comet", "Slayer", "Lord", "Magnet",
  "Boss", "Scan", "Prompter", "Gremlin", "Beans", "Waffle",
];
const NAME_SUFFIXES = ["", "", "", "", "1337", "67", "99", "2k", "x", "TV", "420", "Hhhh"];

const GROUP_NAMES = ["Low Accs", "Smurfs"];

/** Small deterministic PRNG so the same seed always produces the same roster to benchmark. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The lab's dummy accounts: a deterministic roster for a given count and seed. */
export function generateRoster(count: number, seed: number): Records {
  const random = mulberry32(seed);
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;
  const usedNames = new Set<string>();

  const weighted = (centerTier: number): RankTier => {
    // Ranks of one account cluster around its "real" skill.
    const offset = Math.round((random() - 0.5) * 3);
    return TIERS[Math.max(0, Math.min(TIERS.length - 1, centerTier + offset))]!;
  };
  const pickCenterTier = () => {
    const total = TIER_WEIGHTS.reduce((sum, weight) => sum + weight, 0);
    let roll = random() * total;
    for (let index = 0; index < TIER_WEIGHTS.length; index += 1) {
      roll -= TIER_WEIGHTS[index]!;
      if (roll <= 0) return index;
    }
    return 4;
  };
  const rank = (centerTier: number, unrankedChance: number): Rank => {
    if (random() < unrankedChance) {
      return { tier: "Unranked", division: 5, predicted: false, placements: 0 };
    }
    const tier = weighted(centerTier);
    const division = 1 + Math.floor(random() * 5);
    const predicted = random() < 0.12;
    // Derived instead of drawn, so adding placements didn't reshuffle every seeded roster.
    const placements = predicted ? ((division * 7 + tier.length * 3) % 9) + 1 : 0;
    return { tier, division, predicted, placements };
  };
  const currency = (zeroChance: number, max: number) =>
    random() < zeroChance ? 0 : Math.round((random() * max) / 10) * 10;

  const name = () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = `${pick(NAME_HEADS)}${pick(NAME_TAILS)}${pick(NAME_SUFFIXES)}`;
      if (!usedNames.has(candidate)) {
        usedNames.add(candidate);
        return candidate;
      }
    }
    return `Account${usedNames.size + 1}`;
  };

  // The same split as a typical RankDB: mostly loose rows, two groups, an SMS and a banned tail.
  const bannedCount = Math.max(1, Math.round(count * 0.12));
  const smsCount = Math.max(1, Math.round(count * 0.06));
  const groupSizes = [Math.round(count * 0.2), Math.round(count * 0.12)];
  // Groups come after the loose accounts.
  const groups: Group[] = GROUP_NAMES.map((groupName, index) => ({
    id: `group-${index}`,
    name: groupName,
    collapsed: false,
    sortKey: count + index,
  }));
  const accounts: Account[] = [];

  for (let index = 0; index < count; index += 1) {
    const center = pickCenterTier();
    let groupId: string | null = null;
    let status: AccountStatus = "clean";
    const fromEnd = count - index;
    const tail = bannedCount + smsCount;
    if (fromEnd <= bannedCount) status = "banned";
    else if (fromEnd <= tail) status = "sms";
    else if (fromEnd <= tail + groupSizes[1]!) groupId = "group-1";
    else if (fromEnd <= tail + groupSizes[1]! + groupSizes[0]!) groupId = "group-0";

    const account: Account = {
      id: index + 1,
      name: name(),
      ranks: [rank(center, 0.22), rank(center, 0.15), rank(center, 0.2)],
      sixV6: rank(center, 0.7),
      valuesA: [currency(0.8, 400), currency(0.4, 900), currency(0.45, 18_000)],
      valuesB: [currency(0.6, 900), currency(0.5, 2_000)],
      groupId,
      status,
      sortKey: index,
      gamesDodged: 0,
      lastRankChangeAt: null,
      hasEmail: false,
      hasPassword: false,
    };
    accounts.push(account);
  }

  return { accounts, groups: groups.filter((group) => accounts.some((account) => account.groupId === group.id)) };
}

/**
 * The name as shown (the old app's rule): the Battletag without its "#1234" (only copying gives the
 * whole tag). Privacy mode: first N characters then "...", "-" when N is 0.
 */
export function displayAccountName(name: string, privacyMode: boolean, visibleChars: number): string {
  const hash = name.indexOf("#");
  const trimmed = (hash === -1 ? name : name.slice(0, hash)).trim();
  if (!privacyMode) return trimmed;
  if (!trimmed || visibleChars <= 0) return "-";
  if (trimmed.length <= visibleChars) return trimmed;
  return `${trimmed.slice(0, visibleChars)}...`;
}

export function formatCompactValue(value: number): string {
  for (const [limit, suffix] of [
    [1_000_000, "m"],
    [1_000, "k"],
  ] as const) {
    if (Math.abs(value) >= limit) {
      const shortened = value / limit;
      return `${Number.isInteger(shortened) ? shortened : shortened.toFixed(1).replace(/\.0$/, "")}${suffix}`;
    }
  }
  return String(value);
}
