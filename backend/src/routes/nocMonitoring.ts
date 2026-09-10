import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { NocZabbixService } from '../services/nocZabbixService';
import { NocDiagnosticsService } from '../services/nocDiagnosticsService';
import { NocCampusService } from '../services/nocCampusService';

const router = Router();

// GET /api/monitoring/status - Zabbix connection check
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await NocZabbixService.isLiveZabbixConnected();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

// GET /api/monitoring/summary - KPI Cards & Global Overview
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const summary = await NocZabbixService.getSummaryKPI();
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch monitoring summary: ' + err.message });
  }
});

// GET /api/monitoring/devices - Multi-device matrix (Mikrotik, OLT, AP, ONT)
router.get('/devices', async (req: Request, res: Response) => {
  try {
    const devices = await NocZabbixService.getDevices();
    const category = req.query.category as string | undefined;
    if (category && ['mikrotik', 'olt', 'ap', 'ont'].includes(category)) {
      return res.json(devices.filter((d) => d.category === category));
    }
    res.json(devices);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch network devices: ' + err.message });
  }
});

// GET /api/monitoring/devices/:id/detail - Granular telemetry breakdown per device
router.get('/devices/:id/detail', async (req: Request, res: Response) => {
  try {
    const detail = await NocZabbixService.getDeviceDetail(req.params.id);
    res.json(detail);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch device detail: ' + err.message });
  }
});

// GET /api/monitoring/devices/:id/interfaces/:ifaceName/history - Real-time streaming history per interface/VLAN/PPPoE
router.get('/devices/:id/interfaces/:ifaceName/history', async (req: Request, res: Response) => {
  try {
    const { id, ifaceName } = req.params;
    const limit = parseInt(req.query.limit as string, 10) || 30;
    const history = await NocZabbixService.getInterfaceLiveHistory(id, decodeURIComponent(ifaceName), limit);
    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch interface history: ' + err.message });
  }
});

// GET /api/monitoring/bandwidth - Real-time traffic, gauges, time-series & top interfaces
router.get('/bandwidth', async (req: Request, res: Response) => {
  try {
    const bandwidth = await NocZabbixService.getBandwidthSummary();
    res.json(bandwidth);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch bandwidth metrics: ' + err.message });
  }
});

// GET /api/monitoring/problems - Active problem incidents from Zabbix
router.get('/problems', async (req: Request, res: Response) => {
  try {
    const problems = await NocZabbixService.getActiveProblems();
    res.json(problems);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch active problems: ' + err.message });
  }
});

// POST /api/monitoring/problems/:id/ack - Acknowledge problem to Zabbix
router.post('/problems/:id/ack', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { technicianName, note } = req.body;

    if (!technicianName || !note) {
      return res.status(400).json({ error: 'technicianName and note are required' });
    }

    const success = await NocZabbixService.acknowledgeProblem(id, technicianName, note);
    if (success) {
      return res.json({ success: true, message: 'Problem acknowledged successfully' });
    }
    res.status(500).json({ success: false, error: 'Failed to acknowledge in Zabbix' });
  } catch (err: any) {
    res.status(500).json({ error: 'Acknowledge error: ' + err.message });
  }
});

