import { Router, Request, Response } from 'express';
import { pool, writeLog } from '../db';
import { requireAuth } from '../auth';

const router = Router();

// Apply authentication to all inventory endpoints
router.use(requireAuth);

// ============================================================
// 1. IT ASSETS (Perangkat & Alat IT)
// ============================================================

// GET /api/inventory/assets - Get all assets with installed component info
router.get('/assets', async (req: Request, res: Response) => {
  try {
    const [assets]: any = await pool.query(`
      SELECT a.*, 
        (SELECT COUNT(*) FROM it_asset_components ac WHERE ac.asset_id = a.id AND ac.status = 'Installed') as installed_components_count,
        (SELECT COALESCE(SUM(c.unit_price * ac.quantity), 0) 
         FROM it_asset_components ac 
         JOIN it_inventory_components c ON ac.component_id = c.id 
         WHERE ac.asset_id = a.id AND ac.status = 'Installed') as installed_components_value
      FROM it_inventory_assets a 
      ORDER BY a.id DESC
    `);
    res.json(assets);
  } catch (error) {
    console.error('Error fetching IT assets:', error);
    res.status(500).json({ error: 'Database error fetching IT assets' });
  }
});

// GET /api/inventory/assets/:id - Get asset detail + installed components
router.get('/assets/:id', async (req: Request, res: Response) => {
  const assetId = parseInt(req.params.id);
  try {
    const [assetRows]: any = await pool.query('SELECT * FROM it_inventory_assets WHERE id = ?', [assetId]);
    if (assetRows.length === 0) {
      return res.status(404).json({ error: 'Aset IT tidak ditemukan' });
    }

    const [components]: any = await pool.query(`
      SELECT 
        ac.id as attachment_id,
        ac.asset_id,
        ac.component_id,
        ac.quantity,
        ac.installed_at,
        ac.installed_by,
        ac.slot_or_position,
        ac.status,
        ac.notes as attachment_notes,
        c.component_code,
        c.name as component_name,
        c.category as component_category,
        c.brand as component_brand,
        c.model_number as component_model,
        c.unit,
        c.unit_price
      FROM it_asset_components ac
      JOIN it_inventory_components c ON ac.component_id = c.id
      WHERE ac.asset_id = ? AND ac.status = 'Installed'
      ORDER BY ac.id ASC
    `, [assetId]);

    res.json({
      asset: assetRows[0],
      installed_components: components
    });
  } catch (error) {
    console.error('Error fetching asset detail:', error);
    res.status(500).json({ error: 'Database error fetching asset detail' });
  }
});

