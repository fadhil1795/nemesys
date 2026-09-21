import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { pool } from './db';
import { NocSlaService } from './services/nocSlaService';
import { NocDiagnosticsService } from './services/nocDiagnosticsService';

dotenv.config();

let bot: TelegramBot | null = null;
let currentBotToken: string | null = null;

// Session memory for multi-step interactive commands (e.g., editwifi)
const sessionState: Record<string, { command: string; step: number; data: any }> = {};

// Cache for tracking sent problem alerts to prevent duplicate spamming
const sentAlertEventIds = new Set<string>();

// Helper: Get user role from DB
async function getUserRole(chatId: string | number): Promise<{ id: number; name: string; username: string; role: string } | null> {
  const [rows]: any = await pool.query('SELECT id, name, username, role FROM users WHERE telegram_chat_id = ? LIMIT 1', [chatId.toString()]);
  if (rows.length === 0) return null;
  return rows[0];
}

// Helper: Check RBAC permissions
function hasPermission(userRole: string, action: 'view' | 'summon' | 'edit_wifi' | 'manage_users' | 'ack'): boolean {
  if (userRole === 'Administrator' || userRole === 'Manager') return true;
  if (userRole === 'Teknisi') {
    return ['view', 'ack'].includes(action);
  }
  return false;
}

// Helper: Get Bot Token & Default Chat ID from DB or .env
export async function getTelegramConfig(): Promise<{ token: string | null; chatId: string | null }> {
  try {
    const [rows]: any = await pool.query('SELECT bot_token, chat_id, is_connected FROM telegram_bot_config WHERE is_connected = 1 ORDER BY id DESC LIMIT 1');
    if (rows && rows.length > 0 && rows[0].bot_token) {
      return { token: rows[0].bot_token, chatId: rows[0].chat_id };
    }
  } catch {}

  const envToken = process.env.TELEGRAM_BOT_TOKEN;
  if (envToken && !envToken.includes('YOUR_TELEGRAM')) {
    return { token: envToken, chatId: process.env.TELEGRAM_CHAT_ID || null };
  }

  return { token: null, chatId: null };
}

