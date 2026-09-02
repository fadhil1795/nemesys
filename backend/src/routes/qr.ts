import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

// ==========================================
// Device Asset QR Code API
// ==========================================

// Get QR Code info or Generate for a device / asset
router.get('/device/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [rows]: any = await pool.query('SELECT * FROM devices WHERE id = ?', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const device = rows[0];
    const assetCode = `NEM-DEV-${device.id.toString().padStart(4, '0')}`;
    const qrData = JSON.stringify({
      asset_code: assetCode,
      id: device.id,
      name: device.name,
      type: device.type,
      ip: device.ip_address,
      location: device.location,
      status: device.status
    });

    // Check if QR code entry exists in device_qr_codes table
    const [existingQr]: any = await pool.query('SELECT * FROM device_qr_codes WHERE device_id = ?', [id]);
    if (existingQr.length === 0) {
      await pool.query('INSERT INTO device_qr_codes (device_id, asset_code, qr_data) VALUES (?, ?, ?)', [id, assetCode, qrData]);
    }

    res.json({
      success: true,
      asset_code: assetCode,
      qr_data: qrData,
      device
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({ error: 'Failed to generate device QR code' });
  }
});

// Scan / Lookup QR Code Data by asset_code
router.get('/scan/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;

    // 1. Check if asset_code exists in IT Inventory Assets
    const [itAssetRows]: any = await pool.query('SELECT * FROM it_inventory_assets WHERE asset_code = ?', [code]);
    if (itAssetRows.length > 0) {
      const asset = itAssetRows[0];
      const [components]: any = await pool.query(`
        SELECT ac.id, ac.quantity, ac.slot_or_position, ac.installed_at, c.name as component_name, c.component_code, c.category
        FROM it_asset_components ac
        JOIN it_inventory_components c ON ac.component_id = c.id
        WHERE ac.asset_id = ? AND ac.status = 'Installed'
      `, [asset.id]);

      return res.json({
        success: true,
        type: 'it_asset',
        data: {
          ...asset,
          installed_components: components
        },
        asset_code: code
      });
    }

    // 2. Check if asset_code exists in Network Devices
    const [qrRows]: any = await pool.query('SELECT * FROM device_qr_codes WHERE asset_code = ?', [code]);
    if (qrRows.length > 0 && qrRows[0].device_id) {
      const [devRows]: any = await pool.query('SELECT * FROM devices WHERE id = ?', [qrRows[0].device_id]);
      if (devRows.length > 0) {
        return res.json({ success: true, type: 'device', data: devRows[0], asset_code: code });
      }
    }

    // 3. Fallback: Check if asset_code matches procurement item
    const [procRows]: any = await pool.query('SELECT * FROM operational_procurements WHERE id = ?', [code.replace(/\D/g, '')]);
    if (procRows.length > 0) {
      return res.json({ success: true, type: 'procurement', data: procRows[0], asset_code: code });
    }

    res.status(404).json({ error: 'Perangkat atau aset tidak ditemukan untuk kode QR tersebut' });
  } catch (error) {
    console.error('Error scanning QR code:', error);
    res.status(500).json({ error: 'Failed to scan QR code' });
  }
});

export default router;
