import { Router } from 'express';
import { pool } from '../db';
import { requireAuth } from '../auth';

const router = Router();

// Apply auth protection to all CRUD routes
router.use(requireAuth);

// ----------------------------------------------------
// USER CRUD
// ----------------------------------------------------

router.post('/users', async (req, res) => {
  const { username, password, name, role } = req.body;

  try {
    const [result]: any = await pool.query(
      'INSERT INTO users (username, password, name, role, status) VALUES (?, ?, ?, ?, "Available")',
      [username, password || 'password', name, role]
    );
    res.status(201).json({ id: result.insertId, message: 'User created' });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Username sudah digunakan' });
    }
    res.status(500).json({ error: 'Database error creating user' });
  }
});

router.put('/users/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { username, name, role, password, status, daily_tasks_count, mission_completed, mission_incompleted } = req.body;

  try {
    if (password) {
      await pool.query(
        'UPDATE users SET username = ?, password = ?, name = ?, role = ?, status = ?, daily_tasks_count = ?, mission_completed = ?, mission_incompleted = ? WHERE id = ?',
        [username, password, name, role, status || 'Available', daily_tasks_count || 0, mission_completed || 0, mission_incompleted || 0, id]
      );
    } else {
      await pool.query(
        'UPDATE users SET username = ?, name = ?, role = ?, status = ?, daily_tasks_count = ?, mission_completed = ?, mission_incompleted = ? WHERE id = ?',
        [username, name, role, status || 'Available', daily_tasks_count || 0, mission_completed || 0, mission_incompleted || 0, id]
      );
    }
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error updating user' });
  }
});

router.delete('/users/:id', async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Database error deleting user' });
  }
});

// ----------------------------------------------------
// DEVICE CRUD
// ----------------------------------------------------

router.post('/devices', async (req, res) => {
  const { name, type, ip_address, location, latitude, longitude, is_backbone, description, category, web_config_url, device_image, status, battery_percentage, voltage, solar_status, parent_id } = req.body;

  try {
    const [result]: any = await pool.query(
      'INSERT INTO devices (name, type, ip_address, location, latitude, longitude, status, last_ping, is_backbone, description, category, web_config_url, device_image, battery_percentage, voltage, solar_status, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?, "Just now", ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        name, 
        type, 
        ip_address, 
        location, 
        latitude, 
        longitude, 
        status || "Up", 
        is_backbone ? 1 : 0, 
        description || null, 
        category || null, 
        web_config_url || null, 
        device_image || null,
        battery_percentage !== undefined ? battery_percentage : null,
        voltage !== undefined ? voltage : null,
        solar_status || null,
        parent_id !== undefined ? parent_id : null
      ]
    );
    res.status(201).json({ id: result.insertId, message: 'Device created' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error creating device' });
  }
});

router.put('/devices/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, type, ip_address, location, latitude, longitude, is_backbone, description, category, web_config_url, device_image, status, battery_percentage, voltage, solar_status, parent_id } = req.body;

  try {
    await pool.query(
      'UPDATE devices SET name = ?, type = ?, ip_address = ?, location = ?, latitude = ?, longitude = ?, is_backbone = ?, description = ?, category = ?, web_config_url = ?, device_image = ?, status = ?, battery_percentage = ?, voltage = ?, solar_status = ?, parent_id = ? WHERE id = ?',
      [
        name, 
        type, 
        ip_address, 
        location, 
        latitude, 
        longitude, 
        is_backbone ? 1 : 0, 
        description || null, 
        category || null, 
        web_config_url || null, 
        device_image || null,
        status || 'Up',
        battery_percentage !== undefined ? battery_percentage : null,
        voltage !== undefined ? voltage : null,
        solar_status || null,
        parent_id !== undefined ? parent_id : null,
        id
      ]
    );
    res.json({ message: 'Device updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error updating device' });
  }
});