export async function initTelegramBot(onAction?: (action: 'accept' | 'complete', taskId: number) => void) {
  const IS_VERCEL = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
  if (IS_VERCEL) {
    console.log('ℹ️ Telegram Bot polling disabled on Vercel serverless.');
    return;
  }

  const { token } = await getTelegramConfig();
  if (!token) {
    console.log('ℹ️ Telegram Bot token not configured. (Set via .env or System Settings)');
    return;
  }

  if (bot && currentBotToken === token) {
    return; // Already initialized with same token
  }

  if (bot) {
    try {
      await bot.stopPolling();
    } catch {}
    bot = null;
  }

  try {
    bot = new TelegramBot(token, { polling: true });
    currentBotToken = token;

    // Suppress polling network glitches without crashing
    bot.on('polling_error', (error) => {
      // Ignored non-critical network blip
    });

    bot.on('error', (error) => {
      // Catch general errors
    });

    console.log('🤖 NOC Smart Telegram Bot Service successfully initialized.');

    // --------------------------------------------------------
    // COMMAND: /start
    // --------------------------------------------------------
    bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
      const chatId = msg.chat.id.toString();
      const usernameParam = match ? match[1]?.trim() : null;

      if (usernameParam) {
        // Link Account with username
        try {
          const [rows]: any = await pool.query('SELECT * FROM users WHERE username = ?', [usernameParam]);
          if (rows.length === 0) {
            bot?.sendMessage(chatId, `❌ Gagal menghubungkan: Username "${usernameParam}" tidak ditemukan di database NEMESYS.`);
            return;
          }
          await pool.query('UPDATE users SET telegram_chat_id = ? WHERE username = ?', [chatId, usernameParam]);
          
          const welcomeMsg = `✅ *Akun Berhasil Terhubung!*\n\nHalo *${rows[0].name}*, akun Telegram Anda telah ditautkan ke sistem *NEMESYS NOC UNTAG* sebagai *${rows[0].role}*.\n\nAnda sekarang akan menerima notifikasi real-time jika terjadi gangguan pada jaringan kampus.`;
          
          const opts = {
            parse_mode: 'Markdown' as const,
            reply_markup: {
              inline_keyboard: [
                [{ text: '📊 Ringkasan NOC Live', callback_data: 'menu:noc' }, { text: '⚠️ Masalah Aktif', callback_data: 'menu:problems' }],
                [{ text: '📈 Laporan SLA Bulanan', callback_data: 'menu:sla' }, { text: '❓ Bantuan Perintah', callback_data: 'menu:help' }]
              ]
            }
          };
          bot?.sendMessage(chatId, welcomeMsg, opts);
        } catch (err) {
          bot?.sendMessage(chatId, '❌ Terjadi kesalahan internal saat menghubungkan akun.');
        }
        return;
      }

      // Check if already linked
      const user = await getUserRole(chatId);
      if (!user) {
        const welcomeUnlinked = `🏛 *NOC COMMAND CENTER - UNTAG BANYUWANGI*\n\nSelamat datang di Bot Resmi Pemantauan Jaringan NEMESYS.\n\nSilakan hubungkan akun Anda dengan mengetik:\n\`/start <username_dashboard>\`\n\n_Contoh: \`/start dika_admin\`_`;
        bot?.sendMessage(chatId, welcomeUnlinked, { parse_mode: 'Markdown' });
        return;
      }

      const greeting = `🏛 *NOC COMMAND CENTER - UNTAG BANYUWANGI*\n\nHalo *${user.name}* (${user.role})!\nSilakan pilih menu pemantauan atau gunakan perintah di bawah:`;
      const opts = {
        parse_mode: 'Markdown' as const,
        reply_markup: {
          inline_keyboard: [
            [{ text: '📊 Ringkasan NOC Live', callback_data: 'menu:noc' }, { text: '⚠️ Masalah Aktif', callback_data: 'menu:problems' }],
            [{ text: '📈 Laporan SLA Bulanan', callback_data: 'menu:sla' }, { text: '👥 Sesi DHCP / Klien', callback_data: 'menu:leases' }],
            [{ text: '❓ Bantuan & Perintah Lengkap', callback_data: 'menu:help' }]
          ]
        }
      };
      bot?.sendMessage(chatId, greeting, opts);
    });

    // --------------------------------------------------------
    // COMMAND: /help
    // --------------------------------------------------------
    bot.onText(/\/help/, async (msg) => {
      const chatId = msg.chat.id.toString();
      const helpText = `
🏛 *DAFTAR PERINTAH NOC NEMESYS BOT:*

🔹 *Pemantauan Jaringan & NOC:*
• \`/noc\` atau \`/summary\` - Cek ringkasan live NOC (Uptime, Bandwidth, Alarms)
• \`/masalah\` atau \`/problems\` - Lihat daftar alarm & problem aktif Zabbix
• \`/perangkat\` atau \`/hosts\` - Daftar host & node jaringan dari Zabbix
• \`/sla\` - Laporan ringkas pemenuhan SLA bulan ini
• \`/dhcp\` atau \`/leases\` - Info sewa IP DHCP MikroTik
• \`/rekap\` - Kirim rekapitulasi harian jaringan kampus

🔹 *Manajemen Misi Tim:*
• \`/misi\` atau \`/mission\` - Cek daftar Misi Tim aktif & ketersediaan slot

🔹 *Diagnostik Jaringan:*
• \`/ping <ip_atau_host>\` - Uji latensi & ping ke target (Contoh: \`/ping 103.92.209.1\`)

🔹 *Bantuan:*
• \`/help\` - Tampilkan panduan perintah
• \`/cancel\` - Batalkan operasi yang sedang berjalan
      `;
      bot?.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
    });

    // --------------------------------------------------------
    // COMMAND: /noc /summary
    // --------------------------------------------------------
    bot.onText(/\/(?:noc|summary|ringkasan)/, async (msg) => {
      const chatId = msg.chat.id.toString();
      await sendNocSummaryMessage(chatId);
    });

    // --------------------------------------------------------
    // COMMAND: /masalah /problems
    // --------------------------------------------------------
    bot.onText(/\/(?:masalah|problems|alarm)/, async (msg) => {
      const chatId = msg.chat.id.toString();
      await sendActiveProblemsMessage(chatId);
    });

    // --------------------------------------------------------
    // COMMAND: /perangkat /hosts /nodes
    // --------------------------------------------------------
    bot.onText(/\/(?:perangkat|hosts|nodes|devices)/, async (msg) => {
      const chatId = msg.chat.id.toString();
      try {
        const { NocZabbixService } = await import('./services/nocZabbixService');
        const devices = await NocZabbixService.getDevices();
        if (!devices || devices.length === 0) {
          return bot?.sendMessage(chatId, 'ℹ️ Tidak ada perangkat yang terdaftar di Zabbix.');
        }

        let text = `🖥 *DAFTAR HOST & NODE JARINGAN (ZABBIX)*\n━━━━━━━━━━━━━━━━━━━━\n`;
        devices.slice(0, 15).forEach((d) => {
          const statusEmoji = d.status === 'healthy' ? '🟢' : d.status === 'warning' ? '🟡' : '🔴';
          text += `${statusEmoji} *${d.name}* (\`${d.ip}\`)\n   └ *Tipe:* ${d.category.toUpperCase()} • Ping: \`${d.pingMs}ms\` • Traffic: \`${d.trafficInMbps}/${d.trafficOutMbps} Mbps\`\n`;
        });
        text += `\n_Total: ${devices.length} perangkat terdata_`;

        bot?.sendMessage(chatId, text, { parse_mode: 'Markdown' });
      } catch (err: any) {
        bot?.sendMessage(chatId, `❌ Gagal mengambil daftar perangkat: ${err.message}`);
      }
    });

    // --------------------------------------------------------
    // COMMAND: /sla
    // --------------------------------------------------------
    bot.onText(/\/sla/, async (msg) => {
      const chatId = msg.chat.id.toString();
      await sendSlaSummaryMessage(chatId);
    });

    // --------------------------------------------------------
    // COMMAND: /dhcp /leases
    // --------------------------------------------------------
    bot.onText(/\/(?:dhcp|leases|klien)/, async (msg) => {
      const chatId = msg.chat.id.toString();
      await sendDhcpLeasesMessage(chatId);
    });

    // --------------------------------------------------------
    // COMMAND: /rekap
    // --------------------------------------------------------
    bot.onText(/\/(?:rekap|digest|laporan)/, async (msg) => {
      const chatId = msg.chat.id.toString();
      await sendDigestReportToChat(chatId);
    });

    // --------------------------------------------------------
    // COMMAND: /misi /mission
    // --------------------------------------------------------
    bot.onText(/\/(?:misi|mission|missions)/, async (msg) => {
      const chatId = msg.chat.id.toString();
      try {
        const [missions]: any = await pool.query('SELECT * FROM custom_missions ORDER BY id DESC LIMIT 10');
        if (!missions || missions.length === 0) {
          return bot?.sendMessage(chatId, 'ℹ️ Saat ini belum ada Misi Tim terdaftar.');
        }

        const [participants]: any = await pool.query(
          'SELECT mp.mission_id, u.name FROM mission_participants mp JOIN users u ON mp.user_id = u.id'
        );

        let text = `🚀 *DAFTAR MISI TIM UNTAG NOC*\n━━━━━━━━━━━━━━━━━━━━\n\n`;
        missions.forEach((m: any, idx: number) => {
          const mParts = participants.filter((p: any) => p.mission_id === m.id);
          const statusEmoji = m.status === 'Completed' ? '✅' : m.status === 'In Progress' ? '⚡' : '📌';
          text += `${statusEmoji} *${idx + 1}. ${m.title}*\n`;
          text += `   ├ *Status:* ${m.status}\n`;
          text += `   ├ *Slot Personel:* ${mParts.length}/${m.slots}\n`;
          text += `   ├ *Progress:* ${m.progress_percent || 0}%\n`;
          if (mParts.length > 0) {
            text += `   └ *Tim:* ${mParts.map((p: any) => p.name).join(', ')}\n`;
          } else {
            text += `   └ *Tim:* _Belum ada (Slot Terbuka)_\n`;
          }
          text += `\n`;
        });

        text += `📲 _Buka Web Dashboard / Mobile PWA untuk mengambil slot atau update progress pengerjaan!_`;

        bot?.sendMessage(chatId, text, { parse_mode: 'Markdown' });
      } catch (err: any) {
        bot?.sendMessage(chatId, `❌ Gagal mengambil data misi: ${err.message}`);
      }
    });

    // --------------------------------------------------------
    // COMMAND: /ping <host>
    // --------------------------------------------------------
    bot.onText(/\/ping(?:\s+(.+))?/, async (msg, match) => {
      const chatId = msg.chat.id.toString();
      const target = match ? match[1]?.trim() : null;

      if (!target) {
        return bot?.sendMessage(chatId, 'Gunakan format: `/ping <ip_address_atau_domain>`\nContoh: `/ping 103.92.209.1` atau `/ping google.com`', { parse_mode: 'Markdown' });
      }

      const waitMsg = await bot?.sendMessage(chatId, `⚡ Sedang melakukan *Ping Diagnostics* ke \`${target}\` (4 paket)...`, { parse_mode: 'Markdown' });

      try {
        const pingRes = await NocDiagnosticsService.runPing(target, 4);
        const lossEmoji = pingRes.packetLossPercent === 0 ? '🟢' : pingRes.packetLossPercent < 50 ? '🟡' : '🔴';

        const resultText = `
📡 *HASIL PING DIAGNOSTICS*
━━━━━━━━━━━━━━━━━━━━
🎯 *Target:* \`${pingRes.target}\`
${lossEmoji} *Packet Loss:* \`${pingRes.packetLossPercent}%\` (${pingRes.packetsReceived}/${pingRes.packetsTransmitted} diterima)

⏱ *Statistik RTT Latensi:*
• *Min:* ${pingRes.minRttMs} ms
• *Avg:* *${pingRes.avgRttMs} ms*
• *Max:* ${pingRes.maxRttMs} ms
• *Jitter:* ${pingRes.jitterMs} ms
━━━━━━━━━━━━━━━━━━━━
_Server Source: UNTAG NOC Core_
        `;

        if (waitMsg && bot) {
          await bot.editMessageText(resultText, { chat_id: chatId, message_id: waitMsg.message_id, parse_mode: 'Markdown' });
        } else {
          bot?.sendMessage(chatId, resultText, { parse_mode: 'Markdown' });
        }
      } catch (err: any) {
        bot?.sendMessage(chatId, `❌ Gagal melakukan ping ke \`${target}\`: ${err.message || 'Host Unreachable'}`, { parse_mode: 'Markdown' });
      }
    });

    // --------------------------------------------------------
    // COMMAND: /cancel
    // --------------------------------------------------------
    bot.onText(/\/cancel/, async (msg) => {
      const chatId = msg.chat.id.toString();
      if (sessionState[chatId]) {
        delete sessionState[chatId];
        bot?.sendMessage(chatId, '🚫 Perintah dibatalkan.');
      } else {
        bot?.sendMessage(chatId, 'Tidak ada perintah yang sedang berjalan.');
      }
    });

    // --------------------------------------------------------
    // CALLBACK QUERY HANDLER
    // --------------------------------------------------------
    bot.on('callback_query', async (query) => {
      const data = query.data;
      if (!data) return;
      const chatId = query.message?.chat.id.toString();
      if (!chatId) return;

      const user = await getUserRole(chatId);
      const parts = data.split(':');
      const action = parts[0];

      if (action === 'ack') {
        // Acknowledge Zabbix Alarm
        const eventId = parts[1];
        try {
          const { NocZabbixService } = await import('./services/nocZabbixService');
          await NocZabbixService.acknowledgeProblem(
            eventId,
            user?.name || 'Teknisi Telegram',
            'Diakui via Telegram Bot'
          );
          
          bot?.answerCallbackQuery(query.id, { text: `✅ Alarm #${eventId} berhasil diakui!` });
          
          if (query.message) {
            await bot?.editMessageText(`${query.message.text}\n\n✅ *Status:* Diakui oleh ${user?.name || 'Teknisi'} via Telegram Bot`, {
              chat_id: chatId,
              message_id: query.message.message_id,
            });
          }
        } catch (err: any) {
          bot?.answerCallbackQuery(query.id, { text: `Gagal mengakui: ${err.message || err}`, show_alert: true });
        }
      }
      else if (action === 'accept') {
        if (onAction) onAction('accept', parseInt(parts[1]));
        bot?.answerCallbackQuery(query.id, { text: 'Tugas diterima!' });
      } 
      else if (action === 'complete') {
        if (onAction) onAction('complete', parseInt(parts[1]));
        bot?.answerCallbackQuery(query.id, { text: 'Tugas diselesaikan!' });
      }
      else if (action === 'menu') {
        bot?.answerCallbackQuery(query.id);
        const sub = parts[1];
        if (sub === 'noc') await sendNocSummaryMessage(chatId);
        else if (sub === 'problems') await sendActiveProblemsMessage(chatId);
        else if (sub === 'sla') await sendSlaSummaryMessage(chatId);
        else if (sub === 'leases') await sendDhcpLeasesMessage(chatId);
        else if (sub === 'help') {
          bot?.sendMessage(chatId, 'Ketik `/help` untuk panduan perintah lengkap.', { parse_mode: 'Markdown' });
        }
      }
      else if (action === 'noc' && parts[1] === 'refresh') {
        bot?.answerCallbackQuery(query.id, { text: 'Memperbarui data...' });
        await sendNocSummaryMessage(chatId, query.message?.message_id);
      }
    });

  } catch (error) {
    console.error('Failed to start Telegram Bot:', error);
  }
}

