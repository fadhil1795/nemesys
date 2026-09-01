import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

// ==========================================
// 1. Operational Incidents API
// ==========================================
router.get('/incidents', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query('SELECT * FROM operational_incidents ORDER BY id DESC');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching operational incidents:', error);
    res.status(500).json({ error: 'Failed to fetch operational incidents' });
  }
});

router.post('/incidents', async (req: Request, res: Response) => {
  try {
    const {
      incident_date,
      report_time,
      resolved_time,
      affected_system,
      severity,
      description,
      impact,
      root_cause,
      action_taken,
      handled_by,
      status,
      notes
    } = req.body;

    const [result]: any = await pool.query(
      `INSERT INTO operational_incidents 
       (incident_date, report_time, resolved_time, affected_system, severity, description, impact, root_cause, action_taken, handled_by, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        incident_date || new Date().toISOString().split('T')[0],
        report_time || '08:00',
        resolved_time || null,
        affected_system || 'Network System',
        severity || 'Medium',
        description || '',
        impact || null,
        root_cause || null,
        action_taken || null,
        handled_by || 'Admin',
        status || 'In Progress',
        notes || null
      ]
    );

    res.json({ success: true, id: result.insertId, message: 'Incident report created successfully' });
  } catch (error) {
    console.error('Error creating operational incident:', error);
    res.status(500).json({ error: 'Failed to create operational incident' });
  }
});

router.put('/incidents/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      incident_date,
      report_time,
      resolved_time,
      affected_system,
      severity,
      description,
      impact,
      root_cause,
      action_taken,
      handled_by,
      status,
      notes
    } = req.body;

    await pool.query(
      `UPDATE operational_incidents SET
       incident_date = ?, report_time = ?, resolved_time = ?, affected_system = ?, severity = ?,
       description = ?, impact = ?, root_cause = ?, action_taken = ?, handled_by = ?, status = ?, notes = ?
       WHERE id = ?`,
      [
        incident_date, report_time, resolved_time, affected_system, severity,
        description, impact, root_cause, action_taken, handled_by, status, notes, id
      ]
    );

    res.json({ success: true, message: 'Incident updated successfully' });
  } catch (error) {
    console.error('Error updating operational incident:', error);
    res.status(500).json({ error: 'Failed to update operational incident' });
  }
});

router.delete('/incidents/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM operational_incidents WHERE id = ?', [id]);
    res.json({ success: true, message: 'Incident deleted successfully' });
  } catch (error) {
    console.error('Error deleting operational incident:', error);
    res.status(500).json({ error: 'Failed to delete operational incident' });
  }
});

// ==========================================
// 2. Change Requests API
// ==========================================
router.get('/change-requests', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query('SELECT * FROM operational_change_requests ORDER BY id DESC');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching change requests:', error);
    res.status(500).json({ error: 'Failed to fetch change requests' });
  }
});

router.post('/change-requests', async (req: Request, res: Response) => {
  try {
    const {
      request_date,
      cr_code,
      description,
      reason,
      affected_devices,
      requested_by,
      approved_by,
      implementation_schedule,
      rollback_plan,
      status,
      notes
    } = req.body;

    const [result]: any = await pool.query(
      `INSERT INTO operational_change_requests
       (request_date, cr_code, description, reason, affected_devices, requested_by, approved_by, implementation_schedule, rollback_plan, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        request_date || new Date().toISOString().split('T')[0],
        cr_code || `CR-${Date.now().toString().slice(-4)}`,
        description || '',
        reason || '',
        affected_devices || '-',
        requested_by || 'Teknisi',
        approved_by || 'Administrator',
        implementation_schedule || null,
        rollback_plan || null,
        status || 'Diajukan',
        notes || null
      ]
    );

    res.json({ success: true, id: result.insertId, message: 'Change request created successfully' });
  } catch (error) {
    console.error('Error creating change request:', error);
    res.status(500).json({ error: 'Failed to create change request' });
  }
});

