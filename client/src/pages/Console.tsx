import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  List,
  ListItemButton,
  ListItemText,
  Chip,
  Typography,
  CircularProgress,
  Button,
} from '@mui/material';
import TerminalIcon from '@mui/icons-material/Terminal';
import { api } from '../utils/api';
import { EmptyState } from '../components/shared/EmptyState';
import { ServerTerminal } from '../components/admin/ServerTerminal';
import type { Server, ServersResponse } from '../types';
import { useTranslation } from 'react-i18next';

const STATUS_COLOR: Record<string, 'success' | 'error' | 'default'> = {
  online: 'success',
  offline: 'error',
};

export default function Console() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadServers = useCallback(async () => {
    try {
      const response = await api.get<ServersResponse>('/api/servers');
      const list = response.servers || [];
      setServers(list);
    } catch {
      // Non-fatal - list just stays empty/stale on transient errors.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadServers();
    const interval = window.setInterval(loadServers, 15_000);
    return () => window.clearInterval(interval);
  }, [loadServers]);

  const consoleServers = servers.filter((s) => s.sshConsoleEnabled);
  const selectedServer = consoleServers.find((s) => s.id === selectedId) || null;

  useEffect(() => {
    if (!selectedId && consoleServers.length > 0) {
      setSelectedId(consoleServers[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consoleServers.length]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  if (consoleServers.length === 0) {
    return (
      <EmptyState
        icon={TerminalIcon}
        title={t('consolePage.emptyTitle', 'No live consoles configured')}
        description={t(
          'consolePage.emptyDescription',
          'Enable "SSH Console" on a server (Servers → edit a server) to attach to its live tmux console from here.'
        )}
        actionLabel={t('consolePage.emptyAction', 'Go to Servers')}
        onAction={() => navigate('/servers')}
      />
    );
  }

  return (
    <Box display="flex" gap={2} height="calc(100vh - 180px)" minHeight={400}>
      <Card sx={{ width: 280, flexShrink: 0, overflowY: 'auto' }}>
        <List dense disablePadding data-testid="console-server-list">
          {consoleServers.map((server) => (
            <ListItemButton
              key={server.id}
              selected={server.id === selectedId}
              onClick={() => setSelectedId(server.id)}
              data-testid={`console-server-item-${server.id}`}
            >
              <ListItemText
                primary={server.name}
                secondary={`${server.host}:${server.port}`}
                slotProps={{
                  primary: { fontWeight: 600, noWrap: true },
                  secondary: { noWrap: true },
                }}
              />
              <Chip
                label={server.status || t('consolePage.statusUnknown', 'unknown')}
                size="small"
                color={STATUS_COLOR[server.status || ''] || 'default'}
                sx={{ ml: 1 }}
              />
            </ListItemButton>
          ))}
        </List>
      </Card>

      <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, p: 1 }}>
        {selectedServer ? (
          <>
            <Box display="flex" alignItems="center" gap={1} px={1} py={0.5}>
              <TerminalIcon fontSize="small" />
              <Typography variant="subtitle2" fontWeight={600}>
                {selectedServer.name}
              </Typography>
              <Chip
                label={selectedServer.status || t('consolePage.statusUnknown', 'unknown')}
                size="small"
                color={STATUS_COLOR[selectedServer.status || ''] || 'default'}
              />
              <Box flex={1} />
              <Button size="small" onClick={() => navigate('/servers')}>
                {t('consolePage.manageServer', 'Manage server')}
              </Button>
            </Box>
            <Box flex={1} minHeight={0} px={1} pb={1}>
              <ServerTerminal serverId={selectedServer.id} active={true} />
            </Box>
          </>
        ) : (
          <Box display="flex" alignItems="center" justifyContent="center" flex={1}>
            <Typography color="text.secondary">
              {t('consolePage.selectServer', 'Select a server to open its live console.')}
            </Typography>
          </Box>
        )}
      </Card>
    </Box>
  );
}