// -------------------------------------------------------------
// HELPER TELEGRAM MESSAGE GENERATORS
// -------------------------------------------------------------

// 1. NOC Live Summary
async function sendNocSummaryMessage(chatId: string, messageIdToEdit?: number) {
  if (!bot) return;
  try {
    const { NocZabbixService } = await import('./services/nocZabbixService');
    const kpi = await NocZabbixService.getSummaryKPI();
    const liveStatus = await NocZabbixService.isLiveZabbixConnected();

    const text = `
🏛 *NOC COMMAND CENTER — LIVE STATUS*
*Universitas 17 Agustus 1945 Banyuwangi*
━━━━━━━━━━━━━━━━━━━━
⚡ *Zabbix JSON-RPC:* ${liveStatus.connected ? '🟢 *LIVE CONNECTED*' : '🟡 *STANDBY*'}
📈 *Overall Network Uptime:* *${kpi.overallUptimePercent}%*

🌐 *Trafik & Bandwidth:*
• Inbound Traffic: *${kpi.totalBandwidthGbps} Gbps*

🖥 *Status Node Perangkat:*
• Router MikroTik: *${kpi.mikrotik.healthy}/${kpi.mikrotik.total}* Normal 🟢
• Servers & Core: *${kpi.servers?.healthy || 0}/${kpi.servers?.total || 1}* Normal
• Total Klien DHCP: *${kpi.dhcpLeases?.total || kpi.dhcpLeasesCount || 0}* Leases (${kpi.dhcpLeases?.active || 0} Aktif)

⚠️ *Alarm & Problem Aktif:*
• 🔴 Disaster: ${kpi.problemsSummary.disaster}
• 🟠 High: ${kpi.problemsSummary.high}
• 🟡 Warning: ${kpi.problemsSummary.warning}
• Total Problem: *${kpi.problemsSummary.total}* (${kpi.problemsSummary.unackedCount} Belum Diakui)
━━━━━━━━━━━━━━━━━━━━
_Waktu: ${new Date().toLocaleTimeString('id-ID')} WIB_
    `;

    const opts = {
      parse_mode: 'Markdown' as const,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Refresh Status', callback_data: 'noc:refresh' }, { text: '⚠️ Lihat Masalah', callback_data: 'menu:problems' }],
          [{ text: '📈 Laporan SLA', callback_data: 'menu:sla' }]
        ]
      }
    };

    if (messageIdToEdit) {
      await bot.editMessageText(text, { chat_id: chatId, message_id: messageIdToEdit, ...opts });
    } else {
      await bot.sendMessage(chatId, text, opts);
    }
  } catch (err: any) {
    bot?.sendMessage(chatId, `❌ Gagal mengambil status NOC: ${err.message || err}`);
  }
}

