import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { requireAuth } from '../auth';

export const gedungRuanganRouter = Router();

// =========================================================================
// GEDUNG ENDPOINTS
// =========================================================================

// 1. GET ALL GEDUNGS (with room count)
gedungRuanganRouter.get('/gedungs', async (req: Request, res: Response) => {
  try {
    const { status, search } = req.query;

    let query = `
      SELECT 
        g.*,
        (SELECT COUNT(*) FROM ruangans r WHERE r.gedung_id = g.id) AS jumlah_ruangan
      FROM gedungs g
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status && status !== 'all') {
      query += ` AND g.status = ?`;
      params.push(status);
    }

    if (search) {
      query += ` AND (g.kode LIKE ? OR g.nama LIKE ? OR g.keterangan LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    query += ` ORDER BY g.id ASC`;

    const [rows]: any = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching gedungs:', error);
    res.status(500).json({ error: 'Database error fetching gedungs' });
  }
});

// 2. GET SINGLE GEDUNG BY ID
gedungRuanganRouter.get('/gedungs/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [rows]: any = await pool.query(
      `SELECT g.*, (SELECT COUNT(*) FROM ruangans r WHERE r.gedung_id = g.id) AS jumlah_ruangan 
       FROM gedungs g WHERE g.id = ?`,
      [id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Gedung tidak ditemukan' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching gedung by id:', error);
    res.status(500).json({ error: 'Database error fetching gedung' });
  }
});

// 3. POST CREATE GEDUNG (Admin / Manager only)
gedungRuanganRouter.post('/gedungs', requireAuth, async (req: Request, res: Response) => {
  try {
    const { kode, nama, keterangan, status = 'Aktif' } = req.body;

    if (!kode || !String(kode).trim()) {
      return res.status(400).json({ error: 'Kode gedung wajib diisi' });
    }
    if (!nama || !String(nama).trim()) {
      return res.status(400).json({ error: 'Nama gedung wajib diisi' });
    }
    if (!status || (status !== 'Aktif' && status !== 'Nonaktif')) {
      return res.status(400).json({ error: 'Status gedung wajib dipilih (Aktif/Nonaktif)' });
    }

    const cleanKode = String(kode).trim().toUpperCase();
    const cleanNama = String(nama).trim();
    const cleanKet = keterangan ? String(keterangan).trim() : null;

    // Check duplicate code (case-insensitive)
    const [existing]: any = await pool.query(
      `SELECT id FROM gedungs WHERE LOWER(kode) = LOWER(?)`,
      [cleanKode]
    );

    if (existing && existing.length > 0) {
      return res.status(400).json({ error: `Kode gedung "${cleanKode}" sudah terdaftar. Kode gedung harus unik.` });
    }

    const [result]: any = await pool.query(
      `INSERT INTO gedungs (kode, nama, keterangan, status) VALUES (?, ?, ?, ?)`,
      [cleanKode, cleanNama, cleanKet, status]
    );

    const newGedung = {
      id: result.insertId,
      kode: cleanKode,
      nama: cleanNama,
      keterangan: cleanKet,
      status,
      jumlah_ruangan: 0,
      created_at: new Date().toISOString()
    };

    res.status(201).json({
      message: 'Gedung berhasil ditambahkan',
      data: newGedung
    });
  } catch (error) {
    console.error('Error creating gedung:', error);
    res.status(500).json({ error: 'Database error creating gedung' });
  }
});

// 4. PUT UPDATE GEDUNG (Admin / Manager only)
gedungRuanganRouter.put('/gedungs/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { kode, nama, keterangan, status } = req.body;

    if (!kode || !String(kode).trim()) {
      return res.status(400).json({ error: 'Kode gedung wajib diisi' });
    }
    if (!nama || !String(nama).trim()) {
      return res.status(400).json({ error: 'Nama gedung wajib diisi' });
    }
    if (!status || (status !== 'Aktif' && status !== 'Nonaktif')) {
      return res.status(400).json({ error: 'Status gedung wajib dipilih (Aktif/Nonaktif)' });
    }

    const cleanKode = String(kode).trim().toUpperCase();
    const cleanNama = String(nama).trim();
    const cleanKet = keterangan ? String(keterangan).trim() : null;

    // Check if gedung exists
    const [checkGedung]: any = await pool.query(`SELECT id FROM gedungs WHERE id = ?`, [id]);
    if (!checkGedung || checkGedung.length === 0) {
      return res.status(404).json({ error: 'Gedung tidak ditemukan' });
    }

    // Check duplicate code for other building IDs
    const [existing]: any = await pool.query(
      `SELECT id FROM gedungs WHERE LOWER(kode) = LOWER(?) AND id != ?`,
      [cleanKode, id]
    );

    if (existing && existing.length > 0) {
      return res.status(400).json({ error: `Kode gedung "${cleanKode}" sudah digunakan oleh gedung lain.` });
    }

    await pool.query(
      `UPDATE gedungs SET kode = ?, nama = ?, keterangan = ?, status = ? WHERE id = ?`,
      [cleanKode, cleanNama, cleanKet, status, id]
    );

    res.json({
      message: 'Gedung berhasil diperbarui',
      data: { id, kode: cleanKode, nama: cleanNama, keterangan: cleanKet, status }
    });
  } catch (error) {
    console.error('Error updating gedung:', error);
    res.status(500).json({ error: 'Database error updating gedung' });
  }
});

