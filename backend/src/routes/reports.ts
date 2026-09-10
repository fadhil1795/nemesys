import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { NocSlaService, SlaFilterParams } from '../services/nocSlaService';

const router = Router();

// ==========================================
// SLA & Downtime Reporting APIs
// ==========================================

// Get SLA Summary Report JSON
router.get('/sla-summary', async (req: Request, res: Response) => {
  try {
    const { period, startDate, endDate, scope } = req.query;
    const filterParams: SlaFilterParams = {
      period: period as any,
      startDate: startDate as string,
      endDate: endDate as string,
      scope: scope as any,
    };

    const report = await NocSlaService.getSlaReport(filterParams);
    res.json(report);
  } catch (error) {
    console.error('Error generating SLA summary report:', error);
    res.status(500).json({ error: 'Failed to generate SLA summary report' });
  }
});

// Export SLA Report as Multi-sheet Native Excel (.xlsx)
router.get('/sla-export-excel', async (req: Request, res: Response) => {
  try {
    const { period, startDate, endDate, scope } = req.query;
    const filterParams: SlaFilterParams = {
      period: period as any,
      startDate: startDate as string,
      endDate: endDate as string,
      scope: scope as any,
    };

    const report = await NocSlaService.getSlaReport(filterParams);
    const excelXml = NocSlaService.generateExcelXml(report);

    const filename = `Laporan_SLA_NOC_UNTAG_${report.periodLabel.replace(/\s+/g, '_')}.xls`;
    
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(excelXml);
  } catch (error) {
    console.error('Error exporting SLA Excel report:', error);
    res.status(500).json({ error: 'Failed to export SLA Excel report' });
  }
});

// Create/Log New SLA Downtime Incident
router.post('/sla-incident', async (req: Request, res: Response) => {
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
      sla_limit_minutes,
      sla_breached,
    } = req.body;

    const [result]: any = await pool.query(
      `INSERT INTO operational_incidents 
      (incident_date, report_time, resolved_time, affected_system, severity, description, impact, root_cause, action_taken, handled_by, status, sla_limit_minutes, sla_breached)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        incident_date || new Date().toISOString().split('T')[0],
        report_time || '08:00',
        resolved_time || null,
        affected_system || 'General Backbone',
        severity || 'Medium',
        description || '',
        impact || '',
        root_cause || '',
        action_taken || '',
        handled_by || 'NOC Team',
        status || 'Resolved',
        sla_limit_minutes || 60,
        sla_breached ? 1 : 0,
      ]
    );

    res.status(201).json({ success: true, incidentId: result.insertId, message: 'Incident logged successfully' });
  } catch (error) {
    console.error('Error logging SLA incident:', error);
    res.status(500).json({ error: 'Failed to log SLA incident' });
  }
});

// Update/Edit SLA Downtime Incident
router.put('/sla-incident/:id', async (req: Request, res: Response) => {
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
      sla_limit_minutes,
      sla_breached,
    } = req.body;

    const numId = parseInt(id, 10);

    // Try updating existing row in operational_incidents
    const [result]: any = await pool.query(
      `UPDATE operational_incidents 
       SET incident_date = COALESCE(?, incident_date),
           report_time = COALESCE(?, report_time),
           resolved_time = ?,
           affected_system = COALESCE(?, affected_system),
           severity = COALESCE(?, severity),
           description = COALESCE(?, description),
           impact = COALESCE(?, impact),
           root_cause = COALESCE(?, root_cause),
           action_taken = COALESCE(?, action_taken),
           handled_by = COALESCE(?, handled_by),
           status = COALESCE(?, status),
           sla_limit_minutes = COALESCE(?, sla_limit_minutes),
           sla_breached = ?
       WHERE id = ?`,
      [
        incident_date,
        report_time,
        resolved_time || null,
        affected_system,
        severity,
        description,
        impact,
        root_cause,
        action_taken,
        handled_by,
        status || 'Resolved',
        sla_limit_minutes || 60,
        sla_breached ? 1 : 0,
        numId,
      ]
    );

    // If row wasn't found (e.g. synthetic live Zabbix/Task incident), persist as a real resolved record in operational_incidents
    if (result.affectedRows === 0) {
      await pool.query(
        `INSERT INTO operational_incidents 
        (incident_date, report_time, resolved_time, affected_system, severity, description, impact, root_cause, action_taken, handled_by, status, sla_limit_minutes, sla_breached)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          incident_date || new Date().toISOString().split('T')[0],
          report_time || '08:00',
          resolved_time || new Date().toTimeString().substring(0, 5),
          affected_system || 'General Device',
          severity || 'Medium',
          description || root_cause || '',
          impact || root_cause || '',
          root_cause || 'Gangguan Operasional',
          action_taken || 'Telah diperbaiki dan dipulihkan teknisi NOC',
          handled_by || 'Teknisi Nemesys',
          status || 'Resolved',
          sla_limit_minutes || 60,
          sla_breached ? 1 : 0,
        ]
      );
    }

    // Also if there's an open task associated with this device, resolve open task if status is set to Resolved
    if (status === 'Resolved' || status === 'Closed') {
      await pool.query(
        'UPDATE tasks SET status = "Completed" WHERE (device_name = ? OR title LIKE ?) AND status = "Open"',
        [affected_system, `%${affected_system}%`]
      ).catch(() => null);
    }

    res.json({ success: true, message: 'Incident updated and resolved successfully' });
  } catch (error) {
    console.error('Error updating SLA incident:', error);
    res.status(500).json({ error: 'Failed to update SLA incident' });
  }
});