router.put('/change-requests/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      request_date,
      cr_code,
      description,
      reason,
      affected_devices,
      requested_by,
      approved_by,
      implementation_schedule,
      rollback_plan,
      status,
      notes
    } = req.body;

    await pool.query(
      `UPDATE operational_change_requests SET
       request_date = ?, cr_code = ?, description = ?, reason = ?, affected_devices = ?,
       requested_by = ?, approved_by = ?, implementation_schedule = ?, rollback_plan = ?, status = ?, notes = ?
       WHERE id = ?`,
      [
        request_date, cr_code, description, reason, affected_devices,
        requested_by, approved_by, implementation_schedule, rollback_plan, status, notes, id
      ]
    );

    res.json({ success: true, message: 'Change request updated successfully' });
  } catch (error) {
    console.error('Error updating change request:', error);
    res.status(500).json({ error: 'Failed to update change request' });
  }
});

router.delete('/change-requests/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM operational_change_requests WHERE id = ?', [id]);
    res.json({ success: true, message: 'Change request deleted successfully' });
  } catch (error) {
    console.error('Error deleting change request:', error);
    res.status(500).json({ error: 'Failed to delete change request' });
  }
});

// ==========================================
// 3. IT Procurements API
// ==========================================
router.get('/procurements', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query('SELECT * FROM operational_procurements ORDER BY id DESC');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching procurements:', error);
    res.status(500).json({ error: 'Failed to fetch procurements' });
  }
});

router.post('/procurements', async (req: Request, res: Response) => {
  try {
    const {
      item_name,
      category,
      sub_category,
      location,
      brand,
      color,
      unit_price,
      quantity,
      unit_name,
      acquisition_date,
      lifespan,
      notes
    } = req.body;

    const [result]: any = await pool.query(
      `INSERT INTO operational_procurements
       (item_name, category, sub_category, location, brand, color, unit_price, quantity, unit_name, acquisition_date, lifespan, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item_name,
        category || 'Elektronik',
        sub_category || null,
        location || 'UNTAG',
        brand || null,
        color || null,
        unit_price || 0,
        quantity || 1,
        unit_name || 'Pcs',
        acquisition_date || null,
        lifespan || '-',
        notes || null
      ]
    );

    res.json({ success: true, id: result.insertId, message: 'Procurement item created successfully' });
  } catch (error) {
    console.error('Error creating procurement item:', error);
    res.status(500).json({ error: 'Failed to create procurement item' });
  }
});

router.put('/procurements/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      item_name,
      category,
      sub_category,
      location,
      brand,
      color,
      unit_price,
      quantity,
      unit_name,
      acquisition_date,
      lifespan,
      notes
    } = req.body;

    await pool.query(
      `UPDATE operational_procurements SET
       item_name = ?, category = ?, sub_category = ?, location = ?, brand = ?, color = ?,
       unit_price = ?, quantity = ?, unit_name = ?, acquisition_date = ?, lifespan = ?, notes = ?
       WHERE id = ?`,
      [
        item_name, category, sub_category, location, brand, color,
        unit_price, quantity, unit_name, acquisition_date, lifespan, notes, id
      ]
    );

    res.json({ success: true, message: 'Procurement item updated successfully' });
  } catch (error) {
    console.error('Error updating procurement item:', error);
    res.status(500).json({ error: 'Failed to update procurement item' });
  }
});

router.delete('/procurements/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM operational_procurements WHERE id = ?', [id]);
    res.json({ success: true, message: 'Procurement item deleted successfully' });
  } catch (error) {
    console.error('Error deleting procurement item:', error);
    res.status(500).json({ error: 'Failed to delete procurement item' });
  }
});

// ==========================================
// 4. Backup Logs API
// ==========================================
router.get('/backup-logs', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query('SELECT * FROM operational_backup_logs ORDER BY id DESC');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching backup logs:', error);
    res.status(500).json({ error: 'Failed to fetch backup logs' });
  }
});

router.post('/backup-logs', async (req: Request, res: Response) => {
  try {
    const {
      backup_date,
      device_name,
      backup_type,
      storage_location,
      file_size,
      performed_by,
      verification_status,
      notes
    } = req.body;

    const [result]: any = await pool.query(
      `INSERT INTO operational_backup_logs
       (backup_date, device_name, backup_type, storage_location, file_size, performed_by, verification_status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        backup_date || new Date().toISOString().split('T')[0],
        device_name,
        backup_type || 'Full',
        storage_location || null,
        file_size || null,
        performed_by || 'Fadhil',
        verification_status || 'Berhasil',
        notes || null
      ]
    );

    res.json({ success: true, id: result.insertId, message: 'Backup log recorded successfully' });
  } catch (error) {
    console.error('Error creating backup log:', error);
    res.status(500).json({ error: 'Failed to create backup log' });
  }
});

