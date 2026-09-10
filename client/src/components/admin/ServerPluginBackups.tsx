import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore';
import RefreshIcon from '@mui/icons-material/Refresh';
import { api } from '../../utils/api';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '../modals/ConfirmDialog';

interface CsmPluginBackup {
  id: string;
  hasManifest: boolean;
  metamod?: string;
  counterstrikesharp?: string;
  matchzy?: string;
  capturedAt?: string;
}

interface ServerPluginBackupsProps {
  serverId: string;
}

/**
 * Lists the plugin snapshots csm has saved on this server's host (taken
 * automatically before every plugin update) and lets an admin restore one -
 * "run back to the last plugin versions that worked" - from the panel
 * instead of SSHing in. See api/src/services/csmPluginBackupService.ts.
 *
 * One csm install manages every server on a host, so this list and any
 * rollback triggered from here affects every server behind the same SSH
 * connection, not just this one - the confirm dialog says so explicitly.
 */
export const ServerPluginBackups: React.FC<ServerPluginBackupsProps> = ({ serverId }) => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [backups, setBackups] = useState<CsmPluginBackup[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<CsmPluginBackup | null>(null);
  const [rollingBack, setRollingBack] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await api.get<{ success: boolean; backups: CsmPluginBackup[] }>(
        `/api/servers/${serverId}/plugin-backups`
      );
      setBackups(response.backups);
    } catch (err) {
      const error = err as Error;
      setLoadError(error.message || t('pluginBackups.loadFailed', 'Failed to load plugin backups'));
      setBackups(null);
    } finally {
      setLoading(false);
    }
  }, [serverId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const describeVersions = (b: CsmPluginBackup): string => {
    if (!b.hasManifest) {
      return t('pluginBackups.unknownVersions', 'Versions unknown (taken before version tracking was added)');
    }
    return `Metamod ${b.metamod || '?'} · CounterStrikeSharp ${b.counterstrikesharp || '?'} · MatchZy ${
      b.matchzy || '?'
    }`;
  };

  const handleConfirmRollback = async () => {
    if (!confirmTarget) return;
    setRollingBack(true);
    try {
      await api.post(`/api/servers/${serverId}/plugin-backups/rollback`, {
        backupId: confirmTarget.id,
      });
      showSuccess(
        t('pluginBackups.rollbackSuccess', 'Rolled back to backup {{id}} and redeployed to every server.', {
          id: confirmTarget.id,
        })
      );
      setConfirmTarget(null);
      void load();
    } catch (err) {
      const error = err as Error;
      showError(error.message || t('pluginBackups.rollbackFailed', 'Plugin rollback failed'));
    } finally {
      setRollingBack(false);
    }
  };

  if (loading && !backups) {
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary">
          {t('pluginBackups.loading', 'Loading plugin backups...')}
        </Typography>
      </Box>
    );
  }

  if (loadError) {
    return (
      <Alert severity="warning" action={
        <IconButton size="small" onClick={() => void load()}>
          <RefreshIcon fontSize="small" />
        </IconButton>
      }>
        {loadError}
      </Alert>
    );
  }

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Typography variant="body2" color="text.secondary">
          {t(
            'pluginBackups.description',
            'csm snapshots Metamod/CounterStrikeSharp/MatchZy before every plugin update. Restoring one redeploys it to every server on this host and restarts them.'
          )}
        </Typography>
        <Tooltip title={t('pluginBackups.refresh', 'Refresh') as string}>
          <IconButton size="small" onClick={() => void load()}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {(!backups || backups.length === 0) && (
        <Alert severity="info">
          {t(
            'pluginBackups.none',
            'No plugin backups yet - one is taken automatically before each plugin update.'
          )}
        </Alert>
      )}

      {backups && backups.length > 0 && (
        <List dense>
          {backups.map((b, index) => (
            <ListItem
              key={b.id}
              secondaryAction={
                <Tooltip title={t('pluginBackups.restore', 'Restore this version') as string}>
                  <span>
                    <IconButton edge="end" onClick={() => setConfirmTarget(b)} disabled={rollingBack}>
                      <RestoreIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              }
            >
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body2" fontWeight={600}>
                      {b.id}
                    </Typography>
                    {index === 0 && (
                      <Chip label={t('pluginBackups.mostRecent', 'Most recent')} size="small" color="primary" />
                    )}
                  </Box>
                }
                secondary={describeVersions(b)}
              />
            </ListItem>
          ))}
        </List>
      )}

      <ConfirmDialog
        open={!!confirmTarget}
        title={t('pluginBackups.confirmTitle', 'Roll back plugins?')}
        message={
          confirmTarget && (
            <Typography variant="body2">
              {t(
                'pluginBackups.confirmMessage',
                'This restores backup {{id}} ({{versions}}) and redeploys it to EVERY server on this host, stopping and restarting them. Any plugin updates applied since this backup was taken will be lost.',
                { id: confirmTarget.id, versions: describeVersions(confirmTarget) }
              )}
            </Typography>
          )
        }
        confirmLabel={t('pluginBackups.confirmButton', 'Roll back and restart') as string}
        confirmColor="warning"
        loading={rollingBack}
        onConfirm={() => void handleConfirmRollback()}
        onCancel={() => setConfirmTarget(null)}
      />

      {rollingBack && (
        <Alert severity="info">
          {t(
            'pluginBackups.rollingBack',
            'Restoring and restarting all servers on this host - this can take a minute...'
          )}
        </Alert>
      )}
    </Box>
  );
};

export default ServerPluginBackups;