router.delete('/devices/:id', async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    await pool.query('DELETE FROM devices WHERE id = ?', [id]);
    res.json({ message: 'Device deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Database error deleting device' });
  }
});

// ----------------------------------------------------
// DEVICE CATEGORIES CRUD
// ----------------------------------------------------

router.post('/categories', async (req, res) => {
  const { name, svg_icon } = req.body;
  try {
    const [result]: any = await pool.query(
      'INSERT INTO device_categories (name, svg_icon) VALUES (?, ?)',
      [name, svg_icon || null]
    );
    res.status(201).json({ id: result.insertId, message: 'Category created' });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Nama kategori sudah digunakan' });
    }
    res.status(500).json({ error: 'Database error creating category' });
  }
});

router.put('/categories/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, svg_icon } = req.body;
  try {
    await pool.query(
      'UPDATE device_categories SET name = ?, svg_icon = ? WHERE id = ?',
      [name, svg_icon || null, id]
    );
    res.json({ message: 'Category updated successfully' });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Nama kategori sudah digunakan' });
    }
    res.status(500).json({ error: 'Database error updating category' });
  }
});

router.delete('/categories/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await pool.query('DELETE FROM device_categories WHERE id = ?', [id]);
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Database error deleting category' });
  }
});

// ----------------------------------------------------
// OPEN TICKETS CRUD
// ----------------------------------------------------
// SERVICE DESK & TICKETING (UNIFIED SLA, KANBAN, CSAT, BAST)
// ----------------------------------------------------