// 2. Active Problems List
async function sendActiveProblemsMessage(chatId: string) {
  if (!bot) return;
  try {
    const { NocZabbixService } = await import('./services/nocZabbixService');
    const problems = await NocZabbixService.getActiveProblems();

    if (problems.length === 0) {
      const text = `✅ *SEMUA SISTEM NORMAL*\n\nTidak ada alarm atau pemadaman aktif yang terdeteksi di Zabbix saat ini.\nSemua link backbone dan access point kampus beroperasi lancar.`;
      return bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    }

    let text = `🚨 *DAFTAR GANGGUAN / ALARM AKTIF (${problems.length})*\n━━━━━━━━━━━━━━━━━━━━\n\n`;
    const inline_keyboard: any[] = [];

    problems.slice(0, 5).forEach((p, idx) => {
      const sevIcon = p.severity === 5 ? '🔴' : p.severity === 4 ? '🟠' : '🟡';
      const ackIcon = p.acknowledged ? '✓ (Diakui)' : '⚠️ (Belum Diakui)';
      
      text += `${idx + 1}. ${sevIcon} *${p.name}*\n`;
      text += `   📍 *Target:* ${p.deviceName} (\`${p.deviceIp}\`)\n`;
      text += `   ⏱ *Durasi:* ${p.durationText} | ${ackIcon}\n\n`;

      if (!p.acknowledged) {
        inline_keyboard.push([{ text: `⚡ Akui #${p.eventId} (${p.deviceName})`, callback_data: `ack:${p.eventId}` }]);
      }
    });

    if (problems.length > 5) {
      text += `_...dan ${problems.length - 5} alarm lainnya. Buka Dashboard Web untuk melihat seluruhnya._\n`;
    }

    text += `━━━━━━━━━━━━━━━━━━━━\n_Waktu: ${new Date().toLocaleTimeString('id-ID')} WIB_`;

    inline_keyboard.push([{ text: '📊 Kembali ke Ringkasan', callback_data: 'menu:noc' }]);

    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard } });
  } catch (err: any) {
    bot?.sendMessage(chatId, `❌ Gagal memuat daftar masalah: ${err.message || err}`);
  }
}

