import { Router, Request, Response } from 'express';
import { pool, createNotification } from '../db';
import { requireAuth } from '../auth';

const router = Router();

// GET /api/notifications - List notifications for current user (or broadcast)
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || null;
    const { unreadOnly, category, limit = 50 } = req.query;

    let query = `
      SELECT * FROM notifications 
      WHERE (user_id IS NULL OR user_id = ?)
    `;
    const queryParams: any[] = [userId];

    if (unreadOnly === 'true') {
      query += ` AND is_read = 0`;
    }

    if (category && category !== 'all') {
      query += ` AND category = ?`;
      queryParams.push(category);
    }

    query += ` ORDER BY created_at DESC LIMIT ?`;
    queryParams.push(parseInt(limit as string, 10) || 50);

    const [rows]: any = await pool.query(query, queryParams);

    // Also count total unread
    const [countRows]: any = await pool.query(
      `SELECT COUNT(*) as unread_count FROM notifications WHERE (user_id IS NULL OR user_id = ?) AND is_read = 0`,
      [userId]
    );

    const unreadCount = countRows[0]?.unread_count || 0;

    res.json({
      notifications: rows,
      unread_count: unreadCount
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Gagal mengambil data notifikasi' });
  }
});

// PUT /api/notifications/:id/read - Mark notification as read
router.put('/:id/read', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query(`UPDATE notifications SET is_read = 1 WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Notifikasi ditandai dibaca' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Gagal memperbarui status notifikasi' });
  }
});

// PUT /api/notifications/read-all - Mark all notifications for user as read
router.put('/read-all', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || null;
    if (userId) {
      await pool.query(`UPDATE notifications SET is_read = 1 WHERE user_id IS NULL OR user_id = ?`, [userId]);
    } else {
      await pool.query(`UPDATE notifications SET is_read = 1`);
    }
    res.json({ success: true, message: 'Semua notifikasi ditandai dibaca' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Gagal memperbarui semua notifikasi' });
  }
});

// DELETE /api/notifications/:id - Delete single notification
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query(`DELETE FROM notifications WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Notifikasi berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Gagal menghapus notifikasi' });
  }
});

// POST /api/notifications/test - Trigger test notification
router.post('/test', async (req: Request, res: Response) => {
  try {
    const io = req.app.get('socketio');
    const { category = 'network', severity = 'warning' } = req.body;

    const notif = await createNotification({
      userId: (req as any).user?.id,
      title: 'UJI COBA NOTIFIKASI SYSTEM',
      message: 'Ini adalah tes notifikasi real-time dari Nemesys Command Center.',
      category,
      severity,
      linkUrl: '#',
      io
    });

    res.json({ success: true, notification: notif });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ error: 'Gagal mengirim notifikasi tes' });
  }
});

export default router;
