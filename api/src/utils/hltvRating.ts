/**
 * HLTV Rating 2.0 (community-reverse-engineered approximation).
 *
 * HLTV's exact formula is proprietary; this is the widely-used public
 * approximation, calibrated so an "average" pro performance lands near 1.00:
 *
 *   Impact = 2.13*KPR + 0.42*APR - 0.41
 *   Rating = 0.0073*KAST + 0.3591*KPR - 0.5329*DPR + 0.2372*Impact + 0.0032*ADR + 0.1587
 *
 * Unlike ELO/Skill Rating (win/loss driven, see eloTemplateService), this is
 * a pure per-match performance score - it says nothing about who won.
 */

export interface HltvRatingInput {
  kills: number;
  deaths: number;
  assists: number;
  kast: number; // 0-100
  adr: number; // damage per round
  roundsPlayed: number;
}

export function calculateHltvRating(input: HltvRatingInput): number | null {
  const { kills, deaths, assists, kast, adr, roundsPlayed } = input;
  if (!roundsPlayed || roundsPlayed <= 0) {
    return null;
  }

  const kpr = kills / roundsPlayed;
  const dpr = deaths / roundsPlayed;
  const apr = assists / roundsPlayed;
  const impact = 2.13 * kpr + 0.42 * apr - 0.41;
  const rating =
    0.0073 * kast + 0.3591 * kpr - 0.5329 * dpr + 0.2372 * impact + 0.0032 * adr + 0.1587;

  return Math.round(rating * 100) / 100;
}