// 3. SLA Summary
async function sendSlaSummaryMessage(chatId: string) {
  if (!bot) return;
  try {
    const report = await NocSlaService.getSlaReport({ period: 'this_month' });
    const complianceColor = report.slaComplianceRatePercent >= 95 ? '🟢' : '🔴';

    const text = `
📈 *LAPORAN SLA & DOWNTIME BULAN INI*
*Periode:* ${report.periodLabel}
━━━━━━━━━━━━━━━━━━━━
🎯 *Overall Uptime Aktual:* *${report.overallUptimePercent}%*
${complianceColor} *SLA Compliance:* *${report.slaComplianceRatePercent}%* (${report.nodesMetCount} Sesuai / ${report.nodesBreachedCount} Terlanggar)

⏱ *Metrik Pemulihan:*
• Total Downtime: *${report.totalDowntimeMinutes} Menit*
• Rata-rata Pemulihan (MTTR): *${report.mttrMinutes} Menit*
• Total Insiden: *${report.totalIncidents} Insiden*
• Pemadaman Aktif (Live): *${report.liveOutageCount} Perangkat*

🏢 *POP / Gedung Terbanyak Insiden:*
${(report.pops || []).slice(0, 3).map((p) => `• ${p.popName}: ${p.actualUptimePercent}% Uptime (${p.incidentCount} Insiden)`).join('\n')}
━━━━━━━━━━━━━━━━━━━━
_NOC Management System UNTAG_
    `;

    await bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '📊 Dashboard NOC', callback_data: 'menu:noc' }]]
      }
    });
  } catch (err: any) {
    bot?.sendMessage(chatId, `❌ Gagal membuat laporan SLA: ${err.message || err}`);
  }
}

