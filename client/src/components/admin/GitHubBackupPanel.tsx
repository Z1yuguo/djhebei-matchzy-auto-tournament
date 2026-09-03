import React, { useState, useEffect } from 'react';
import { Box, Button, Typography, Alert, CircularProgress, List, ListItem, ListItemText, Chip } from '@mui/material';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import { api } from '../../utils/api';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { useTranslation } from 'react-i18next';

interface BackupCategoryResult {
  category: string;
  success: boolean;
  path: string;
  error?: string;
}

/**
 * Pushes JSON snapshots of teams, players, tournament info, and match
 * results to a separate GitHub repo (see api/src/services/githubBackupService.ts).
 * Configured via GITHUB_BACKUP_TOKEN / GITHUB_BACKUP_REPO in the API's .env.
 */
export const GitHubBackupPanel: React.FC = () => {
  const { t } = useTranslation();
  const { showError } = useSnackbar();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [results, setResults] = useState<BackupCategoryResult[] | null>(null);

  useEffect(() => {
    void api
      .get<{ success: boolean; configured: boolean }>('/api/backup/status')
      .then((res) => setConfigured(res.configured))
      .catch(() => setConfigured(false));
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setResults(null);
    try {
      const response = await api.post<{ success: boolean; results: BackupCategoryResult[] }>(
        '/api/backup/sync'
      );
      setResults(response.results);
    } catch (err) {
      const error = err as Error;
      showError(error.message || t('backup.syncFailed', 'Backup sync failed'));
    } finally {
      setSyncing(false);
    }
  };

  if (configured === null) {
    return <CircularProgress size={20} />;
  }

  if (!configured) {
    return (
      <Alert severity="info">
        {t(
          'backup.notConfigured',
          'GitHub backup is not configured. Set GITHUB_BACKUP_TOKEN and GITHUB_BACKUP_REPO in the .env file to enable it.'
        )}
      </Alert>
    );
  }

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Typography variant="body2" color="text.secondary">
        {t(
          'backup.description',
          'Pushes teams.json, players.json, tournament.json, and results.json to your configured GitHub backup repo.'
        )}
      </Typography>

      <Box>
        <Button
          variant="contained"
          startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <CloudSyncIcon />}
          onClick={() => void handleSync()}
          disabled={syncing}
        >
          {t('backup.syncNow', 'Sync Now')}
        </Button>
      </Box>

      {results && (
        <List dense>
          {results.map((r) => (
            <ListItem key={r.category}>
              <ListItemText primary={r.path} secondary={r.error} />
              <Chip
                label={r.success ? t('backup.ok', 'OK') : t('backup.failed', 'Failed')}
                color={r.success ? 'success' : 'error'}
                size="small"
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};

export default GitHubBackupPanel;
