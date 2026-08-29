import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import RefreshIcon from '@mui/icons-material/Refresh';
import { api } from '../../utils/api';
import { useSnackbar } from '../../contexts/SnackbarContext';
import type { Match, MatchesResponse } from '../../types';
import { useTranslation } from 'react-i18next';

/**
 * Raw MatchZy match-config JSON editor. View/edit the config stored for any
 * match (matches.config), independent of the tournament/manual-match wizard,
 * then optionally push it to the server via the existing load pipeline.
 */
export const MatchConfigEditor: React.FC = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [configText, setConfigText] = useState('');
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingOnServer, setLoadingOnServer] = useState(false);
  const [jsonError, setJsonError] = useState('');
  const { showSuccess, showError } = useSnackbar();
  const { t } = useTranslation();

  const loadMatches = async () => {
    setLoadingMatches(true);
    try {
      const response = await api.get<MatchesResponse>('/api/matches');
      setMatches(response.matches || []);
    } catch (err) {
      const error = err as Error;
      showError(error.message || t('matchConfigEditor.errors.loadMatchesFailed', 'Failed to load matches'));
    } finally {
      setLoadingMatches(false);
    }
  };

  useEffect(() => {
    void loadMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadConfigForSlug = async (slug: string) => {
    if (!slug) {
      setConfigText('');
      return;
    }
    setLoadingConfig(true);
    setJsonError('');
    try {
      const response = await api.get<Record<string, unknown>>(`/api/matches/${slug}.json`);
      setConfigText(JSON.stringify(response, null, 2));
    } catch (err) {
      const error = err as Error;
      showError(error.message || t('matchConfigEditor.errors.loadConfigFailed', 'Failed to load config'));
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleSelectMatch = (slug: string) => {
    setSelectedSlug(slug);
    void loadConfigForSlug(slug);
  };

  const handleSave = async () => {
    if (!selectedSlug) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(configText);
    } catch (err) {
      const error = err as Error;
      setJsonError(error.message || t('matchConfigEditor.errors.invalidJson', 'Invalid JSON'));
      return;
    }
    setJsonError('');
    setSaving(true);
    try {
      const response = await api.patch<{ success: boolean; config: unknown; error?: string }>(
        `/api/matches/${selectedSlug}/config`,
        parsed
      );
      setConfigText(JSON.stringify(response.config, null, 2));
      showSuccess(t('matchConfigEditor.success.saved', 'Config saved'));
    } catch (err) {
      const error = err as Error;
      showError(error.message || t('matchConfigEditor.errors.saveFailed', 'Failed to save config'));
    } finally {
      setSaving(false);
    }
  };

  const handleLoadOnServer = async () => {
    if (!selectedSlug) return;
    setLoadingOnServer(true);
    try {
      const response = await api.post<{ success: boolean; message?: string; error?: string }>(
        `/api/matches/${selectedSlug}/load`
      );
      if (response.success) {
        showSuccess(response.message || t('matchConfigEditor.success.loaded', 'Config loaded on server'));
      } else {
        showError(response.error || t('matchConfigEditor.errors.loadOnServerFailed', 'Failed to load on server'));
      }
    } catch (err) {
      const error = err as Error;
      showError(error.message || t('matchConfigEditor.errors.loadOnServerFailed', 'Failed to load on server'));
    } finally {
      setLoadingOnServer(false);
    }
  };

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Typography variant="body2" color="text.secondary">
        {t(
          'matchConfigEditor.description',
          'View and edit the raw MatchZy match config JSON for any match, then optionally push it to the assigned server.'
        )}
      </Typography>

      <Box display="flex" gap={2} alignItems="center">
        <FormControl size="small" sx={{ minWidth: 320 }}>
          <InputLabel>{t('matchConfigEditor.matchSelectLabel', 'Match')}</InputLabel>
          <Select
            value={selectedSlug}
            label={t('matchConfigEditor.matchSelectLabel', 'Match')}
            onChange={(e) => handleSelectMatch(e.target.value)}
            disabled={loadingMatches}
          >
            {matches.map((m) => (
              <MenuItem key={m.slug} value={m.slug}>
                {m.slug} — {m.team1?.name || '?'} vs {m.team2?.name || '?'} ({m.status})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          size="small"
          startIcon={<RefreshIcon />}
          onClick={() => void loadMatches()}
          disabled={loadingMatches}
        >
          {t('matchConfigEditor.refresh', 'Refresh')}
        </Button>
      </Box>

      {jsonError && <Alert severity="error">{jsonError}</Alert>}

      {loadingConfig ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        selectedSlug && (
          <>
            <TextField
              value={configText}
              onChange={(e) => setConfigText(e.target.value)}
              multiline
              minRows={16}
              maxRows={32}
              fullWidth
              sx={{
                '& textarea': {
                  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                  fontSize: '0.8rem',
                },
              }}
            />

            <Box display="flex" gap={1}>
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {t('matchConfigEditor.save', 'Save')}
              </Button>
              <Button
                variant="outlined"
                color="warning"
                startIcon={
                  loadingOnServer ? <CircularProgress size={16} color="inherit" /> : <CloudUploadIcon />
                }
                onClick={() => void handleLoadOnServer()}
                disabled={loadingOnServer}
              >
                {t('matchConfigEditor.loadOnServer', 'Load on server')}
              </Button>
            </Box>
          </>
        )
      )}
    </Box>
  );
};

export default MatchConfigEditor;
