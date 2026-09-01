import cron from 'node-cron';
import { pool } from './db';
import { getDevices, parseDeviceData, GenieACSConfig } from './genieacs';

// Fetch the telegram config and send message directly via HTTP
async function sendTelegramAlert(message: string) {
  try {
    const [rows]: any = await pool.query('SELECT bot_token, chat_id FROM telegram_bot_config WHERE is_connected = 1 LIMIT 1');
    if (rows.length === 0) return; // Not configured

    const { bot_token, chat_id } = rows[0];
    await fetch(`https://api.telegram.org/bot${bot_token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id, text: message, parse_mode: 'Markdown' })
    });
  } catch (err) {
    console.error('[CRON] Failed to send Telegram alert:', err);
  }
}

async function startDeviceMonitor() {
  console.log(`[CRON] ${new Date().toISOString()} Device Monitor Started`);
  try {
    const [credRows]: any = await pool.query('SELECT host, port, username, password FROM genieacs_credentials WHERE is_connected = 1 ORDER BY id DESC LIMIT 1');
    if (credRows.length === 0) {
      console.log('[CRON] GenieACS not configured. Skipping monitor.');
      return;
    }
    
    const creds: GenieACSConfig = credRows[0];

    const response = await getDevices(creds);
    if (!response.success || !response.data) {
      console.log('[CRON] Failed to fetch devices from ACS');
      return;
    }

    let changedCount = 0;

    for (const device of response.data) {
      const parsed = parseDeviceData(device);
      const deviceId = parsed._id;
      const currentStatus = parsed.status;

      // Get last known status
      const [lastRows]: any = await pool.query(
        'SELECT status, notified FROM device_monitoring WHERE device_id = ? ORDER BY created_at DESC LIMIT 1',
        [deviceId]
      );
      
      const lastStatus = lastRows.length > 0 ? lastRows[0].status : null;
      const wasNotified = lastRows.length > 0 ? lastRows[0].notified : 0;

      if (lastStatus !== currentStatus) {
        changedCount++;
        console.log(`[CRON] Device ${deviceId}: ${lastStatus} -> ${currentStatus}`);

        // Insert new record
        const [insertRes]: any = await pool.query(
          'INSERT INTO device_monitoring (device_id, status, notified) VALUES (?, ?, 0)',
          [deviceId, currentStatus]
        );

        // Send Telegram notification
        if (!wasNotified) {
          const alertMsg = `⚠️ *PERINGATAN ACS*\n\nDevice: \`${deviceId}\`\nSN: ${parsed.serialNumber}\nIP TR069: ${parsed.ipTr069}\nStatus: *${currentStatus.toUpperCase()}*`;
          await sendTelegramAlert(alertMsg);

          // Mark as notified
          await pool.query('UPDATE device_monitoring SET notified = 1 WHERE id = ?', [insertRes.insertId]);
        }
      }
    }
    
    // Cleanup old records (>30 days)
    await pool.query('DELETE FROM device_monitoring WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)');
    
    console.log(`[CRON] ${new Date().toISOString()} Device Monitor Finished. Changes: ${changedCount}`);
  } catch (err) {
    console.error('[CRON] Error in device monitor:', err);
  }
}