// POST /api/inventory/assets - Create new IT asset
router.post('/assets', async (req: Request, res: Response) => {
  const {
    asset_code,
    name,
    category,
    brand,
    model_number,
    serial_number,
    mac_address,
    ip_address,
    location,
    assigned_user,
    status,
    purchase_date,
    purchase_cost,
    vendor,
    warranty_expiry,
    specs,
    image_url,
    notes
  } = req.body;

  if (!name || !category || !location) {
    return res.status(400).json({ error: 'Nama, Kategori, dan Lokasi wajib diisi' });
  }

  try {
    // Generate asset_code if not provided
    let finalCode = asset_code?.trim();
    if (!finalCode) {
      const [countRows]: any = await pool.query('SELECT COUNT(*) as cnt FROM it_inventory_assets');
      const nextNum = (countRows[0].cnt + 1).toString().padStart(4, '0');
      const catPrefix = category.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '') || 'AST';
      finalCode = `AST-${catPrefix}-${nextNum}`;
    }

    const [result]: any = await pool.query(`
      INSERT INTO it_inventory_assets (
        asset_code, name, category, brand, model_number, serial_number, 
        mac_address, ip_address, location, assigned_user, status, 
        purchase_date, purchase_cost, vendor, warranty_expiry, specs, image_url, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      finalCode,
      name,
      category,
      brand || null,
      model_number || null,
      serial_number || null,
      mac_address || null,
      ip_address || null,
      location,
      assigned_user || null,
      status || 'Baik / Aktif',
      purchase_date || null,
      purchase_cost ? parseFloat(purchase_cost) : 0,
      vendor || null,
      warranty_expiry || null,
      specs || null,
      image_url || null,
      notes || null
    ]);

    const newId = result.insertId;

    // Create QR entry in device_qr_codes
    const qrData = JSON.stringify({
      asset_code: finalCode,
      id: newId,
      name,
      category,
      brand,
      location,
      status: status || 'Baik / Aktif',
      type: 'it_asset'
    });

    await pool.query(
      'INSERT INTO device_qr_codes (device_id, asset_code, qr_data) VALUES (NULL, ?, ?) ON DUPLICATE KEY UPDATE qr_data = ?',
      [finalCode, qrData, qrData]
    );

    // Record mutation log
    const actorName = (req as any).user?.name || 'Administrator';
    await pool.query(`
      INSERT INTO it_inventory_mutations (type, reference_id, reference_name, details, quantity_change, actor_name)
      VALUES (?, ?, ?, ?, NULL, ?)
    `, ['Asset Create', newId, name, `Registrasi aset baru [${finalCode}] ${name} di lokasi ${location}`, actorName]);

    res.status(201).json({ id: newId, asset_code: finalCode, message: 'Aset IT berhasil ditambahkan' });
  } catch (error: any) {
    console.error('Error creating IT asset:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Kode Aset sudah digunakan, gunakan kode lain' });
    }
    res.status(500).json({ error: 'Gagal menambahkan aset IT' });
  }
});

// PUT /api/inventory/assets/:id - Update IT asset
router.put('/assets/:id', async (req: Request, res: Response) => {
  const assetId = parseInt(req.params.id);
  const {
    asset_code,
    name,
    category,
    brand,
    model_number,
    serial_number,
    mac_address,
    ip_address,
    location,
    assigned_user,
    status,
    purchase_date,
    purchase_cost,
    vendor,
    warranty_expiry,
    specs,
    image_url,
    notes
  } = req.body;

  try {
    await pool.query(`
      UPDATE it_inventory_assets SET
        asset_code = ?, name = ?, category = ?, brand = ?, model_number = ?, serial_number = ?,
        mac_address = ?, ip_address = ?, location = ?, assigned_user = ?, status = ?,
        purchase_date = ?, purchase_cost = ?, vendor = ?, warranty_expiry = ?, specs = ?,
        image_url = ?, notes = ?
      WHERE id = ?
    `, [
      asset_code,
      name,
      category,
      brand || null,
      model_number || null,
      serial_number || null,
      mac_address || null,
      ip_address || null,
      location,
      assigned_user || null,
      status || 'Baik / Aktif',
      purchase_date || null,
      purchase_cost ? parseFloat(purchase_cost) : 0,
      vendor || null,
      warranty_expiry || null,
      specs || null,
      image_url || null,
      notes || null,
      assetId
    ]);

    // Update QR code data
    const qrData = JSON.stringify({
      asset_code,
      id: assetId,
      name,
      category,
      brand,
      location,
      status: status || 'Baik / Aktif',
      type: 'it_asset'
    });
    await pool.query(
      'UPDATE device_qr_codes SET asset_code = ?, qr_data = ? WHERE asset_code = ?',
      [asset_code, qrData, asset_code]
    );

    // Record mutation log
    const actorName = (req as any).user?.name || 'Administrator';
    await pool.query(`
      INSERT INTO it_inventory_mutations (type, reference_id, reference_name, details, quantity_change, actor_name)
      VALUES (?, ?, ?, ?, NULL, ?)
    `, ['Asset Update', assetId, name, `Pembaruan data aset [${asset_code}] ${name} (Status: ${status}, Lokasi: ${location})`, actorName]);

    res.json({ message: 'Aset IT berhasil diperbarui' });
  } catch (error: any) {
    console.error('Error updating IT asset:', error);
    res.status(500).json({ error: 'Gagal memperbarui aset IT' });
  }
});

// DELETE /api/inventory/assets/:id - Delete IT asset
router.delete('/assets/:id', async (req: Request, res: Response) => {
  const assetId = parseInt(req.params.id);

  try {
    const [rows]: any = await pool.query('SELECT name, asset_code FROM it_inventory_assets WHERE id = ?', [assetId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Aset tidak ditemukan' });
    }

    const asset = rows[0];

    // Delete asset (foreign keys cascade to it_asset_components)
    await pool.query('DELETE FROM it_inventory_assets WHERE id = ?', [assetId]);
    await pool.query('DELETE FROM device_qr_codes WHERE asset_code = ?', [asset.asset_code]);

    // Record mutation log
    const actorName = (req as any).user?.name || 'Administrator';
    await pool.query(`
      INSERT INTO it_inventory_mutations (type, reference_id, reference_name, details, quantity_change, actor_name)
      VALUES (?, ?, ?, ?, NULL, ?)
    `, ['Asset Delete', assetId, asset.name, `Penghapusan aset [${asset.asset_code}] ${asset.name} dari sistem`, actorName]);

    res.json({ message: 'Aset IT berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting IT asset:', error);
    res.status(500).json({ error: 'Gagal menghapus aset IT' });
  }
});

// ============================================================
// 2. IT COMPONENTS & SPARE PARTS (Komponen & Suku Cadang)
// ============================================================

// GET /api/inventory/components - Get all components with low stock indicator
router.get('/components', async (req: Request, res: Response) => {
  try {
    const [components]: any = await pool.query(`
      SELECT c.*, 
        (c.stock_quantity <= c.min_stock_alert) as is_low_stock,
        (SELECT COALESCE(SUM(ac.quantity), 0) FROM it_asset_components ac WHERE ac.component_id = c.id AND ac.status = 'Installed') as installed_count
      FROM it_inventory_components c 
      ORDER BY (c.stock_quantity <= c.min_stock_alert) DESC, c.id DESC
    `);
    res.json(components);
  } catch (error) {
    console.error('Error fetching components:', error);
    res.status(500).json({ error: 'Database error fetching components' });
  }
});

// GET /api/inventory/components/:id - Get single component detail with installed devices
router.get('/components/:id', async (req: Request, res: Response) => {
  const componentId = parseInt(req.params.id);
  try {
    const [compRows]: any = await pool.query('SELECT * FROM it_inventory_components WHERE id = ?', [componentId]);
    if (compRows.length === 0) {
      return res.status(404).json({ error: 'Komponen tidak ditemukan' });
    }

    const [installedOn]: any = await pool.query(`
      SELECT 
        ac.id as attachment_id,
        ac.quantity,
        ac.installed_at,
        ac.installed_by,
        ac.slot_or_position,
        a.id as asset_id,
        a.asset_code,
        a.name as asset_name,
        a.location as asset_location,
        a.category as asset_category
      FROM it_asset_components ac
      JOIN it_inventory_assets a ON ac.asset_id = a.id
      WHERE ac.component_id = ? AND ac.status = 'Installed'
      ORDER BY ac.id DESC
    `, [componentId]);

    res.json({
      component: compRows[0],
      installed_on: installedOn
    });
  } catch (error) {
    console.error('Error fetching component detail:', error);
    res.status(500).json({ error: 'Database error fetching component detail' });
  }
});

// POST /api/inventory/components - Create new component
router.post('/components', async (req: Request, res: Response) => {
  const {
    component_code,
    name,
    category,
    brand,
    model_number,
    stock_quantity,
    min_stock_alert,
    unit,
    condition_status,
    storage_location,
    unit_price,
    supplier,
    notes
  } = req.body;

  if (!name || !category || !storage_location) {
    return res.status(400).json({ error: 'Nama, Kategori, dan Lokasi Penyimpanan wajib diisi' });
  }

  try {
    let finalCode = component_code?.trim();
    if (!finalCode) {
      const [countRows]: any = await pool.query('SELECT COUNT(*) as cnt FROM it_inventory_components');
      const nextNum = (countRows[0].cnt + 1).toString().padStart(3, '0');
      const catPrefix = category.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '') || 'CMP';
      finalCode = `CMP-${catPrefix}-${nextNum}`;
    }

    const qty = parseInt(stock_quantity) || 0;
    const minAlert = parseInt(min_stock_alert) || 2;
    const price = parseFloat(unit_price) || 0;

    const [result]: any = await pool.query(`
      INSERT INTO it_inventory_components (
        component_code, name, category, brand, model_number, stock_quantity,
        min_stock_alert, unit, condition_status, storage_location, unit_price, supplier, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      finalCode,
      name,
      category,
      brand || null,
      model_number || null,
      qty,
      minAlert,
      unit || 'Pcs',
      condition_status || 'Baru',
      storage_location,
      price,
      supplier || null,
      notes || null
    ]);

    const newId = result.insertId;
    const actorName = (req as any).user?.name || 'Administrator';

    await pool.query(`
      INSERT INTO it_inventory_mutations (type, reference_id, reference_name, details, quantity_change, actor_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['Stock In', newId, name, `Penerimaan stok awal komponen [${finalCode}] ${name} sebanyak ${qty} ${unit || 'Pcs'}`, qty, actorName]);

    res.status(201).json({ id: newId, component_code: finalCode, message: 'Komponen berhasil ditambahkan' });
  } catch (error: any) {
    console.error('Error creating component:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Kode Komponen sudah digunakan' });
    }
    res.status(500).json({ error: 'Gagal menambahkan komponen' });
  }
});

// PUT /api/inventory/components/:id - Update component info
router.put('/components/:id', async (req: Request, res: Response) => {
  const componentId = parseInt(req.params.id);
  const {
    component_code,
    name,
    category,
    brand,
    model_number,
    stock_quantity,
    min_stock_alert,
    unit,
    condition_status,
    storage_location,
    unit_price,
    supplier,
    notes
  } = req.body;

  try {
    await pool.query(`
      UPDATE it_inventory_components SET
        component_code = ?, name = ?, category = ?, brand = ?, model_number = ?,
        stock_quantity = ?, min_stock_alert = ?, unit = ?, condition_status = ?,
        storage_location = ?, unit_price = ?, supplier = ?, notes = ?
      WHERE id = ?
    `, [
      component_code,
      name,
      category,
      brand || null,
      model_number || null,
      parseInt(stock_quantity) || 0,
      parseInt(min_stock_alert) || 2,
      unit || 'Pcs',
      condition_status || 'Baru',
      storage_location,
      parseFloat(unit_price) || 0,
      supplier || null,
      notes || null,
      componentId
    ]);

    res.json({ message: 'Komponen berhasil diperbarui' });
  } catch (error) {
    console.error('Error updating component:', error);
    res.status(500).json({ error: 'Gagal memperbarui komponen' });
  }
});

// DELETE /api/inventory/components/:id - Delete component
router.delete('/components/:id', async (req: Request, res: Response) => {
  const componentId = parseInt(req.params.id);

  try {
    const [rows]: any = await pool.query('SELECT name, component_code FROM it_inventory_components WHERE id = ?', [componentId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Komponen tidak ditemukan' });
    }

    await pool.query('DELETE FROM it_inventory_components WHERE id = ?', [componentId]);

    const actorName = (req as any).user?.name || 'Administrator';
    await pool.query(`
      INSERT INTO it_inventory_mutations (type, reference_id, reference_name, details, quantity_change, actor_name)
      VALUES (?, ?, ?, ?, NULL, ?)
    `, ['Component Delete', componentId, rows[0].name, `Penghapusan master komponen [${rows[0].component_code}] ${rows[0].name}`, actorName]);

    res.json({ message: 'Komponen berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting component:', error);
    res.status(500).json({ error: 'Gagal menghapus komponen' });
  }
});

// POST /api/inventory/components/:id/adjust-stock - Stock In / Stock Out / Opname
router.post('/components/:id/adjust-stock', async (req: Request, res: Response) => {
  const componentId = parseInt(req.params.id);
  const { adjustType, quantity, notes } = req.body; // adjustType: 'in' | 'out' | 'set'

  const numQty = parseInt(quantity);
  if (isNaN(numQty) || numQty < 0) {
    return res.status(400).json({ error: 'Jumlah stok harus angka positif' });
  }

  try {
    const [rows]: any = await pool.query('SELECT * FROM it_inventory_components WHERE id = ?', [componentId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Komponen tidak ditemukan' });
    }

    const comp = rows[0];
    let newStock = comp.stock_quantity;
    let mutationType = 'Stock In';
    let qtyChange = numQty;

    if (adjustType === 'in') {
      newStock += numQty;
      mutationType = 'Stock In';
      qtyChange = numQty;
    } else if (adjustType === 'out') {
      if (comp.stock_quantity < numQty) {
        return res.status(400).json({ error: `Stok tidak mencukupi! Stok saat ini: ${comp.stock_quantity} ${comp.unit}` });
      }
      newStock -= numQty;
      mutationType = 'Stock Out';
      qtyChange = -numQty;
    } else if (adjustType === 'set') {
      qtyChange = numQty - comp.stock_quantity;
      newStock = numQty;
      mutationType = 'Stock Opname';
    }

    await pool.query('UPDATE it_inventory_components SET stock_quantity = ? WHERE id = ?', [newStock, componentId]);

    const actorName = (req as any).user?.name || 'Administrator';
    const detailMsg = `Penyesuaian stok (${mutationType}) ${Math.abs(qtyChange)} ${comp.unit} untuk [${comp.component_code}] ${comp.name}. Stok sekarang: ${newStock} ${comp.unit}. Catatan: ${notes || '-'}`;

    await pool.query(`
      INSERT INTO it_inventory_mutations (type, reference_id, reference_name, details, quantity_change, actor_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [mutationType, componentId, comp.name, detailMsg, qtyChange, actorName]);

    res.json({ success: true, newStock, message: 'Stok komponen berhasil disesuaikan' });
  } catch (error) {
    console.error('Error adjusting stock:', error);
    res.status(500).json({ error: 'Gagal menyesuaikan stok komponen' });
  }
});

