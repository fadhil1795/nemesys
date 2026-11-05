import { pool } from '../db';

export interface ChangeLogItem {
  id?: number;
  device_type: 'mikrotik' | 'olt' | 'onu' | 'switch' | 'other';
  category: string;
  target_name: string;
  action_title: string;
  details?: string | null;
  before_state?: string | null;
  after_state?: string | null;
  impact_level?: 'low' | 'medium' | 'high' | 'critical';
  pic_name: string;
  execution_start?: string | null;
  execution_end?: string | null;
  duration_minutes?: number;
  documentation_images?: string[] | string;
  mission_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface MaintenanceWindowItem {
  id?: number;
  device_type?: string;
  target_id?: string | null;
  target_name: string;
  reason: string;
  scheduled_start: string;
  scheduled_end: string;
  actual_end?: string | null;
  is_active?: boolean | number;
  silence_alarms?: boolean | number;
  created_by: string;
  created_at?: string;
}

/**
 * Fetch change logs with optional search, category, and date filtering
 */
export async function getChangeLogs(params: {
  device_type?: string;
  category?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}) {
  const conditions: string[] = [];
  const queryParams: any[] = [];

  if (params.device_type && params.device_type !== 'all') {
    conditions.push('device_type = ?');
    queryParams.push(params.device_type);
  }

  if (params.category && params.category !== 'all') {
    conditions.push('category = ?');
    queryParams.push(params.category);
  }

  if (params.search) {
    conditions.push('(action_title LIKE ? OR target_name LIKE ? OR details LIKE ? OR pic_name LIKE ?)');
    const searchTerm = `%${params.search}%`;
    queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  if (params.startDate) {
    conditions.push('created_at >= ?');
    queryParams.push(params.startDate);
  }

  if (params.endDate) {
    conditions.push('created_at <= ?');
    queryParams.push(params.endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total matching
  const [countResult]: any = await pool.query(
    `SELECT COUNT(*) as total FROM network_change_logs ${whereClause}`,
    queryParams
  );
  const total = countResult[0]?.total || 0;

  // Pagination
  const limit = Math.min(Math.max(params.limit || 50, 1), 200);
  const offset = Math.max(params.offset || 0, 0);

  const [rows]: any = await pool.query(
    `SELECT * FROM network_change_logs ${whereClause} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...queryParams, limit, offset]
  );

  // Normalize documentation_images to parsed array
  const formattedRows = rows.map((row: any) => {
    let images: string[] = [];
    if (row.documentation_images) {
      try {
        images = typeof row.documentation_images === 'string' 
          ? JSON.parse(row.documentation_images) 
          : row.documentation_images;
      } catch {
        images = [];
      }
    }
    return {
      ...row,
      documentation_images: Array.isArray(images) ? images : [],
    };
  });

  // Calculate high-level summary
  const [statsResult]: any = await pool.query(`
    SELECT 
      COUNT(*) as total_logs,
      SUM(CASE WHEN device_type = 'mikrotik' THEN 1 ELSE 0 END) as mikrotik_count,
      SUM(CASE WHEN device_type = 'olt' THEN 1 ELSE 0 END) as olt_count,
      SUM(CASE WHEN device_type = 'onu' THEN 1 ELSE 0 END) as onu_count,
      SUM(CASE WHEN device_type = 'switch' THEN 1 ELSE 0 END) as switch_count,
      SUM(duration_minutes) as total_duration_minutes,
      ROUND(AVG(duration_minutes), 1) as avg_duration_minutes
    FROM network_change_logs
  `);

  const [activeMaintResult]: any = await pool.query(`
    SELECT COUNT(*) as active_windows
    FROM network_maintenance_windows
    WHERE is_active = 1 AND NOW() BETWEEN scheduled_start AND scheduled_end
  `);

  return {
    logs: formattedRows,
    total,
    stats: {
      ...statsResult[0],
      active_maintenance: activeMaintResult[0]?.active_windows || 0
    }
  };
}

/**
 * Create a new change log record
 */
export async function createChangeLog(data: ChangeLogItem) {
  let duration = data.duration_minutes || 0;

  // Auto calculate duration if start and end are provided
  if ((!duration || duration <= 0) && data.execution_start && data.execution_end) {
    const startMs = new Date(data.execution_start).getTime();
    const endMs = new Date(data.execution_end).getTime();
    if (!isNaN(startMs) && !isNaN(endMs) && endMs >= startMs) {
      duration = Math.round((endMs - startMs) / 60000);
    }
  }

  // Ensure documentation_images is stored as valid JSON string
  let imagesJson = '[]';
  if (data.documentation_images) {
    if (Array.isArray(data.documentation_images)) {
      imagesJson = JSON.stringify(data.documentation_images);
    } else if (typeof data.documentation_images === 'string') {
      try {
        JSON.parse(data.documentation_images);
        imagesJson = data.documentation_images;
      } catch {
        imagesJson = JSON.stringify([data.documentation_images]);
      }
    }
  }

  const [result]: any = await pool.query(
    `INSERT INTO network_change_logs 
    (device_type, category, target_name, action_title, details, before_state, after_state, impact_level, pic_name, execution_start, execution_end, duration_minutes, documentation_images, mission_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.device_type || 'mikrotik',
      data.category,
      data.target_name,
      data.action_title,
      data.details || null,
      data.before_state || null,
      data.after_state || null,
      data.impact_level || 'low',
      data.pic_name,
      data.execution_start ? new Date(data.execution_start) : null,
      data.execution_end ? new Date(data.execution_end) : null,
      duration,
      imagesJson,
      data.mission_id || null,
    ]
  );

  return { id: result.insertId, ...data, duration_minutes: duration };
}

/**
 * Delete a change log record
 */
export async function deleteChangeLog(id: number) {
  const [result]: any = await pool.query('DELETE FROM network_change_logs WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

/**
 * Get maintenance windows (with live status)
 */
export async function getMaintenanceWindows(onlyActive: boolean = false) {
  const where = onlyActive ? 'WHERE is_active = 1' : '';
  const [rows]: any = await pool.query(
    `SELECT *,
      CASE 
        WHEN is_active = 1 AND NOW() BETWEEN scheduled_start AND scheduled_end THEN 'IN_PROGRESS'
        WHEN is_active = 1 AND NOW() < scheduled_start THEN 'SCHEDULED'
        WHEN is_active = 1 AND NOW() > scheduled_end THEN 'OVERDUE'
        ELSE 'COMPLETED'
      END as status_badge
    FROM network_maintenance_windows 
    ${where}
    ORDER BY scheduled_start DESC`
  );
  return rows;
}

/**
 * Start/Schedule a Maintenance Window
 */
export async function createMaintenanceWindow(data: MaintenanceWindowItem) {
  const [result]: any = await pool.query(
    `INSERT INTO network_maintenance_windows
    (device_type, target_id, target_name, reason, scheduled_start, scheduled_end, silence_alarms, created_by, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      data.device_type || 'all',
      data.target_id || null,
      data.target_name,
      data.reason,
      new Date(data.scheduled_start),
      new Date(data.scheduled_end),
      data.silence_alarms !== undefined ? (data.silence_alarms ? 1 : 0) : 1,
      data.created_by,
    ]
  );
  return { id: result.insertId, ...data, is_active: 1 };
}

/**
 * End a Maintenance Window early or on schedule
 */
export async function endMaintenanceWindow(id: number) {
  const [result]: any = await pool.query(
    `UPDATE network_maintenance_windows 
     SET is_active = 0, actual_end = NOW() 
     WHERE id = ?`,
    [id]
  );
  return result.affectedRows > 0;
}
