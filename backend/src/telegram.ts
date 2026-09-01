import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { pool } from './db';
import { getDevices, summonDevice, setWifiConfig, GenieACSConfig, parseDeviceData } from './genieacs';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
let bot: TelegramBot | null = null;

// Session memory for multi-step interactive commands (e.g., editwifi)
const sessionState: Record<string, { command: string; step: number; data: any }> = {};

// Helper: Get user role from DB
async function getUserRole(chatId: string | number): Promise<{ name: string; role: string } | null> {
  const [rows]: any = await pool.query('SELECT name, role FROM users WHERE telegram_chat_id = ? LIMIT 1', [chatId.toString()]);
  if (rows.length === 0) return null;
  return rows[0];
}

// Helper: Check RBAC permissions
function hasPermission(userRole: string, action: 'view' | 'summon' | 'edit_wifi' | 'manage_users'): boolean {
  if (userRole === 'Administrator') return true;
  if (userRole === 'Manager') {
    return ['view', 'summon'].includes(action);
  }
  if (userRole === 'Teknisi') {
    return ['view'].includes(action);
  }
  return false;
}

// Helper: Get ACS Credentials
async function getAcsCreds(): Promise<GenieACSConfig | null> {
  const [credRows]: any = await pool.query('SELECT host, port, username, password FROM genieacs_credentials WHERE is_connected = 1 ORDER BY id DESC LIMIT 1');
  if (credRows.length === 0) return null;
  return credRows[0];
}