// Delete SLA Downtime Incident
router.delete('/sla-incident/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const numId = parseInt(id, 10);

    await pool.query('DELETE FROM operational_incidents WHERE id = ?', [numId]);
    // Also cleanup any matching task if ID matches task ID
    await pool.query('DELETE FROM tasks WHERE id = ?', [numId]).catch(() => null);

    res.json({ success: true, message: 'Incident deleted successfully' });
  } catch (error) {
    console.error('Error deleting SLA incident:', error);
    res.status(500).json({ error: 'Failed to delete SLA incident' });
  }
});

// ==========================================
// Executive Report Summary API
// ==========================================
router.get('/executive-summary', async (req: Request, res: Response) => {
  try {
    const [[{ count: totalIncidents }]]: any = await pool.query('SELECT COUNT(*) as count FROM operational_incidents');
    const [[{ count: openIncidents }]]: any = await pool.query('SELECT COUNT(*) as count FROM operational_incidents WHERE status IN ("Open", "In Progress")');
    const [[{ count: resolvedIncidents }]]: any = await pool.query('SELECT COUNT(*) as count FROM operational_incidents WHERE status IN ("Resolved", "Closed")');
    const [[{ count: breachedSLA }]]: any = await pool.query('SELECT COUNT(*) as count FROM operational_incidents WHERE sla_breached = 1');
    
    const [[{ total_cost }]]: any = await pool.query('SELECT SUM(unit_price * quantity) as total_cost FROM operational_procurements');
    const [[{ count: totalProcurements }]]: any = await pool.query('SELECT COUNT(*) as count FROM operational_procurements');
    
    const [[{ count: verifiedBackups }]]: any = await pool.query('SELECT COUNT(*) as count FROM operational_backup_logs WHERE verification_status = "Berhasil"');
    const [[{ count: totalBackups }]]: any = await pool.query('SELECT COUNT(*) as count FROM operational_backup_logs');
    
    const [[{ count: completedTasks }]]: any = await pool.query('SELECT COUNT(*) as count FROM tasks WHERE status = "Completed"');
    const [[{ count: totalTasks }]]: any = await pool.query('SELECT COUNT(*) as count FROM tasks');
    
    const [incidentsBySeverity]: any = await pool.query('SELECT severity, COUNT(*) as count FROM operational_incidents GROUP BY severity');
    const [procurementsByLocation]: any = await pool.query('SELECT location, SUM(unit_price * quantity) as cost, COUNT(*) as items FROM operational_procurements GROUP BY location');
    const [topTechnicians]: any = await pool.query('SELECT name, daily_tasks_count, mission_completed FROM users ORDER BY daily_tasks_count DESC LIMIT 5');

    const backupSuccessRate = totalBackups > 0 ? Math.round((verifiedBackups / totalBackups) * 100) : 100;
    const taskResolutionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;

    res.json({
      timestamp: new Date().toISOString(),
      period: 'Monthly Summary (Agustus 2026)',
      incidents: {
        total: totalIncidents,
        open: openIncidents,
        resolved: resolvedIncidents,
        slaBreached: breachedSLA,
        bySeverity: incidentsBySeverity
      },
      procurement: {
        totalInvestment: total_cost || 0,
        totalItems: totalProcurements,
        byLocation: procurementsByLocation
      },
      backups: {
        total: totalBackups,
        verified: verifiedBackups,
        successRatePercent: backupSuccessRate
      },
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        completionRatePercent: taskResolutionRate
      },
      topTechnicians
    });
  } catch (error) {
    console.error('Error generating executive summary report:', error);
    res.status(500).json({ error: 'Failed to generate executive report' });
  }
});