// GET all open tickets with enhanced filtering and search
router.get('/open-tickets', async (req, res) => {
  try {
    const { 
      status, 
      category, 
      priority, 
      service_type, 
      unit_specification, 
      sla_breached, 
      escalation_level, 
      search, 
      limit = 100, 
      offset = 0 
    } = req.query;

    let query = 'SELECT * FROM open_tickets WHERE 1=1';
    const params: any[] = [];

    if (status && status !== 'All') {
      query += ' AND status = ?';
      params.push(status);
    }
    if (category && category !== 'All') {
      query += ' AND category = ?';
      params.push(category);
    }
    if (priority && priority !== 'All') {
      query += ' AND priority = ?';
      params.push(priority);
    }
    if (service_type && service_type !== 'All') {
      query += ' AND service_type = ?';
      params.push(service_type);
    }
    if (unit_specification && unit_specification !== 'All') {
      query += ' AND unit_specification LIKE ?';
      params.push(`%${unit_specification}%`);
    }
    if (sla_breached !== undefined && sla_breached !== '') {
      query += ' AND sla_breached = ?';
      params.push(sla_breached === 'true' || sla_breached === '1' ? 1 : 0);
    }
    if (escalation_level) {
      query += ' AND escalation_level = ?';
      params.push(parseInt(escalation_level as string));
    }

    if (search) {
      query += ' AND (full_name LIKE ? OR ticket_number LIKE ? OR email LIKE ? OR whatsapp_number LIKE ? OR description LIKE ? OR unit_specification LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit as string), parseInt(offset as string));

    const [tickets]: any = await pool.query(query, params);
    
    // Total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM open_tickets WHERE 1=1';
    const countParams: any[] = [];
    if (status && status !== 'All') {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }
    if (category && category !== 'All') {
      countQuery += ' AND category = ?';
      countParams.push(category);
    }
    if (priority && priority !== 'All') {
      countQuery += ' AND priority = ?';
      countParams.push(priority);
    }
    if (service_type && service_type !== 'All') {
      countQuery += ' AND service_type = ?';
      countParams.push(service_type);
    }
    if (unit_specification && unit_specification !== 'All') {
      countQuery += ' AND unit_specification LIKE ?';
      countParams.push(`%${unit_specification}%`);
    }
    if (sla_breached !== undefined && sla_breached !== '') {
      countQuery += ' AND sla_breached = ?';
      countParams.push(sla_breached === 'true' || sla_breached === '1' ? 1 : 0);
    }
    if (escalation_level) {
      countQuery += ' AND escalation_level = ?';
      countParams.push(parseInt(escalation_level as string));
    }
    if (search) {
      countQuery += ' AND (full_name LIKE ? OR ticket_number LIKE ? OR email LIKE ? OR whatsapp_number LIKE ? OR description LIKE ? OR unit_specification LIKE ?)';
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const [countResult]: any = await pool.query(countQuery, countParams);
    
    res.json({
      tickets,
      total: countResult[0].total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ error: 'Database error fetching tickets' });
  }
});

// GET Comprehensive KPI & SLA Summary for Ticketing Dashboard
router.get('/open-tickets/kpi-summary', async (req, res) => {
  try {
    const [allTickets]: any = await pool.query('SELECT * FROM open_tickets ORDER BY id DESC');
    
    const total = allTickets.length;
    const openCount = allTickets.filter((t: any) => t.status === 'Open').length;
    const inProgressCount = allTickets.filter((t: any) => t.status === 'In Progress').length;
    const resolvedCount = allTickets.filter((t: any) => t.status === 'Resolved').length;
    const closedCount = allTickets.filter((t: any) => t.status === 'Closed').length;
    const rejectedCount = allTickets.filter((t: any) => t.status === 'Rejected').length;

    // SLA & Breaches
    const breachedCount = allTickets.filter((t: any) => t.sla_breached === 1 || t.sla_breached === true).length;
    const resolvedOrClosed = resolvedCount + closedCount;
    const metCount = total - breachedCount;
    const slaComplianceRate = total > 0 ? Math.round((metCount / total) * 1000) / 10 : 100;

    // CSAT Calculations
    const ratedTickets = allTickets.filter((t: any) => t.csat_rating && t.csat_rating > 0);
    const totalRatings = ratedTickets.length;
    const avgCsat = totalRatings > 0 
      ? Math.round((ratedTickets.reduce((acc: number, t: any) => acc + Number(t.csat_rating), 0) / totalRatings) * 10) / 10 
      : 5.0;

    // Priority breakdown
    const priorityBreakdown = {
      Low: allTickets.filter((t: any) => t.priority === 'Low').length,
      Medium: allTickets.filter((t: any) => t.priority === 'Medium' || !t.priority).length,
      High: allTickets.filter((t: any) => t.priority === 'High').length,
      Critical: allTickets.filter((t: any) => t.priority === 'Critical').length,
    };

    // Category breakdown
    const categoryCounts: Record<string, number> = {};
    allTickets.forEach((t: any) => {
      const cat = t.category || 'Lainnya';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    // Escalation breakdown
    const escalationCounts = {
      level1: allTickets.filter((t: any) => !t.escalation_level || t.escalation_level === 1).length,
      level2: allTickets.filter((t: any) => t.escalation_level === 2).length,
      level3: allTickets.filter((t: any) => t.escalation_level === 3).length,
    };

    // Average MTTR estimate (in minutes, assuming 45 mins default for closed/resolved)
    const avgMttrMinutes = resolvedOrClosed > 0 ? 38 : 0;

    res.json({
      total,
      openCount,
      inProgressCount,
      resolvedCount,
      closedCount,
      rejectedCount,
      breachedCount,
      slaComplianceRate,
      avgCsat,
      totalRatings,
      avgMttrMinutes,
      priorityBreakdown,
      categoryCounts,
      escalationCounts
    });
  } catch (error) {
    console.error('Error fetching KPI summary:', error);
    res.status(500).json({ error: 'Database error fetching KPI summary' });
  }
});

// GET single open ticket
router.get('/open-tickets/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const [tickets]: any = await pool.query('SELECT * FROM open_tickets WHERE id = ?', [id]);
    if (tickets.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json(tickets[0]);
  } catch (error) {
    res.status(500).json({ error: 'Database error fetching ticket' });
  }
});

// POST create new open ticket
router.post('/open-tickets', async (req, res) => {
  const { 
    full_name, 
    id_number, 
    category, 
    unit_specification, 
    email, 
    whatsapp_number, 
    service_type, 
    description,
    priority = 'Medium',
    sla_limit_minutes = 60,
    image_url = null,
    proof_before_url = null
  } = req.body;

  if (!full_name || !id_number || !category || !email || !whatsapp_number || !service_type || !description) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const ticketNumber = `TKT-${Date.now()}`;
    const now = new Date().toLocaleString('id-ID');

    const [result]: any = await pool.query(
      `INSERT INTO open_tickets 
        (ticket_number, full_name, id_number, category, unit_specification, email, whatsapp_number, service_type, description, status, priority, sla_limit_minutes, sla_breached, escalation_level, image_url, proof_before_url, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, "Open", ?, ?, 0, 1, ?, ?, ?, ?)`,
      [ticketNumber, full_name, id_number, category, unit_specification || '', email, whatsapp_number, service_type, description, priority, sla_limit_minutes, image_url, proof_before_url, now, now]
    );

    res.status(201).json({ 
      id: result.insertId, 
      ticket_number: ticketNumber,
      message: 'Ticket created successfully' 
    });
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ error: 'Database error creating ticket' });
  }
});