// 4. DHCP Leases Summary
async function sendDhcpLeasesMessage(chatId: string) {
  if (!bot) return;
  try {
    const { NocZabbixService } = await import('./services/nocZabbixService');
    const kpi = await NocZabbixService.getSummaryKPI();
    const leases = kpi.dhcpLeases;

    const text = `
👥 *MIKROTIK DHCP SERVER & KLIEN AKTIF*
━━━━━━━━━━━━━━━━━━━━
📦 *Total Sewa IP (Leases):* *${leases?.total || kpi.dhcpLeasesCount || 0} Perangkat*
🟢 *Aktif / Bound:* *${leases?.active || 0} Klien*
⚡ *Dynamic Leases:* *${leases?.dynamic || 0}*
🔒 *Static Leases:* *${leases?.static || 0}*
🔌 *Status Sumber:* \`${leases?.source || 'mikrotik'}\`

_Router: RB1100AHx4 Dude Edition (103.92.209.1)_
━━━━━━━━━━━━━━━━━━━━
_Waktu: ${new Date().toLocaleTimeString('id-ID')} WIB_
    `;

    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  } catch (err: any) {
    bot?.sendMessage(chatId, `❌ Gagal mengambil data DHCP: ${err.message || err}`);
  }
}

// 5. Daily Digest Report
async function sendDigestReportToChat(chatId: string) {
  if (!bot) return;
  try {
    const { NocZabbixService } = await import('./services/nocZabbixService');
    const kpi = await NocZabbixService.getSummaryKPI();
    const report = await NocSlaService.getSlaReport({ period: 'this_month' });
    const problems = await NocZabbixService.getActiveProblems();

    const todayStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const text = `
🌅 *REKAPITULASI HARIAN JARINGAN (NOC UNTAG)*
📅 *${todayStr}*
━━━━━━━━━━━━━━━━━━━━
📊 *Kinerja Jaringan:*
• Uptime SLA Bulan Ini: *${report.overallUptimePercent}%*
• Kepatuhan Target SLA: *${report.slaComplianceRatePercent}%*
• Rata-rata MTTR: *${report.mttrMinutes} Menit*
• Total Bandwidth Inbound: *${kpi.totalBandwidthGbps} Gbps*
• Klien DHCP Aktif: *${kpi.dhcpLeases?.total || 0} Klien*

⚠️ *Status Alarm Pagi Ini:*
• Alarm Aktif: *${problems.length} Problem* ${problems.length > 0 ? '⚠️' : '✅'}
• Router MikroTik: *${kpi.mikrotik.healthy}/${kpi.mikrotik.total} Online*
• Server & Core: *${kpi.servers?.healthy || 0}/${kpi.servers?.total || 1} Online*

━━━━━━━━━━━━━━━━━━━━
_Tim NOC & Pusat Jaringan UNTAG Banyuwangi_
    `;

    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  } catch (err: any) {
    bot?.sendMessage(chatId, `❌ Gagal membuat rekap harian: ${err.message || err}`);
  }
}