async function startScheduledReports() {
  console.log(`[CRON] ${new Date().toISOString()} Checking report schedules...`);
  try {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentDay = now.getDay(); // 0=Sunday
    const today = now.toISOString().split('T')[0];

    // Get active schedules from DB that match current time window (±30 min)
    const [schedules]: any = await pool.query(`
      SELECT rs.*, tb.bot_token, tb.chat_id as default_chat_id
      FROM report_schedules rs
      LEFT JOIN telegram_bot_config tb ON tb.is_connected = 1
      WHERE rs.is_active = 1
        AND (rs.last_sent_at IS NULL OR DATE(rs.last_sent_at) < ?)
        AND (
          (rs.report_type = 'daily'
            AND HOUR(rs.schedule_time) = ?
            AND MINUTE(rs.schedule_time) BETWEEN ? AND ?)
          OR
          (rs.report_type = 'weekly'
            AND rs.schedule_day = ?
            AND HOUR(rs.schedule_time) = ?
            AND MINUTE(rs.schedule_time) BETWEEN ? AND ?)
        )
    `, [today,
        currentHour, Math.max(0, currentMinute - 30), Math.min(59, currentMinute + 30),
        currentDay,
        currentHour, Math.max(0, currentMinute - 30), Math.min(59, currentMinute + 30)]);

    // If no custom schedules configured, fallback to default daily at 08:00
    if (schedules.length === 0) {
      const [schedCount]: any = await pool.query('SELECT COUNT(*) as cnt FROM report_schedules');
      if (schedCount[0].cnt === 0 && currentHour === 8 && currentMinute < 30) {
        await sendDefaultDailyReport();
      }
      return;
    }

    for (const schedule of schedules) {
      try {
        const chatId = schedule.chat_id || schedule.default_chat_id;
        const botToken = schedule.bot_token;
        if (!botToken || !chatId) {
          console.log(`[CRON] Schedule #${schedule.id}: Telegram not configured, skipping`);
          continue;
        }

        // Build stats
        const [credRows]: any = await pool.query('SELECT host, port, username, password FROM genieacs_credentials WHERE is_connected = 1 LIMIT 1');
        let total = 0, online = 0, offline = 0;
        if (credRows.length > 0) {
          try {
            const resp = await getDevices(credRows[0]);
            if (resp.success && resp.data) {
              for (const dev of resp.data) { total++; if (parseDeviceData(dev).status === 'online') online++; else offline++; }
            }
          } catch {}
        }

        let mtStatus = 'Not Configured';
        try {
          const [mtRows]: any = await pool.query('SELECT is_connected FROM mikrotik_credentials LIMIT 1');
          if (mtRows.length > 0) mtStatus = mtRows[0].is_connected ? 'Online 🟢' : 'Offline 🔴';
        } catch {}

        const typeLabel = schedule.report_type === 'weekly' ? 'Weekly' : 'Daily';
        const reportMsg = `📊 *${typeLabel} System Report (Nemesys)*\n` +
          `📅 ${now.toLocaleDateString('id-ID')}\n\n` +
          `*GenieACS Devices*\n- Total: ${total}\n- Online: ${online} 🟢\n- Offline: ${offline} 🔴\n\n` +
          `*MikroTik Status*\n- API: ${mtStatus}\n\n` +
          `_Schedule ID: #${schedule.id} | ${typeLabel} at ${schedule.schedule_time}_`;

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: reportMsg, parse_mode: 'Markdown' })
        });

        await pool.query('UPDATE report_schedules SET last_sent_at = NOW() WHERE id = ?', [schedule.id]);
        await pool.query('INSERT INTO telegram_report_logs (schedule_id, status, message) VALUES (?, "Success", ?)', [schedule.id, `${typeLabel} report sent`]);
        console.log(`[CRON] Report schedule #${schedule.id} sent successfully`);
      } catch (err) {
        console.error(`[CRON] Failed to send schedule #${schedule.id}:`, err);
      }
    }
  } catch (err) {
    console.error('[CRON] Error in startScheduledReports:', err);
  }
}

async function sendDefaultDailyReport() {
  try {
    const [tgRows]: any = await pool.query('SELECT bot_token, chat_id FROM telegram_bot_config WHERE is_connected = 1 LIMIT 1');
    if (!tgRows.length) return;
    const [credRows]: any = await pool.query('SELECT host, port, username, password FROM genieacs_credentials WHERE is_connected = 1 LIMIT 1');
    let total = 0, online = 0, offline = 0;
    if (credRows.length > 0) {
      try {
        const resp = await getDevices(credRows[0]);
        if (resp.success && resp.data) { for (const dev of resp.data) { total++; if (parseDeviceData(dev).status === 'online') online++; else offline++; } }
      } catch {}
    }
    const msg = `📊 *Daily System Report (Nemesys)*\n📅 ${new Date().toLocaleDateString('id-ID')}\n\n*GenieACS:* Total ${total} | Online 🟢${online} | Offline 🔴${offline}\n\n_Auto default daily report_`;
    await fetch(`https://api.telegram.org/bot${tgRows[0].bot_token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: tgRows[0].chat_id, text: msg, parse_mode: 'Markdown' })
    });
    await pool.query('INSERT INTO telegram_report_logs (schedule_id, status, message) VALUES (0, "Success", "Default daily report sent")');
    console.log('[CRON] Default daily report sent');
  } catch (err) {
    console.error('[CRON] Default daily report error:', err);
  }
}

export function startCronJobs() {
  console.log('⏳ Initializing Cron Jobs...');
  
  // Every 5 minutes — device monitor
  cron.schedule('*/5 * * * *', () => {
    startDeviceMonitor();
  });

  // Every 30 minutes — check report schedules from DB
  cron.schedule('*/30 * * * *', () => {
    startScheduledReports();
  });
  
  // Trigger device monitor once on startup (with slight delay)
  setTimeout(() => {
    startDeviceMonitor();
  }, 10000);
}