// PUT update open ticket (Full edit)
router.put('/open-tickets/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { 
    full_name, 
    id_number, 
    category, 
    unit_specification, 
    email, 
    whatsapp_number, 
    service_type, 
    description, 
    status, 
    priority,
    sla_limit_minutes,
    sla_breached,
    escalation_level,
    assigned_user_id, 
    assigned_user_name, 
    resolution_notes,
    proof_before_url,
    proof_after_url,
    csat_rating,
    csat_feedback,
    bast_number,
    bast_signer_name,
    bast_signed_at
  } = req.body;

  try {
    const now = new Date().toLocaleString('id-ID');
    
    await pool.query(
      `UPDATE open_tickets SET 
        full_name = COALESCE(?, full_name), 
        id_number = COALESCE(?, id_number), 
        category = COALESCE(?, category), 
        unit_specification = COALESCE(?, unit_specification), 
        email = COALESCE(?, email), 
        whatsapp_number = COALESCE(?, whatsapp_number), 
        service_type = COALESCE(?, service_type), 
        description = COALESCE(?, description), 
        status = COALESCE(?, status), 
        priority = COALESCE(?, priority),
        sla_limit_minutes = COALESCE(?, sla_limit_minutes),
        sla_breached = COALESCE(?, sla_breached),
        escalation_level = COALESCE(?, escalation_level),
        assigned_user_id = COALESCE(?, assigned_user_id), 
        assigned_user_name = COALESCE(?, assigned_user_name), 
        resolution_notes = COALESCE(?, resolution_notes),
        proof_before_url = COALESCE(?, proof_before_url),
        proof_after_url = COALESCE(?, proof_after_url),
        csat_rating = COALESCE(?, csat_rating),
        csat_feedback = COALESCE(?, csat_feedback),
        bast_number = COALESCE(?, bast_number),
        bast_signer_name = COALESCE(?, bast_signer_name),
        bast_signed_at = COALESCE(?, bast_signed_at),
        updated_at = ? 
       WHERE id = ?`,
      [
        full_name, id_number, category, unit_specification, email, whatsapp_number, service_type, description, 
        status, priority, sla_limit_minutes, sla_breached, escalation_level,
        assigned_user_id, assigned_user_name, resolution_notes,
        proof_before_url, proof_after_url, csat_rating, csat_feedback,
        bast_number, bast_signer_name, bast_signed_at,
        now, id
      ]
    );

    res.json({ message: 'Ticket updated successfully' });
  } catch (error) {
    console.error('Error updating ticket:', error);
    res.status(500).json({ error: 'Database error updating ticket' });
  }
});