// ============================================================
// 3. HARDWARE COMPONENT ATTACHMENT (Pasang/Lepas Komponen ke Perangkat)
// ============================================================

// POST /api/inventory/assets/:assetId/install-component - Install component into device
router.post('/assets/:assetId/install-component', async (req: Request, res: Response) => {
  const assetId = parseInt(req.params.assetId);
  const { componentId, quantity, slotOrPosition, notes, installedAt } = req.body;

  const installQty = parseInt(quantity) || 1;

  try {
    // 1. Verify asset exists
    const [assetRows]: any = await pool.query('SELECT * FROM it_inventory_assets WHERE id = ?', [assetId]);
    if (assetRows.length === 0) {
      return res.status(404).json({ error: 'Perangkat IT tujuan tidak ditemukan' });
    }
    const asset = assetRows[0];

    // 2. Verify component exists and has enough stock
    const [compRows]: any = await pool.query('SELECT * FROM it_inventory_components WHERE id = ?', [componentId]);
    if (compRows.length === 0) {
      return res.status(404).json({ error: 'Komponen yang dipilih tidak ditemukan' });
    }
    const comp = compRows[0];

    if (comp.stock_quantity < installQty) {
      return res.status(400).json({
        error: `Stok komponen tidak cukup! Stok saat ini: ${comp.stock_quantity} ${comp.unit}, dibutuhkan: ${installQty} ${comp.unit}`
      });
    }

    const actorName = (req as any).user?.name || 'Administrator';
    const installDate = installedAt || new Date().toISOString().split('T')[0];

    // 3. Insert into it_asset_components
    await pool.query(`
      INSERT INTO it_asset_components (asset_id, component_id, quantity, installed_at, installed_by, slot_or_position, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, 'Installed', ?)
    `, [
      assetId,
      componentId,
      installQty,
      installDate,
      actorName,
      slotOrPosition || null,
      notes || null
    ]);

    // 4. Decrement component stock
    const nextStock = comp.stock_quantity - installQty;
    await pool.query('UPDATE it_inventory_components SET stock_quantity = ? WHERE id = ?', [nextStock, componentId]);

    // 5. Log mutation
    const detailMsg = `Pemasangan ${installQty} ${comp.unit} [${comp.component_code}] ${comp.name} ke perangkat [${asset.asset_code}] ${asset.name} (${slotOrPosition || 'Default Slot'}). Sisa stok komponen: ${nextStock}.`;
    await pool.query(`
      INSERT INTO it_inventory_mutations (type, reference_id, reference_name, details, quantity_change, actor_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['Install Component', assetId, asset.name, detailMsg, -installQty, actorName]);

    res.json({
      success: true,
      message: `Berhasil memasang ${installQty} ${comp.unit} ${comp.name} ke ${asset.name}`
    });
  } catch (error) {
    console.error('Error installing component to asset:', error);
    res.status(500).json({ error: 'Gagal memasang komponen ke perangkat' });
  }
});

// POST /api/inventory/assets/:assetId/remove-component/:attachmentId - Detach component from device
router.post('/assets/:assetId/remove-component/:attachmentId', async (req: Request, res: Response) => {
  const assetId = parseInt(req.params.assetId);
  const attachmentId = parseInt(req.params.attachmentId);
  const { restock, conditionStatus, reason } = req.body;

  try {
    // 1. Get attachment detail
    const [attachRows]: any = await pool.query(`
      SELECT ac.*, a.name as asset_name, a.asset_code, c.name as component_name, c.component_code, c.unit
      FROM it_asset_components ac
      JOIN it_inventory_assets a ON ac.asset_id = a.id
      JOIN it_inventory_components c ON ac.component_id = c.id
      WHERE ac.id = ? AND ac.asset_id = ? AND ac.status = 'Installed'
    `, [attachmentId, assetId]);

    if (attachRows.length === 0) {
      return res.status(404).json({ error: 'Data komponen terpasang tidak ditemukan atau sudah dilepas' });
    }

    const attach = attachRows[0];
    const actorName = (req as any).user?.name || 'Administrator';

    // 2. Mark attachment as Removed or Delete
    await pool.query(`
      UPDATE it_asset_components 
      SET status = 'Removed', notes = CONCAT(COALESCE(notes, ''), ' | Dilepas: ', ?)
      WHERE id = ?
    `, [`${reason || 'Pelepasan komponen'} oleh ${actorName}`, attachmentId]);

    // 3. Restock if requested
    if (restock) {
      await pool.query(`
        UPDATE it_inventory_components 
        SET stock_quantity = stock_quantity + ?, condition_status = COALESCE(?, condition_status)
        WHERE id = ?
      `, [attach.quantity, conditionStatus || null, attach.component_id]);
    }

    // 4. Log mutation
    const detailMsg = `Pelepasan ${attach.quantity} ${attach.unit} [${attach.component_code}] ${attach.component_name} dari perangkat [${attach.asset_code}] ${attach.asset_name}. Restock: ${restock ? 'Ya (Masuk ke Gudang)' : 'Tidak (Komponen Rusak/Dibuang)'}. Alasan: ${reason || '-'}`;

    await pool.query(`
      INSERT INTO it_inventory_mutations (type, reference_id, reference_name, details, quantity_change, actor_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['Remove Component', assetId, attach.asset_name, detailMsg, restock ? attach.quantity : 0, actorName]);

    res.json({ success: true, message: 'Komponen berhasil dilepas dari perangkat' });
  } catch (error) {
    console.error('Error removing component from asset:', error);
    res.status(500).json({ error: 'Gagal melepas komponen dari perangkat' });
  }
});

// ============================================================
// 4. MUTATION LOGS & STATS (Audit Trail & Valuasi Inventaris)
// ============================================================

// GET /api/inventory/mutations - Get mutation history
router.get('/mutations', async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query('SELECT * FROM it_inventory_mutations ORDER BY id DESC LIMIT 100');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching inventory mutations:', error);
    res.status(500).json({ error: 'Database error fetching inventory mutations' });
  }
});