// CSV Export Endpoint
router.get('/export-csv', async (req: Request, res: Response) => {
  try {
    const { type } = req.query; // 'incidents' | 'procurements' | 'backups' | 'checklists'

    let csvContent = '';
    let filename = `nemesys_report_${type || 'all'}.csv`;

    if (type === 'incidents' || !type) {
      const [incidents]: any = await pool.query('SELECT * FROM operational_incidents ORDER BY id DESC');
      csvContent += 'ID,Tanggal,Perangkat Terdampak,Severity,Status,Deskripsi,Dampak,Root Cause,Tindakan,Teknisi\n';
      for (const row of incidents) {
        csvContent += `"${row.id}","${row.incident_date}","${row.affected_system}","${row.severity}","${row.status}","${(row.description || '').replace(/"/g, '""')}","${(row.impact || '').replace(/"/g, '""')}","${(row.root_cause || '').replace(/"/g, '""')}","${(row.action_taken || '').replace(/"/g, '""')}","${row.handled_by}"\n`;
      }
    } else if (type === 'procurements') {
      const [procs]: any = await pool.query('SELECT * FROM operational_procurements ORDER BY id DESC');
      csvContent += 'ID,Nama Barang,Kategori,Lokasi,Merk,Harga Satuan,Jumlah,Total Biaya,Tanggal Perolehan\n';
      for (const row of procs) {
        const total = (row.unit_price || 0) * (row.quantity || 1);
        csvContent += `"${row.id}","${row.item_name}","${row.category}","${row.location}","${row.brand || '-'}","${row.unit_price}","${row.quantity}","${total}","${row.acquisition_date || '-'}"\n`;
      }
    } else if (type === 'backups') {
      const [backups]: any = await pool.query('SELECT * FROM operational_backup_logs ORDER BY id DESC');
      csvContent += 'ID,Tanggal,Perangkat,Jenis Backup,Lokasi Storage,Ukuran File,Pelaksana,Status Verifikasi\n';
      for (const row of backups) {
        csvContent += `"${row.id}","${row.backup_date}","${row.device_name}","${row.backup_type}","${row.storage_location || '-'}","${row.file_size || '-'}","${row.performed_by}","${row.verification_status}"\n`;
      }
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.status(200).send(csvContent);
  } catch (error) {
    console.error('Error exporting CSV report:', error);
    res.status(500).json({ error: 'Failed to export CSV report' });
  }
});

export default router;