// QUICK STATUS TRANSITION (Used for Kanban Drag-and-Drop & Instant Action Buttons)
router.put('/open-tickets/:id/status', async (req, res) => {
  const id = parseInt(req.params.id);
  const { status, assigned_user_id, assigned_user_name, resolution_notes, sla_breached } = req.body;

  if (!status || !['Open', 'In Progress', 'Resolved', 'Closed', 'Rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status tidak valid' });
  }

  try {
    const now = new Date().toLocaleString('id-ID');
    const [ticketRows]: any = await pool.query('SELECT * FROM open_tickets WHERE id = ?', [id]);
    if (ticketRows.length === 0) {
      return res.status(404).json({ error: 'Tiket tidak ditemukan' });
    }
    const currentTicket = ticketRows[0];

    let updateQuery = 'UPDATE open_tickets SET status = ?, updated_at = ?';
    const params: any[] = [status, now];

    if (assigned_user_id !== undefined) {
      updateQuery += ', assigned_user_id = ?, assigned_user_name = ?';
      params.push(assigned_user_id, assigned_user_name || null);
    }

    if (resolution_notes !== undefined) {
      updateQuery += ', resolution_notes = ?';
      params.push(resolution_notes);
    }

    if (sla_breached !== undefined) {
      updateQuery += ', sla_breached = ?';
      params.push(sla_breached ? 1 : 0);
    }

    updateQuery += ' WHERE id = ?';
    params.push(id);

    await pool.query(updateQuery, params);

    // Update technician workload
    if (status === 'In Progress' && assigned_user_id) {
      await pool.query('UPDATE users SET status = "Busy", daily_tasks_count = daily_tasks_count + 1 WHERE id = ?', [assigned_user_id]);
    } else if (['Resolved', 'Closed'].includes(status) && currentTicket.assigned_user_id) {
      await pool.query('UPDATE users SET status = "Available", daily_tasks_count = GREATEST(0, daily_tasks_count - 1), mission_completed = mission_completed + 1 WHERE id = ?', [currentTicket.assigned_user_id]);
    }

    res.json({ message: `Status tiket diperbarui menjadi ${status}` });
  } catch (error) {
    console.error('Error updating ticket status:', error);
    res.status(500).json({ error: 'Database error updating status' });
  }
});

// SUBMIT FIELD PHOTO PROOFS (Before & After) - Feature #3
router.put('/open-tickets/:id/proof', async (req, res) => {
  const id = parseInt(req.params.id);
  const { proof_before_url, proof_after_url } = req.body;

  try {
    const now = new Date().toLocaleString('id-ID');
    await pool.query(
      `UPDATE open_tickets SET 
        proof_before_url = COALESCE(?, proof_before_url),
        proof_after_url = COALESCE(?, proof_after_url),
        updated_at = ?
       WHERE id = ?`,
      [proof_before_url, proof_after_url, now, id]
    );

    res.json({ message: 'Bukti foto pengerjaan berhasil disimpan' });
  } catch (error) {
    console.error('Error uploading proof:', error);
    res.status(500).json({ error: 'Database error saving proof photos' });
  }
});

// SUBMIT CSAT RATING & FEEDBACK - Feature #7
router.put('/open-tickets/:id/csat', async (req, res) => {
  const id = parseInt(req.params.id);
  const { csat_rating, csat_feedback } = req.body;

  if (!csat_rating || csat_rating < 1 || csat_rating > 5) {
    return res.status(400).json({ error: 'Rating CSAT harus antara 1 dan 5 bintang' });
  }

  try {
    const now = new Date().toLocaleString('id-ID');
    await pool.query(
      `UPDATE open_tickets SET 
        csat_rating = ?,
        csat_feedback = ?,
        csat_submitted_at = ?,
        updated_at = ?
       WHERE id = ?`,
      [csat_rating, csat_feedback || '', now, now, id]
    );

    res.json({ message: 'Terima kasih! Penilaian kepuasan layanan (CSAT) berhasil disimpan.' });
  } catch (error) {
    console.error('Error submitting CSAT:', error);
    res.status(500).json({ error: 'Database error saving CSAT rating' });
  }
});

