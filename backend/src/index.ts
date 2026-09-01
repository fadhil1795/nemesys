import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { pool, initializeDatabase, writeLog } from './db';
import { initTelegramBot, sendTelegramAlert, updateTelegramMessage } from './telegram';
import { startCronJobs } from './cron';
import { syncZabbixHosts, testZabbixConnection } from './zabbix';
import * as GenieACS from './genieacs';

dotenv.config();

const app = express();

// Detect if running on Vercel (serverless) or locally
const IS_VERCEL = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;

let io: Server | null = null;
let httpServer: ReturnType<typeof createServer> | null = null;

// Only create HTTP server + Socket.io when NOT on Vercel
if (!IS_VERCEL) {
  httpServer = createServer(app);
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });
}

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

import { handleLogin, requireAuth } from './auth';
import crudRouter from './routes/crud';
import operationalRouter from './routes/operational';
import reportsRouter from './routes/reports';
import qrRouter from './routes/qr';

app.post('/api/login', handleLogin);
app.use('/api/operational', operationalRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/qr', qrRouter);

// Broadcast database change helper (no-op on Vercel)
async function broadcastUpdate() {
  if (io) {
    io.emit('data_changed');
  }
}

// Track if database has been initialized (for serverless cold starts)
let dbInitialized = false;
async function ensureDbInitialized() {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
}

// Middleware: ensure DB is ready on every Vercel request (cold start handling)
if (IS_VERCEL) {
  app.use(async (req, res, next) => {
    try {
      await ensureDbInitialized();
      next();
    } catch (error) {
      console.error('DB initialization error:', error);
      res.status(500).json({ error: 'Database initialization failed' });
    }
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', environment: IS_VERCEL ? 'vercel' : 'local', timestamp: new Date().toISOString() });
});

// ----------------------------------------------------
// REST API Endpoints
// ----------------------------------------------------

app.get('/api/devices', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM devices');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error fetching devices' });
  }
});

app.get('/api/tasks', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM tasks ORDER BY id DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error fetching tasks' });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error fetching users' });
  }
});

app.get('/api/missions', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM missions ORDER BY id DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error fetching missions' });
  }
});

app.get('/api/temp-logs', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM temp_logs ORDER BY id DESC LIMIT 10');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error fetching temperature logs' });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM device_categories ORDER BY id ASC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error fetching device categories' });
  }
});

// Zabbix API connection test & manual sync endpoints
app.get('/api/zabbix/test', async (req, res) => {
  const result = await testZabbixConnection();
  res.json(result);
});

app.post('/api/zabbix/sync', async (req, res) => {
  try {
    await syncZabbixHosts();
    res.json({ success: true, message: 'Zabbix sync manually triggered and completed' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || String(error) });
  }
});

