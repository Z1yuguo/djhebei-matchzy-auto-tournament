import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Autocomplete,
  ToggleButtonGroup,
  ToggleButton,
  Switch,
  FormControlLabel,
  Divider,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { api } from '../utils/api';
import { useSnackbar } from '../contexts/SnackbarContext';
import { useTranslation } from 'react-i18next';
import { downloadMatchReport } from '../utils/matchReport';
import MatchDetailsModal from '../components/modals/MatchDetailsModal';
import type { Match, MatchesResponse, PlayerDetail, PlayersResponse, MapsResponse } from '../types';

interface RosterPlayer {
  steamId: string;
  name: string;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_');

function RosterEditor({
  label,
  players,
  allPlayers,
  onChange,
}: {
  label: string;
  players: RosterPlayer[];
  allPlayers: PlayerDetail[];
  onChange: (players: RosterPlayer[]) => void;
}) {
  const { t } = useTranslation();
  const [manualSteamId, setManualSteamId] = useState('');
  const [manualName, setManualName] = useState('');

  const availablePlayers = allPlayers.filter((p) => !players.some((rp) => rp.steamId === p.id));

  const addPlayer = (steamId: string, name: string) => {
    if (!steamId.trim() || players.some((p) => p.steamId === steamId.trim())) return;
    onChange([...players, { steamId: steamId.trim(), name: name.trim() || steamId.trim() }]);
  };

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        {label} ({players.length})
      </Typography>

      <List dense sx={{ mb: 1 }}>
        {players.map((p) => (
          <ListItem
            key={p.steamId}
            secondaryAction={
              <IconButton
                edge="end"
                size="small"
                onClick={() => onChange(players.filter((x) => x.steamId !== p.steamId))}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            }
          >
            <ListItemText primary={p.name} secondary={p.steamId} />
          </ListItem>
        ))}
      </List>

      <Autocomplete
        size="small"
        options={availablePlayers}
        getOptionLabel={(p) => `${p.name} (${p.id})`}
        onChange={(_e, value) => value && addPlayer(value.id, value.name)}
        value={null}
        renderInput={(params) => (
          <TextField {...params} label={t('manualMatch.addExistingPlayer', 'Add existing player')} />
        )}
        sx={{ mb: 1 }}
      />

      <Box display="flex" gap={1} alignItems="center">
        <TextField
          size="small"
          label={t('manualMatch.steamId', 'SteamID64')}
          value={manualSteamId}
          onChange={(e) => setManualSteamId(e.target.value)}
        />
        <TextField
          size="small"
          label={t('manualMatch.playerName', 'Name')}
          value={manualName}
          onChange={(e) => setManualName(e.target.value)}
        />
        <IconButton
          onClick={() => {
            addPlayer(manualSteamId, manualName);
            setManualSteamId('');
            setManualName('');
          }}
          disabled={!manualSteamId.trim()}
        >
          <AddIcon />
        </IconButton>
      </Box>
      <Typography variant="caption" color="text.secondary">
        {t(
          'manualMatch.manualPlayerHelper',
          "Player not registered yet? Type their SteamID64 and a name directly — they'll be added automatically."
        )}
      </Typography>
    </Box>
  );
}