// POST /api/monitoring/test-connection - Test Zabbix API Credentials
router.post('/test-connection', async (req: Request, res: Response) => {
  try {
    const status = await NocZabbixService.isLiveZabbixConnected();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

// ==========================================
// NETWORK DIAGNOSTICS & TESTING SUITE
// ==========================================

// POST /api/monitoring/diagnostics/ping
router.post('/diagnostics/ping', async (req: Request, res: Response) => {
  try {
    const { target, count, packetSize, deviceId } = req.body;
    if (!target) {
      return res.status(400).json({ error: 'Target IP or Hostname is required' });
    }
    const result = await NocDiagnosticsService.runPing(
      target,
      count ? Number(count) : 5,
      packetSize ? Number(packetSize) : 56,
      deviceId
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Ping execution failed: ' + err.message });
  }
});

// POST /api/monitoring/diagnostics/traceroute
router.post('/diagnostics/traceroute', async (req: Request, res: Response) => {
  try {
    const { target, maxHops } = req.body;
    if (!target) {
      return res.status(400).json({ error: 'Target IP or Hostname is required' });
    }
    const result = await NocDiagnosticsService.runTraceroute(
      target,
      maxHops ? Number(maxHops) : 12
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Traceroute execution failed: ' + err.message });
  }
});

// POST /api/monitoring/diagnostics/btest
router.post('/diagnostics/btest', async (req: Request, res: Response) => {
  try {
    const { targetIp, direction, durationSec, protocol } = req.body;
    if (!targetIp) {
      return res.status(400).json({ error: 'Target IP is required' });
    }
    const result = await NocDiagnosticsService.runBandwidthTest(
      targetIp,
      direction || 'both',
      durationSec ? Number(durationSec) : 6,
      protocol || 'udp'
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Bandwidth test failed: ' + err.message });
  }
});

// POST /api/monitoring/diagnostics/port-check
router.post('/diagnostics/port-check', async (req: Request, res: Response) => {
  try {
    const { target, ports } = req.body;
    if (!target) {
      return res.status(400).json({ error: 'Target IP or Hostname is required' });
    }
    const result = await NocDiagnosticsService.runPortCheck(target, ports);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Port check failed: ' + err.message });
  }
});

// ==========================================
// CAMPUS MULTI-BUILDING INFRASTRUCTURE
// ==========================================

// GET /api/monitoring/campus/buildings - Get all buildings with floors and APs
router.get('/campus/buildings', async (req: Request, res: Response) => {
  try {
    const buildings = await NocCampusService.getCampusBuildings();
    res.json(buildings);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch campus buildings: ' + err.message });
  }
});

// POST /api/monitoring/campus/buildings - Create new building
router.post('/campus/buildings', async (req: Request, res: Response) => {
  try {
    const id = await NocCampusService.createBuilding(req.body);
    res.json({ success: true, id, message: 'Building created successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create building: ' + err.message });
  }
});

// PUT /api/monitoring/campus/buildings-layout - Batch update building coordinates from drag and drop
router.put('/campus/buildings-layout', async (req: Request, res: Response) => {
  try {
    const { positions } = req.body;
    if (!Array.isArray(positions)) {
      return res.status(400).json({ error: 'Positions must be an array of { id, x, y }' });
    }
    await NocCampusService.updateBuildingPositions(positions);
    res.json({ success: true, message: 'Campus layout positions saved successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update campus layout: ' + err.message });
  }
});

// PUT /api/monitoring/campus/buildings/:id - Update building
router.put('/campus/buildings/:id', async (req: Request, res: Response) => {
  try {
    const success = await NocCampusService.updateBuilding(req.params.id, req.body);
    res.json({ success, message: 'Building updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update building: ' + err.message });
  }
});

// DELETE /api/monitoring/campus/buildings/:id - Delete building
router.delete('/campus/buildings/:id', async (req: Request, res: Response) => {
  try {
    const success = await NocCampusService.deleteBuilding(req.params.id);
    res.json({ success, message: 'Building deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete building: ' + err.message });
  }
});

// POST /api/monitoring/campus/buildings/:id/floors - Add floor
router.post('/campus/buildings/:id/floors', async (req: Request, res: Response) => {
  try {
    const floorId = await NocCampusService.addFloor(req.params.id, req.body);
    res.json({ success: true, floorId, message: 'Floor added successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to add floor: ' + err.message });
  }
});

// PUT /api/monitoring/campus/floors/:floorId - Update floor
router.put('/campus/floors/:floorId', async (req: Request, res: Response) => {
  try {
    const success = await NocCampusService.updateFloor(Number(req.params.floorId), req.body);
    res.json({ success, message: 'Floor updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update floor: ' + err.message });
  }
});

// DELETE /api/monitoring/campus/floors/:floorId - Delete floor
router.delete('/campus/floors/:floorId', async (req: Request, res: Response) => {
  try {
    const success = await NocCampusService.deleteFloor(Number(req.params.floorId));
    res.json({ success, message: 'Floor deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete floor: ' + err.message });
  }
});

// POST /api/monitoring/campus/floors/:floorId/aps - Add AP
router.post('/campus/floors/:floorId/aps', async (req: Request, res: Response) => {
  try {
    const { buildingId, name, ip, channel, band, clientsCount, status } = req.body;
    const apId = await NocCampusService.addAccessPoint(Number(req.params.floorId), buildingId, {
      name,
      ip,
      channel,
      band,
      clientsCount,
      status,
    });
    res.json({ success: true, apId, message: 'Access point added successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to add access point: ' + err.message });
  }
});

// DELETE /api/monitoring/campus/aps/:apId - Delete AP
router.delete('/campus/aps/:apId', async (req: Request, res: Response) => {
  try {
    const success = await NocCampusService.deleteAccessPoint(Number(req.params.apId));
    res.json({ success, message: 'Access point deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete access point: ' + err.message });
  }
});

// GET /api/monitoring/campus/fiber-links - Get fiber links
router.get('/campus/fiber-links', async (req: Request, res: Response) => {
  try {
    const links = await NocCampusService.getFiberLinks();
    res.json(links);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch fiber links: ' + err.message });
  }
});

// POST /api/monitoring/campus/fiber-links - Save fiber link
router.post('/campus/fiber-links', async (req: Request, res: Response) => {
  try {
    const { fromBuildingId, toBuildingId, speed, status } = req.body;
    const linkId = await NocCampusService.saveFiberLink(fromBuildingId, toBuildingId, speed, status);
    res.json({ success: true, linkId, message: 'Fiber link saved successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save fiber link: ' + err.message });
  }
});

// POST /api/monitoring/telegram/test-alert - Send test alarm to Telegram
router.post('/telegram/test-alert', async (req: Request, res: Response) => {
  try {
    const { sendNocProblemAlert } = await import('../telegram');
    await sendNocProblemAlert({
      eventId: 'TEST-' + Date.now().toString().slice(-4),
      name: 'UJI COBA NOTIFIKASI: Link Backbone FO Rektorat Flapping',
      severity: 4,
      severityLabel: 'High',
      deviceName: 'Router Mikrotik UNTAG',
      deviceIp: '103.92.209.1',
    });
    res.json({ success: true, message: 'Test alert sent to Telegram successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to send test alert: ' + err.message });
  }
});

// POST /api/monitoring/telegram/broadcast-digest - Broadcast Daily Digest
router.post('/telegram/broadcast-digest', async (req: Request, res: Response) => {
  try {
    const { sendDailyDigestReport } = await import('../telegram');
    await sendDailyDigestReport();
    res.json({ success: true, message: 'Daily digest report sent successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to send digest report: ' + err.message });
  }
});

// GET /api/monitoring/telegram/status - Telegram Bot Status & Linked Users
router.get('/telegram/status', async (req: Request, res: Response) => {
  try {
    const { getTelegramConfig } = await import('../telegram');
    const cfg = await getTelegramConfig();
    const [users]: any = await pool.query('SELECT id, name, username, role, telegram_chat_id FROM users WHERE telegram_chat_id IS NOT NULL');
    res.json({
      isConfigured: !!cfg.token,
      botTokenSet: !!cfg.token,
      defaultChatId: cfg.chatId || null,
      linkedPersonnelCount: users.length,
      linkedPersonnel: users,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get telegram status: ' + err.message });
  }
});

export default router;
