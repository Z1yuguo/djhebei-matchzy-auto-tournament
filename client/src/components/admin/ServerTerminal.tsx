import React, { useEffect, useRef, useState } from 'react';
import { Box, Alert, CircularProgress, Typography } from '@mui/material';
import { io, Socket } from 'socket.io-client';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useTranslation } from 'react-i18next';

interface ServerTerminalProps {
  serverId: string;
  /** Terminal only actually connects while this is true (e.g. dialog is open). */
  active: boolean;
}

/**
 * Live SSH terminal attached to a server's cs2-<N> tmux console session
 * (see api/src/services/terminalService.ts). Streams the real SRCDS console
 * output - including chat - and forwards keystrokes back into the pane.
 */
export const ServerTerminal: React.FC<ServerTerminalProps> = ({ serverId, active }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<'connecting' | 'ready' | 'error' | 'closed'>('connecting');
  const [errorMessage, setErrorMessage] = useState('');
  const { t } = useTranslation();

  useEffect(() => {
    if (!active || !containerRef.current) return;

    setStatus('connecting');
    setErrorMessage('');

    const term = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#111318',
      },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    const socket = io(`${window.location.origin}/admin-terminal`, {
      path: '/socket.io',
      withCredentials: true,
    });
    socketRef.current = socket;

    const start = () => {
      socket.emit('terminal:start', {
        serverId,
        cols: term.cols,
        rows: term.rows,
      });
    };

    socket.on('connect', start);

    socket.on('terminal:ready', () => {
      setStatus('ready');
    });

    socket.on('terminal:output', (data: string) => {
      term.write(data);
    });

    socket.on('terminal:error', (message: string) => {
      setStatus('error');
      setErrorMessage(message);
    });

    socket.on('terminal:closed', () => {
      setStatus('closed');
    });

    socket.on('connect_error', (err: Error) => {
      setStatus('error');
      setErrorMessage(err.message || t('serverTerminal.connectionFailed', 'Failed to connect'));
    });

    const onData = term.onData((data) => {
      socket.emit('terminal:input', data);
    });

    const handleResize = () => {
      fitAddon.fit();
      socket.emit('terminal:resize', { cols: term.cols, rows: term.rows });
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      onData.dispose();
      socket.emit('terminal:stop');
      socket.disconnect();
      term.dispose();
      termRef.current = null;
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId, active]);

  return (
    <Box display="flex" flexDirection="column" height="100%" minHeight={0}>
      {status === 'connecting' && (
        <Box display="flex" alignItems="center" gap={1} px={2} py={1}>
          <CircularProgress size={16} />
          <Typography variant="caption" color="text.secondary">
            {t('serverTerminal.connecting', 'Connecting to server console…')}
          </Typography>
        </Box>
      )}
      {status === 'error' && (
        <Alert severity="error" sx={{ m: 1 }}>
          {errorMessage}
        </Alert>
      )}
      {status === 'closed' && (
        <Alert severity="warning" sx={{ m: 1 }}>
          {t('serverTerminal.sessionClosed', 'Console session closed.')}
        </Alert>
      )}
      <Box
        ref={containerRef}
        sx={{
          flex: 1,
          minHeight: 0,
          bgcolor: '#111318',
          borderRadius: 1,
          p: 1,
          '& .xterm': { height: '100%' },
        }}
      />
    </Box>
  );
};

export default ServerTerminal;
