import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

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
