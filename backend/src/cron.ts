import cron from 'node-cron';
import { pool } from './db';
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

    const { NocZabbixService } = await import('./services/nocZabbixService');
    const kpi = await NocZabbixService.getSummaryKPI();

    for (const schedule of schedules) {
      try {
        const chatId = schedule.chat_id || schedule.default_chat_id;
        const botToken = schedule.bot_token;
        if (!botToken || !chatId) {
          console.log(`[CRON] Schedule #${schedule.id}: Telegram not configured, skipping`);
          continue;
        }

        let mtStatus = 'Not Configured';
        try {
          const [mtRows]: any = await pool.query('SELECT is_connected FROM mikrotik_credentials LIMIT 1');
          if (mtRows.length > 0) mtStatus = mtRows[0].is_connected ? 'Online 🟢' : 'Offline 🔴';
        } catch {}

        const typeLabel = schedule.report_type === 'weekly' ? 'Weekly' : 'Daily';
        const reportMsg = `📊 *${typeLabel} System Report (NOC UNTAG)*\n` +
          `📅 ${now.toLocaleDateString('id-ID')}\n\n` +
          `*Zabbix Network Nodes:*\n` +
          `- Total: ${kpi.totalDevices}\n` +
          `- Healthy / Up: ${kpi.healthyDevices} 🟢\n` +
          `- Warning: ${kpi.warningDevices} 🟡\n` +
          `- Down: ${kpi.downDevices} 🔴\n` +
          `- Uptime: ${kpi.overallUptimePercent}%\n\n` +
          `*MikroTik Status:*\n- API: ${mtStatus}\n\n` +
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
    
    const { NocZabbixService } = await import('./services/nocZabbixService');
    const kpi = await NocZabbixService.getSummaryKPI();

    const msg = `📊 *Daily System Report (NOC UNTAG)*\n📅 ${new Date().toLocaleDateString('id-ID')}\n\n*Zabbix Nodes:* Total ${kpi.totalDevices} | Up 🟢${kpi.healthyDevices} | Down 🔴${kpi.downDevices}\n*SLA Uptime:* ${kpi.overallUptimePercent}%\n\n_Auto default daily report_`;
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

// Real-time Zabbix Problem Monitor & Telegram Broadcast
async function checkAndAlertNocProblems() {
  try {
    const { NocZabbixService } = await import('./services/nocZabbixService');
    const { sendNocProblemAlert } = await import('./telegram');
    const problems = await NocZabbixService.getActiveProblems();

    for (const p of problems) {
      if (!p.acknowledged && p.severity >= 3) {
        await sendNocProblemAlert(p);
      }
    }
  } catch (err) {
    // Non-blocking catch
  }
}

export function startCronJobs() {
  console.log('⏳ Initializing Cron Jobs...');
  
  // Every 30 minutes — check report schedules from DB
  cron.schedule('*/30 * * * *', () => {
    startScheduledReports();
  });

  // Every 1 minute — Realtime NOC Zabbix Problem Monitor
  cron.schedule('* * * * *', () => {
    checkAndAlertNocProblems();
  });

  // Every day at 07:00 WIB — Morning NOC Daily Digest Report
  cron.schedule('0 7 * * *', async () => {
    try {
      const { sendDailyDigestReport } = await import('./telegram');
      await sendDailyDigestReport();
      console.log('[CRON] Morning NOC Daily Digest successfully sent.');
    } catch (err) {
      console.error('[CRON] Failed to send morning daily digest:', err);
    }
  });
  
  // Trigger initial checks on startup (with slight delay)
  setTimeout(() => {
    checkAndAlertNocProblems();
  }, 10000);
}

