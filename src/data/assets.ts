import bronze from "../assets/ranks/Bronze.png";
import silver from "../assets/ranks/Silver.png";
import gold from "../assets/ranks/Gold.png";
import platinum from "../assets/ranks/Platinum.png";
import emerald from "../assets/ranks/Emerald.png";
import diamond from "../assets/ranks/Diamond.png";
import master from "../assets/ranks/Master.png";
import grandmaster from "../assets/ranks/Grandmaster.png";
import champion from "../assets/ranks/Champion.png";
import unranked from "../assets/ranks/Unranked.png";
import battlenet from "../assets/icons/Battlenet_Icon.png";
import overwatch from "../assets/icons/Overwatch_Icon.png";
import tank from "../assets/icons/Tank_Icon.png";
import damage from "../assets/icons/Damage_Icon.png";
import support from "../assets/icons/Support_Icon.png";
import flex from "../assets/icons/Flex_Icon.png";
import mythicPrisms from "../assets/icons/MythicPrisms.png";
import overwatchCoins from "../assets/icons/OverwatchCoins.png";
import overwatchCredits from "../assets/icons/OverwatchCredits.png";
import competitivePoints from "../assets/icons/CompetetivePoints.png";
import legacyPoints from "../assets/icons/LegacyPoints.png";
import emblemBronze from "../assets/emblems/Bronze.png";
import emblemSilver from "../assets/emblems/Silver.png";
import emblemGold from "../assets/emblems/Gold.png";
import emblemPlatinum from "../assets/emblems/Platinum.png";
import emblemEmerald from "../assets/emblems/Emerald.png";
import emblemDiamond from "../assets/emblems/Diamond.png";
import emblemMaster from "../assets/emblems/Master.png";
import emblemGrandmaster from "../assets/emblems/Grandmaster.png";
import emblemChampion from "../assets/emblems/Champion.png";
import emblemUnranked from "../assets/emblems/Unranked.png";
import emblemPredicted from "../assets/emblems/Predicted.png";
import digit1 from "../assets/digits/1.png";
import digit2 from "../assets/digits/2.png";
import digit3 from "../assets/digits/3.png";
import digit4 from "../assets/digits/4.png";
import digit5 from "../assets/digits/5.png";
import type { RankTier } from "./accounts";

/**
 * The division numbers 1–5 as images (white on transparent, used as masks by RankDigit), drawn
 * from the font Merk chose to match Overwatch's. Images, not the font: the font's licence doesn't
 * allow shipping the font file inside the app. Each is the box the text took: the font's digit
 * width by 1em, baseline at 0.8em.
 */
export const DIVISION_DIGITS: Record<number, string> = { 1: digit1, 2: digit2, 3: digit3, 4: digit4, 5: digit5 };

/** Square rank emblems for the rank picker (the badges use the wide images above). */
export const RANK_EMBLEMS: Record<RankTier, string> = {
  Bronze: emblemBronze,
  Silver: emblemSilver,
  Gold: emblemGold,
  Platinum: emblemPlatinum,
  Emerald: emblemEmerald,
  Diamond: emblemDiamond,
  Master: emblemMaster,
  Grandmaster: emblemGrandmaster,
  Champion: emblemChampion,
  Unranked: emblemUnranked,
};
export const PREDICTED_EMBLEM = emblemPredicted;

export const RANK_IMAGES: Record<RankTier, string> = {
  Bronze: bronze,
  Silver: silver,
  Gold: gold,
  Platinum: platinum,
  Emerald: emerald,
  Diamond: diamond,
  Master: master,
  Grandmaster: grandmaster,
  Champion: champion,
  Unranked: unranked,
};

export const ICONS = {
  battlenet,
  overwatch,
  tank,
  damage,
  support,
  flex,
  mythicPrisms,
  overwatchCoins,
  overwatchCredits,
  competitivePoints,
  legacyPoints,
};

/** Header order matches the row's value columns: three in A, two in B. */
export const VALUE_A_ICONS = [ICONS.mythicPrisms, ICONS.overwatchCoins, ICONS.overwatchCredits];
export const VALUE_B_ICONS = [ICONS.competitivePoints, ICONS.legacyPoints];
export const ROLE_ICONS = [ICONS.tank, ICONS.damage, ICONS.support];

export const ALL_IMAGE_URLS = [
  ...Object.values(RANK_IMAGES),
  ...Object.values(ICONS),
  ...Object.values(RANK_EMBLEMS),
  PREDICTED_EMBLEM,
];
