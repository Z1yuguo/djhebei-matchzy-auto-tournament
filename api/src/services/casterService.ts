import { db } from '../config/database';

export interface CasterRecord {
  id: string;
  name: string;
  avatar_url: string | null;
  created_at: number;
}

export interface CasterResponse {
  id: string;
  name: string;
  avatar?: string | null;
  createdAt: number;
}

function toResponse(row: CasterRecord): CasterResponse {
  return {
    id: row.id,
    name: row.name,
    avatar: row.avatar_url,
    createdAt: row.created_at,
  };
}

class CasterService {
  async getAllCasters(): Promise<CasterResponse[]> {
    const rows = await db.getAllAsync<CasterRecord>('casters', undefined, undefined);
    return rows.map(toResponse).sort((a, b) => a.name.localeCompare(b.name));
  }

  async upsertCaster(id: string, name: string, avatar?: string | null): Promise<CasterResponse> {
    if (!id || id.trim() === '') {
      throw new Error('SteamID is required');
    }
    if (!name || name.trim() === '') {
      throw new Error('Name is required');
    }

    const existing = await db.getOneAsync<CasterRecord>('casters', 'id = ?', [id]);
    if (existing) {
      await db.updateAsync('casters', { name: name.trim(), avatar_url: avatar || null }, 'id = ?', [id]);
    } else {
      await db.insertAsync('casters', {
        id,
        name: name.trim(),
        avatar_url: avatar || null,
        created_at: Math.floor(Date.now() / 1000),
      });
    }

    const row = await db.getOneAsync<CasterRecord>('casters', 'id = ?', [id]);
    if (!row) {
      throw new Error('Failed to save caster');
    }
    return toResponse(row);
  }

  async deleteCaster(id: string): Promise<boolean> {
    const result = await db.deleteAsync('casters', 'id = ?', [id]);
    return result.changes > 0;
  }
}

export const casterService = new CasterService();