router.put('/backup-logs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      backup_date,
      device_name,
      backup_type,
      storage_location,
      file_size,
      performed_by,
      verification_status,
      notes
    } = req.body;

    await pool.query(
      `UPDATE operational_backup_logs SET
       backup_date = ?, device_name = ?, backup_type = ?, storage_location = ?,
       file_size = ?, performed_by = ?, verification_status = ?, notes = ?
       WHERE id = ?`,
      [backup_date, device_name, backup_type, storage_location, file_size, performed_by, verification_status, notes, id]
    );

    res.json({ success: true, message: 'Backup log updated successfully' });
  } catch (error) {
    console.error('Error updating backup log:', error);
    res.status(500).json({ error: 'Failed to update backup log' });
  }
});

router.delete('/backup-logs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM operational_backup_logs WHERE id = ?', [id]);
    res.json({ success: true, message: 'Backup log deleted successfully' });
  } catch (error) {
    console.error('Error deleting backup log:', error);
    res.status(500).json({ error: 'Failed to delete backup log' });
  }
});

// ==========================================
// 5. Access Control Logs API
// ==========================================
router.get('/access-logs', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query('SELECT * FROM operational_access_logs ORDER BY id DESC');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching access control logs:', error);
    res.status(500).json({ error: 'Failed to fetch access control logs' });
  }
});

router.post('/access-logs', async (req: Request, res: Response) => {
  try {
    const {
      access_date,
      access_time,
      accessor_name,
      target_device,
      purpose,
      access_method,
      approved_by,
      end_time,
      notes
    } = req.body;

    const [result]: any = await pool.query(
      `INSERT INTO operational_access_logs
       (access_date, access_time, accessor_name, target_device, purpose, access_method, approved_by, end_time, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        access_date || new Date().toISOString().split('T')[0],
        access_time || '08:00:00',
        accessor_name || 'Teknisi',
        target_device,
        purpose || 'Maintenance',
        access_method || 'Web/GUI',
        approved_by || 'Administrator',
        end_time || null,
        notes || null
      ]
    );

    res.json({ success: true, id: result.insertId, message: 'Access log recorded successfully' });
  } catch (error) {
    console.error('Error creating access log:', error);
    res.status(500).json({ error: 'Failed to create access log' });
  }
});

router.put('/access-logs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      access_date,
      access_time,
      accessor_name,
      target_device,
      purpose,
      access_method,
      approved_by,
      end_time,
      notes
    } = req.body;

    await pool.query(
      `UPDATE operational_access_logs SET
       access_date = ?, access_time = ?, accessor_name = ?, target_device = ?,
       purpose = ?, access_method = ?, approved_by = ?, end_time = ?, notes = ?
       WHERE id = ?`,
      [access_date, access_time, accessor_name, target_device, purpose, access_method, approved_by, end_time, notes, id]
    );

    res.json({ success: true, message: 'Access log updated successfully' });
  } catch (error) {
    console.error('Error updating access log:', error);
    res.status(500).json({ error: 'Failed to update access log' });
  }
});

router.delete('/access-logs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM operational_access_logs WHERE id = ?', [id]);
    res.json({ success: true, message: 'Access log deleted successfully' });
  } catch (error) {
    console.error('Error deleting access log:', error);
    res.status(500).json({ error: 'Failed to delete access log' });
  }
});

// ==========================================
// 6. Daily Checklists API
// ==========================================
router.get('/daily-checklists', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query('SELECT * FROM operational_daily_checklists ORDER BY id ASC');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching daily checklists:', error);
    res.status(500).json({ error: 'Failed to fetch daily checklists' });
  }
});

router.post('/daily-checklists', async (req: Request, res: Response) => {
  try {
    const { inspection_item, is_completed, inspected_by, inspection_time, notes } = req.body;

    const [result]: any = await pool.query(
      `INSERT INTO operational_daily_checklists
       (inspection_item, is_completed, inspected_by, inspection_time, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [inspection_item, is_completed ? 1 : 0, inspected_by || 'Teknisi', inspection_time || new Date().toISOString().split('T')[0], notes || null]
    );

    res.json({ success: true, id: result.insertId, message: 'Daily checklist item created' });
  } catch (error) {
    console.error('Error creating daily checklist item:', error);
    res.status(500).json({ error: 'Failed to create daily checklist item' });
  }
});

router.put('/daily-checklists/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { inspection_item, is_completed, inspected_by, inspection_time, notes } = req.body;

    await pool.query(
      `UPDATE operational_daily_checklists SET
       inspection_item = ?, is_completed = ?, inspected_by = ?, inspection_time = ?, notes = ?
       WHERE id = ?`,
      [inspection_item, is_completed ? 1 : 0, inspected_by, inspection_time, notes, id]
    );

    res.json({ success: true, message: 'Daily checklist updated' });
  } catch (error) {
    console.error('Error updating daily checklist:', error);
    res.status(500).json({ error: 'Failed to update daily checklist' });
  }
});

