/**
 * WhatsApp Integration Utility (Direct Deep Link Integration - No API / No Paid Gateway Required)
 * Uses wa.me / api.whatsapp.com deep links with formatted template text.
 */

// Format any phone number into international format (e.g. 081234567890 -> 6281234567890)
export function formatPhoneNumberForWA(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, ''); // Remove all non-digits
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  } else if (cleaned.startsWith('8')) {
    cleaned = '62' + cleaned;
  }
  return cleaned;
}

// Open WhatsApp Web or App directly with a pre-filled message
export function openWhatsAppChat(phone: string, message: string): void {
  const formattedPhone = formatPhoneNumberForWA(phone);
  const encodedText = encodeURIComponent(message);
  
  if (!formattedPhone) {
    alert('Nomor telepon WhatsApp tidak valid atau belum diisi.');
    return;
  }
  
  const url = `https://wa.me/${formattedPhone}?text=${encodedText}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

// Message Templates for WhatsApp Deep Link Integration
export const WATemplates = {
  // Verification / Profile Message
  profileVerification: (name: string, nipp: string, division: string, role: string) => 
    `Halo *${name}*,\n\n` +
    `Berikut adalah konfirmasi data profil Anda di *NEMESYS NOC System*:\n` +
    `• *Nama*: ${name}\n` +
    `• *NIPP*: ${nipp || '-'}\n` +
    `• *Divisi*: ${division || '-'}\n` +
    `• *Role*: ${role}\n` +
    `• *Status*: Terverifikasi & Aktif\n\n` +
    `Pesan ini dikirimkan via WhatsApp Direct Link System (No API required). Terima kasih!`,

  // Task / Ticket Dispatch to Technician
  taskDispatch: (task: { id: string | number; device_name: string; location: string; severity: string; ip_address: string }, techName: string) =>
    `🚨 *NOTIFIKASI TUGAS NOC NEMESYS*\n\n` +
    `Yth. *${techName}*,\n` +
    `Anda mendapat penugasan perbaikan gangguan berikut:\n` +
    `• *ID Tiket*: #${task.id}\n` +
    `• *Perangkat*: ${task.device_name} (${task.ip_address})\n` +
    `• *Lokasi*: ${task.location}\n` +
    `• *Tingkat Severity*: *${task.severity.toUpperCase()}*\n\n` +
    `Mohon dapat segera menuju lokasi & memperbarui status tugas. Terima kasih.`,

  // Service Desk / Helpdesk Ticket Status Update
  ticketStatusUpdate: (ticketId: string | number, title: string, status: string, requesterName: string) =>
    `📢 *UPDATE TIKET HELPDESK UNTAG*\n\n` +
    `Halo *${requesterName}*,\n` +
    `Tiket laporan Anda *#${ticketId}* (${title}) telah diperbarui ke status:\n` +
    `👉 *STATUS: ${status.toUpperCase()}*\n\n` +
    `Jika ada kendala lebih lanjut, silakan hubungi tim NOC Helpdesk. Terima kasih.`,

  // General Public Helpdesk Enquiry
  publicHelpdeskEnquiry: () =>
    `Halo *Helpdesk NOC IT UNTAG*,\n\n` +
    `Saya mengalami kendala jaringan / layanan IT dan membutuhkan bantuan teknis.\n` +
    `Mohon dapat dibantu. Terima kasih.`
};
