import { db } from '../config/database';
import { getMatchDetailsBySlug } from '../routes/matches';
import { calculateHltvRating } from '../utils/hltvRating';

export interface MatchReport {
  slug: string;
  status: string;
  bestOf: number | null;
  createdAt: number;
  loadedAt: number | null;
  team1: { name: string | null; tag: string | null; players: { steamId: string; name: string }[] };
  team2: { name: string | null; tag: string | null; players: { steamId: string; name: string }[] };
  maps: {
    mapNumber: number;
    mapName: string | null;
    team1Score: number;
    team2Score: number;
    winner: string | null | undefined;
  }[];
  players: {
    steamId: string;
    name: string | null;
    avatar: string | null;
    team: string;
    wonMatch: boolean;
    roundsPlayed: number | null;
    kills: number | null;
    deaths: number | null;
    assists: number | null;
    headshots: number | null;
    flashAssists: number | null;
    utilityDamage: number | null;
    adr: number | null;
    kast: number | null;
    mvps: number | null;
    score: number | null;
    /**
     * Community-reverse-engineered HLTV Rating 2.0 approximation - a pure
     * per-match performance score, independent of win/loss (unlike this
     * app's ELO/Skill Rating, which is win/loss driven). Null if we don't
     * have rounds-played data to compute it from.
     */
    hltvRating: number | null;
  }[];
}

/**
 * Builds a normalized, source-agnostic match report (used by both the
 * downloadable GET /api/matches/:slug/report endpoint and the GitHub backup
 * sync), independent of MatchZy's own webhook payload shapes.
 */
export async function buildMatchReport(slug: string): Promise<MatchReport | null> {
  const match = await getMatchDetailsBySlug(slug);
  if (!match) return null;

  const playerRows = await db.queryAsync<{
    player_id: string;
    name: string | null;
    avatar_url: string | null;
    team: string;
    won_match: boolean;
    adr: number | null;
    kills: number | null;
    deaths: number | null;
    assists: number | null;
    headshots: number | null;
    flash_assists: number | null;
    utility_damage: number | null;
    kast: number | null;
    mvps: number | null;
    score: number | null;
    rounds_played: number | null;
  }>(
    `SELECT pms.*, p.name, p.avatar_url
       FROM player_match_stats pms
       LEFT JOIN players p ON p.id = pms.player_id
      WHERE pms.match_slug = ?
      ORDER BY pms.team, pms.score DESC NULLS LAST`,
    [slug]
  );

  const rawConfig = match.config as
    | { num_maps?: number; team1?: { name?: string; tag?: string }; team2?: { name?: string; tag?: string } }
    | undefined;

  return {
    slug: match.slug,
    status: match.status,
    bestOf: rawConfig?.num_maps ?? null,
    createdAt: match.createdAt,
    loadedAt: match.loadedAt ?? null,
    team1: {
      name: match.team1?.name ?? rawConfig?.team1?.name ?? null,
      tag: match.team1?.tag ?? rawConfig?.team1?.tag ?? null,
      players: (match.team1Players || []).map((p) => ({ steamId: p.steamId, name: p.name })),
    },
    team2: {
      name: match.team2?.name ?? rawConfig?.team2?.name ?? null,
      tag: match.team2?.tag ?? rawConfig?.team2?.tag ?? null,
      players: (match.team2Players || []).map((p) => ({ steamId: p.steamId, name: p.name })),
    },
    maps: (match.mapResults || []).map((m) => ({
      mapNumber: m.mapNumber,
      mapName: m.mapName ?? null,
      team1Score: m.team1Score,
      team2Score: m.team2Score,
      winner: m.winnerTeam,
    })),
    players: playerRows.map((row) => ({
      steamId: row.player_id,
      name: row.name,
      avatar: row.avatar_url,
      team: row.team,
      wonMatch: row.won_match,
      roundsPlayed: row.rounds_played,
      kills: row.kills,
      deaths: row.deaths,
      assists: row.assists,
      headshots: row.headshots,
      flashAssists: row.flash_assists,
      utilityDamage: row.utility_damage,
      adr: row.adr,
      kast: row.kast,
      mvps: row.mvps,
      score: row.score,
      hltvRating:
        row.rounds_played && row.rounds_played > 0
          ? calculateHltvRating({
              kills: row.kills || 0,
              deaths: row.deaths || 0,
              assists: row.assists || 0,
              kast: row.kast || 0,
              adr: row.adr || 0,
              roundsPlayed: row.rounds_played,
            })
          : null,
    })),
  };
}
