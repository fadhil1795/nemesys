import { pool } from '../db';

export interface HousekeepingConfig {
  id?: number;
  is_enabled: boolean;
  frequency: 'daily' | 'every_2_days' | 'weekly';
  execution_time: string; // e.g. '02:00:00'
  retention_mac_hours: number; // e.g. 24
  retention_logs_days: number; // e.g. 30
  retention_telegram_days: number; // e.g. 14
  last_run_at?: string | null;
  last_run_status?: string | null;
  last_deleted_count?: number;
  updated_at?: string;
}

export class HousekeepingService {
  /**
   * Ensure housekeeping_config table exists and has default row
   */
  public static async ensureTable(): Promise<void> {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS housekeeping_config (
          id INT AUTO_INCREMENT PRIMARY KEY,
          is_enabled TINYINT(1) DEFAULT 1,
          frequency VARCHAR(20) DEFAULT 'daily',
          execution_time TIME DEFAULT '02:00:00',
          retention_mac_hours INT DEFAULT 24,
          retention_logs_days INT DEFAULT 30,
          retention_telegram_days INT DEFAULT 14,
          last_run_at DATETIME NULL,
          last_run_status VARCHAR(50) NULL,
          last_deleted_count INT DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB;
      `);

      const [rows]: any = await pool.query('SELECT id FROM housekeeping_config LIMIT 1');
      if (!rows || rows.length === 0) {
        await pool.query(`
          INSERT INTO housekeeping_config 
          (is_enabled, frequency, execution_time, retention_mac_hours, retention_logs_days, retention_telegram_days)
          VALUES (1, 'daily', '02:00:00', 24, 30, 14)
        `);
      }
    } catch (err: any) {
      console.warn('[HousekeepingService] Table init note:', err.message);
    }
  }

  /**
   * Get current Housekeeping configuration
   */
  public static async getConfig(): Promise<HousekeepingConfig> {
    await this.ensureTable();
    const [rows]: any = await pool.query('SELECT * FROM housekeeping_config ORDER BY id DESC LIMIT 1');
    if (rows && rows[0]) {
      const r = rows[0];
      return {
        id: r.id,
        is_enabled: Boolean(r.is_enabled),
        frequency: r.frequency || 'daily',
        execution_time: String(r.execution_time || '02:00:00').slice(0, 5),
        retention_mac_hours: Number(r.retention_mac_hours) || 24,
        retention_logs_days: Number(r.retention_logs_days) || 30,
        retention_telegram_days: Number(r.retention_telegram_days) || 14,
        last_run_at: r.last_run_at,
        last_run_status: r.last_run_status,
        last_deleted_count: Number(r.last_deleted_count) || 0,
        updated_at: r.updated_at
      };
    }

    return {
      is_enabled: true,
      frequency: 'daily',
      execution_time: '02:00',
      retention_mac_hours: 24,
      retention_logs_days: 30,
      retention_telegram_days: 14,
      last_run_at: null,
      last_run_status: null,
      last_deleted_count: 0
    };
  }

  /**
   * Save Housekeeping configuration
   */
  public static async updateConfig(cfg: Partial<HousekeepingConfig>): Promise<HousekeepingConfig> {
    await this.ensureTable();
    const current = await this.getConfig();

    const isEnabled = cfg.is_enabled !== undefined ? (cfg.is_enabled ? 1 : 0) : (current.is_enabled ? 1 : 0);
    const frequency = cfg.frequency || current.frequency;
    const executionTime = (cfg.execution_time || current.execution_time).length === 5 
      ? `${cfg.execution_time || current.execution_time}:00` 
      : (cfg.execution_time || current.execution_time);
    const retentionMac = Number(cfg.retention_mac_hours) || current.retention_mac_hours;
    const retentionLogs = Number(cfg.retention_logs_days) || current.retention_logs_days;
    const retentionTg = Number(cfg.retention_telegram_days) || current.retention_telegram_days;

    await pool.query(`
      UPDATE housekeeping_config 
      SET is_enabled = ?, frequency = ?, execution_time = ?, retention_mac_hours = ?, retention_logs_days = ?, retention_telegram_days = ?
      WHERE id = ?
    `, [isEnabled, frequency, executionTime, retentionMac, retentionLogs, retentionTg, current.id || 1]);

    return await this.getConfig();
  }

  /**
   * Execute Housekeeping Prune Run
   */
  public static async runHousekeeping(isManual = false): Promise<{
    success: boolean;
    deletedMacs: number;
    deletedLogs: number;
    deletedTelegramLogs: number;
    totalDeleted: number;
    message: string;
    timestamp: string;
  }> {
    const startTime = Date.now();
    await this.ensureTable();
    const cfg = await this.getConfig();

    let deletedMacs = 0;
    let deletedLogs = 0;
    let deletedTelegramLogs = 0;

    try {
      // 1. Prune stale MAC entries (devices that have disconnected/unseen past retention hours)
      try {
        const [macRes]: any = await pool.query(
          'DELETE FROM olt_mac_entries WHERE last_seen < NOW() - INTERVAL ? HOUR',
          [cfg.retention_mac_hours]
        );
        deletedMacs = macRes?.affectedRows || 0;
      } catch (e: any) {
        console.warn('[Housekeeping] MAC cleanup note:', e.message);
      }

      // 2. Prune old system logs past retention days
      try {
        const [logsRes]: any = await pool.query(
          'DELETE FROM system_logs WHERE created_at < NOW() - INTERVAL ? DAY',
          [cfg.retention_logs_days]
        );
        deletedLogs = logsRes?.affectedRows || 0;
      } catch (e: any) {
        console.warn('[Housekeeping] System logs cleanup note:', e.message);
      }

      // 3. Prune old telegram report logs past retention days
      try {
        const [tgRes]: any = await pool.query(
          'DELETE FROM telegram_report_logs WHERE sent_at < NOW() - INTERVAL ? DAY',
          [cfg.retention_telegram_days]
        );
        deletedTelegramLogs = tgRes?.affectedRows || 0;
      } catch (e: any) {
        console.warn('[Housekeeping] Telegram logs cleanup note:', e.message);
      }

      // 4. Optimize tables to reclaim disk space & defragment index
      try {
        await pool.query('OPTIMIZE TABLE olt_mac_entries, system_logs, telegram_report_logs');
      } catch {}

      const totalDeleted = deletedMacs + deletedLogs + deletedTelegramLogs;

      // 5. Update housekeeping_config stats
      await pool.query(`
        UPDATE housekeeping_config 
        SET last_run_at = NOW(), last_run_status = 'Sukses', last_deleted_count = ?
        WHERE id = ?
      `, [totalDeleted, cfg.id || 1]);

      // 6. Record audit entry in system_logs
      try {
        await pool.query(`
          INSERT INTO system_logs (action, details, created_at)
          VALUES ('DATABASE_HOUSEKEEPING', ?, NOW())
        `, [
          `${isManual ? 'Manual' : 'Scheduled'} Housekeeping selesai: ${totalDeleted} baris data kadaluarsa dibersihkan (${deletedMacs} MAC, ${deletedLogs} Log Sistem, ${deletedTelegramLogs} Log Telegram). Waktu: ${Date.now() - startTime}ms.`
        ]);
      } catch {}

      return {
        success: true,
        deletedMacs,
        deletedLogs,
        deletedTelegramLogs,
        totalDeleted,
        message: `Pembersihan berhasil! ${totalDeleted} baris data kadaluarsa telah dihapus dari database (${deletedMacs} MAC idle, ${deletedLogs} log sistem, ${deletedTelegramLogs} log telegram).`,
        timestamp: new Date().toISOString()
      };
    } catch (err: any) {
      console.error('[Housekeeping] Execution error:', err);
      await pool.query(`
        UPDATE housekeeping_config 
        SET last_run_at = NOW(), last_run_status = ? 
        WHERE id = ?
      `, [`Error: ${err.message}`.slice(0, 50), cfg.id || 1]).catch(() => {});

      return {
        success: false,
        deletedMacs: 0,
        deletedLogs: 0,
        deletedTelegramLogs: 0,
        totalDeleted: 0,
        message: `Pembersihan gagal: ${err.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Check if housekeeping should run in current cron tick
   */
  public static async checkAndRunCron(): Promise<void> {
    try {
      const cfg = await this.getConfig();
      if (!cfg.is_enabled) return;

      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      // Parse execution time (e.g. '02:00')
      const [targetHour = 2, targetMinute = 0] = (cfg.execution_time || '02:00').split(':').map(Number);
      const nowMins = currentHour * 60 + currentMinute;
      const targetMins = targetHour * 60 + targetMinute;

      // Allow window of 15 minutes starting from target time
      if (nowMins < targetMins || nowMins >= targetMins + 15) {
        return;
      }

      // Check frequency condition
      if (cfg.last_run_at) {
        const lastRun = new Date(cfg.last_run_at);
        const hoursSinceLastRun = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);

        if (cfg.frequency === 'daily' && hoursSinceLastRun < 20) {
          return;
        }
        if (cfg.frequency === 'every_2_days' && hoursSinceLastRun < 40) {
          return;
        }
        if (cfg.frequency === 'weekly' && hoursSinceLastRun < 140) {
          return;
        }
      }

      console.log(`[CRON] Menjalankan Housekeeping Otomatis (${cfg.frequency})...`);
      const res = await this.runHousekeeping(false);
      console.log(`[CRON] ${res.message}`);
    } catch (err: any) {
      console.error('[CRON] checkAndRunCron error:', err.message);
    }
  }
}
