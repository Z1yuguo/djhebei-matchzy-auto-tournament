import { api } from './api';

/**
 * Fetches the normalized match report (see GET /api/matches/:slug/report)
 * and triggers a browser download of it as a .json file. Used for exporting
 * clean per-match data (rosters, map results, per-player stats) to feed an
 * external stats site.
 */
export async function downloadMatchReport(slug: string): Promise<void> {
  const response = await api.get<{ success: boolean; report: unknown }>(
    `/api/matches/${slug}/report`
  );
  const blob = new Blob([JSON.stringify(response.report, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${slug}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