// Zabbix Webhook Receiver / Simulated Alert
app.post('/api/alerts/trigger', async (req, res) => {
  try {
    // Pick an active device to fail
    const [activeDevices]: any = await pool.query('SELECT * FROM devices WHERE status = "Up" AND id != 1');
    if (activeDevices.length === 0) {
      return res.status(400).json({ error: 'All devices are already Down' });
    }
    const targetDevice = activeDevices[Math.floor(Math.random() * activeDevices.length)];

    // 1. Change device status
    await pool.query('UPDATE devices SET status = "Down" WHERE id = ?', [targetDevice.id]);

    // 2. Insert Daily Task
    const newTaskId = Date.now();
    const startedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const severity = targetDevice.is_backbone ? 'Emergency' : 'Alert';

    await pool.query(
      'INSERT INTO tasks (id, device_id, device_name, ip_address, location, status, severity, started_at, sla_minutes) VALUES (?, ?, ?, ?, ?, "Open", ?, ?, 30)',
      [newTaskId, targetDevice.id, targetDevice.name, targetDevice.ip_address, targetDevice.location, severity, startedAt]
    );

    // 3. Push telegram alert
    await sendTelegramAlert({
      id: newTaskId,
      device_name: targetDevice.name,
      ip_address: targetDevice.ip_address,
      location: targetDevice.location,
      severity,
    });

    broadcastUpdate();
    res.json({ message: `Triggered DOWN state for ${targetDevice.name}`, taskId: newTaskId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Manager approve ticket (Open → Approved)
app.post('/api/tasks/:id/approve', async (req, res) => {
  const taskId = parseInt(req.params.id);
  try {
    const [taskRows]: any = await pool.query('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (taskRows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    if (taskRows[0].status !== 'Open') {
      return res.status(400).json({ error: 'Hanya tiket berstatus Open yang bisa di-approve' });
    }
    await pool.query('UPDATE tasks SET status = "Approved" WHERE id = ?', [taskId]);
    broadcastUpdate();
    res.json({ message: 'Tiket berhasil di-approve oleh Manager' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error approving task' });
  }
});

// Manager reject ticket (Open → Rejected, device back to Up)
app.post('/api/tasks/:id/reject', async (req, res) => {
  const taskId = parseInt(req.params.id);
  const { reason } = req.body;
  try {
    const [taskRows]: any = await pool.query('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (taskRows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    if (taskRows[0].status !== 'Open') {
      return res.status(400).json({ error: 'Hanya tiket berstatus Open yang bisa di-reject' });
    }
    const task = taskRows[0];
    const rejectedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // 1. Reject ticket
    await pool.query(
      'UPDATE tasks SET status = "Rejected", completed_at = ?, resolution_notes = ? WHERE id = ?',
      [rejectedAt, reason || 'Tiket ditolak oleh Manager.', taskId]
    );

    // 2. Restore device status to Up
    await pool.query('UPDATE devices SET status = "Up" WHERE id = ?', [task.device_id]);

    broadcastUpdate();
    res.json({ message: 'Tiket berhasil di-reject oleh Manager' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error rejecting task' });
  }
});

// Manual assign task (only for Approved tickets)
app.post('/api/tasks/:id/assign', async (req, res) => {
  const taskId = parseInt(req.params.id);
  const { userId } = req.body;

  try {
    // Verify task exists and is in Approved status
    const [taskCheck]: any = await pool.query('SELECT status FROM tasks WHERE id = ?', [taskId]);
    if (taskCheck.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    if (taskCheck[0].status !== 'Approved' && taskCheck[0].status !== 'In Progress') {
      return res.status(400).json({ error: 'Tiket harus di-approve Manager terlebih dahulu sebelum bisa di-assign' });
    }

    const [userRows]: any = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userRows[0];

    // Update task
    await pool.query(
      'UPDATE tasks SET assigned_user_id = ?, assigned_user_name = ?, status = "In Progress" WHERE id = ?',
      [user.id, user.name, taskId]
    );

    // Update user stats
    await pool.query('UPDATE users SET status = "Busy", daily_tasks_count = daily_tasks_count + 1 WHERE id = ?', [user.id]);

    broadcastUpdate();
    res.json({ message: 'Task assigned successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Complete task endpoint with resolution notes
app.post('/api/tasks/:id/complete', async (req, res) => {
  const taskId = parseInt(req.params.id);
  const { resolution_notes } = req.body;
  const completedTime = new Date().toISOString().replace('T', ' ').substring(0, 19);

  try {
    const [taskRows]: any = await pool.query('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (taskRows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const task = taskRows[0];

    // 1. Device up
    await pool.query('UPDATE devices SET status = "Up" WHERE id = ?', [task.device_id]);

    // 2. Complete task
    await pool.query(
      'UPDATE tasks SET status = "Completed", completed_at = ?, resolution_notes = ? WHERE id = ?',
      [completedTime, resolution_notes || 'Tindakan perbaikan selesai.', taskId]
    );

    // 3. Record Mission
    await pool.query(
      'INSERT INTO missions (id, task_id, user_id, user_name, task_device_name, status, completed_at, resolution_notes) VALUES (?, ?, ?, ?, ?, "Completed", ?, ?)',
      [Date.now(), taskId, task.assigned_user_id, task.assigned_user_name, task.device_name, completedTime, resolution_notes || 'Tindakan perbaikan selesai.']
    );

    // 4. Update technician scores
    if (task.assigned_user_id) {
      await pool.query(
        'UPDATE users SET status = "Available", daily_tasks_count = GREATEST(0, daily_tasks_count - 1), mission_completed = mission_completed + 1 WHERE id = ?',
        [task.assigned_user_id]
      );
    }

    // Update Telegram Bot
    await updateTelegramMessage({ id: taskId, device_name: task.device_name }, 'Completed');

    broadcastUpdate();
    res.json({ message: 'Task completed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Update task steps checklist
app.put('/api/tasks/:id/steps', async (req, res) => {
  const taskId = parseInt(req.params.id);
  const { steps } = req.body;
  try {
    const stepsStr = typeof steps === 'string' ? steps : JSON.stringify(steps);
    await pool.query('UPDATE tasks SET steps = ? WHERE id = ?', [stepsStr, taskId]);
    broadcastUpdate();
    res.json({ message: 'Task steps updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error updating task steps' });
  }
});

// Manually create network incident ticket
app.post('/api/tasks', async (req, res) => {
  const { deviceId, severity, slaMinutes } = req.body;
  const newTaskId = Date.now();
  const startedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);

  try {
    const [deviceRows]: any = await pool.query('SELECT * FROM devices WHERE id = ?', [deviceId]);
    if (deviceRows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }
    const device = deviceRows[0];

    // Change device status to Down
    await pool.query('UPDATE devices SET status = "Down" WHERE id = ?', [device.id]);

    // Insert task
    await pool.query(
      'INSERT INTO tasks (id, device_id, device_name, ip_address, location, status, severity, started_at, sla_minutes) VALUES (?, ?, ?, ?, ?, "Open", ?, ?, ?)',
      [newTaskId, device.id, device.name, device.ip_address, device.location, severity || 'Alert', startedAt, slaMinutes || 30]
    );

    // Send Telegram Alert
    await sendTelegramAlert({
      id: newTaskId,
      device_name: device.name,
      ip_address: device.ip_address,
      location: device.location,
      severity: severity || 'Alert',
    });

    broadcastUpdate();
    res.status(201).json({ message: 'Task created successfully', taskId: newTaskId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error creating task' });
  }
});

// Daily Todos checklist CRUD
app.get('/api/daily-todos', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM daily_todos ORDER BY id DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'DB error fetching daily todos' });
  }
});

app.post('/api/daily-todos', async (req, res) => {
  const { task_name } = req.body;
  try {
    const [result]: any = await pool.query('INSERT INTO daily_todos (task_name) VALUES (?)', [task_name]);
    broadcastUpdate();
    res.status(201).json({ id: result.insertId, message: 'Todo created' });
  } catch (error) {
    res.status(500).json({ error: 'DB error creating todo' });
  }
});

app.put('/api/daily-todos/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { task_name, is_completed } = req.body;
  try {
    await pool.query(
      'UPDATE daily_todos SET task_name = ?, is_completed = ? WHERE id = ?',
      [task_name, is_completed ? 1 : 0, id]
    );
    broadcastUpdate();
    res.json({ message: 'Todo updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'DB error updating todo' });
  }
});

app.delete('/api/daily-todos/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await pool.query('DELETE FROM daily_todos WHERE id = ?', [id]);
    broadcastUpdate();
    res.json({ message: 'Todo deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'DB error deleting todo' });
  }
});

// Custom Missions CRUD
app.get('/api/custom-missions', async (req, res) => {
  try {
    const [missions]: any = await pool.query('SELECT * FROM custom_missions ORDER BY id DESC');
    const [participants]: any = await pool.query(
      'SELECT mp.mission_id, u.id, u.name, u.username, u.role FROM mission_participants mp JOIN users u ON mp.user_id = u.id'
    );
    
    const mappedMissions = missions.map((m: any) => {
      return {
        ...m,
        personnels: participants.filter((p: any) => p.mission_id === m.id)
      };
    });
    res.json(mappedMissions);
  } catch (error) {
    res.status(500).json({ error: 'DB error fetching custom missions' });
  }
});

app.post('/api/custom-missions', async (req, res) => {
  const { title, description, slots, user_ids, created_by, date_finished, duration_str, note, mission_image, progress_percent, status } = req.body;
  const createdAt = new Date().toLocaleString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(' pukul', ' -');
  
  try {
    const [result]: any = await pool.query(
      'INSERT INTO custom_missions (title, description, slots, progress_percent, created_at, status, created_by, date_finished, duration_str, note, mission_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [title, description || null, slots, progress_percent || 0, createdAt, status || 'Active', created_by || null, date_finished || null, duration_str || null, note || null, mission_image || null]
    );
    const missionId = result.insertId;

    if (user_ids && Array.isArray(user_ids)) {
      for (const userId of user_ids) {
        await pool.query('INSERT INTO mission_participants (mission_id, user_id) VALUES (?, ?)', [missionId, userId]);
      }
    }
    broadcastUpdate();
    res.status(201).json({ id: missionId, message: 'Mission created successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'DB error creating mission' });
  }
});

app.put('/api/custom-missions/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { title, description, slots, progress_percent, status, user_ids, created_by, date_finished, duration_str, note, mission_image } = req.body;
  try {
    await pool.query(
      'UPDATE custom_missions SET title = ?, description = ?, slots = ?, progress_percent = ?, status = ?, created_by = ?, date_finished = ?, duration_str = ?, note = ?, mission_image = ? WHERE id = ?',
      [title, description || null, slots, progress_percent, status, created_by || null, date_finished || null, duration_str || null, note || null, mission_image || null, id]
    );
    
    if (user_ids && Array.isArray(user_ids)) {
      await pool.query('DELETE FROM mission_participants WHERE mission_id = ?', [id]);
      for (const userId of user_ids) {
        await pool.query('INSERT INTO mission_participants (mission_id, user_id) VALUES (?, ?)', [id, userId]);
      }
    }
    broadcastUpdate();
    res.json({ message: 'Mission updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'DB error updating mission' });
  }
});

app.delete('/api/custom-missions/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await pool.query('DELETE FROM custom_missions WHERE id = ?', [id]);
    await pool.query('DELETE FROM mission_participants WHERE mission_id = ?', [id]);
    broadcastUpdate();
    res.json({ message: 'Mission deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'DB error deleting mission' });
  }
});

// Periodic Temp update route
app.post('/api/temp/update', async (req, res) => {
  const { temperature } = req.body;
  const recordedAt = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  try {
    await pool.query('INSERT INTO temp_logs (temperature, recorded_at) VALUES (?, ?)', [temperature, recordedAt]);
    broadcastUpdate();
    res.json({ message: 'Temperature log inserted' });
  } catch (error) {
    res.status(500).json({ error: 'DB error log temperature' });
  }
});

// ----------------------------------------------------
// Telegram bot triggered callbacks
// ----------------------------------------------------
const handleTelegramBotAction = async (action: 'accept' | 'complete', taskId: number) => {
  try {
    const [taskRows]: any = await pool.query('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (taskRows.length === 0) return;
    const task = taskRows[0];

    if (action === 'accept') {
      // Find first available technician
      const [techRows]: any = await pool.query('SELECT * FROM users WHERE role = "Teknisi" AND status = "Available" LIMIT 1');
      const tech = techRows.length > 0 ? techRows[0] : (await pool.query('SELECT * FROM users WHERE role = "Teknisi" LIMIT 1') as any)[0][0];

      if (!tech) return;

      // Update task and technician
      await pool.query('UPDATE tasks SET assigned_user_id = ?, assigned_user_name = ?, status = "In Progress" WHERE id = ?', [tech.id, tech.name, taskId]);
      await pool.query('UPDATE users SET status = "Busy", daily_tasks_count = daily_tasks_count + 1 WHERE id = ?', [tech.id]);
      
      await updateTelegramMessage({ id: taskId, device_name: task.device_name }, 'In Progress');

    } else if (action === 'complete') {
      const completedTime = new Date().toISOString().replace('T', ' ').substring(0, 19);

      // 1. Device up
      await pool.query('UPDATE devices SET status = "Up" WHERE id = ?', [task.device_id]);

      // 2. Complete task
      await pool.query('UPDATE tasks SET status = "Completed", completed_at = ?, resolution_notes = "Diselesaikan via Bot Telegram" WHERE id = ?', [completedTime, taskId]);

      // 3. Record Mission
      await pool.query(
        'INSERT INTO missions (id, task_id, user_id, user_name, task_device_name, status, completed_at, resolution_notes) VALUES (?, ?, ?, ?, ?, "Completed", ?, "Diselesaikan via Bot Telegram")',
        [Date.now(), taskId, task.assigned_user_id, task.assigned_user_name, task.device_name, completedTime]
      );

      // 4. Update technician scores
      await pool.query(
        'UPDATE users SET status = "Available", daily_tasks_count = GREATEST(0, daily_tasks_count - 1), mission_completed = mission_completed + 1 WHERE id = ?',
        [task.assigned_user_id]
      );

      await updateTelegramMessage({ id: taskId, device_name: task.device_name }, 'Completed');
    }

    broadcastUpdate();
  } catch (err) {
    console.error('Failed to handle telegram trigger action:', err);
  }
};

// PUBLIC ENDPOINT: Submit Open Ticket (No Authentication Required)
app.post('/api/public/submit-ticket', async (req, res) => {
  const { full_name, id_number, category, unit_specification, email, whatsapp_number, service_type, description, image_url } = req.body;

  // Validate required fields
  if (!full_name || !id_number || !category || !email || !whatsapp_number || !service_type || !description) {
    return res.status(400).json({ error: 'Semua field harus diisi' });
  }

  try {
    // Generate ticket number
    const ticketNumber = `TKT-${Date.now()}`;
    const now = new Date().toLocaleString('id-ID');

    const [result]: any = await pool.query(
      'INSERT INTO open_tickets (ticket_number, full_name, id_number, category, unit_specification, email, whatsapp_number, service_type, description, status, created_at, updated_at, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, "Open", ?, ?, ?)',
      [ticketNumber, full_name, id_number, category, unit_specification, email, whatsapp_number, service_type, description, now, now, image_url || null]
    );

    res.status(201).json({ 
      id: result.insertId, 
      ticket_number: ticketNumber,
      message: 'Ticket berhasil dibuat! Anda akan menerima notifikasi di email dan WhatsApp.' 
    });
    
    broadcastUpdate();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal membuat ticket. Silakan coba lagi.' });
  }
});

// PUBLIC ENDPOINT: Get ticket status (No Authentication Required)
app.get('/api/public/tickets/status', async (req, res) => {
  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ error: 'Parameter pencarian tidak boleh kosong' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT * FROM open_tickets WHERE ticket_number = ? OR id_number = ? ORDER BY id DESC',
      [query, query]
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error fetching ticket status' });
  }
});

// PROTECTED ENDPOINTS FOR TICKETS
app.get('/api/tickets', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM open_tickets ORDER BY id DESC');
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error fetching tickets' });
  }
});

app.put('/api/tickets/:id/assign', requireAuth, async (req, res) => {
  const ticketId = parseInt(req.params.id);
  const { userId } = req.body;

  try {
    const [userRows]: any = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'Teknisi tidak ditemukan' });
    }
    const user = userRows[0];

    const now = new Date().toLocaleString('id-ID');
    await pool.query(
      'UPDATE open_tickets SET assigned_user_id = ?, assigned_user_name = ?, status = "In Progress", updated_at = ? WHERE id = ?',
      [user.id, user.name, now, ticketId]
    );

    // Also set technician status to Busy
    await pool.query('UPDATE users SET status = "Busy", daily_tasks_count = daily_tasks_count + 1 WHERE id = ?', [user.id]);

    broadcastUpdate();
    res.json({ message: 'Tiket berhasil ditugaskan ke teknisi' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error assigning ticket' });
  }
});

app.put('/api/tickets/:id/resolve', requireAuth, async (req, res) => {
  const ticketId = parseInt(req.params.id);
  const { status, resolution_notes } = req.body; // status: 'Resolved' or 'Closed' or 'Rejected'

  if (!status || !['Resolved', 'Closed', 'Rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status tidak valid' });
  }

  try {
    const [ticketRows]: any = await pool.query('SELECT * FROM open_tickets WHERE id = ?', [ticketId]);
    if (ticketRows.length === 0) {
      return res.status(404).json({ error: 'Tiket tidak ditemukan' });
    }
    const ticket = ticketRows[0];

    const now = new Date().toLocaleString('id-ID');
    await pool.query(
      'UPDATE open_tickets SET status = ?, resolution_notes = ?, updated_at = ? WHERE id = ?',
      [status, resolution_notes || 'Tindakan selesai.', now, ticketId]
    );

    // If technician was assigned, make them Available again
    if (ticket.assigned_user_id) {
      await pool.query(
        'UPDATE users SET status = "Available", daily_tasks_count = GREATEST(0, daily_tasks_count - 1), mission_completed = mission_completed + 1 WHERE id = ?',
        [ticket.assigned_user_id]
      );
    }

    broadcastUpdate();
    res.json({ message: `Tiket berhasil di-update menjadi ${status}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error resolving ticket' });
  }
});

// ============================================================
// GACS ROUTES — GenieACS / Config / PON Map
// ============================================================

// Helper: get ACS config from DB
async function getACSConfig(): Promise<GenieACS.GenieACSConfig | null> {
  const [rows]: any = await pool.query('SELECT * FROM genieacs_credentials LIMIT 1');
  if (!rows || rows.length === 0) return null;
  return { host: rows[0].host, port: rows[0].port, username: rows[0].username, password: rows[0].password };
}

// ---- ACS Credentials ----
app.get('/api/config/acs', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, host, port, username, is_connected, last_test FROM genieacs_credentials LIMIT 1');
    res.json(rows);
  } catch { res.status(500).json({ error: 'DB error' }); }
});

app.post('/api/config/acs', requireAuth, async (req, res) => {
  const { host, port, username, password } = req.body;
  try {
    const [rows]: any = await pool.query('SELECT id FROM genieacs_credentials LIMIT 1');
    if (rows.length > 0) {
      await pool.query('UPDATE genieacs_credentials SET host=?, port=?, username=?, password=?, is_connected=0, last_test=NULL WHERE id=?',
        [host, port || 7557, username || null, password || null, rows[0].id]);
    } else {
      await pool.query('INSERT INTO genieacs_credentials (host, port, username, password) VALUES (?,?,?,?)',
        [host, port || 7557, username || null, password || null]);
    }
    res.json({ message: 'ACS config saved' });
  } catch { res.status(500).json({ error: 'DB error saving ACS config' }); }
});

app.post('/api/config/acs/test', requireAuth, async (req, res) => {
  try {
    const cfg = await getACSConfig();
    if (!cfg) return res.status(400).json({ success: false, error: 'Belum ada konfigurasi ACS' });
    const ok = await GenieACS.testConnection(cfg);
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await pool.query('UPDATE genieacs_credentials SET is_connected=?, last_test=? LIMIT 1', [ok ? 1 : 0, now]);
    res.json({ success: ok, message: ok ? 'Koneksi berhasil' : 'Koneksi gagal' });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// ---- MikroTik Config ----
app.get('/api/config/mikrotik', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, host, port, username, is_connected, last_test FROM mikrotik_credentials LIMIT 1');
    res.json(rows);
  } catch { res.status(500).json({ error: 'DB error' }); }
});

app.post('/api/config/mikrotik', requireAuth, async (req, res) => {
  const { host, port, username, password } = req.body;
  try {
    const [rows]: any = await pool.query('SELECT id FROM mikrotik_credentials LIMIT 1');
    if (rows.length > 0) {
      await pool.query('UPDATE mikrotik_credentials SET host=?, port=?, username=?, password=?, is_connected=0, last_test=NULL WHERE id=?',
        [host, port || 8728, username, password, rows[0].id]);
    } else {
      await pool.query('INSERT INTO mikrotik_credentials (host, port, username, password) VALUES (?,?,?,?)',
        [host, port || 8728, username, password]);
    }
    res.json({ message: 'MikroTik config saved' });
  } catch { res.status(500).json({ error: 'DB error saving MikroTik config' }); }
});

import * as Mikrotik from './mikrotik';

app.post('/api/config/mikrotik/test', requireAuth, async (req, res) => {
  try {
    const client = await Mikrotik.connectMikrotik();
    if (client) {
      res.json({ success: true, message: 'Koneksi ke MikroTik berhasil' });
    }
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/mikrotik/netwatch', requireAuth, async (req, res) => {
  try {
    const data = await Mikrotik.getNetwatchList();
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/mikrotik/hotspot', requireAuth, async (req, res) => {
  try {
    const data = await Mikrotik.getHotspotActive();
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/mikrotik/leases', requireAuth, async (req, res) => {
  try {
    const data = await Mikrotik.getDhcpLeases();
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ---- Telegram Bot Config ----
app.get('/api/config/telegram-bot', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, chat_id, is_connected, last_test FROM telegram_bot_config LIMIT 1');
    res.json(rows);
  } catch { res.status(500).json({ error: 'DB error' }); }
});

app.post('/api/config/telegram-bot', requireAuth, async (req, res) => {
  const { bot_token, chat_id } = req.body;
  try {
    const [rows]: any = await pool.query('SELECT id FROM telegram_bot_config LIMIT 1');
    if (rows.length > 0) {
      await pool.query('UPDATE telegram_bot_config SET bot_token=?, chat_id=?, is_connected=0, last_test=NULL WHERE id=?',
        [bot_token, chat_id, rows[0].id]);
    } else {
      await pool.query('INSERT INTO telegram_bot_config (bot_token, chat_id) VALUES (?,?)', [bot_token, chat_id]);
    }
    res.json({ message: 'Telegram config saved' });
  } catch { res.status(500).json({ error: 'DB error saving Telegram config' }); }
});

app.post('/api/config/telegram-bot/test', requireAuth, async (req, res) => {
  try {
    const [rows]: any = await pool.query('SELECT * FROM telegram_bot_config LIMIT 1');
    if (!rows || rows.length === 0) return res.status(400).json({ success: false, error: 'Konfigurasi Telegram belum ada' });
    const tlgToken = rows[0].bot_token;
    const chatId = rows[0].chat_id;
    const r = await fetch(`https://api.telegram.org/bot${tlgToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: '✅ Nemesys — Koneksi Telegram berhasil!' }),
    });
    const data: any = await r.json();
    const ok = data.ok === true;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await pool.query('UPDATE telegram_bot_config SET is_connected=?, last_test=? LIMIT 1', [ok ? 1 : 0, now]);
    res.json({ success: ok, message: ok ? 'Pesan test terkirim' : data.description || 'Gagal' });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// ---- GenieACS Stats (Dashboard) ----
app.get('/api/gacs/stats', requireAuth, async (req, res) => {
  try {
    const cfg = await getACSConfig();
    if (!cfg) return res.json({ total: 0, online: 0, offline: 0, unprovisioned: 0 });
    const result = await GenieACS.getDeviceStats(cfg);
    if (!result.success) return res.json({ total: 0, online: 0, offline: 0, unprovisioned: 0 });
    res.json(result.data);
  } catch (e: any) { res.json({ total: 0, online: 0, offline: 0, unprovisioned: 0 }); }
});

app.get('/api/gacs/uplink-stats', requireAuth, async (req, res) => {
  try {
    const cfg = await getACSConfig();
    if (!cfg) return res.json({ excellent: 0, good: 0, fair: 0, poor: 0, no_signal: 0 });
    const result = await GenieACS.getUplinkStats(cfg);
    if (!result.success) return res.json({ excellent: 0, good: 0, fair: 0, poor: 0, no_signal: 0 });
    res.json(result.data);
  } catch (e: any) { res.json({ excellent: 0, good: 0, fair: 0, poor: 0, no_signal: 0 }); }
});

app.get('/api/gacs/recent', requireAuth, async (req, res) => {
  try {
    const cfg = await getACSConfig();
    if (!cfg) return res.json([]);
    const result = await GenieACS.getRecentDevices(cfg, 10);
    if (!result.success) return res.json([]);
    res.json(result.data);
  } catch (e: any) { res.json([]); }
});

// ---- GenieACS Bulk Action ----
app.post('/api/gacs/bulk-action', requireAuth, async (req, res) => {
  try {
    const { action, deviceIds, tag } = req.body;
    if (!action || !deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
      return res.status(400).json({ error: 'Invalid parameters: action and deviceIds[] required' });
    }
    const cfg = await getACSConfig();
    if (!cfg) return res.status(400).json({ error: 'ACS belum dikonfigurasi' });

    const results: { deviceId: string; ok: boolean; error?: string }[] = [];
    let succeeded = 0;
    let failed = 0;

    for (const deviceId of deviceIds) {
      try {
        let result: { success: boolean; error?: string };
        if (action === 'summon') {
          result = await GenieACS.summonDevice(cfg, deviceId);
        } else if (action === 'reboot') {
          result = await GenieACS.rebootDevice(cfg, deviceId);
        } else if (action === 'tag' || action === 'untag') {
          if (!tag) { results.push({ deviceId, ok: false, error: 'Tag name required' }); failed++; continue; }
          const method = action === 'tag' ? 'POST' : 'DELETE';
          const tagResult = await GenieACS.genieRawRequest(cfg, `/devices/${encodeURIComponent(deviceId)}/tags/${encodeURIComponent(tag)}`, method);
          result = { success: tagResult.success, error: tagResult.error };
        } else if (action === 'delete') {
          const delResult = await GenieACS.genieRawRequest(cfg, `/devices/${encodeURIComponent(deviceId)}`, 'DELETE');
          result = { success: delResult.success, error: delResult.error };
        } else {
          result = { success: false, error: `Unknown action: ${action}` };
        }
        if (result.success) { succeeded++; results.push({ deviceId, ok: true }); }
        else { failed++; results.push({ deviceId, ok: false, error: result.error }); }
      } catch (e: any) {
        failed++;
        results.push({ deviceId, ok: false, error: e.message });
      }
    }

    res.json({ success: succeeded > 0, total: deviceIds.length, succeeded, failed, results });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});



// ---- GenieACS Device List ----
app.get('/api/gacs/devices', requireAuth, async (req, res) => {
  try {
    const cfg = await getACSConfig();
    if (!cfg) return res.status(400).json({ error: 'ACS belum dikonfigurasi. Pergi ke Konfigurasi > ACS.' });
    const limit = parseInt(req.query.limit as string) || 100;
    const skip = parseInt(req.query.skip as string) || 0;
    const result = await GenieACS.getDevices(cfg, {}, limit, skip);
    if (!result.success) return res.status(500).json({ error: result.error });
    const parsed = (result.data || []).map((d: any) => GenieACS.parseDeviceData(d));
    res.json({ devices: parsed, total: parsed.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ---- GenieACS Device Detail ----
app.get('/api/gacs/devices/:deviceId', requireAuth, async (req, res) => {
  try {
    const cfg = await getACSConfig();
    if (!cfg) return res.status(400).json({ error: 'ACS belum dikonfigurasi' });
    const result = await GenieACS.getDevice(cfg, decodeURIComponent(req.params.deviceId));
    if (!result.success) return res.status(404).json({ error: result.error });
    res.json(GenieACS.parseDeviceData(result.data));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ---- Device Actions ----
app.post('/api/gacs/devices/:deviceId/summon', requireAuth, async (req, res) => {
  try {
    const cfg = await getACSConfig();
    if (!cfg) return res.status(400).json({ error: 'ACS belum dikonfigurasi' });
    const result = await GenieACS.summonDevice(cfg, decodeURIComponent(req.params.deviceId));
    if (result.success && (req as any).user) {
      await writeLog((req as any).user.id, 'Summon Device', `Summoned device ${req.params.deviceId}`, req.ip);
    }
    res.json({ success: result.success, message: result.success ? 'Summon berhasil dikirim' : 'Gagal summon', error: result.error });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/gacs/devices/:deviceId/reboot', requireAuth, async (req, res) => {
  try {
    const cfg = await getACSConfig();
    if (!cfg) return res.status(400).json({ error: 'ACS belum dikonfigurasi' });
    const result = await GenieACS.rebootDevice(cfg, decodeURIComponent(req.params.deviceId));
    if (result.success && (req as any).user) {
      await writeLog((req as any).user.id, 'Reboot Device', `Rebooted device ${req.params.deviceId}`, req.ip);
    }
    res.json({ success: result.success, message: result.success ? 'Reboot berhasil dikirim' : 'Gagal reboot', error: result.error });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/gacs/devices/:deviceId/refresh', requireAuth, async (req, res) => {
  try {
    const cfg = await getACSConfig();
    if (!cfg) return res.status(400).json({ error: 'ACS belum dikonfigurasi' });
    const { objectPath } = req.body;
    const result = await GenieACS.addRefreshTask(cfg, decodeURIComponent(req.params.deviceId), objectPath || 'InternetGatewayDevice');
    res.json({ success: result.success, message: result.success ? 'Refresh dikirim' : 'Gagal refresh', error: result.error });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/gacs/devices/:deviceId/wifi', requireAuth, async (req, res) => {
  try {
    const cfg = await getACSConfig();
    if (!cfg) return res.status(400).json({ error: 'ACS belum dikonfigurasi' });
    const { ssid, password, wlanIndex, securityMode } = req.body;
    if (!ssid) return res.status(400).json({ error: 'SSID wajib diisi' });
    const result = await GenieACS.setWiFiConfig(cfg, decodeURIComponent(req.params.deviceId), ssid, password || '', wlanIndex || 1, securityMode || 'WPA2PSK');
    if (result.success && (req as any).user) {
      await writeLog((req as any).user.id, 'Edit WiFi', `Changed WiFi for ${req.params.deviceId} (SSID: ${ssid})`, req.ip);
    }
    res.json({ success: result.success, message: result.success ? 'WiFi config dikirim' : 'Gagal set WiFi', error: result.error });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/gacs/devices/:deviceId/get-params', requireAuth, async (req, res) => {
  try {
    const cfg = await getACSConfig();
    if (!cfg) return res.status(400).json({ error: 'ACS belum dikonfigurasi' });
    const { parameterNames } = req.body;
    if (!Array.isArray(parameterNames) || parameterNames.length === 0)
      return res.status(400).json({ error: 'parameterNames harus array string' });
    const result = await GenieACS.getParameterValues(cfg, decodeURIComponent(req.params.deviceId), parameterNames);
    res.json({ success: result.success, message: result.success ? 'Task getParameterValues dikirim' : 'Gagal', error: result.error });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ====== GAP #1: WAN Config Management ======
app.post('/api/gacs/devices/:deviceId/wan', requireAuth, async (req, res) => {
  try {
    const deviceId = decodeURIComponent(req.params.deviceId);
    const { index, type, params, name } = req.body;
    if (!index || !type || !params) return res.status(400).json({ error: 'Missing required: index, type, params' });
    if (index < 1 || index > 8) return res.status(400).json({ error: 'index must be between 1-8' });
    if (!['ppp', 'ip'].includes(type)) return res.status(400).json({ error: 'type must be ppp or ip' });
    if (type === 'ppp' && (!params.Username || !params.Password)) return res.status(400).json({ error: 'PPPoE requires Username and Password' });
    const cfg = await getACSConfig();
    if (!cfg) return res.status(400).json({ error: 'ACS belum dikonfigurasi' });
    const result = await GenieACS.setWanConfig(cfg, deviceId, Number(index), type, params, name);
    res.json({ ...result, message: result.success ? 'WAN configuration task dikirim ke ACS' : 'Gagal mengirim task' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.put('/api/gacs/devices/:deviceId/wan', requireAuth, async (req, res) => {
  try {
    const deviceId = decodeURIComponent(req.params.deviceId);
    const { index, type, params } = req.body;
    if (!index || !type || !params) return res.status(400).json({ error: 'Missing required: index, type, params' });
    if (!['ppp', 'ip'].includes(type)) return res.status(400).json({ error: 'type must be ppp or ip' });
    if (Object.keys(params).length === 0) return res.status(400).json({ error: 'No parameters to update' });
    const cfg = await getACSConfig();
    if (!cfg) return res.status(400).json({ error: 'ACS belum dikonfigurasi' });
    const result = await GenieACS.setWanConfig(cfg, deviceId, Number(index), type, params);
    res.json({ ...result, message: result.success ? 'WAN configuration updated via ACS' : 'Gagal update' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/gacs/devices/:deviceId/wan', requireAuth, async (req, res) => {
  try {
    const deviceId = decodeURIComponent(req.params.deviceId);
    const { index, type, service_list, connection_name, confirm_tr069_delete } = req.body;
    if (!index || !type) return res.status(400).json({ error: 'Missing required: index, type' });
    const cfg = await getACSConfig();
    if (!cfg) return res.status(400).json({ error: 'ACS belum dikonfigurasi' });
    const result = await GenieACS.disableWanConnection(cfg, deviceId, Number(index), type, service_list, connection_name, confirm_tr069_delete);
    if (result.requiresConfirmation) return res.status(409).json(result);
    res.json({ ...result, message: result.success ? 'WAN connection dinonaktifkan via ACS' : 'Gagal' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ====== GAP #2: DHCP Config ======
app.post('/api/gacs/devices/:deviceId/dhcp', requireAuth, async (req, res) => {
  try {
    const deviceId = decodeURIComponent(req.params.deviceId);
    const { params } = req.body;
    if (!params || Object.keys(params).length === 0) return res.status(400).json({ error: 'No DHCP parameters provided' });
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (params.MinAddress && !ipRegex.test(params.MinAddress)) return res.status(400).json({ error: 'Invalid MinAddress format' });
    if (params.MaxAddress && !ipRegex.test(params.MaxAddress)) return res.status(400).json({ error: 'Invalid MaxAddress format' });
    if (params.SubnetMask && !ipRegex.test(params.SubnetMask)) return res.status(400).json({ error: 'Invalid SubnetMask format' });
    if (params.IPRouters && !ipRegex.test(params.IPRouters)) return res.status(400).json({ error: 'Invalid IPRouters format' });
    if (params.DHCPLeaseTime && Number(params.DHCPLeaseTime) < 60) return res.status(400).json({ error: 'DHCPLeaseTime must be >= 60 seconds' });
    const cfg = await getACSConfig();
    if (!cfg) return res.status(400).json({ error: 'ACS belum dikonfigurasi' });
    const result = await GenieACS.setDhcpConfig(cfg, deviceId, params);
    res.json({ ...result, message: result.success ? 'DHCP configuration task dikirim ke ACS' : 'Gagal mengirim task' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});


app.get('/api/map/items', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM map_items ORDER BY id ASC');
    res.json(rows);
  } catch { res.status(500).json({ error: 'DB error' }); }
});

app.post('/api/map/items', requireAuth, async (req, res) => {
  const { item_type, parent_id, name, latitude, longitude, genieacs_device_id, status, properties } = req.body;
  try {
    const [result]: any = await pool.query(
      'INSERT INTO map_items (item_type, parent_id, name, latitude, longitude, genieacs_device_id, status, properties) VALUES (?,?,?,?,?,?,?,?)',
      [item_type, parent_id || null, name, latitude, longitude, genieacs_device_id || null, status || 'unknown',
        properties ? JSON.stringify(properties) : null]
    );
    broadcastUpdate();
    res.status(201).json({ id: result.insertId, message: 'Map item created' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.put('/api/map/items/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const { item_type, parent_id, name, latitude, longitude, genieacs_device_id, status, properties } = req.body;
  try {
    await pool.query(
      'UPDATE map_items SET item_type=?, parent_id=?, name=?, latitude=?, longitude=?, genieacs_device_id=?, status=?, properties=? WHERE id=?',
      [item_type, parent_id || null, name, latitude, longitude, genieacs_device_id || null, status || 'unknown',
        properties ? JSON.stringify(properties) : null, id]
    );
    broadcastUpdate();
    res.json({ message: 'Map item updated' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/map/items/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await pool.query('DELETE FROM map_items WHERE id = ?', [id]);
    broadcastUpdate();
    res.json({ message: 'Map item deleted' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ---- PON Map Connections CRUD ----
app.get('/api/map/connections', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM map_connections ORDER BY id ASC');
    res.json(rows);
  } catch { res.status(500).json({ error: 'DB error' }); }
});

app.post('/api/map/connections', requireAuth, async (req, res) => {
  const { from_item_id, to_item_id, connection_type, path_coordinates } = req.body;
  try {
    const [result]: any = await pool.query(
      'INSERT INTO map_connections (from_item_id, to_item_id, connection_type, path_coordinates) VALUES (?,?,?,?)',
      [from_item_id, to_item_id, connection_type || 'online',
        path_coordinates ? JSON.stringify(path_coordinates) : null]
    );
    broadcastUpdate();
    res.status(201).json({ id: result.insertId, message: 'Connection created' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.put('/api/map/connections/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const { from_item_id, to_item_id, connection_type, path_coordinates } = req.body;
  try {
    await pool.query(
      'UPDATE map_connections SET from_item_id=?, to_item_id=?, connection_type=?, path_coordinates=? WHERE id=?',
      [from_item_id, to_item_id, connection_type || 'online',
        path_coordinates ? JSON.stringify(path_coordinates) : null, id]
    );
    broadcastUpdate();
    res.json({ message: 'Connection updated' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/map/connections/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await pool.query('DELETE FROM map_connections WHERE id = ?', [id]);
    broadcastUpdate();
    res.json({ message: 'Connection deleted' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ---- MAP API Phase 3 Enhancements ----
app.put('/api/map/items/:id/position', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const { latitude, longitude } = req.body;
  if (isNaN(latitude) || isNaN(longitude)) return res.status(400).json({ error: 'Invalid coordinates' });
  try {
    await pool.query('UPDATE map_items SET latitude = ?, longitude = ? WHERE id = ?', [latitude, longitude, id]);
    broadcastUpdate();
    res.json({ success: true, message: 'Position updated' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.put('/api/map/connections/:id/waypoints', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const { path_coordinates } = req.body;
  try {
    await pool.query('UPDATE map_connections SET path_coordinates = ? WHERE id = ?', [
      path_coordinates ? JSON.stringify(path_coordinates) : null, id
    ]);
    broadcastUpdate();
    res.json({ success: true, message: 'Waypoints updated' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/map/available-onus', requireAuth, async (req, res) => {
  try {
    // Get all devices mapped
    const [rows]: any = await pool.query('SELECT genieacs_device_id FROM onu_config WHERE genieacs_device_id IS NOT NULL');
    const mappedIds = new Set(rows.map((r: any) => r.genieacs_device_id));

    // Get all devices from ACS (simplified for MVP, ideally should use a helper)
    const { getGenieACSCredentials, genieRequest } = require('./genieacs');
    const creds = await getGenieACSCredentials();
    if (!creds) return res.json({ available: [] });
    
    // Just fetch projection
    const url = `http://${creds.host}:${creds.port}/devices?projection=_id,InternetGatewayDevice.DeviceInfo.SerialNumber`;
    const response = await genieRequest(url, 'GET', creds);
    if (!response || response.error) throw new Error(response?.error || 'ACS Error');
    
    const all = Array.isArray(response) ? response : [];
    const available = all.filter(d => !mappedIds.has(d._id)).map(d => ({
      _id: d._id,
      serialNumber: d.InternetGatewayDevice?.DeviceInfo?.SerialNumber?._value || d._id
    }));
    
    res.json({ success: true, available });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/map/recalculate', requireAuth, async (req, res) => {
  try {
    const { calculatePONPower } = require('./PONCalculator');
    const [odpList]: any = await pool.query(`
      SELECT mi.id, mi.name, oc.port_count, oc.input_power, oc.splitter_ratio, oc.calculated_power,
             parent.id as parent_id, parent.item_type as parent_type
      FROM map_items mi
      INNER JOIN odp_config oc ON oc.map_item_id = mi.id
      LEFT JOIN map_items parent ON parent.id = mi.parent_id
      WHERE mi.item_type = 'odp'
    `);
    const updated: any[] = [];
    const errors: any[] = [];
    for (const odp of odpList) {
      try {
        let inputPower = odp.input_power;
        if ((!inputPower || inputPower === 0) && odp.parent_type === 'odc') {
          const [oltPort]: any = await pool.query(`
            SELECT pp.output_power FROM olt_pon_ports pp
            INNER JOIN odc_config oc2 ON oc2.olt_pon_port_id = pp.id
            WHERE oc2.map_item_id = ? LIMIT 1
          `, [odp.parent_id]);
          if (oltPort.length > 0) inputPower = oltPort[0].output_power;
        }
        if (!inputPower) { errors.push({ odp: odp.name, reason: 'No input power available' }); continue; }
        const splitterRatio = odp.splitter_ratio || '1:8';
        const result = calculatePONPower({ inputPower: parseFloat(inputPower), splitterRatio, fiberLoss: 0.35, distance: 0 });
        const oldPower = odp.calculated_power;
        await pool.query('UPDATE odp_config SET calculated_power = ? WHERE map_item_id = ?', [result.outputPower, odp.id]);
        updated.push({ odp: odp.name, old_power: oldPower, new_power: result.outputPower, signal_quality: result.signalQuality });
      } catch (e: any) { errors.push({ odp: odp.name, reason: e.message }); }
    }
    broadcastUpdate();
    res.json({ success: true, total_updated: updated.length, total_errors: errors.length, details: updated, errors });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
// ----------------------------------------

// ====== GAP #3: ODP Port Manager ======
app.get('/api/map/odp-ports', requireAuth, async (req, res) => {
  try {
    const [odpItems]: any = await pool.query(`
      SELECT mi.id, mi.name, mi.status, COALESCE(oc.port_count, 8) as port_count
      FROM map_items mi
      LEFT JOIN odp_config oc ON mi.id = oc.map_item_id
      WHERE mi.item_type = 'odp'
      ORDER BY mi.name
    `);
    const result = [];
    for (const odp of odpItems) {
      const [occupied]: any = await pool.query(`
        SELECT oc.odp_port FROM onu_config oc
        INNER JOIN map_items mi ON mi.id = oc.map_item_id
        WHERE mi.parent_id = ? AND oc.odp_port IS NOT NULL
      `, [odp.id]);
      const occupiedPorts = occupied.map((r: any) => r.odp_port);
      const available = [];
      for (let i = 1; i <= odp.port_count; i++) if (!occupiedPorts.includes(i)) available.push(i);
      result.push({ id: odp.id, name: odp.name, status: odp.status, port_count: odp.port_count, occupied_ports: occupiedPorts, available_ports: available });
    }
    res.json({ success: true, odp_list: result });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/map/pon-ports', requireAuth, async (req, res) => {
  try {
    const [rows]: any = await pool.query(`
      SELECT pp.id, pp.pon_number, pp.output_power, pp.olt_item_id, mi.name as olt_name
      FROM olt_pon_ports pp
      INNER JOIN map_items mi ON mi.id = pp.olt_item_id
      ORDER BY mi.name, pp.pon_number
    `);
    const result = [];
    for (const port of rows) {
      const [odc]: any = await pool.query(`
        SELECT mi.name FROM map_items mi
        INNER JOIN odc_config oc ON oc.map_item_id = mi.id
        WHERE oc.olt_pon_port_id = ? LIMIT 1
      `, [port.id]);
      result.push({ ...port, is_used: odc.length > 0, connected_odc_name: odc[0]?.name || null });
    }
    res.json({ success: true, ports: result });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/map/used-ports', requireAuth, async (req, res) => {
  try {
    const { parent_id, parent_type } = req.query;
    if (!parent_id || !parent_type) return res.status(400).json({ error: 'parent_id and parent_type required' });
    let rows: any;
    if (parent_type === 'odc') {
      [rows] = await pool.query(`SELECT oc.odc_port as used_port FROM odp_config oc INNER JOIN map_items mi ON mi.id = oc.map_item_id WHERE mi.parent_id = ? AND oc.odc_port IS NOT NULL`, [parent_id]);
    } else if (parent_type === 'odp') {
      [rows] = await pool.query(`SELECT oc.odp_port as used_port FROM onu_config oc INNER JOIN map_items mi ON mi.id = oc.map_item_id WHERE mi.parent_id = ? AND oc.odp_port IS NOT NULL`, [parent_id]);
    } else return res.status(400).json({ error: 'parent_type must be odc or odp' });
    res.json({ success: true, used_ports: (rows as any[]).map((r: any) => r.used_port) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ====== GAP #5: ONU Location Batch ======
app.post('/api/map/onu-locations/batch', requireAuth, async (req, res) => {
  try {
    const { serial_numbers } = req.body;
    if (!serial_numbers || !Array.isArray(serial_numbers) || serial_numbers.length === 0)
      return res.status(400).json({ error: 'serial_numbers[] required' });
    if (serial_numbers.length > 100) return res.status(400).json({ error: 'Max 100 serial numbers per batch' });
    const patterns = serial_numbers.map(() => 'oc.genieacs_device_id LIKE ?').join(' OR ');
    const values = serial_numbers.map((sn: string) => `%${sn}%`);
    const [rows]: any = await pool.query(`
      SELECT onu.id as onu_id, onu.name as onu_name, onu.latitude as onu_lat, onu.longitude as onu_lng,
             oc.odp_port as onu_port, oc.genieacs_device_id as onu_device_id,
             odp.id as odp_id, odp.name as odp_name, odp.latitude as odp_lat, odp.longitude as odp_lng,
             odc.id as odc_id, odc.name as odc_name,
             olt.id as olt_id, olt.name as olt_name
      FROM map_items onu
      INNER JOIN onu_config oc ON oc.map_item_id = onu.id
      LEFT JOIN map_items odp ON odp.id = onu.parent_id AND odp.item_type = 'odp'
      LEFT JOIN map_items odc ON odc.id = odp.parent_id AND odc.item_type = 'odc'
      LEFT JOIN map_items olt ON olt.id = odc.parent_id AND olt.item_type = 'olt'
      WHERE onu.item_type = 'onu' AND (${patterns})
    `, values);
    const locations: Record<string, any> = {};
    for (const row of rows) {
      for (const sn of serial_numbers) {
        if (row.onu_device_id && row.onu_device_id.toLowerCase().includes(sn.toLowerCase()) && !locations[sn]) {
          locations[sn] = {
            found: true,
            onu: { id: row.onu_id, name: row.onu_name, lat: row.onu_lat, lng: row.onu_lng, port: row.onu_port || 'N/A' },
            ...(row.odp_id ? { odp: { id: row.odp_id, name: row.odp_name, lat: row.odp_lat, lng: row.odp_lng } } : {}),
            ...(row.odc_id ? { odc: { id: row.odc_id, name: row.odc_name } } : {}),
            ...(row.olt_id ? { olt: { id: row.olt_id, name: row.olt_name } } : {}),
          };
        }
      }
    }
    for (const sn of serial_numbers) if (!locations[sn]) locations[sn] = { found: false };
    res.json({ success: true, locations });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ====== GAP #9: Server Links Management ======
app.get('/api/map/items/:id/server-links', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const [items]: any = await pool.query(`SELECT properties FROM map_items WHERE id = ? AND item_type = 'server'`, [id]);
    if (!items.length) return res.status(404).json({ error: 'Server node not found' });
    const props = items[0].properties ? JSON.parse(items[0].properties) : {};
    const [ports]: any = await pool.query(`SELECT port_number, output_power FROM server_pon_ports WHERE map_item_id = ? ORDER BY port_number`, [id]);
    res.json({ success: true, isp_link: props.isp_link || '', mikrotik_device_id: props.mikrotik_device_id || '', olt_link: props.olt_link || '', pon_ports: ports });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.put('/api/map/items/:id/server-links', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { isp_link, mikrotik_device_id, olt_link, pon_ports } = req.body;
    const [items]: any = await pool.query(`SELECT properties FROM map_items WHERE id = ? AND item_type = 'server'`, [id]);
    if (!items.length) return res.status(404).json({ error: 'Server node not found' });
    const props = items[0].properties ? JSON.parse(items[0].properties) : {};
    props.isp_link = isp_link || '';
    props.mikrotik_device_id = mikrotik_device_id || '';
    props.olt_link = olt_link || '';
    await pool.query(`UPDATE map_items SET properties = ? WHERE id = ?`, [JSON.stringify(props), id]);
    if (Array.isArray(pon_ports) && pon_ports.length > 0) {
      await pool.query(`DELETE FROM server_pon_ports WHERE map_item_id = ?`, [id]);
      for (const port of pon_ports) {
        if (port.port_number && port.output_power !== undefined) {
          await pool.query(`INSERT INTO server_pon_ports (map_item_id, port_number, output_power) VALUES (?, ?, ?)`, [id, port.port_number, port.output_power]);
        }
      }
    }
    broadcastUpdate();
    res.json({ success: true, message: 'Server links updated successfully' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ====== GAP #4: Client Logs ======
app.post('/api/client-logs', async (req, res) => {
  try {
    const { level, message, url } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });
    const validLevels = ['INFO', 'WARN', 'ERROR', 'DEBUG'];
    const logLevel = validLevels.includes((level || '').toUpperCase()) ? level.toUpperCase() : 'INFO';
    const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '').split(',')[0].trim();
    const ua = (req.headers['user-agent'] || '').substring(0, 500);
    await pool.query(`INSERT INTO client_logs (level, message, url, user_agent, ip_address) VALUES (?, ?, ?, ?, ?)`,
      [logLevel, message.substring(0, 2000), (url || '').substring(0, 500) || null, ua || null, ip || null]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/client-logs', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 200, 500);
    const level = req.query.level as string;
    let q = 'SELECT * FROM client_logs';
    const params: any[] = [];
    if (level && level !== 'ALL') { q += ' WHERE level = ?'; params.push(level.toUpperCase()); }
    q += ' ORDER BY id DESC LIMIT ?'; params.push(limit);
    const [rows] = await pool.query(q, params);
    res.json({ success: true, logs: rows });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/client-logs', requireAuth, async (req, res) => {
  try {
    await pool.query('TRUNCATE TABLE client_logs');
    res.json({ success: true, message: 'Client logs cleared' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ====== GAP #10: Full Health Check ======
app.get('/api/health/full', requireAuth, async (req, res) => {
  const checks: Record<string, any> = {};
  let overallStatus = 'healthy';
  // 1. Database
  try {
    await pool.query('SELECT 1');
    checks.database = { status: 'ok', message: 'Connected' };
  } catch (e: any) { checks.database = { status: 'error', message: e.message }; overallStatus = 'unhealthy'; }
  // 2. GenieACS
  try {
    const [cred]: any = await pool.query('SELECT host, port FROM genieacs_credentials WHERE is_connected = 1 LIMIT 1');
    if (!cred.length) { checks.genieacs = { status: 'warning', message: 'Not configured' }; if (overallStatus === 'healthy') overallStatus = 'degraded'; }
    else {
      const start = Date.now();
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5000);
        const resp = await fetch(`http://${cred[0].host}:${cred[0].port}/devices?limit=1`, { signal: ctrl.signal });
        clearTimeout(t);
        checks.genieacs = { status: resp.ok ? 'ok' : 'error', message: resp.ok ? 'Reachable' : `HTTP ${resp.status}`, latency_ms: Date.now() - start };
        if (!resp.ok && overallStatus === 'healthy') overallStatus = 'degraded';
      } catch { checks.genieacs = { status: 'error', message: 'Unreachable / timeout' }; if (overallStatus !== 'unhealthy') overallStatus = 'degraded'; }
    }
  } catch (e: any) { checks.genieacs = { status: 'error', message: e.message }; }
  // 3. MikroTik
  try {
    const [mt]: any = await pool.query('SELECT is_connected FROM mikrotik_credentials LIMIT 1');
    if (!mt.length) checks.mikrotik = { status: 'warning', message: 'Not configured' };
    else { checks.mikrotik = { status: mt[0].is_connected ? 'ok' : 'error', message: mt[0].is_connected ? 'Connected' : 'Disconnected' }; if (!mt[0].is_connected && overallStatus === 'healthy') overallStatus = 'degraded'; }
  } catch (e: any) { checks.mikrotik = { status: 'error', message: e.message }; }
  // 4. Telegram
  try {
    const [tg]: any = await pool.query('SELECT bot_token FROM telegram_bot_config WHERE is_connected = 1 LIMIT 1');
    if (!tg.length) { checks.telegram = { status: 'warning', message: 'Not configured' }; }
    else {
      const resp = await fetch(`https://api.telegram.org/bot${tg[0].bot_token}/getWebhookInfo`);
      const data: any = await resp.json();
      checks.telegram = { status: 'ok', message: 'Bot active', pending_updates: data?.result?.pending_update_count || 0 };
    }
  } catch (e: any) { checks.telegram = { status: 'error', message: e.message }; }
  // 5. Memory
  const mem = process.memoryUsage();
  checks.memory = { status: mem.heapUsed / mem.heapTotal > 0.9 ? 'warning' : 'ok', rss_mb: Math.round(mem.rss/1024/1024), heap_used_mb: Math.round(mem.heapUsed/1024/1024), heap_total_mb: Math.round(mem.heapTotal/1024/1024) };
  res.status(overallStatus === 'unhealthy' ? 503 : 200).json({ status: overallStatus, timestamp: new Date().toISOString(), uptime_seconds: Math.floor(process.uptime()), checks });
});

// ====== GAP #11: Report Schedules CRUD ======
app.get('/api/report-schedules', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM report_schedules ORDER BY id');
    res.json({ success: true, schedules: rows });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/report-schedules', requireAuth, async (req, res) => {
  try {
    const { report_type, schedule_time, schedule_day, chat_id } = req.body;
    if (!report_type || !schedule_time) return res.status(400).json({ error: 'report_type and schedule_time required' });
    if (!['daily', 'weekly'].includes(report_type)) return res.status(400).json({ error: 'report_type must be daily or weekly' });
    await pool.query(`INSERT INTO report_schedules (report_type, schedule_time, schedule_day, chat_id) VALUES (?, ?, ?, ?)`,
      [report_type, schedule_time, schedule_day || null, chat_id || null]);
    res.json({ success: true, message: 'Schedule created' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.put('/api/report-schedules/:id', requireAuth, async (req, res) => {
  try {
    const { report_type, schedule_time, schedule_day, is_active, chat_id } = req.body;
    await pool.query(`UPDATE report_schedules SET
      report_type = COALESCE(?, report_type),
      schedule_time = COALESCE(?, schedule_time),
      schedule_day = ?,
      is_active = COALESCE(?, is_active),
      chat_id = ?
      WHERE id = ?`,
      [report_type || null, schedule_time || null, schedule_day !== undefined ? schedule_day : null, is_active !== undefined ? (is_active ? 1 : 0) : null, chat_id || null, req.params.id]);
    res.json({ success: true, message: 'Schedule updated' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/report-schedules/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM report_schedules WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Schedule deleted' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/report-schedules/:id/send', requireAuth, async (req, res) => {
  try {
    const [schedRows]: any = await pool.query('SELECT * FROM report_schedules WHERE id = ?', [req.params.id]);
    if (!schedRows.length) return res.status(404).json({ error: 'Schedule not found' });
    const [tgRows]: any = await pool.query('SELECT bot_token, chat_id FROM telegram_bot_config WHERE is_connected = 1 LIMIT 1');
    if (!tgRows.length) return res.status(400).json({ error: 'Telegram not configured' });
    const { bot_token, chat_id } = tgRows[0];
    const targetChatId = schedRows[0].chat_id || chat_id;
    const cfg = await getACSConfig();
    let total = 0, online = 0, offline = 0;
    if (cfg) {
      try { const resp = await GenieACS.getDevices(cfg); if (resp.success && resp.data) { for (const d of resp.data) { total++; if (GenieACS.parseDeviceData(d).status === 'online') online++; else offline++; } } } catch {}
    }
    const msg = `📊 *Manual Report (Nemesys)*\n📅 ${new Date().toLocaleDateString('id-ID')}\n\n*GenieACS:* Total ${total} | Online 🟢${online} | Offline 🔴${offline}\n\n_Sent manually from schedule #${req.params.id}_`;
    await fetch(`https://api.telegram.org/bot${bot_token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: targetChatId, text: msg, parse_mode: 'Markdown' }) });
    await pool.query('UPDATE report_schedules SET last_sent_at = NOW() WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Report sent manually' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/webhook-logs', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const [rows] = await pool.query('SELECT * FROM webhook_logs ORDER BY id DESC LIMIT ?', [limit]);
    res.json({ success: true, logs: rows });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ====== GAP #12: Webhook Receivers ======
app.post('/webhook/zabbix', async (req, res) => {
  try {
    const secret = req.headers['x-webhook-secret'];
    const expectedSecret = process.env.WEBHOOK_SECRET;
    if (expectedSecret && secret !== expectedSecret) return res.status(401).json({ error: 'Unauthorized' });
    await pool.query('INSERT INTO webhook_logs (source, payload) VALUES (?, ?)', ['zabbix', JSON.stringify(req.body)]);
    if (req.body.status === 'PROBLEM' || req.body.status === 'DOWN') {
      const [devs]: any = await pool.query('SELECT * FROM devices WHERE ip_address = ? OR name LIKE ? LIMIT 1', [req.body.ip || req.body.host, `%${req.body.host}%`]);
      if (devs.length > 0) {
        await pool.query(`UPDATE devices SET status = 'Down' WHERE id = ?`, [devs[0].id]);
        broadcastUpdate();
      }
    }
    if (req.body.status === 'RESOLVED' || req.body.status === 'OK') {
      const [devs]: any = await pool.query('SELECT * FROM devices WHERE ip_address = ? OR name LIKE ? LIMIT 1', [req.body.ip || req.body.host, `%${req.body.host}%`]);
      if (devs.length > 0) { await pool.query(`UPDATE devices SET status = 'Up' WHERE id = ?`, [devs[0].id]); broadcastUpdate(); }
    }
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/webhook/telegram', async (req, res) => {
  try {
    await pool.query('INSERT INTO webhook_logs (source, payload) VALUES (?, ?)', ['telegram', JSON.stringify(req.body)]);
    res.sendStatus(200);
  } catch { res.sendStatus(200); }
});

app.post('/webhook/generic', async (req, res) => {
  try {
    const source = ((req.headers['x-source'] as string) || 'unknown').substring(0, 100);
    await pool.query('INSERT INTO webhook_logs (source, payload) VALUES (?, ?)', [source, JSON.stringify(req.body)]);
    broadcastUpdate();
    res.json({ success: true, message: 'Webhook received and logged' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.use('/api', crudRouter);

// ----------------------------------------------------
// Server Start: Local vs Vercel
// ----------------------------------------------------
if (!IS_VERCEL) {
  // LOCAL MODE: Start traditional HTTP server with WebSocket + Telegram + Zabbix polling
  const PORT = process.env.PORT || 5000;

  async function start() {
    await initializeDatabase();
    initTelegramBot(handleTelegramBotAction);
    startCronJobs();

    // Sync Zabbix hosts on startup and then every 30 seconds
    await syncZabbixHosts();
    setInterval(async () => {
      await syncZabbixHosts();
      broadcastUpdate();
    }, 30000);

    app.get('/api/system-logs', requireAuth, async (req, res) => {
      try {
        const [rows] = await pool.query(`
          SELECT s.*, u.username 
          FROM system_logs s 
          LEFT JOIN users u ON s.user_id = u.id 
          ORDER BY s.id DESC LIMIT 200
        `);
        res.json(rows);
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    httpServer!.listen(PORT, () => {
      console.log(`🚀 Server NEMESYS running on port ${PORT}`);
    });
  }

  start();
}

// VERCEL MODE: Export the Express app as the default handler for serverless
export default app;
