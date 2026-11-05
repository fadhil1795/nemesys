import { Router, Request, Response } from 'express';
import {
  getChangeLogs,
  createChangeLog,
  deleteChangeLog,
  getMaintenanceWindows,
  createMaintenanceWindow,
  endMaintenanceWindow
} from '../services/networkLogService';

const networkLogsRouter = Router();

/**
 * GET /api/network-logs
 * Fetch change logbook records with filtering, pagination, and overview metrics
 */
networkLogsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { device_type, category, search, startDate, endDate, limit, offset } = req.query;
    const result = await getChangeLogs({
      device_type: device_type as string,
      category: category as string,
      search: search as string,
      startDate: startDate as string,
      endDate: endDate as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Error fetching change logs:', error);
    res.status(500).json({ success: false, error: error.message || 'Gagal mengambil data log perubahan jaringan' });
  }
});

/**
 * POST /api/network-logs
 * Record a new change event in MikroTik, OLT, ONU, or Switch
 */
networkLogsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const {
      device_type,
      category,
      target_name,
      action_title,
      details,
      before_state,
      after_state,
      impact_level,
      pic_name,
      execution_start,
      execution_end,
      duration_minutes,
      documentation_images,
      mission_id
    } = req.body;

    if (!target_name || !action_title || !pic_name) {
      return res.status(400).json({
        success: false,
        error: 'Target perangkat, judul tindakan, dan nama PIC wajib diisi.'
      });
    }

    const newLog = await createChangeLog({
      device_type: device_type || 'mikrotik',
      category: category || 'Umum',
      target_name,
      action_title,
      details,
      before_state,
      after_state,
      impact_level: impact_level || 'low',
      pic_name,
      execution_start,
      execution_end,
      duration_minutes: duration_minutes ? parseInt(duration_minutes, 10) : 0,
      documentation_images,
      mission_id: mission_id ? parseInt(mission_id, 10) : null
    });

    res.status(201).json({
      success: true,
      message: 'Perubahan jaringan berhasil dicatat ke buku log',
      data: newLog
    });
  } catch (error: any) {
    console.error('Error creating change log:', error);
    res.status(500).json({ success: false, error: error.message || 'Gagal menyimpan catatan perubahan' });
  }
});

/**
 * DELETE /api/network-logs/:id
 * Delete a change log entry
 */
networkLogsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'ID tidak valid' });
    }

    const success = await deleteChangeLog(id);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Catatan log tidak ditemukan' });
    }

    res.json({ success: true, message: 'Catatan log berhasil dihapus' });
  } catch (error: any) {
    console.error('Error deleting change log:', error);
    res.status(500).json({ success: false, error: error.message || 'Gagal menghapus catatan perubahan' });
  }
});

/**
 * GET /api/network-logs/maintenance
 * Get maintenance windows schedule
 */
networkLogsRouter.get('/maintenance', async (req: Request, res: Response) => {
  try {
    const onlyActive = req.query.active === 'true';
    const windows = await getMaintenanceWindows(onlyActive);
    res.json({ success: true, data: windows });
  } catch (error: any) {
    console.error('Error fetching maintenance windows:', error);
    res.status(500).json({ success: false, error: error.message || 'Gagal mengambil jadwal maintenance' });
  }
});

/**
 * POST /api/network-logs/maintenance
 * Schedule / Start a maintenance window
 */
networkLogsRouter.post('/maintenance', async (req: Request, res: Response) => {
  try {
    const { device_type, target_id, target_name, reason, scheduled_start, scheduled_end, silence_alarms, created_by } = req.body;

    if (!target_name || !reason || !scheduled_start || !scheduled_end || !created_by) {
      return res.status(400).json({
        success: false,
        error: 'Target perangkat, alasan pemeliharaan, jadwal mulai/selesai, dan nama teknisi wajib diisi.'
      });
    }

    const created = await createMaintenanceWindow({
      device_type: device_type || 'all',
      target_id,
      target_name,
      reason,
      scheduled_start,
      scheduled_end,
      silence_alarms: silence_alarms !== undefined ? silence_alarms : true,
      created_by
    });

    res.status(201).json({
      success: true,
      message: 'Jendela maintenance berhasil diaktifkan/dijadwalkan',
      data: created
    });
  } catch (error: any) {
    console.error('Error creating maintenance window:', error);
    res.status(500).json({ success: false, error: error.message || 'Gagal membuat jadwal maintenance' });
  }
});

/**
 * POST /api/network-logs/maintenance/:id/end
 * End an active maintenance window
 */
networkLogsRouter.post('/maintenance/:id/end', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'ID tidak valid' });
    }

    const success = await endMaintenanceWindow(id);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Jendela maintenance tidak ditemukan' });
    }

    res.json({ success: true, message: 'Jendela maintenance telah ditutup' });
  } catch (error: any) {
    console.error('Error ending maintenance window:', error);
    res.status(500).json({ success: false, error: error.message || 'Gagal menutup jendela maintenance' });
  }
});

export default networkLogsRouter;