// -------------------------------------------------------------
// BROADCAST ALERT FUNCTIONS
// -------------------------------------------------------------

// Push real-time Zabbix Problem Alert to all linked NOC personnel
export async function sendNocProblemAlert(problem: {
  eventId: string;
  name: string;
  severity: number;
  severityLabel: string;
  deviceName: string;
  deviceIp: string;
  durationText?: string;
}) {
  if (!bot) return;
  if (sentAlertEventIds.has(problem.eventId)) return; // Avoid duplicate spam
  sentAlertEventIds.add(problem.eventId);

  try {
    const [users]: any = await pool.query('SELECT telegram_chat_id FROM users WHERE telegram_chat_id IS NOT NULL');
    const { chatId: defaultChatId } = await getTelegramConfig();

    const targetChatIds = new Set<string>();
    if (defaultChatId) targetChatIds.add(defaultChatId);
    for (const u of users) {
      if (u.telegram_chat_id) targetChatIds.add(u.telegram_chat_id.toString());
    }

    if (targetChatIds.size === 0) return;

    const sevIcon = problem.severity >= 4 ? '🔴' : '🟠';
    const msg = `
🚨 *[ALERT GANGGUAN NOC UNTAG]*
━━━━━━━━━━━━━━━━━━━━
${sevIcon} *Masalah:* *${problem.name}*
📍 *Perangkat:* *${problem.deviceName}*
🌐 *IP Address:* \`${problem.deviceIp}\`
⚡ *Tingkat Bahaya:* *${problem.severityLabel.toUpperCase()}*
🕒 *Waktu Deteksi:* ${new Date().toLocaleTimeString('id-ID')} WIB
🆔 *Event ID:* \`#${problem.eventId}\`
━━━━━━━━━━━━━━━━━━━━
Silakan tangani atau akui alarm ini:
    `;

    const opts = {
      parse_mode: 'Markdown' as const,
      reply_markup: {
        inline_keyboard: [
          [{ text: '⚡ Akui Gangguan Ini', callback_data: `ack:${problem.eventId}` }],
          [{ text: '📊 Buka Dashboard NOC', callback_data: 'menu:noc' }]
        ]
      }
    };

    for (const cid of targetChatIds) {
      await bot.sendMessage(cid, msg, opts).catch(() => {});
    }
  } catch (err) {
    console.error('Failed to send NOC problem alert:', err);
  }
}

// Push resolution alert
export async function sendNocRecoveryAlert(problem: {
  name: string;
  deviceName: string;
  deviceIp: string;
}) {
  if (!bot) return;
  try {
    const [users]: any = await pool.query('SELECT telegram_chat_id FROM users WHERE telegram_chat_id IS NOT NULL');
    const { chatId: defaultChatId } = await getTelegramConfig();

    const targetChatIds = new Set<string>();
    if (defaultChatId) targetChatIds.add(defaultChatId);
    for (const u of users) {
      if (u.telegram_chat_id) targetChatIds.add(u.telegram_chat_id.toString());
    }

    const msg = `
✅ *[PULIH - RECOVERED]*
━━━━━━━━━━━━━━━━━━━━
Perangkat: *${problem.deviceName}* (\`${problem.deviceIp}\`)
Gangguan: *${problem.name}*
Status: *TELAH NORMAL KEMBALI 🟢*
Waktu: ${new Date().toLocaleTimeString('id-ID')} WIB
━━━━━━━━━━━━━━━━━━━━
_Sistem monitoring otomatis NOC UNTAG_
    `;

    for (const cid of targetChatIds) {
      await bot.sendMessage(cid, msg, { parse_mode: 'Markdown' }).catch(() => {});
    }
  } catch (err) {}
}

// Push Daily Morning Digest to all personnel
export async function sendDailyDigestReport() {
  if (!bot) return;
  try {
    const [users]: any = await pool.query('SELECT telegram_chat_id FROM users WHERE telegram_chat_id IS NOT NULL');
    const { chatId: defaultChatId } = await getTelegramConfig();

    const targetChatIds = new Set<string>();
    if (defaultChatId) targetChatIds.add(defaultChatId);
    for (const u of users) {
      if (u.telegram_chat_id) targetChatIds.add(u.telegram_chat_id.toString());
    }

    for (const cid of targetChatIds) {
      await sendDigestReportToChat(cid);
    }
  } catch (err) {
    console.error('Failed to broadcast daily digest report:', err);
  }
}

