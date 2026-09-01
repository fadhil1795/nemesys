export interface User {
  id: number;
  username: string;
  name: string;
  role: 'Administrator' | 'Manager' | 'Teknisi';
  telegram_chat_id: string | null;
  status: 'Available' | 'Busy';
  daily_tasks_count: number;
  mission_completed: number;
  mission_incompleted: number;
}

export interface DeviceCategory {
  id: number;
  name: string;
  svg_icon: string | null;
}

export interface Device {
  id: number;
  name: string;
  type: string;
  ip_address: string;
  location: string;
  latitude: number;
  longitude: number;
  status: 'Up' | 'Down' | 'Warning' | 'Maintenance';
  last_ping: string;
  is_backbone: boolean;
  battery_percentage?: number; // for solar devices
  voltage?: number; // for solar devices
  solar_status?: 'Charging' | 'Discharging' | 'Full';
  description?: string;
  category?: string;
  web_config_url?: string;
  device_image?: string;
  parent_id?: number | null;
}

export interface DailyTask {
  id: number;
  device_id: number;
  device_name: string;
  ip_address: string;
  location: string;
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  status: 'Open' | 'Approved' | 'Rejected' | 'In Progress' | 'Completed';
  severity: 'Warning' | 'Alert' | 'Emergency';
  started_at: string;
  completed_at: string | null;
  sla_minutes: number;
  resolution_notes?: string | null;
  steps?: string | null;
}

export interface Mission {
  id: number;
  task_id: number;
  user_id: number;
  user_name: string;
  task_device_name: string;
  status: 'Completed' | 'Incompleted';
  completed_at: string;
  resolution_notes?: string | null;
}

export interface TemperatureLog {
  id: number;
  temperature: number;
  recorded_at: string;
}

export interface DailyTodo {
  id: number;
  task_name: string;
  is_completed: boolean;
}

export interface CustomMission {
  id: number;
  title: string;
  description: string | null;
  slots: number;
  progress_percent: number;
  created_at: string;
  status: string;
  personnels: Array<{ id: number; name: string; username: string; role: string }>;
  created_by?: string | null;
  date_finished?: string | null;
  duration_str?: string | null;
  note?: string | null;
  mission_image?: string | null;
}

export interface UserTicket {
  id: number;
  ticket_number: string;
  full_name: string;
  id_number: string;
  category: string;
  unit_specification: string;
  email: string;
  whatsapp_number: string;
  service_type: string;
  description: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed' | 'Rejected';
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  created_at: string;
  updated_at: string;
  resolution_notes?: string | null;
  image_url?: string | null;
}

// ============================================================
// GACS — GenieACS / PON Network Types
// ============================================================

export interface GenieACSDevice {
  _id: string;
  serialNumber: string;
  oui: string;
  manufacturer: string;
  productClass: string;
  hardwareVersion: string;
  softwareVersion: string;
  macAddress: string;
  ipAddress: string;
  ipTr069: string;
  status: 'online' | 'offline';
  lastInform: string | null;
  lastInformTs: number | null;
  uptime: string;
  wifiSsid: string;
  wifiPassword: string;
  rxPower: string | number | null;
  temperature: string | number | null;
  ping: number | null;
  wanDetails: WanDetail[];
}

export interface WanDetail {
  type: 'PPPoE' | 'IP';
  name: string;
  status: string;
  connectionType: string;
  externalIp: string;
  gateway: string;
  subnetMask: string;
  dnsServers: string;
  macAddress: string;
  username: string;
  uptime: string;
  lastError: string;
  binding: string;
}

export interface MapItem {
  id: number;
  item_type: 'server' | 'isp' | 'mikrotik' | 'olt' | 'odc' | 'odp' | 'onu' | 'other';
  parent_id: number | null;
  name: string;
  latitude: number;
  longitude: number;
  genieacs_device_id: string | null;
  status: 'online' | 'offline' | 'unknown';
  properties?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MapConnection {
  id: number;
  from_item_id: number;
  to_item_id: number;
  connection_type: 'online' | 'offline' | 'unknown';
  path_coordinates: string | null; // JSON array [[lat,lng],...]
}

export interface GenieACSCredentials {
  id?: number;
  host: string;
  port: number;
  username?: string;
  is_connected?: number;
  last_test?: string | null;
}

export interface MikroTikCredentials {
  id?: number;
  host: string;
  port: number;
  username: string;
  is_connected?: number;
  last_test?: string | null;
}

export interface TelegramBotConfig {
  id?: number;
  bot_token?: string;
  bot_name?: string;
  chat_id?: string;
  is_active?: number;
  is_connected?: number;
  last_test?: string | null;
}

// ============================================================
// Operational Management Suite Types (Network Engginer.xlsx)
// ============================================================

export interface OperationalIncident {
  id: number;
  incident_date: string;
  report_time: string | null;
  resolved_time: string | null;
  affected_system: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  description: string;
  impact: string | null;
  root_cause: string | null;
  action_taken: string | null;
  handled_by: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  notes: string | null;
  created_at?: string;
}

export interface OperationalChangeRequest {
  id: number;
  request_date: string;
  cr_code: string;
  description: string;
  reason: string;
  affected_devices: string;
  requested_by: string;
  approved_by: string | null;
  implementation_schedule: string | null;
  rollback_plan: string | null;
  status: 'Draft' | 'Diajukan' | 'Disetujui' | 'Diimplementasi' | 'Ditolak' | 'Selesai';
  notes: string | null;
  created_at?: string;
}

export interface OperationalProcurement {
  id: number;
  item_name: string;
  category: string;
  sub_category: string | null;
  location: string;
  brand: string | null;
  color: string | null;
  unit_price: number;
  quantity: number;
  unit_name: string | null;
  acquisition_date: string | null;
  lifespan: string | null;
  notes: string | null;
  created_at?: string;
}

export interface OperationalBackupLog {
  id: number;
  backup_date: string;
  device_name: string;
  backup_type: 'Full' | 'Manual' | 'Auto';
  storage_location: string | null;
  file_size: string | null;
  performed_by: string;
  verification_status: 'Berhasil' | 'Gagal' | 'Pending';
  notes: string | null;
  created_at?: string;
}

export interface OperationalAccessLog {
  id: number;
  access_date: string;
  access_time: string;
  accessor_name: string;
  target_device: string;
  purpose: string;
  access_method: string;
  approved_by: string | null;
  end_time: string | null;
  notes: string | null;
  created_at?: string;
}

export interface OperationalDailyChecklist {
  id: number;
  inspection_item: string;
  is_completed: boolean | number;
  inspected_by: string;
  inspection_time: string | null;
  notes: string | null;
  created_at?: string;
}

export interface OperationalMonitoringReport {
  id: number;
  report_date: string;
  device_name: string;
  uptime_pct: string | null;
  bandwidth_util: string | null;
  cpu_pct: string | null;
  memory_pct: string | null;
  latency_ms: string | null;
  packet_loss_pct: string | null;
  status: 'Normal' | 'Warning' | 'Nonaktif' | 'Critical';
  notes: string | null;
  created_at?: string;
}

export interface OperationalSummary {
  totalIncidents: number;
  openIncidents: number;
  totalCRs: number;
  pendingCRs: number;
  totalProcurementCost: number;
  totalProcurements: number;
  totalBackups: number;
  totalAccessLogs: number;
  completedChecklists: number;
  totalChecklists: number;
  totalMonitors?: number;
  warningMonitors?: number;
}