export function initTelegramBot(onAction: (action: 'accept' | 'complete', taskId: number) => void) {
  const IS_VERCEL = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;

  if (!token || token.includes('YOUR_TELEGRAM_BOT_TOKEN')) {
    console.warn('⚠️ WARNING: Telegram Bot Token not set in .env. Bot features will run in simulation mode.');
    return;
  }

  if (IS_VERCEL) {
    console.log('ℹ️ Telegram Bot polling disabled on Vercel serverless.');
    return;
  }

  try {
    bot = new TelegramBot(token, { polling: true });
    console.log('🤖 Telegram Bot Service successfully initialized with Interactive Commands.');

    // --------------------------------------------------------
    // COMMAND: /start
    // --------------------------------------------------------
    bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
      const chatId = msg.chat.id.toString();
      const usernameParam = match ? match[1] : null;

      if (usernameParam) {
        // Link Account
        try {
          const [rows]: any = await pool.query('SELECT * FROM users WHERE username = ?', [usernameParam]);
          if (rows.length === 0) {
            bot?.sendMessage(chatId, `❌ Gagal menghubungkan: Username "${usernameParam}" tidak ditemukan di database.`);
            return;
          }
          await pool.query('UPDATE users SET telegram_chat_id = ? WHERE username = ?', [chatId, usernameParam]);
          bot?.sendMessage(chatId, `✓ Halo ${rows[0].name}, akun Telegram Anda berhasil terhubung ke NEMESYS sebagai: ${rows[0].role}! Ketik /help untuk menu.`);
        } catch (err) {
          bot?.sendMessage(chatId, '❌ Terjadi kesalahan internal saat menghubungkan akun.');
        }
        return;
      }

      // Check if already linked
      const user = await getUserRole(chatId);
      if (!user) {
        bot?.sendMessage(chatId, 'Selamat datang di Nemesys Bot.\nSilakan gunakan perintah: `/start <username_dashboard>` untuk menghubungkan akun Anda.', { parse_mode: 'Markdown' });
        return;
      }

      const opts = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📊 Dashboard', callback_data: 'menu:dashboard' }, { text: '🖧 Device List', callback_data: 'menu:list' }],
            [{ text: '❓ Bantuan (Help)', callback_data: 'menu:help' }]
          ]
        }
      };
      bot?.sendMessage(chatId, `Halo *${user.name}* (${user.role})! Apa yang ingin Anda lakukan hari ini?`, { parse_mode: 'Markdown', ...opts });
    });

    // --------------------------------------------------------
    // COMMAND: /help
    // --------------------------------------------------------
    bot.onText(/\/help/, async (msg) => {
      const chatId = msg.chat.id.toString();
      const helpText = `
*Daftar Perintah Nemesys Bot:*
/status <SN> - Cek status detail ONU
/list - Lihat daftar perangkat ONU
/summon <SN> - Refresh/Summon ONU (Admin/Manager)
/editwifi <SN> - Ubah SSID/Pass WiFi ONU (Admin)
/cancel - Batalkan perintah yang sedang berjalan
      `;
      bot?.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
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
    // COMMAND: /status <SN>
    // --------------------------------------------------------
    bot.onText(/\/status(?:\s+(.+))?/, async (msg, match) => {
      const chatId = msg.chat.id.toString();
      const serial = match ? match[1]?.trim() : null;
      
      const user = await getUserRole(chatId);
      if (!user) return; // Silent if not registered
      if (!hasPermission(user.role, 'view')) return bot!.sendMessage(chatId, '❌ Anda tidak memiliki akses untuk perintah ini.');

      if (!serial) {
        return bot!.sendMessage(chatId, 'Gunakan format: `/status <SerialNumber>`', { parse_mode: 'Markdown' });
      }

      bot!.sendMessage(chatId, `🔍 Mencari perangkat dengan SN: ${serial}...`);
      
      const creds = await getAcsCreds();
      if (!creds) return bot!.sendMessage(chatId, '❌ Konfigurasi GenieACS belum diatur di sistem.');

      const res = await getDevices(creds, { 'summary.serialNumber': serial }, 1);
      if (!res.success || !res.data || res.data.length === 0) {
        return bot!.sendMessage(chatId, '❌ Perangkat tidak ditemukan atau sedang offline dari ACS.');
      }

      const d = parseDeviceData(res.data[0]);
      const statusIcon = d.status === 'online' ? '✅' : '❌';
      
      const text = `
*STATUS PERANGKAT*
SN: \`${d.serialNumber}\`
Pabrikan: ${d.manufacturer} ${d.productClass}
Status: ${statusIcon} *${d.status.toUpperCase()}*

*Parameter Jaringan:*
IP Address: ${d.ipAddress || '-'}
IP TR069: ${d.ipTr069 || '-'}
MAC Address: ${d.macAddress || '-'}

*Optik & Suhu:*
Rx Power: ${d.rxPower ? d.rxPower + ' dBm' : '-'}
Suhu: ${d.temperature ? d.temperature + ' °C' : '-'}

*WiFi Info:*
SSID: ${d.wifiSsid || '-'}
Password: ${d.wifiPassword ? '`' + d.wifiPassword + '`' : '-'}
      `;

      const inline_keyboard = [];
      if (hasPermission(user.role, 'summon')) {
        inline_keyboard.push([{ text: '⚡ Summon Device', callback_data: `action:summon:${d._id}` }]);
      }
      if (hasPermission(user.role, 'edit_wifi')) {
        inline_keyboard.push([{ text: '📶 Edit WiFi', callback_data: `action:editwifi:${d._id}` }]);
      }

      bot!.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard } });
    });

    // --------------------------------------------------------
    // COMMAND: /list
    // --------------------------------------------------------
    bot.onText(/\/list/, async (msg) => {
      const chatId = msg.chat.id.toString();
      const user = await getUserRole(chatId);
      if (!user) return;
      if (!hasPermission(user.role, 'view')) return bot!.sendMessage(chatId, '❌ Anda tidak memiliki akses.');

      bot!.sendMessage(chatId, 'Sedang mengambil daftar perangkat...');
      const creds = await getAcsCreds();
      if (!creds) return bot!.sendMessage(chatId, '❌ Konfigurasi GenieACS belum diatur.');

      const res = await getDevices(creds, {}, 10, 0);
      if (!res.success || !res.data) return bot!.sendMessage(chatId, '❌ Gagal mengambil data.');

      let text = '*10 Perangkat Terakhir:*\n\n';
      res.data.forEach((device) => {
        const d = parseDeviceData(device);
        text += `${d.status === 'online' ? '🟢' : '🔴'} \`${d.serialNumber}\` - ${d.ipAddress || '-'}\n`;
      });

      bot!.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    });

    // --------------------------------------------------------
    // COMMAND: /summon <SN>
    // --------------------------------------------------------
    bot.onText(/\/summon(?:\s+(.+))?/, async (msg, match) => {
      const chatId = msg.chat.id.toString();
      const serial = match ? match[1]?.trim() : null;
      
      const user = await getUserRole(chatId);
      if (!user) return;
      if (!hasPermission(user.role, 'summon')) return bot!.sendMessage(chatId, '❌ Akses ditolak. Hanya Admin/Manager.');

      if (!serial) return bot!.sendMessage(chatId, 'Gunakan format: `/summon <SerialNumber>`', { parse_mode: 'Markdown' });

      // First find device_id
      const creds = await getAcsCreds();
      if (!creds) return;
      const res = await getDevices(creds, { 'summary.serialNumber': serial }, 1);
      if (!res.success || !res.data || res.data.length === 0) {
        return bot!.sendMessage(chatId, '❌ Perangkat tidak ditemukan.');
      }
      
      const d = parseDeviceData(res.data[0]);
      bot!.sendMessage(chatId, `⚠️ Konfirmasi Summon untuk perangkat ${d.serialNumber}?`, {
        reply_markup: {
          inline_keyboard: [[
            { text: 'Ya, Summon', callback_data: `confirm:summon:${d._id}` },
            { text: 'Batal', callback_data: `confirm:cancel` }
          ]]
        }
      });
    });

    // --------------------------------------------------------
    // COMMAND: /editwifi <SN>
    // --------------------------------------------------------
    bot.onText(/\/editwifi(?:\s+(.+))?/, async (msg, match) => {
      const chatId = msg.chat.id.toString();
      const serial = match ? match[1]?.trim() : null;
      
      const user = await getUserRole(chatId);
      if (!user) return;
      if (!hasPermission(user.role, 'edit_wifi')) return bot!.sendMessage(chatId, '❌ Akses ditolak. Hanya Admin.');

      if (!serial) return bot!.sendMessage(chatId, 'Gunakan format: `/editwifi <SerialNumber>`', { parse_mode: 'Markdown' });

      const creds = await getAcsCreds();
      if (!creds) return;
      const res = await getDevices(creds, { 'summary.serialNumber': serial }, 1);
      if (!res.success || !res.data || res.data.length === 0) return bot!.sendMessage(chatId, '❌ Perangkat tidak ditemukan.');
      
      const d = parseDeviceData(res.data[0]);
      
      // Start Session
      sessionState[chatId] = { command: 'editwifi', step: 1, data: { deviceId: d._id, serial: d.serialNumber } };
      
      bot!.sendMessage(chatId, `📶 *Edit WiFi* untuk ONU \`${d.serialNumber}\`\n\nMasukkan *SSID (Nama WiFi)* baru:\n\n_(Atau ketik /cancel untuk membatalkan)_`, { parse_mode: 'Markdown' });
    });

    // --------------------------------------------------------
    // Catch-all for Session States (Multi-step)
    // --------------------------------------------------------
    bot.on('message', async (msg) => {
      const chatId = msg.chat.id.toString();
      const text = msg.text || '';
      
      if (text.startsWith('/')) return; // Ignore commands
      
      if (sessionState[chatId] && sessionState[chatId].command === 'editwifi') {
        const state = sessionState[chatId];
        
        if (state.step === 1) {
          state.data.ssid = text;
          state.step = 2;
          bot!.sendMessage(chatId, `✅ SSID diset ke: *${text}*\n\nSekarang masukkan *Password WiFi* baru (minimal 8 karakter):\n\n_(Ketik 'skip' jika tidak ingin pakai password, atau /cancel)_`, { parse_mode: 'Markdown' });
        } 
        else if (state.step === 2) {
          const pass = text.toLowerCase() === 'skip' ? '' : text;
          if (pass !== '' && pass.length < 8) {
            return bot!.sendMessage(chatId, '❌ Password harus minimal 8 karakter. Silakan masukkan lagi:');
          }
          
          state.data.password = pass;
          const { deviceId, serial, ssid, password } = state.data;
          
          bot!.sendMessage(chatId, `⏳ Mengirim perintah TR-069 ke perangkat \`${serial}\`...`, { parse_mode: 'Markdown' });
          delete sessionState[chatId]; // Clear session
          
          const creds = await getAcsCreds();
          if (creds) {
            const res = await setWifiConfig(creds, deviceId, ssid, password);
            if (res.success) {
              bot!.sendMessage(chatId, `🎉 *Berhasil!* Konfigurasi WiFi telah dikirim ke perangkat. Membutuhkan waktu 1-2 menit untuk teraplikasi pada router.`, { parse_mode: 'Markdown' });
            } else {
              bot!.sendMessage(chatId, `❌ Gagal mengirim konfigurasi: ${res.error}`);
            }
          }
        }
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
      if (!user) return bot?.answerCallbackQuery(query.id, { text: 'Akses Ditolak', show_alert: true });

      const parts = data.split(':');
      const action = parts[0];

      if (action === 'accept') {
        // Zabbix tasks
        onAction('accept', parseInt(parts[1]));
        bot?.answerCallbackQuery(query.id, { text: 'Tugas diterima!' });
      } 
      else if (action === 'complete') {
        onAction('complete', parseInt(parts[1]));
        bot?.answerCallbackQuery(query.id, { text: 'Tugas diselesaikan!' });
      }
      else if (action === 'menu') {
        bot?.answerCallbackQuery(query.id);
        if (parts[1] === 'dashboard') {
          // just send static summary
          bot?.sendMessage(chatId, '📊 Untuk melihat Dashboard secara lengkap, silakan buka Web Interface Nemesys.');
        } else if (parts[1] === 'help') {
          bot?.sendMessage(chatId, 'Gunakan /status <SN> untuk melihat detail alat, atau /list untuk melihat daftar.');
        } else if (parts[1] === 'list') {
          bot?.sendMessage(chatId, 'Ketik perintah /list');
        }
      }
      else if (action === 'action') {
        bot?.answerCallbackQuery(query.id);
        const subAction = parts[1];
        const deviceId = parts[2];
        
        if (subAction === 'summon') {
          if (!hasPermission(user.role, 'summon')) return bot?.sendMessage(chatId, '❌ Anda tidak memiliki hak akses.');
          bot?.sendMessage(chatId, `⚠️ Konfirmasi Summon perangkat?`, {
            reply_markup: {
              inline_keyboard: [[
                { text: 'Ya, Summon', callback_data: `confirm:summon:${deviceId}` },
                { text: 'Batal', callback_data: `confirm:cancel` }
              ]]
            }
          });
        }
        else if (subAction === 'editwifi') {
          if (!hasPermission(user.role, 'edit_wifi')) return bot?.sendMessage(chatId, '❌ Anda tidak memiliki hak akses.');
          sessionState[chatId] = { command: 'editwifi', step: 1, data: { deviceId, serial: deviceId } }; // deviceId matches serial mostly, or query it
          bot?.sendMessage(chatId, `📶 *Edit WiFi*\n\nMasukkan *SSID (Nama WiFi)* baru:\n\n_(Atau ketik /cancel)_`, { parse_mode: 'Markdown' });
        }
      }
      else if (action === 'confirm') {
        if (parts[1] === 'cancel') {
          bot?.answerCallbackQuery(query.id, { text: 'Dibatalkan' });
          bot?.sendMessage(chatId, '🚫 Perintah dibatalkan.');
        }
        else if (parts[1] === 'summon') {
          bot?.answerCallbackQuery(query.id, { text: 'Mengirim Summon...' });
          bot?.sendMessage(chatId, '⏳ Mengirim Connection Request...');
          const creds = await getAcsCreds();
          if (creds) {
            const res = await summonDevice(creds, parts[2]);
            if (res.success) {
              bot?.sendMessage(chatId, '✅ Summon berhasil dikirim (200 OK).');
            } else {
              bot?.sendMessage(chatId, `❌ Gagal summon: ${res.error}`);
            }
          }
        }
      }
    });

  } catch (error) {
    console.error('Failed to start Telegram Bot:', error);
  }
}

// Push alert to all registered technicians or specific assigned tech
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