// GET /api/inventory/stats - Get full inventory overview statistics & asset valuation
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const [assetStat]: any = await pool.query(`
      SELECT 
        COUNT(*) as total_assets,
        COALESCE(SUM(purchase_cost), 0) as total_asset_cost,
        SUM(CASE WHEN status = 'Baik / Aktif' THEN 1 ELSE 0 END) as good_assets,
        SUM(CASE WHEN status IN ('Rusak Ringan', 'Rusak Berat') THEN 1 ELSE 0 END) as broken_assets,
        SUM(CASE WHEN status = 'Cadangan / Stock' THEN 1 ELSE 0 END) as spare_assets
      FROM it_inventory_assets
    `);

    const [compStat]: any = await pool.query(`
      SELECT 
        COUNT(*) as total_component_types,
        COALESCE(SUM(stock_quantity), 0) as total_stock_items,
        COALESCE(SUM(stock_quantity * unit_price), 0) as total_component_value,
        SUM(CASE WHEN stock_quantity <= min_stock_alert THEN 1 ELSE 0 END) as low_stock_count
      FROM it_inventory_components
    `);

    const [assetByCat]: any = await pool.query(`
      SELECT category, COUNT(*) as count, COALESCE(SUM(purchase_cost), 0) as total_val
      FROM it_inventory_assets
      GROUP BY category
      ORDER BY count DESC
    `);

    const [compByCat]: any = await pool.query(`
      SELECT category, COUNT(*) as count, COALESCE(SUM(stock_quantity), 0) as total_stock, COALESCE(SUM(stock_quantity * unit_price), 0) as total_val
      FROM it_inventory_components
      GROUP BY category
      ORDER BY count DESC
    `);

    const [recentMutations]: any = await pool.query(`
      SELECT * FROM it_inventory_mutations ORDER BY id DESC LIMIT 6
    `);

    res.json({
      summary: {
        totalAssets: assetStat[0].total_assets,
        totalAssetCost: assetStat[0].total_asset_cost,
        goodAssets: assetStat[0].good_assets,
        brokenAssets: assetStat[0].broken_assets,
        spareAssets: assetStat[0].spare_assets,
        totalComponentTypes: compStat[0].total_component_types,
        totalStockItems: compStat[0].total_stock_items,
        totalComponentValue: compStat[0].total_component_value,
        lowStockCount: compStat[0].low_stock_count,
        totalInventoryValuation: (assetStat[0].total_asset_cost || 0) + (compStat[0].total_component_value || 0)
      },
      assetsByCategory: assetByCat,
      componentsByCategory: compByCat,
      recentMutations
    });
  } catch (error) {
    console.error('Error fetching inventory stats:', error);
    res.status(500).json({ error: 'Database error fetching inventory stats' });
  }
});

export default router;