// Legacy task alert for compatibility
export async function sendTelegramAlert(task: { id: number; device_name: string; ip_address: string; location: string; severity: string }) {
  if (!bot) return;
  try {
    const [techs]: any = await pool.query('SELECT telegram_chat_id FROM users WHERE role = "Teknisi" AND telegram_chat_id IS NOT NULL');
    for (const tech of techs) {
      const message = `🚨 *GANGGUAN BARU DETEKSI ZABBIX*\n\n*Perangkat:* ${task.device_name}\n*IP:* ${task.ip_address}\n*Lokasi:* ${task.location}\n*Tingkat Bahaya:* ${task.severity}\n*Status:* DOWN\n\nSilakan terima tugas melalui tombol di bawah:`;
      await bot.sendMessage(tech.telegram_chat_id, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '✓ Terima Tugas', callback_data: `accept:${task.id}` }]]
        }
      });
    }
  } catch (err) {}
}

// Update Telegram message with complete status
export async function updateTelegramMessage(task: { id: number; device_name: string }, status: 'In Progress' | 'Completed') {
  if (!bot) return;
  try {
    const [techs]: any = await pool.query('SELECT telegram_chat_id FROM users WHERE role = "Teknisi" AND telegram_chat_id IS NOT NULL');
    for (const tech of techs) {
      if (status === 'In Progress') {
        await bot.sendMessage(tech.telegram_chat_id, `📢 Tugas [${task.device_name}] sedang dikerjakan oleh teknisi.`, {
          reply_markup: {
            inline_keyboard: [[{ text: '✓ Selesai', callback_data: `complete:${task.id}` }]]
          }
        });
      } else if (status === 'Completed') {
        await bot.sendMessage(tech.telegram_chat_id, `✓ Tugas [${task.device_name}] telah diselesaikan.`);
      }
    }
  } catch (err) {}
}

// Broadcast new Custom Mission to Telegram personnel
export async function sendTelegramMissionAlert(mission: { id: number; title: string; slots: number; description?: string }) {
  if (!bot) return;
  try {
    const { chatId: defaultChatId } = await getTelegramConfig();
    const [techs]: any = await pool.query('SELECT telegram_chat_id FROM users WHERE telegram_chat_id IS NOT NULL');
    const targetChatIds = new Set<string>();
    if (defaultChatId) targetChatIds.add(defaultChatId);
    for (const t of techs) {
      if (t.telegram_chat_id) targetChatIds.add(t.telegram_chat_id.toString());
    }

    const msg = `🚀 *MISI BARU DITERBITKAN!*\n\n📌 *Judul:* ${mission.title}\n👥 *Kapasitas Slot:* ${mission.slots} Personel\n📝 *Deskripsi:* ${mission.description || '-'}\n\nSilakan buka Dashboard / Mobile PWA untuk mengambil slot Misi ini!`;

    for (const cid of targetChatIds) {
      await bot.sendMessage(cid, msg, { parse_mode: 'Markdown' }).catch(() => {});
    }
  } catch (err) {
    console.error('Failed to send Telegram Mission alert:', err);
  }
}

// Broadcast Mission Completed to Telegram personnel
export async function sendTelegramMissionCompletedAlert(mission: { id: number; title: string; bast_number?: string; bast_signer_name?: string }) {
  if (!bot) return;
  try {
    const { chatId: defaultChatId } = await getTelegramConfig();
    const [techs]: any = await pool.query('SELECT telegram_chat_id FROM users WHERE telegram_chat_id IS NOT NULL');
    const targetChatIds = new Set<string>();
    if (defaultChatId) targetChatIds.add(defaultChatId);
    for (const t of techs) {
      if (t.telegram_chat_id) targetChatIds.add(t.telegram_chat_id.toString());
    }

    let msg = `✅ *MISI DISELESAIKAN!*\n\n📌 *Judul:* ${mission.title}\n`;
    if (mission.bast_number) {
      msg += `📄 *No. BAST:* ${mission.bast_number}\n✍️ *Penerima:* ${mission.bast_signer_name || '-'}\n`;
    }
    msg += `\nDokumen Laporan & BAST resmi telah diterbitkan dan tersimpan di sistem.`;

    for (const cid of targetChatIds) {
      await bot.sendMessage(cid, msg, { parse_mode: 'Markdown' }).catch(() => {});
    }
  } catch (err) {
    console.error('Failed to send Telegram Mission completed alert:', err);
  }
}


