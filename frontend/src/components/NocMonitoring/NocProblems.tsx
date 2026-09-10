import React, { useState } from 'react';
import { 
  ShieldAlert, 
  AlertOctagon, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  Clock, 
  Search, 
  Volume2, 
  VolumeX, 
  Ticket, 
  Check, 
  X,
  Router,
  Server,
  Radio,
  Wifi,
  BellRing,
  Send
} from 'lucide-react';
import type { NocProblem, NocDeviceCategory } from '../../types/noc';
import { BACKEND_URL } from '../../App';

interface Props {
  problems: NocProblem[];
  onAcknowledge: (eventId: string, technicianName: string, note: string) => Promise<boolean>;
  buzzerActive: boolean;
  onToggleBuzzer: () => void;
  onTestAlarm?: () => void;
  currentUserRole?: string;
  currentUserName?: string;
}

export const NocProblems: React.FC<Props> = ({
  problems,
  onAcknowledge,
  buzzerActive,
  onToggleBuzzer,
  onTestAlarm,
  currentUserName = 'Teknisi NOC',
}) => {
  const [selectedSeverity, setSelectedSeverity] = useState<number | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<NocDeviceCategory | 'all'>('all');
  const [ackFilter, setAckFilter] = useState<'all' | 'unacked' | 'acked'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [activeAckModal, setActiveAckModal] = useState<NocProblem | null>(null);
  const [ackNote, setAckNote] = useState('');
  const [techName, setTechName] = useState(currentUserName);
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccessToast, setActionSuccessToast] = useState<string | null>(null);

  // Filter logic
  const filteredProblems = problems.filter((p) => {
    if (selectedSeverity !== 'all' && p.severity !== selectedSeverity) return false;
    if (selectedCategory !== 'all' && p.deviceCategory !== selectedCategory) return false;
    if (ackFilter === 'unacked' && p.acknowledged) return false;
    if (ackFilter === 'acked' && !p.acknowledged) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchDevice = p.deviceName.toLowerCase().includes(q);
      const matchIp = p.deviceIp.toLowerCase().includes(q);
      return matchName || matchDevice || matchIp;
    }
    return true;
  });

  const disasterCount = problems.filter((p) => p.severity === 5).length;
  const highCount = problems.filter((p) => p.severity === 4).length;
  const warningCount = problems.filter((p) => p.severity === 2 || p.severity === 3).length;
  const infoCount = problems.filter((p) => p.severity === 1).length;
  const unackedCount = problems.filter((p) => !p.acknowledged).length;

  const handleOpenAck = (p: NocProblem) => {
    setActiveAckModal(p);
    setAckNote('');
    setTechName(currentUserName);
  };

  const handleConfirmAck = async () => {
    if (!activeAckModal || !ackNote.trim()) return;
    setSubmitting(true);
    const success = await onAcknowledge(activeAckModal.eventId, techName, ackNote);
    setSubmitting(false);
    if (success) {
      setActionSuccessToast(`Alarm [${activeAckModal.deviceName}] successfully acknowledged!`);
      setActiveAckModal(null);
      setTimeout(() => setActionSuccessToast(null), 4000);
    }
  };

  const handleCreateTicket = (p: NocProblem) => {
    setActionSuccessToast(`Ticket created for [${p.deviceName}]: Incident #${p.eventId}`);
    setTimeout(() => setActionSuccessToast(null), 4000);
  };

  const handleTestTelegramAlert = async () => {
    try {
      setActionSuccessToast('Mengirim notifikasi alarm ke Bot Telegram...');
      const res = await fetch(`${BACKEND_URL}/api/monitoring/telegram/test-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionSuccessToast('✓ Alarm uji coba berhasil dikirim ke Telegram!');
      } else {
        setActionSuccessToast(`⚠️ Info Telegram: ${data.error || data.message || 'Token belum aktif'}`);
      }
    } catch (e: any) {
      setActionSuccessToast(`⚠️ Gagal kirim Telegram: ${e.message}`);
    }
    setTimeout(() => setActionSuccessToast(null), 4500);
  };

  const getDeviceIcon = (category: string) => {
    switch (category) {
      case 'mikrotik':
        return <Router size={14} className="text-emerald-400" />;
      case 'olt':
        return <Server size={14} className="text-blue-400" />;
      case 'ap':
        return <Radio size={14} className="text-purple-400" />;
      default:
        return <Wifi size={14} className="text-amber-400" />;
    }
  };

  return (
    <div className="noc-problems-view">
      {/* Toast alert */}
      {actionSuccessToast && (
        <div className="noc-floating-toast">
          <CheckCircle2 size={18} className="text-emerald-400" />
          <span>{actionSuccessToast}</span>
        </div>
      )}

      {/* 1. SEVERITY GLOWING COUNTERS */}
      <div className="noc-severity-counters-grid">
        {/* Disaster */}
        <div
          className={`noc-sev-card sev-disaster ${selectedSeverity === 5 ? 'active-filter' : ''}`}
          onClick={() => setSelectedSeverity(selectedSeverity === 5 ? 'all' : 5)}
        >
          <div className="sev-card-top">
            <span className="sev-card-title">DISASTER</span>
            <AlertOctagon size={20} className="text-rose-500 animate-pulse" />
          </div>
          <div className="sev-card-value text-rose-500">{disasterCount}</div>
          <div className="sev-card-sub">Critical Backbone Outage</div>
        </div>

        {/* High */}
        <div
          className={`noc-sev-card sev-high ${selectedSeverity === 4 ? 'active-filter' : ''}`}
          onClick={() => setSelectedSeverity(selectedSeverity === 4 ? 'all' : 4)}
        >
          <div className="sev-card-top">
            <span className="sev-card-title">HIGH</span>
            <ShieldAlert size={20} className="text-amber-500" />
          </div>
          <div className="sev-card-value text-amber-500">{highCount}</div>
          <div className="sev-card-sub">Major Service / Port Down</div>
        </div>

        {/* Warning */}
        <div
          className={`noc-sev-card sev-warning ${selectedSeverity === 2 || selectedSeverity === 3 ? 'active-filter' : ''}`}
          onClick={() => setSelectedSeverity(selectedSeverity === 3 ? 'all' : 3)}
        >
          <div className="sev-card-top">
            <span className="sev-card-title">WARNING</span>
            <AlertTriangle size={20} className="text-yellow-400" />
          </div>
          <div className="sev-card-value text-yellow-400">{warningCount}</div>
          <div className="sev-card-sub">Threshold / High Utilization</div>
        </div>

        {/* Info */}
        <div
          className={`noc-sev-card sev-info ${selectedSeverity === 1 ? 'active-filter' : ''}`}
          onClick={() => setSelectedSeverity(selectedSeverity === 1 ? 'all' : 1)}
        >
          <div className="sev-card-top">
            <span className="sev-card-title">INFO</span>
            <Info size={20} className="text-blue-400" />
          </div>
          <div className="sev-card-value text-blue-400">{infoCount}</div>
          <div className="sev-card-sub">Reboots & Config Logs</div>
        </div>
      </div>

      {/* 2. CONTROLS & FILTER BAR */}
      <div className="noc-table-controls-bar glass-panel">
        <div className="search-box-wrap">
          <Search size={16} className="text-slate-400" />
          <input
            type="text"
            placeholder="Search problem, device name, or IP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="noc-search-input"
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className="filter-group-wrap">
          {/* Device Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as any)}
            className="noc-select"
          >
            <option value="all">All Devices</option>
            <option value="mikrotik">Mikrotik Routers</option>
            <option value="olt">OLT GPON</option>
            <option value="ap">Access Points</option>
            <option value="ont">Modems / ONTs</option>
          </select>

          {/* Ack Status Filter */}
          <select
            value={ackFilter}
            onChange={(e) => setAckFilter(e.target.value as any)}
            className="noc-select"
          >
            <option value="all">All Ack Status</option>
            <option value="unacked">Unacknowledged Only ({unackedCount})</option>
            <option value="acked">Acknowledged Only</option>
          </select>

          {/* Audio Buzzer Toggle Button */}
          <button
            className={`btn-buzzer-toggle ${buzzerActive ? 'buzzer-on' : 'buzzer-off'}`}
            onClick={onToggleBuzzer}
            title={buzzerActive ? 'Mute Audio Alarm' : 'Enable Audio Alarm'}
          >
            {buzzerActive ? <Volume2 size={16} className="animate-pulse" /> : <VolumeX size={16} />}
            <span>{buzzerActive ? 'Alarm: ON' : 'Alarm: MUTED'}</span>
          </button>

          {/* Test Sirine Button */}
          {onTestAlarm && (
            <button
              className="btn-buzzer-toggle buzzer-test"
              onClick={onTestAlarm}
              title="Klik untuk mendengarkan simulasi bunyi sirine alarm"
            >
              <BellRing size={16} className="text-rose-400 animate-bounce" />
              <span>Test Sirine</span>
            </button>
          )}

          {/* Test Telegram Alert Button */}
          <button
            className="btn-buzzer-toggle btn-telegram-alert"
            onClick={handleTestTelegramAlert}
            title="Klik untuk mengirim simulasi alarm gangguan ke Bot Telegram NOC"
          >
            <Send size={15} className="text-sky-400" />
            <span>Test Telegram</span>
          </button>
        </div>
      </div>

      {/* 3. ACTIVE INCIDENTS TABLE */}
      <div className="noc-problems-table-card glass-panel">
        <div className="table-responsive">
          <table className="noc-table">
            <thead>
              <tr>
                <th>Timestamp & Duration</th>
                <th>Severity</th>
                <th>Device Category</th>
                <th>Problem Description</th>
                <th>Host IP</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProblems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8">
                    <div className="empty-problem-state">
                      <CheckCircle2 size={32} className="text-emerald-400 mx-auto mb-2" />
                      <p className="text-slate-300 font-medium">No matching active network problems found.</p>
                      <span className="text-xs text-slate-500">All Zabbix triggers in this filter criteria are normal.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProblems.map((prob) => {
                  const isCritical = prob.severity >= 4;
                  return (
                    <tr
                      key={prob.eventId}
                      className={`problem-row ${!prob.acknowledged && isCritical ? 'row-critical-unacked' : ''}`}
                    >
                      <td>
                        <div className="time-duration-cell">
                          <span className="time-main">
                            <Clock size={12} /> {prob.durationText}
                          </span>
                          <span className="time-clock text-xs text-slate-400">
                            {new Date(prob.clock * 1000).toLocaleTimeString()}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`noc-badge badge-sev-${prob.severity}`}>
                          {prob.severityLabel.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div className="dev-category-badge">
                          {getDeviceIcon(prob.deviceCategory)}
                          <span>{prob.deviceCategory.toUpperCase()}</span>
                        </div>
                      </td>
                      <td>
                        <div className="prob-desc-cell">
                          <strong>{prob.name}</strong>
                          {prob.acknowledgedMessage && (
                            <div className="ack-note-sub">
                              Note: "{prob.acknowledgedMessage}"
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <code className="text-cyan-300">{prob.deviceIp}</code>
                      </td>
                      <td>
                        {prob.acknowledged ? (
                          <span className="ack-pill-acked">
                            ✓ {prob.acknowledgedBy || 'Acked'}
                          </span>
                        ) : (
                          <span className="ack-pill-unacked animate-pulse">
                            ⚠ Unacked
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="actions-btn-group">
                          {!prob.acknowledged ? (
                            <button
                              className="btn-ack-primary"
                              onClick={() => handleOpenAck(prob)}
                              title="Acknowledge in Zabbix"
                            >
                              Ack
                            </button>
                          ) : (
                            <button
                              className="btn-ack-secondary"
                              onClick={() => handleOpenAck(prob)}
                              title="Edit Acknowledge Note"
                            >
                              Edit
                            </button>
                          )}
                          <button
                            className="btn-ticket-action"
                            onClick={() => handleCreateTicket(prob)}
                            title="Create Helpdesk Ticket"
                          >
                            <Ticket size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. ACKNOWLEDGE MODAL DIALOG */}
      {activeAckModal && (
        <div className="noc-modal-backdrop">
          <div className="noc-modal-box glass-panel animate-scale-in">
            <div className="modal-header">
              <div className="modal-title">
                <Check size={18} className="text-emerald-400" />
                <span>Acknowledge Zabbix Alarm</span>
              </div>
              <button className="modal-close-btn" onClick={() => setActiveAckModal(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-info-box">
                <p><strong>Device:</strong> {activeAckModal.deviceName} (<code>{activeAckModal.deviceIp}</code>)</p>
                <p><strong>Incident:</strong> {activeAckModal.name}</p>
                <p><strong>Duration:</strong> {activeAckModal.durationText} ago</p>
              </div>

              <div className="form-group">
                <label>Technician Name:</label>
                <input
                  type="text"
                  value={techName}
                  onChange={(e) => setTechName(e.target.value)}
                  className="noc-input"
                  placeholder="e.g. Fadhil (Teknisi NOC)"
                />
              </div>

              <div className="form-group">
                <label>Investigation / Mitigation Note:</label>
                <textarea
                  rows={3}
                  value={ackNote}
                  onChange={(e) => setAckNote(e.target.value)}
                  className="noc-textarea"
                  placeholder="e.g. Sedang pengecekan kabel FO di ODC Timur / reboot AP."
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn-cancel"
                onClick={() => setActiveAckModal(null)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                className="btn-submit-ack"
                onClick={handleConfirmAck}
                disabled={submitting || !ackNote.trim()}
              >
                {submitting ? 'Submitting to Zabbix...' : 'Confirm Acknowledge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
