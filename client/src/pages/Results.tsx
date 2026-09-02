import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  List,
  ListItemButton,
  ListItemText,
  Chip,
  Typography,
  CircularProgress,
  IconButton,
  Button,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { api } from '../utils/api';
import { useSnackbar } from '../contexts/SnackbarContext';
import { downloadMatchReport } from '../utils/matchReport';
import { EmptyState } from '../components/shared/EmptyState';
import MatchDetailsModal from '../components/modals/MatchDetailsModal';
import { getRoundLabel } from '../utils/matchUtils';
import type { Match, MatchesResponse } from '../types';
import { useTranslation } from 'react-i18next';

export default function Results() {
  const { t } = useTranslation();
  const { showError } = useSnackbar();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  const loadResults = useCallback(async () => {
    try {
      const response = await api.get<MatchesResponse>('/api/matches');
      const completed = (response.matches || [])
        .filter((m) => m.status === 'completed')
        .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
      setMatches(completed);
    } catch {
      // Non-fatal - list just stays empty/stale on transient errors.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadResults();
  }, [loadResults]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  if (matches.length === 0) {
    return (
      <EmptyState
        icon={EmojiEventsIcon}
        title={t('resultsPage.emptyTitle', 'No completed games yet')}
        description={t(
          'resultsPage.emptyDescription',
          'Finished tournament and manual matches will show up here once they complete.'
        )}
      />
    );
  }

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Box display="flex" justifyContent="flex-end">
        <IconButton size="small" onClick={() => void loadResults()}>
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Box>

      <Card>
        <List disablePadding data-testid="results-list">
          {matches.map((m) => {
            const winnerIsTeam1 = m.winner?.id && m.winner.id === m.team1?.id;
            const winnerIsTeam2 = m.winner?.id && m.winner.id === m.team2?.id;
            return (
              <ListItemButton
                key={m.slug}
                divider
                onClick={() => setSelectedMatch(m)}
                sx={{ display: 'flex', alignItems: 'center', gap: 2 }}
              >
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography fontWeight={winnerIsTeam1 ? 700 : 400}>
                        {m.team1?.name || 'Team 1'}
                      </Typography>
                      <Typography color="text.secondary">
                        {m.team1Score ?? '-'} : {m.team2Score ?? '-'}
                      </Typography>
                      <Typography fontWeight={winnerIsTeam2 ? 700 : 400}>
                        {m.team2?.name || 'Team 2'}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <>
                      {m.round === 0
                        ? t('resultsPage.manualMatch', 'Manual match')
                        : getRoundLabel(m.round)}{' '}
                      · {m.completedAt ? new Date(m.completedAt * 1000).toLocaleString() : ''}
                      <Chip label={m.slug} size="small" sx={{ ml: 1 }} variant="outlined" />
                    </>
                  }
                />
                <Button
                  size="small"
                  startIcon={<DownloadIcon fontSize="small" />}
                  onClick={(e) => {
                    e.stopPropagation();
                    void downloadMatchReport(m.slug).catch((err: Error) =>
                      showError(err.message || t('resultsPage.downloadFailed', 'Failed to download report'))
                    );
                  }}
                >
                  {t('resultsPage.download', 'JSON')}
                </Button>
              </ListItemButton>
            );
          })}
        </List>
      </Card>

      {selectedMatch && (
        <MatchDetailsModal
          match={selectedMatch}
          matchNumber={selectedMatch.matchNumber || selectedMatch.id}
          roundLabel={
            selectedMatch.round === 0
              ? t('resultsPage.manualMatch', 'Manual match')
              : getRoundLabel(selectedMatch.round)
          }
          onClose={() => setSelectedMatch(null)}
          onDeleted={() => {
            setSelectedMatch(null);
            void loadResults();
          }}
        />
      )}
    </Box>
  );
}