// 5. DELETE GEDUNG (Admin / Manager only)
// CRITICAL RULE: Don't delete if building still has rooms!
gedungRuanganRouter.delete('/gedungs/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    // Check rooms count
    const [roomCountRows]: any = await pool.query(
      `SELECT COUNT(*) as count FROM ruangans WHERE gedung_id = ?`,
      [id]
    );

    const roomCount = roomCountRows[0]?.count || 0;
    if (roomCount > 0) {
      return res.status(400).json({
        error: 'Gedung ini masih memiliki beberapa ruangan. Hapus semua ruangan terlebih dahulu atau nonaktifkan gedung.'
      });
    }

    const [result]: any = await pool.query(`DELETE FROM gedungs WHERE id = ?`, [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Gedung tidak ditemukan' });
    }

    res.json({ message: 'Gedung berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting gedung:', error);
    res.status(500).json({ error: 'Database error deleting gedung' });
  }
});

// =========================================================================
// RUANGAN ENDPOINTS
// =========================================================================

// 1. GET ALL RUANGANS (Optionally filtered by gedung_id)
gedungRuanganRouter.get('/ruangans', async (req: Request, res: Response) => {
  try {
    const { gedung_id, status, search } = req.query;

    let query = `
      SELECT 
        r.*,
        g.nama as gedung_nama,
        g.kode as gedung_kode
      FROM ruangans r
      JOIN gedungs g ON r.gedung_id = g.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (gedung_id) {
      query += ` AND r.gedung_id = ?`;
      params.push(parseInt(String(gedung_id)));
    }

    if (status && status !== 'all') {
      query += ` AND r.status = ?`;
      params.push(status);
    }

    if (search) {
      query += ` AND (r.kode LIKE ? OR r.nama LIKE ? OR r.lantai LIKE ? OR r.keterangan LIKE ? OR g.nama LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    query += ` ORDER BY r.lantai ASC, r.kode ASC`;

    const [rows]: any = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching ruangans:', error);
    res.status(500).json({ error: 'Database error fetching ruangans' });
  }
});

// 2. GET RUANGANS FOR A SPECIFIC GEDUNG
gedungRuanganRouter.get('/gedungs/:gedungId/ruangans', async (req: Request, res: Response) => {
  try {
    const gedungId = parseInt(req.params.gedungId);
    const { status } = req.query;

    let query = `
      SELECT 
        r.*,
        g.nama as gedung_nama,
        g.kode as gedung_kode
      FROM ruangans r
      JOIN gedungs g ON r.gedung_id = g.id
      WHERE r.gedung_id = ?
    `;
    const params: any[] = [gedungId];

    if (status && status !== 'all') {
      query += ` AND r.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY r.lantai ASC, r.kode ASC`;

    const [rows]: any = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching ruangans for gedung:', error);
    res.status(500).json({ error: 'Database error fetching ruangans' });
  }
});

// 3. POST CREATE RUANGAN (Admin / Manager only)
gedungRuanganRouter.post('/ruangans', requireAuth, async (req: Request, res: Response) => {
  try {
    const { gedung_id, kode, nama, lantai = '1', keterangan, status = 'Aktif' } = req.body;

    if (!gedung_id || isNaN(parseInt(String(gedung_id)))) {
      return res.status(400).json({ error: 'Gedung wajib dipilih' });
    }
    if (!kode || !String(kode).trim()) {
      return res.status(400).json({ error: 'Kode ruangan wajib diisi' });
    }
    if (!nama || !String(nama).trim()) {
      return res.status(400).json({ error: 'Nama ruangan wajib diisi' });
    }
    if (!status || (status !== 'Aktif' && status !== 'Nonaktif')) {
      return res.status(400).json({ error: 'Status ruangan wajib dipilih (Aktif/Nonaktif)' });
    }

    const cleanGedungId = parseInt(String(gedung_id));
    const cleanKode = String(kode).trim().toUpperCase();
    const cleanNama = String(nama).trim();
    const cleanLantai = String(lantai).trim() || '1';
    const cleanKet = keterangan ? String(keterangan).trim() : null;

    // Check if Gedung exists
    const [gCheck]: any = await pool.query(`SELECT id, nama, kode FROM gedungs WHERE id = ?`, [cleanGedungId]);
    if (!gCheck || gCheck.length === 0) {
      return res.status(404).json({ error: 'Gedung terpilih tidak ditemukan' });
    }

    // Check duplicate room code within the SAME building
    const [existing]: any = await pool.query(
      `SELECT id FROM ruangans WHERE gedung_id = ? AND LOWER(kode) = LOWER(?)`,
      [cleanGedungId, cleanKode]
    );

    if (existing && existing.length > 0) {
      return res.status(400).json({
        error: `Kode ruangan "${cleanKode}" sudah terdaftar pada ${gCheck[0].nama}. Kode ruangan harus unik dalam gedung yang sama.`
      });
    }

    const [result]: any = await pool.query(
      `INSERT INTO ruangans (gedung_id, kode, nama, lantai, keterangan, status) VALUES (?, ?, ?, ?, ?, ?)`,
      [cleanGedungId, cleanKode, cleanNama, cleanLantai, cleanKet, status]
    );

    const newRuangan = {
      id: result.insertId,
      gedung_id: cleanGedungId,
      gedung_nama: gCheck[0].nama,
      gedung_kode: gCheck[0].kode,
      kode: cleanKode,
      nama: cleanNama,
      lantai: cleanLantai,
      keterangan: cleanKet,
      status,
      created_at: new Date().toISOString()
    };

    res.status(201).json({
      message: 'Ruangan berhasil ditambahkan',
      data: newRuangan
    });
  } catch (error) {
    console.error('Error creating ruangan:', error);
    res.status(500).json({ error: 'Database error creating ruangan' });
  }
});

// 4. PUT UPDATE RUANGAN (Admin / Manager only)
gedungRuanganRouter.put('/ruangans/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { gedung_id, kode, nama, lantai, keterangan, status } = req.body;

    if (!gedung_id || isNaN(parseInt(String(gedung_id)))) {
      return res.status(400).json({ error: 'Gedung wajib dipilih' });
    }
    if (!kode || !String(kode).trim()) {
      return res.status(400).json({ error: 'Kode ruangan wajib diisi' });
    }
    if (!nama || !String(nama).trim()) {
      return res.status(400).json({ error: 'Nama ruangan wajib diisi' });
    }
    if (!status || (status !== 'Aktif' && status !== 'Nonaktif')) {
      return res.status(400).json({ error: 'Status ruangan wajib dipilih (Aktif/Nonaktif)' });
    }

    const cleanGedungId = parseInt(String(gedung_id));
    const cleanKode = String(kode).trim().toUpperCase();
    const cleanNama = String(nama).trim();
    const cleanLantai = String(lantai).trim() || '1';
    const cleanKet = keterangan ? String(keterangan).trim() : null;

    // Check if room exists
    const [checkRuangan]: any = await pool.query(`SELECT id FROM ruangans WHERE id = ?`, [id]);
    if (!checkRuangan || checkRuangan.length === 0) {
      return res.status(404).json({ error: 'Ruangan tidak ditemukan' });
    }

    // Check if Gedung exists
    const [gCheck]: any = await pool.query(`SELECT id, nama, kode FROM gedungs WHERE id = ?`, [cleanGedungId]);
    if (!gCheck || gCheck.length === 0) {
      return res.status(404).json({ error: 'Gedung terpilih tidak ditemukan' });
    }

    // Check duplicate code within same gedung for other room IDs
    const [existing]: any = await pool.query(
      `SELECT id FROM ruangans WHERE gedung_id = ? AND LOWER(kode) = LOWER(?) AND id != ?`,
      [cleanGedungId, cleanKode, id]
    );

    if (existing && existing.length > 0) {
      return res.status(400).json({
        error: `Kode ruangan "${cleanKode}" sudah digunakan oleh ruangan lain pada ${gCheck[0].nama}.`
      });
    }

    await pool.query(
      `UPDATE ruangans SET gedung_id = ?, kode = ?, nama = ?, lantai = ?, keterangan = ?, status = ? WHERE id = ?`,
      [cleanGedungId, cleanKode, cleanNama, cleanLantai, cleanKet, status, id]
    );

    res.json({
      message: 'Ruangan berhasil diperbarui',
      data: {
        id,
        gedung_id: cleanGedungId,
        gedung_nama: gCheck[0].nama,
        gedung_kode: gCheck[0].kode,
        kode: cleanKode,
        nama: cleanNama,
        lantai: cleanLantai,
        keterangan: cleanKet,
        status
      }
    });
  } catch (error) {
    console.error('Error updating ruangan:', error);
    res.status(500).json({ error: 'Database error updating ruangan' });
  }
});

// 5. DELETE RUANGAN (Admin / Manager only)
gedungRuanganRouter.delete('/ruangans/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    const [result]: any = await pool.query(`DELETE FROM ruangans WHERE id = ?`, [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Ruangan tidak ditemukan' });
    }

    res.json({ message: 'Ruangan berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting ruangan:', error);
    res.status(500).json({ error: 'Database error deleting ruangan' });
  }
});
