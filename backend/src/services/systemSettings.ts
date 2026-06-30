import pool, { readQuery } from '../db/connection';
import { CacheService } from './cacheService';

export interface SystemSetting {
  id: string;
  key: string;
  value: string;
  description?: string;
  updated_at: string;
  updated_by?: string;
}

const SETTINGS_TTL = 5 * 60; // 5 minutes in seconds
const ALL_KEY = 'settings:all';
const settingKey = (k: string) => `settings:${k}`;

export const SystemSettings = {
  async getAll(): Promise<SystemSetting[]> {
    const cached = await CacheService.get<SystemSetting[]>(ALL_KEY);
    if (cached) return cached;

    const result = await pool.query('SELECT * FROM system_settings ORDER BY key');
    await CacheService.set(ALL_KEY, result.rows, SETTINGS_TTL);
    return result.rows;
  },

  async get(key: string, defaultValue?: string): Promise<string> {
    const cached = await CacheService.get<string>(settingKey(key));
    if (cached !== null) return cached;

    // Load all settings at once to warm the cache for all keys
    await this.refreshCache();

    const afterRefresh = await CacheService.get<string>(settingKey(key));
    if (afterRefresh !== null) return afterRefresh;

    // Cache unavailable (no Redis) — fall back to direct DB query with retry+local fallback
    try {
      const result = await readQuery('SELECT value FROM system_settings WHERE key = $1', [key]);
      if (result.rows.length > 0) return result.rows[0].value;
    } catch {
      // DB unavailable — return default
    }
    return defaultValue ?? '';
  },

  async getNumber(key: string, defaultValue: number): Promise<number> {
    const val = await this.get(key);
    const num = Number(val);
    return isNaN(num) ? defaultValue : num;
  },

  async getBoolean(key: string, defaultValue: boolean): Promise<boolean> {
    const val = await this.get(key);
    if (val === 'true') return true;
    if (val === 'false') return false;
    return defaultValue;
  },

  async update(key: string, value: string, userId: string): Promise<SystemSetting> {
    const result = await pool.query(
      `INSERT INTO system_settings (key, value, updated_by, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (key)
       DO UPDATE SET value = $2, updated_by = $3, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [key, value, userId]
    );

    // Invalidate both the individual key and the all-settings cache
    await CacheService.del(ALL_KEY, settingKey(key));

    return result.rows[0];
  },

  async refreshCache() {
    try {
      const result = await pool.query('SELECT key, value FROM system_settings');
      // Cache each individual key and the full list in parallel
      await Promise.all([
        ...result.rows.map((row: any) =>
          CacheService.set(settingKey(row.key), row.value, SETTINGS_TTL)
        ),
        CacheService.set(
          ALL_KEY,
          result.rows,
          SETTINGS_TTL
        ),
      ]);
    } catch (error) {
      console.error('Failed to refresh settings cache:', error);
    }
  },
};
