import pool from '../db/connection';

export interface SystemSetting {
  id: string;
  key: string;
  value: string;
  description?: string;
  updated_at: string;
  updated_by?: string;
}

// In-memory cache for settings to avoid DB hits on every request
// Cache invalidates after 5 minutes or on update
let settingsCache: Record<string, string> | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const SystemSettings = {
  async getAll(): Promise<SystemSetting[]> {
    const result = await pool.query('SELECT * FROM system_settings ORDER BY key');
    return result.rows;
  },

  async get(key: string, defaultValue?: string): Promise<string> {
    // Check cache first
    if (settingsCache && (Date.now() - cacheTimestamp < CACHE_TTL)) {
      if (settingsCache[key] !== undefined) {
        return settingsCache[key];
      }
    }

    // Refresh cache if needed or key not found
    if (!settingsCache || (Date.now() - cacheTimestamp >= CACHE_TTL)) {
      await this.refreshCache();
    }

    // Return from refreshed cache
    return settingsCache?.[key] ?? defaultValue ?? '';
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
    
    // Invalidate cache immediately
    settingsCache = null;
    
    return result.rows[0];
  },

  async refreshCache() {
    try {
      const result = await pool.query('SELECT key, value FROM system_settings');
      settingsCache = result.rows.reduce((acc: Record<string, string>, row: any) => {
        acc[row.key] = row.value;
        return acc;
      }, {} as Record<string, string>);
      cacheTimestamp = Date.now();
    } catch (error) {
      console.error('Failed to refresh settings cache:', error);
      // Don't clear cache on error to serve stale data if possible
    }
  }
};