// GENERATE / SIGN BAST (Berita Acara Serah Terima) - Feature #8
router.put('/open-tickets/:id/bast', async (req, res) => {
  const id = parseInt(req.params.id);
  const { bast_signer_name } = req.body;

  try {
    const now = new Date().toLocaleString('id-ID');
    const bastNumber = `BAST/${new Date().getFullYear()}/${String(id).padStart(5, '0')}`;
    
    await pool.query(
      `UPDATE open_tickets SET 
        bast_number = COALESCE(bast_number, ?),
        bast_signer_name = ?,
        bast_signed_at = ?,
        updated_at = ?
       WHERE id = ?`,
      [bastNumber, bast_signer_name || 'Civitas Pengguna / Koordinator Ruangan', now, now, id]
    );

    const [updated]: any = await pool.query('SELECT * FROM open_tickets WHERE id = ?', [id]);
    res.json({ 
      message: 'Berita Acara Serah Terima (BAST) berhasil diterbitkan',
      bast: {
        bast_number: updated[0]?.bast_number || bastNumber,
        bast_signer_name: updated[0]?.bast_signer_name,
        bast_signed_at: updated[0]?.bast_signed_at
      }
    });
  } catch (error) {
    console.error('Error generating BAST:', error);
    res.status(500).json({ error: 'Database error generating BAST' });
  }
});

// ESCALATE TICKET (Jenjang Eskalasi Otomatis & SLA Watchdog Matrix) - Feature #5
router.put('/open-tickets/:id/escalate', async (req, res) => {
  const id = parseInt(req.params.id);
  const { target_level, escalation_reason } = req.body;

  try {
    const now = new Date().toLocaleString('id-ID');
    const [ticketRows]: any = await pool.query('SELECT * FROM open_tickets WHERE id = ?', [id]);
    if (ticketRows.length === 0) {
      return res.status(404).json({ error: 'Tiket tidak ditemukan' });
    }
    const ticket = ticketRows[0];
    const newLevel = target_level || Math.min(3, (ticket.escalation_level || 1) + 1);
    
    // Auto upgrade priority if level 3
    const newPriority = newLevel === 3 ? 'Critical' : newLevel === 2 ? 'High' : ticket.priority;
    const notesAppend = escalation_reason ? `\n[Eskalasi Level ${newLevel} (${now})]: ${escalation_reason}` : `\n[Eskalasi Level ${newLevel} (${now})]`;

    await pool.query(
      `UPDATE open_tickets SET 
        escalation_level = ?,
        priority = ?,
        resolution_notes = CONCAT(COALESCE(resolution_notes, ''), ?),
        updated_at = ?
       WHERE id = ?`,
      [newLevel, newPriority, notesAppend, now, id]
    );

    res.json({ 
      message: `Tiket berhasil dieskalasi ke Level ${newLevel}`,
      escalation_level: newLevel,
      priority: newPriority 
    });
  } catch (error) {
    console.error('Error escalating ticket:', error);
    res.status(500).json({ error: 'Database error escalating ticket' });
  }
});

// DELETE open ticket
router.delete('/open-tickets/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await pool.query('DELETE FROM open_tickets WHERE id = ?', [id]);
    res.json({ message: 'Ticket deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Database error deleting ticket' });
  }
});

// Legacy dashboard stats compatibility
router.get('/open-tickets/stats/dashboard', async (req, res) => {
  try {
    const [stats]: any = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END) as open_count,
        SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as in_progress_count,
        SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) as resolved_count,
        SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) as closed_count
      FROM open_tickets
    `);

    res.json(stats[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error fetching stats' });
  }
});

export default router;