router.delete('/daily-checklists/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM operational_daily_checklists WHERE id = ?', [id]);
    res.json({ success: true, message: 'Daily checklist deleted' });
  } catch (error) {
    console.error('Error deleting daily checklist:', error);
    res.status(500).json({ error: 'Failed to delete daily checklist' });
  }
});

// Escalate Incident to NEMESYS Open Ticket
router.post('/incidents/:id/escalate-ticket', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [rows]: any = await pool.query('SELECT * FROM operational_incidents WHERE id = ?', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    const inc = rows[0];
    const ticketNum = `TK-OPS-${Math.floor(1000 + Math.random() * 9000)}`;

    const [tResult]: any = await pool.query(
      `INSERT INTO open_tickets 
       (ticket_number, full_name, id_number, category, unit_specification, email, whatsapp_number, service_type, description, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Open', NOW(), NOW())`,
      [
        ticketNum,
        inc.handled_by || 'Teknisi Network',
        `INC-${inc.id}`,
        'Jaringan / Internet',
        inc.affected_system || 'Core Device',
        'network.admin@untag-bwy.ac.id',
        '08123456789',
        'Penanganan Insiden Ops',
        `[Eskalasi Insiden Operasional] ${inc.description}. Dampak: ${inc.impact || '-'} | Root Cause: ${inc.root_cause || '-'}`
      ]
    );

    await pool.query('UPDATE operational_incidents SET ticket_id = ?, status = "In Progress" WHERE id = ?', [tResult.insertId, id]);

    res.json({ success: true, ticket_number: ticketNum, ticket_id: tResult.insertId, message: 'Incident escalated to NEMESYS Open Ticket successfully' });
  } catch (error) {
    console.error('Error escalating incident to ticket:', error);
    res.status(500).json({ error: 'Failed to escalate incident to ticket' });
  }
});

// Quick Approve / Reject Change Request
router.post('/change-requests/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { approved_by } = req.body;
    await pool.query('UPDATE operational_change_requests SET status = "Disetujui", approved_by = ? WHERE id = ?', [approved_by || 'Administrator', id]);
    res.json({ success: true, message: 'Change Request approved successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve Change Request' });
  }
});

router.post('/change-requests/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE operational_change_requests SET status = "Ditolak" WHERE id = ?', [id]);
    res.json({ success: true, message: 'Change Request rejected successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reject Change Request' });
  }
});

// ==========================================
// 7. Monitoring Reports API (Tab 7)
// ==========================================
router.get('/monitoring-reports', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query('SELECT * FROM operational_monitoring_reports ORDER BY id ASC');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching monitoring reports:', error);
    res.status(500).json({ error: 'Failed to fetch monitoring reports' });
  }
});

