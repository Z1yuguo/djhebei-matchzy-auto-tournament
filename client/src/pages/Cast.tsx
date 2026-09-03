import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  IconButton,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CampaignIcon from '@mui/icons-material/Campaign';
import { api } from '../utils/api';
import { useSnackbar } from '../contexts/SnackbarContext';
import { EmptyState } from '../components/shared/EmptyState';
import { useTranslation } from 'react-i18next';

interface Caster {
  id: string;
  name: string;
  avatar?: string | null;
  createdAt: number;
}

export default function Cast() {
  const { t } = useTranslation();
  const { showSuccess, showError } = useSnackbar();
  const [casters, setCasters] = useState<Caster[]>([]);
  const [loading, setLoading] = useState(true);
  const [steamId, setSteamId] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; casters: Caster[] }>('/api/casters');
      setCasters(res.casters || []);
    } catch {
      // Non-fatal; list just stays empty on transient errors.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = async () => {
    if (!steamId.trim() || !name.trim()) {
      showError(t('castPage.errors.bothRequired', 'SteamID and name are both required'));
      return;
    }
    setSaving(true);
    try {
      await api.post('/api/casters', { id: steamId.trim(), name: name.trim() });
      showSuccess(t('castPage.success.added', 'Cast member added'));
      setSteamId('');
      setName('');
      void load();
    } catch (err) {
      const error = err as Error;
      showError(error.message || t('castPage.errors.addFailed', 'Failed to add cast member'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/casters/${id}`);
      showSuccess(t('castPage.success.removed', 'Cast member removed'));
      void load();
    } catch (err) {
      const error = err as Error;
      showError(error.message || t('castPage.errors.removeFailed', 'Failed to remove cast member'));
    }
  };

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('castPage.addTitle', 'Add Cast Member')}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {t(
              'castPage.addDescription',
              'Register a broadcaster/caster SteamID once, then pick them quickly when building any Manual Match.'
            )}
          </Typography>
          <Box display="flex" gap={2} mt={2} flexWrap="wrap">
            <TextField
              size="small"
              label={t('castPage.steamId', 'SteamID64')}
              value={steamId}
              onChange={(e) => setSteamId(e.target.value)}
            />
            <TextField
              size="small"
              label={t('castPage.name', 'Name')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
              onClick={() => void handleAdd()}
              disabled={saving}
            >
              {t('castPage.add', 'Add')}
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('castPage.listTitle', 'Registered Cast')}
          </Typography>
          {loading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress size={24} />
            </Box>
          ) : casters.length === 0 ? (
            <EmptyState
              icon={CampaignIcon}
              title={t('castPage.emptyTitle', 'No cast members yet')}
              description={t(
                'castPage.emptyDescription',
                'Add a SteamID above to register your first broadcaster.'
              )}
            />
          ) : (
            <List>
              {casters.map((caster) => (
                <ListItem
                  key={caster.id}
                  divider
                  secondaryAction={
                    <IconButton edge="end" onClick={() => void handleDelete(caster.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  }
                >
                  <ListItemAvatar>
                    <Avatar src={caster.avatar || undefined}>{caster.name.charAt(0)}</Avatar>
                  </ListItemAvatar>
                  <ListItemText primary={caster.name} secondary={caster.id} />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
