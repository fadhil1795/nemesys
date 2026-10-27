import { Router, Request, Response } from 'express';
import { CdataOltService } from '../services/cdataOltService';

export const cdataOltRouter = Router();

// GET /api/monitoring/cdata-olt/config - Get current OLT IP & SNMP community
cdataOltRouter.get('/config', async (req: Request, res: Response) => {
  try {
    const device = await CdataOltService.getOltDevice();
    res.json(device);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch OLT configuration: ' + err.message });
  }
});

// POST /api/monitoring/cdata-olt/config - Update OLT IP, community, port
cdataOltRouter.post('/config', async (req: Request, res: Response) => {
  try {
    const updated = await CdataOltService.updateOltConfig(req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update OLT configuration: ' + err.message });
  }
});

// GET /api/monitoring/cdata-olt/summary - KPI Cards & Optical Status
cdataOltRouter.get('/summary', async (req: Request, res: Response) => {
  try {
    const summary = await CdataOltService.getSummary();
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch OLT summary: ' + err.message });
  }
});

// GET /api/monitoring/cdata-olt/pons - All PON ports & DDM SFP metrics
cdataOltRouter.get('/pons', async (req: Request, res: Response) => {
  try {
    const pons = await CdataOltService.getPons();
    res.json(pons);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch PON ports: ' + err.message });
  }
});

// GET /api/monitoring/cdata-olt/onus - Filterable ONU table
cdataOltRouter.get('/onus', async (req: Request, res: Response) => {
  try {
    const portId = req.query.port_id ? parseInt(req.query.port_id as string, 10) : undefined;
    const status = req.query.status as any;
    const search = req.query.search as string | undefined;

    const onus = await CdataOltService.getOnus({ port_id: portId, status, search });
    res.json(onus);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch ONUs: ' + err.message });
  }
});

// GET /api/monitoring/cdata-olt/onus/:id - ONU Detail
cdataOltRouter.get('/onus/:id', async (req: Request, res: Response) => {
  try {
    const onu = await CdataOltService.getOnuById(parseInt(req.params.id, 10));
    if (!onu) return res.status(404).json({ error: 'ONU not found' });
    res.json(onu);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch ONU detail: ' + err.message });
  }
});

// GET /api/monitoring/cdata-olt/onus/:id/history - Optical History
cdataOltRouter.get('/onus/:id/history', async (req: Request, res: Response) => {
  try {
    const hours = req.query.hours ? parseInt(req.query.hours as string, 10) : 24;
    const history = await CdataOltService.getOpticalHistory(parseInt(req.params.id, 10), hours);
    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch optical history: ' + err.message });
  }
});

// GET /api/monitoring/cdata-olt/onus/:id/clients - Active MAC addresses behind ONU
cdataOltRouter.get('/onus/:id/clients', async (req: Request, res: Response) => {
  try {
    const clients = await CdataOltService.getOnuMacClients(parseInt(req.params.id, 10));
    res.json(clients);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch ONU clients: ' + err.message });
  }
});

// GET /api/monitoring/cdata-olt/mac-leases - Full MAC Information Table & MikroTik DHCP Leases
cdataOltRouter.get('/mac-leases', async (req: Request, res: Response) => {
  try {
    const onuId = req.query.onu_id ? parseInt(req.query.onu_id as string, 10) : undefined;
    const portId = req.query.port_id ? parseInt(req.query.port_id as string, 10) : undefined;
    const vlanId = req.query.vlan_id ? parseInt(req.query.vlan_id as string, 10) : undefined;
    const search = req.query.search as string | undefined;
    const live = req.query.live === 'true';

    if (live) {
      await CdataOltService.syncMacTableAndLeases();
    }

    const leases = await CdataOltService.getMacLeases({
      onu_id: onuId,
      port_id: portId,
      vlan_id: vlanId,
      search
    });

    res.json(leases);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch MAC leases: ' + err.message });
  }
});

// POST /api/monitoring/cdata-olt/mac-leases/sync - Force Live Sync from OLT + MikroTik
cdataOltRouter.post('/mac-leases/sync', async (req: Request, res: Response) => {
  try {
    const result = await CdataOltService.syncMacTableAndLeases();
    const io = req.app.get('socketio');
    if (io && result.success) {
      io.emit('olt_leases_updated', { total: result.total, timestamp: new Date().toISOString() });
      io.emit('olt_telemetry_updated', { is_live: true, timestamp: new Date().toISOString() });
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to sync MAC leases: ' + err.message });
  }
});

// POST /api/monitoring/cdata-olt/onus/:id/reboot - Remote ONU Reboot
cdataOltRouter.post('/onus/:id/reboot', async (req: Request, res: Response) => {
  try {
    const result = await CdataOltService.rebootOnu(parseInt(req.params.id, 10));
    const io = req.app.get('socketio');
    if (io) {
      io.emit('olt_telemetry_updated', { timestamp: new Date().toISOString() });
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to reboot ONU: ' + err.message });
  }
});

// POST /api/monitoring/cdata-olt/onus/:id/deactivate - Remote ONU Deactivate
cdataOltRouter.post('/onus/:id/deactivate', async (req: Request, res: Response) => {
  try {
    const result = await CdataOltService.deactivateOnu(parseInt(req.params.id, 10));
    const io = req.app.get('socketio');
    if (io) {
      io.emit('olt_telemetry_updated', { timestamp: new Date().toISOString() });
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to deactivate ONU: ' + err.message });
  }
});

// GET /api/monitoring/cdata-olt/autofind - Unregistered ONUs
cdataOltRouter.get('/autofind', async (req: Request, res: Response) => {
  try {
    const list = await CdataOltService.getAutofindList();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch autofind list: ' + err.message });
  }
});

// POST /api/monitoring/cdata-olt/autofind/register - Register new ONU
cdataOltRouter.post('/autofind/register', async (req: Request, res: Response) => {
  try {
    const result = await CdataOltService.registerAutofindOnu(req.body);
    const io = req.app.get('socketio');
    if (io) {
      io.emit('olt_telemetry_updated', { timestamp: new Date().toISOString() });
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to register autofind ONU: ' + err.message });
  }
});

// POST /api/monitoring/cdata-olt/poll - Force manual SNMP sync
cdataOltRouter.post('/poll', async (req: Request, res: Response) => {
  try {
    const io = req.app.get('socketio');
    const result = await CdataOltService.pollOltSNMP(io);
    if (io && result.success) {
      io.emit('olt_telemetry_updated', { is_live: result.is_live, timestamp: new Date().toISOString() });
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to poll OLT: ' + err.message });
  }
});