router.post('/monitoring-reports', async (req: Request, res: Response) => {
  try {
    const { report_date, device_name, uptime_pct, bandwidth_util, cpu_pct, memory_pct, latency_ms, packet_loss_pct, status, notes } = req.body;
    const [result]: any = await pool.query(
      `INSERT INTO operational_monitoring_reports
       (report_date, device_name, uptime_pct, bandwidth_util, cpu_pct, memory_pct, latency_ms, packet_loss_pct, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [report_date || new Date().toISOString().split('T')[0], device_name, uptime_pct || null, bandwidth_util || null, cpu_pct || null, memory_pct || null, latency_ms || null, packet_loss_pct || null, status || 'Normal', notes || null]
    );
    res.json({ success: true, id: result.insertId, message: 'Monitoring report created' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create monitoring report' });
  }
});

router.put('/monitoring-reports/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { report_date, device_name, uptime_pct, bandwidth_util, cpu_pct, memory_pct, latency_ms, packet_loss_pct, status, notes } = req.body;
    await pool.query(
      `UPDATE operational_monitoring_reports SET
       report_date = ?, device_name = ?, uptime_pct = ?, bandwidth_util = ?, cpu_pct = ?,
       memory_pct = ?, latency_ms = ?, packet_loss_pct = ?, status = ?, notes = ?
       WHERE id = ?`,
      [report_date, device_name, uptime_pct, bandwidth_util, cpu_pct, memory_pct, latency_ms, packet_loss_pct, status, notes, id]
    );
    res.json({ success: true, message: 'Monitoring report updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update monitoring report' });
  }
});

router.delete('/monitoring-reports/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM operational_monitoring_reports WHERE id = ?', [id]);
    res.json({ success: true, message: 'Monitoring report deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete monitoring report' });
  }
});

// ==========================================
// 8. Operations Summary & Analytics API
// ==========================================
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const [[{ count: totalIncidents }]]: any = await pool.query('SELECT COUNT(*) as count FROM operational_incidents');
    const [[{ count: openIncidents }]]: any = await pool.query('SELECT COUNT(*) as count FROM operational_incidents WHERE status IN ("Open", "In Progress")');
    const [[{ count: totalCRs }]]: any = await pool.query('SELECT COUNT(*) as count FROM operational_change_requests');
    const [[{ count: pendingCRs }]]: any = await pool.query('SELECT COUNT(*) as count FROM operational_change_requests WHERE status = "Diajukan"');
    const [[{ total_cost }]]: any = await pool.query('SELECT SUM(unit_price * quantity) as total_cost FROM operational_procurements');
    const [[{ count: totalProcurements }]]: any = await pool.query('SELECT COUNT(*) as count FROM operational_procurements');
    const [[{ count: totalBackups }]]: any = await pool.query('SELECT COUNT(*) as count FROM operational_backup_logs');
    const [[{ count: totalAccessLogs }]]: any = await pool.query('SELECT COUNT(*) as count FROM operational_access_logs');
    const [[{ count: completedChecklists }]]: any = await pool.query('SELECT COUNT(*) as count FROM operational_daily_checklists WHERE is_completed = 1');
    const [[{ count: totalChecklists }]]: any = await pool.query('SELECT COUNT(*) as count FROM operational_daily_checklists');
    const [[{ count: totalMonitors }]]: any = await pool.query('SELECT COUNT(*) as count FROM operational_monitoring_reports');
    const [[{ count: warningMonitors }]]: any = await pool.query('SELECT COUNT(*) as count FROM operational_monitoring_reports WHERE status IN ("Warning", "Critical")');

    res.json({
      totalIncidents,
      openIncidents,
      totalCRs,
      pendingCRs,
      totalProcurementCost: total_cost || 0,
      totalProcurements,
      totalBackups,
      totalAccessLogs,
      completedChecklists,
      totalChecklists,
      totalMonitors,
      warningMonitors
    });
  } catch (error) {
    console.error('Error fetching operational summary:', error);
    res.status(500).json({ error: 'Failed to fetch operational summary' });
  }
});

export default router;