export default function ManualMatch() {
  const { t } = useTranslation();
  const { showSuccess, showError } = useSnackbar();

  const [team1Name, setTeam1Name] = useState('');
  const [team2Name, setTeam2Name] = useState('');
  const [team1Players, setTeam1Players] = useState<RosterPlayer[]>([]);
  const [team2Players, setTeam2Players] = useState<RosterPlayer[]>([]);
  const [bestOf, setBestOf] = useState<1 | 3 | 5>(1);
  const [vetoEnabled, setVetoEnabled] = useState(true);
  const [selectedMaps, setSelectedMaps] = useState<string[]>([]);
  const [serverId, setServerId] = useState<string>('');
  const [recordDemo, setRecordDemo] = useState(true);

  const [allPlayers, setAllPlayers] = useState<PlayerDetail[]>([]);
  const [allMaps, setAllMaps] = useState<{ id: string; displayName: string }[]>([]);
  const [availableServers, setAvailableServers] = useState<
    { id: string; name: string; online: boolean; allocatable: boolean }[]
  >([]);
  const [manualMatches, setManualMatches] = useState<Match[]>([]);
  const [creating, setCreating] = useState(false);
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [playersRes, mapsRes, matchesRes, availabilityRes] = await Promise.all([
        api.get<PlayersResponse>('/api/players/selection'),
        api.get<MapsResponse>('/api/maps'),
        api.get<MatchesResponse>('/api/matches'),
        api.get<{
          success: boolean;
          servers?: { id: string; name: string; online: boolean; allocatable: boolean }[];
        }>('/api/tournament/server-availability'),
      ]);
      setAllPlayers(playersRes.players || []);
      setAllMaps(mapsRes.maps || []);
      setManualMatches((matchesRes.matches || []).filter((m) => m.round === 0));
      setAvailableServers(availabilityRes.servers || []);
    } catch {
      // Non-fatal; page still usable with empty lists, user can retry via Refresh.
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const slug = useMemo(() => {
    if (!team1Name.trim() || !team2Name.trim()) return '';
    return `${slugify(team1Name)}_vs_${slugify(team2Name)}_${Date.now().toString(36)}`;
  }, [team1Name, team2Name]);

  const mapPoolValid = vetoEnabled ? selectedMaps.length >= bestOf : selectedMaps.length === bestOf;

  const handleCreate = async () => {
    if (!team1Name.trim() || !team2Name.trim()) {
      showError(t('manualMatch.errors.teamNamesRequired', 'Both team names are required'));
      return;
    }
    if (team1Players.length === 0 || team2Players.length === 0) {
      showError(t('manualMatch.errors.rostersRequired', 'Both rosters need at least one player'));
      return;
    }
    if (!mapPoolValid) {
      showError(
        vetoEnabled
          ? t('manualMatch.errors.poolTooSmall', 'Veto map pool must have at least as many maps as the format')
          : t('manualMatch.errors.pickExactMaps', 'Pick exactly the number of maps for this format')
      );
      return;
    }

    setCreating(true);
    try {
      const playersPerTeam = Math.max(team1Players.length, team2Players.length, 1);
      const toPlayerMap = (players: RosterPlayer[]) =>
        Object.fromEntries(players.map((p) => [p.steamId, p.name]));

      await api.post('/api/matches', {
        slug,
        serverId: serverId || undefined,
        config: {
          matchid: 0,
          skip_veto: true,
          players_per_team: playersPerTeam,
          team1: { name: team1Name.trim(), players: toPlayerMap(team1Players) },
          team2: { name: team2Name.trim(), players: toPlayerMap(team2Players) },
          num_maps: bestOf,
          maplist: selectedMaps,
          vetoDisabled: !vetoEnabled,
          cvars: { matchzy_demo_recording_enabled: recordDemo ? 1 : 0 },
        },
      });

      showSuccess(t('manualMatch.success.created', 'Match created'));
      setTeam1Name('');
      setTeam2Name('');
      setTeam1Players([]);
      setTeam2Players([]);
      setSelectedMaps([]);
      setServerId('');
      void loadData();
    } catch (err) {
      const error = err as Error;
      showError(error.message || t('manualMatch.errors.createFailed', 'Failed to create match'));
    } finally {
      setCreating(false);
    }
  };

  const handleLoad = async (matchSlug: string) => {
    setLoadingSlug(matchSlug);
    try {
      const response = await api.post<{ success: boolean; message?: string; error?: string }>(
        `/api/matches/${matchSlug}/load`
      );
      if (response.success) {
        showSuccess(response.message || t('manualMatch.success.loaded', 'Match loaded on server'));
      } else {
        showError(response.error || t('manualMatch.errors.loadFailed', 'Failed to load match'));
      }
      void loadData();
    } catch (err) {
      const error = err as Error;
      showError(error.message || t('manualMatch.errors.loadFailed', 'Failed to load match'));
    } finally {
      setLoadingSlug(null);
    }
  };

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('manualMatch.createTitle', 'Create Manual Match')}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {t(
              'manualMatch.createDescription',
              'Build a standalone match outside the tournament bracket — pick rosters, best-of, and whether teams veto maps or you set them directly.'
            )}
          </Typography>

          <Box display="flex" gap={3} flexWrap="wrap" mt={2}>
            <Box flex={1} minWidth={320}>
              <TextField
                fullWidth
                size="small"
                label={t('manualMatch.team1Name', 'Team 1 name')}
                value={team1Name}
                onChange={(e) => setTeam1Name(e.target.value)}
                sx={{ mb: 2 }}
              />
              <RosterEditor
                label={t('manualMatch.team1Roster', 'Team 1 roster')}
                players={team1Players}
                allPlayers={allPlayers}
                onChange={setTeam1Players}
              />
            </Box>

            <Box flex={1} minWidth={320}>
              <TextField
                fullWidth
                size="small"
                label={t('manualMatch.team2Name', 'Team 2 name')}
                value={team2Name}
                onChange={(e) => setTeam2Name(e.target.value)}
                sx={{ mb: 2 }}
              />
              <RosterEditor
                label={t('manualMatch.team2Roster', 'Team 2 roster')}
                players={team2Players}
                allPlayers={allPlayers}
                onChange={setTeam2Players}
              />
            </Box>
          </Box>

          <Divider sx={{ my: 3 }} />

          <Box display="flex" gap={4} flexWrap="wrap" alignItems="flex-start">
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {t('manualMatch.bestOf', 'Best of')}
              </Typography>
              <ToggleButtonGroup
                value={bestOf}
                exclusive
                size="small"
                onChange={(_e, v) => {
                  if (v !== null) {
                    setBestOf(v);
                    setSelectedMaps([]);
                  }
                }}
              >
                <ToggleButton value={1}>BO1</ToggleButton>
                <ToggleButton value={3}>BO3</ToggleButton>
                <ToggleButton value={5}>BO5</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={vetoEnabled}
                    onChange={(e) => {
                      setVetoEnabled(e.target.checked);
                      setSelectedMaps([]);
                    }}
                  />
                }
                label={t('manualMatch.vetoToggle', 'Teams veto maps')}
              />
              <Typography variant="caption" color="text.secondary" display="block">
                {vetoEnabled
                  ? t(
                      'manualMatch.vetoOnHelper',
                      'Off means picking the pool below — teams will ban/pick down to the final map(s) on their team pages before the match can be loaded.'
                    )
                  : t(
                      'manualMatch.vetoOffHelper',
                      'Pick the exact map(s) below — the match can be loaded immediately after creation.'
                    )}
              </Typography>
            </Box>

            <Box minWidth={260}>
              <FormControl size="small" fullWidth>
                <InputLabel>{t('manualMatch.server', 'Server')}</InputLabel>
                <Select
                  value={serverId}
                  label={t('manualMatch.server', 'Server')}
                  onChange={(e) => setServerId(e.target.value)}
                >
                  <MenuItem value="">
                    {t('manualMatch.autoAllocate', 'Auto-allocate (recommended)')}
                  </MenuItem>
                  {availableServers.map((s) => (
                    <MenuItem key={s.id} value={s.id} disabled={!s.allocatable}>
                      {s.name} {!s.allocatable ? `(${t('manualMatch.busy', 'busy')})` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                {t(
                  'manualMatch.serverHelper',
                  'Pin this match to a specific server instead of letting the allocator pick one.'
                )}
              </Typography>
            </Box>

            <Box>
              <FormControlLabel
                control={
                  <Switch checked={recordDemo} onChange={(e) => setRecordDemo(e.target.checked)} />
                }
                label={t('manualMatch.recordDemo', 'Record demo (GOTV)')}
              />
              <Typography variant="caption" color="text.secondary" display="block">
                {t(
                  'manualMatch.recordDemoHelper',
                  'Automatically enabled via RCON when the match is loaded on the server - no manual server-side setup needed.'
                )}
              </Typography>
            </Box>
          </Box>

          <Box mt={2}>
            <Autocomplete
              multiple
              size="small"
              options={allMaps.map((m) => m.id)}
              getOptionLabel={(id) => allMaps.find((m) => m.id === id)?.displayName || id}
              value={selectedMaps}
              onChange={(_e, value) => setSelectedMaps(value)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={
                    vetoEnabled
                      ? t('manualMatch.vetoPool', 'Veto map pool (at least {{n}} maps)', { n: bestOf })
                      : t('manualMatch.exactMaps', 'Maps ({{n}} required, in order)', { n: bestOf })
                  }
                />
              )}
            />
          </Box>

          <Box mt={3} display="flex" gap={1} alignItems="center">
            <Button
              variant="contained"
              onClick={() => void handleCreate()}
              disabled={creating}
              startIcon={creating ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {t('manualMatch.createButton', 'Create Match')}
            </Button>
            {slug && (
              <Typography variant="caption" color="text.secondary">
                {t('manualMatch.slugPreview', 'Slug: {{slug}}', { slug })}
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="h6">{t('manualMatch.listTitle', 'Manual Matches')}</Typography>
            <IconButton size="small" onClick={() => void loadData()}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Box>

          {manualMatches.length === 0 ? (
            <Alert severity="info">
              {t('manualMatch.noneYet', 'No manual matches created yet.')}
            </Alert>
          ) : (
            <List>
              {manualMatches.map((m) => (
                <ListItem
                  key={m.slug}
                  divider
                  secondaryAction={
                    <Box display="flex" gap={1}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<VisibilityIcon fontSize="small" />}
                        onClick={() => setSelectedMatch(m)}
                      >
                        {t('manualMatch.viewResult', 'Result')}
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={
                          loadingSlug === m.slug ? (
                            <CircularProgress size={14} />
                          ) : (
                            <CloudUploadIcon fontSize="small" />
                          )
                        }
                        onClick={() => void handleLoad(m.slug)}
                        disabled={loadingSlug === m.slug}
                      >
                        {t('manualMatch.load', 'Load')}
                      </Button>
                      <Button
                        size="small"
                        startIcon={<DownloadIcon fontSize="small" />}
                        onClick={() =>
                          void downloadMatchReport(m.slug).catch((err: Error) =>
                            showError(err.message || t('manualMatch.errors.downloadFailed', 'Failed to download report'))
                          )
                        }
                      >
                        {t('manualMatch.download', 'JSON')}
                      </Button>
                    </Box>
                  }
                >
                  <ListItemText
                    primary={`${m.team1?.name || m.config?.team1?.name || '?'} vs ${
                      m.team2?.name || m.config?.team2?.name || '?'
                    }`}
                    secondary={
                      <>
                        {m.slug}{' '}
                        <Chip label={m.status} size="small" sx={{ ml: 1 }} />
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {selectedMatch && (
        <MatchDetailsModal
          match={selectedMatch}
          matchNumber={selectedMatch.matchNumber || selectedMatch.id}
          roundLabel={t('manualMatch.roundLabel', 'Manual Match')}
          onClose={() => setSelectedMatch(null)}
          onDeleted={() => {
            setSelectedMatch(null);
            void loadData();
          }}
        />
      )}
    </Box>
  );
}
