import { pool } from '../db';
import { NocZabbixService } from './nocZabbixService';

export interface SlaFilterParams {
  period?: 'this_month' | 'last_month' | 'last_30_days' | 'q3' | 'custom';
  startDate?: string;
  endDate?: string;
  scope?: 'all' | 'backbone' | 'pop' | 'vip' | 'aps';
}

export interface DeviceSlaItem {
  id: number | string;
  name: string;
  ip: string;
  type: string;
  location: string;
  targetSlaPercent: number;
  actualUptimePercent: number;
  totalDowntimeMinutes: number;
  incidentCount: number;
  mttrMinutes: number;
  status: 'MET' | 'BREACHED';
  isBackbone: boolean;
  isLiveDown?: boolean;
  liveDownMinutes?: number;
}

export interface PopSlaItem {
  popName: string;
  nodeCount: number;
  targetSlaPercent: number;
  actualUptimePercent: number;
  totalDowntimeMinutes: number;
  incidentCount: number;
  status: 'MET' | 'BREACHED';
  hasLiveOutage?: boolean;
}

export interface IncidentRecord {
  id: number;
  incidentDate: string;
  reportTime: string;
  resolvedTime: string;
  durationMinutes: number;
  affectedSystem: string;
  location: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  rootCause: string;
  actionTaken: string;
  handledBy: string;
  status: 'Resolved' | 'Closed' | 'In Progress';
  slaBreached: boolean;
  isLive?: boolean;
}

export interface SlaSummaryReport {
  periodLabel: string;
  startDate: string;
  endDate: string;
  totalPeriodHours: number;
  totalPeriodMinutes: number;
  zabbixLiveConnected: boolean;
  liveOutageCount: number;
  
  // High Level KPIs
  overallUptimePercent: number;
  totalDowntimeMinutes: number;
  totalIncidents: number;
  mttrMinutes: number; // Mean Time To Repair
  mtbfHours: number;   // Mean Time Between Failures
  slaComplianceRatePercent: number; // % of devices that met target SLA
  nodesMetCount: number;
  nodesBreachedCount: number;
  totalNodesMonitored: number;

  // Breakdowns
  devices: DeviceSlaItem[];
  pops: PopSlaItem[];
  incidents: IncidentRecord[];
  rootCauses: Array<{ cause: string; count: number; downtimeMinutes: number }>;
  dailyTrends: Array<{ date: string; uptimePercent: number; incidentCount: number }>;
}

export class NocSlaService {
  /**
   * Calculate comprehensive SLA & Downtime Report
   */
  static async getSlaReport(params: SlaFilterParams = {}): Promise<SlaSummaryReport> {
    const period = params.period || 'this_month';
    const now = new Date();
    
    let startDateStr = '';
    let endDateStr = '';
    let periodLabel = '';
    let totalDays = 30;

    if (period === 'this_month') {
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      startDateStr = `${year}-${month}-01`;
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
      endDateStr = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
      totalDays = lastDay;
      const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      periodLabel = `${monthNames[now.getMonth()]} ${year}`;
    } else if (period === 'last_month') {
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const year = prevDate.getFullYear();
      const month = String(prevDate.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, prevDate.getMonth() + 1, 0).getDate();
      startDateStr = `${year}-${month}-01`;
      endDateStr = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
      totalDays = lastDay;
      const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      periodLabel = `${monthNames[prevDate.getMonth()]} ${year}`;
    } else if (period === 'q3') {
      startDateStr = '2026-07-01';
      endDateStr = '2026-09-30';
      totalDays = 92;
      periodLabel = 'Triwulan III (Q3 2026)';
    } else if (params.startDate && params.endDate) {
      startDateStr = params.startDate;
      endDateStr = params.endDate;
      const d1 = new Date(startDateStr);
      const d2 = new Date(endDateStr);
      const diffTime = Math.abs(d2.getTime() - d1.getTime());
      totalDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      periodLabel = `${startDateStr} s/d ${endDateStr}`;
    } else {
      startDateStr = '2026-08-01';
      endDateStr = '2026-08-31';
      totalDays = 31;
      periodLabel = '30 Hari Terakhir';
    }

    const totalPeriodHours = totalDays * 24;
    const totalPeriodMinutes = totalPeriodHours * 60;

    // 1. Check Live Zabbix Connection & Active Problems
    const zLive = await NocZabbixService.isLiveZabbixConnected();
    const isZabbixLive = Boolean(zLive && zLive.connected);
    const zProblems = await NocZabbixService.getActiveProblems().catch(() => []);

    // 2. Fetch Devices & Open Tasks from MySQL
    const [devicesRows]: any = await pool.query('SELECT * FROM devices ORDER BY is_backbone DESC, name ASC');
    const [openTasks]: any = await pool.query('SELECT * FROM tasks WHERE status = "Open"').catch(() => [[]]);
    const [completedTasks]: any = await pool.query('SELECT * FROM tasks WHERE status = "Completed" ORDER BY id DESC LIMIT 50').catch(() => [[]]);

    // 3. Fetch Operational Incidents
    const [incidentRows]: any = await pool.query(
      'SELECT * FROM operational_incidents ORDER BY id DESC'
    );

    // Seed realistic sample incidents if table is empty
    if (incidentRows.length === 0) {
      await this.seedDefaultIncidents();
    }

    const [freshIncidentRows]: any = await pool.query('SELECT * FROM operational_incidents ORDER BY id DESC');

    // 4. Process Historical Incidents
    const incidents: IncidentRecord[] = freshIncidentRows.map((inc: any) => {
      let durationMins = 35;
      if (inc.report_time && inc.resolved_time) {
        try {
          const t1 = inc.report_time.split(':');
          const t2 = inc.resolved_time.split(':');
          if (t1.length >= 2 && t2.length >= 2) {
            const m1 = parseInt(t1[0]) * 60 + parseInt(t1[1]);
            const m2 = parseInt(t2[0]) * 60 + parseInt(t2[1]);
            if (m2 >= m1) durationMins = m2 - m1;
          }
        } catch (e) {
          durationMins = 35;
        }
      }

      return {
        id: inc.id,
        incidentDate: inc.incident_date || '2026-08-15',
        reportTime: inc.report_time || '09:15',
        resolvedTime: inc.resolved_time || '09:50',
        durationMinutes: durationMins,
        affectedSystem: inc.affected_system || 'Core Switch',
        location: inc.affected_system?.includes('Lab') ? 'Lab Komputer' : inc.affected_system?.includes('Asrama') ? 'Asrama Mahasiswa' : 'Server Room Rektorat',
        severity: inc.severity || 'Medium',
        rootCause: inc.root_cause || 'Kabel Patchcord FO Tertekuk',
        actionTaken: inc.action_taken || 'Cleaning core connector & re-patching LC-LC jumper',
        handledBy: inc.handled_by || 'Rizal Kurniawan (NOC)',
        status: (inc.status === 'Open' ? 'In Progress' : inc.status) || 'Resolved',
        slaBreached: Boolean(inc.sla_breached) || durationMins > (inc.sla_limit_minutes || 60),
        isLive: false,
      };
    });

    // 5. Inject Realtime Active Zabbix Problems & Open Tasks into Incidents
    const activeOutageMap = new Map<string, { minutes: number; cause: string; severity: any }>();

    // From Zabbix Active Problems
    zProblems.forEach((zp) => {
      const devName = zp.deviceName || zp.name;
      const probClock = Number(zp.clock) || Math.floor(Date.now() / 1000) - 900;
      const ongoingMins = Math.max(1, Math.round((Date.now() / 1000 - probClock) / 60));
      const sevLabel = zp.severity >= 4 ? 'Critical' : zp.severity === 3 ? 'High' : 'Medium';
      
      activeOutageMap.set(devName.toLowerCase(), {
        minutes: ongoingMins,
        cause: zp.name || 'Zabbix Trigger Alert',
        severity: sevLabel,
      });

      incidents.unshift({
        id: 9000 + Math.floor(Math.random() * 999),
        incidentDate: new Date().toISOString().split('T')[0],
        reportTime: new Date(probClock * 1000).toTimeString().substring(0, 5),
        resolvedTime: 'SEDANG PADAM (LIVE)',
        durationMinutes: ongoingMins,
        affectedSystem: devName,
        location: 'Data Center Kampus UNTAG',
        severity: sevLabel as any,
        rootCause: zp.name || 'Zabbix ICMP/Service Alert',
        actionTaken: 'Teknisi NOC sedang melakukan investigasi live di lokasi',
        handledBy: 'Tim NOC Siaga',
        status: 'In Progress',
        slaBreached: ongoingMins > 45,
        isLive: true,
      });
    });

    // From Open Tasks in MySQL
    if (Array.isArray(openTasks)) {
      openTasks.forEach((ot: any) => {
        const taskDev = (ot.device_name || '').toLowerCase();
        if (!activeOutageMap.has(taskDev)) {
          const taskStart = ot.created_at ? new Date(ot.created_at).getTime() : Date.now() - (30 * 60000);
          const ongoingMins = Math.max(1, Math.round((Date.now() - taskStart) / 60000));
          
          activeOutageMap.set(taskDev, {
            minutes: ongoingMins,
            cause: ot.title || 'Gangguan Operasional',
            severity: ot.priority === 'High' ? 'High' : 'Medium',
          });

          incidents.unshift({
            id: 8000 + (ot.id || 1),
            incidentDate: new Date().toISOString().split('T')[0],
            reportTime: new Date(taskStart).toTimeString().substring(0, 5),
            resolvedTime: 'SEDANG PADAM (LIVE)',
            durationMinutes: ongoingMins,
            affectedSystem: ot.device_name || 'Perangkat Jaringan',
            location: ot.location || 'Kampus UNTAG',
            severity: (ot.priority || 'Medium') as any,
            rootCause: ot.description || 'Gangguan Layanan Jaringan',
            actionTaken: 'Pengerjaan tiket gangguan oleh teknisi lapangan',
            handledBy: 'Teknisi Nemesys',
            status: 'In Progress',
            slaBreached: ongoingMins > 45,
            isLive: true,
          });
        }
      });
    }

    // 6. Map Per-Device Realtime SLA
    let liveOutageCount = 0;
    const devicesList: DeviceSlaItem[] = devicesRows.map((dev: any) => {
      const devNameLower = dev.name.toLowerCase();
      const devIpLower = (dev.ip_address || '').toLowerCase();

      // Find all incidents matching this device
      const devIncidents = incidents.filter(
        (i) => i.affectedSystem.toLowerCase().includes(devNameLower) || (devIpLower && i.affectedSystem.toLowerCase().includes(devIpLower))
      );

      // Check if this device is currently LIVE DOWN
      const activeOutage = activeOutageMap.get(devNameLower) || (devIpLower ? activeOutageMap.get(devIpLower) : undefined);
      const isLiveDown = Boolean(activeOutage);
      const liveDownMinutes = activeOutage ? activeOutage.minutes : 0;

      if (isLiveDown) liveOutageCount++;

      const devDowntime = devIncidents.reduce((sum, i) => sum + i.durationMinutes, 0);
      const devIncCount = devIncidents.length;
      const uptimePct = Math.max(0, Math.min(100, Math.round(((totalPeriodMinutes - devDowntime) / totalPeriodMinutes) * 10000) / 100));
      
      const targetSla = dev.is_backbone ? 99.9 : dev.name.includes('Server') || dev.name.includes('Core') ? 99.9 : 99.5;
      const isMet = uptimePct >= targetSla && !isLiveDown;
      const mttr = devIncCount > 0 ? Math.round(devDowntime / devIncCount) : 0;

      return {
        id: dev.id,
        name: dev.name,
        ip: dev.ip_address,
        type: dev.type,
        location: dev.location,
        targetSlaPercent: targetSla,
        actualUptimePercent: uptimePct,
        totalDowntimeMinutes: devDowntime,
        incidentCount: devIncCount,
        mttrMinutes: mttr,
        status: isMet ? 'MET' : 'BREACHED',
        isBackbone: Boolean(dev.is_backbone),
        isLiveDown,
        liveDownMinutes: isLiveDown ? liveDownMinutes : undefined,
      };
    });

    // Filter by Scope if requested
    let filteredDevices = devicesList;
    if (params.scope === 'backbone') {
      filteredDevices = devicesList.filter((d) => d.isBackbone || d.targetSlaPercent === 99.9);
    } else if (params.scope === 'vip') {
      filteredDevices = devicesList.filter((d) => d.name.includes('Rektorat') || d.name.includes('Server') || d.isBackbone);
    } else if (params.scope === 'aps') {
      filteredDevices = devicesList.filter((d) => d.type.toLowerCase().includes('access_point') || d.type.toLowerCase().includes('ap'));
    }

    // 7. Aggregate POP SLA
    const popMap = new Map<string, { totalNodes: number; downtime: number; incidents: number; target: number; hasLive: boolean }>();
    devicesList.forEach((d) => {
      const loc = d.location || 'Server Room Rektorat';
      const existing = popMap.get(loc) || { totalNodes: 0, downtime: 0, incidents: 0, target: 99.5, hasLive: false };
      existing.totalNodes += 1;
      existing.downtime += d.totalDowntimeMinutes;
      existing.incidents += d.incidentCount;
      if (d.isLiveDown) existing.hasLive = true;
      if (d.targetSlaPercent === 99.9) existing.target = 99.9;
      popMap.set(loc, existing);
    });

    const pops: PopSlaItem[] = Array.from(popMap.entries()).map(([popName, data]) => {
      const maxPossibleMins = totalPeriodMinutes * data.totalNodes;
      const actualPct = Math.max(0, Math.min(100, Math.round(((maxPossibleMins - data.downtime) / maxPossibleMins) * 10000) / 100));
      return {
        popName,
        nodeCount: data.totalNodes,
        targetSlaPercent: data.target,
        actualUptimePercent: actualPct,
        totalDowntimeMinutes: data.downtime,
        incidentCount: data.incidents,
        status: actualPct >= data.target && !data.hasLive ? 'MET' : 'BREACHED',
        hasLiveOutage: data.hasLive,
      };
    });

    // 8. Global KPI Calculations
    const totalDowntimeMinutes = filteredDevices.reduce((sum, d) => sum + d.totalDowntimeMinutes, 0);
    const totalIncidents = incidents.length;
    const mttrMinutes = totalIncidents > 0 ? Math.round(totalDowntimeMinutes / totalIncidents) : 0;
    const mtbfHours = totalIncidents > 0 ? Math.max(1, Math.round((totalPeriodHours - (totalDowntimeMinutes / 60)) / totalIncidents)) : totalPeriodHours;

    const totalMonitored = filteredDevices.length || 1;
    const metCount = filteredDevices.filter((d) => d.status === 'MET').length;
    const breachedCount = filteredDevices.filter((d) => d.status === 'BREACHED').length;
    const slaComplianceRatePercent = Math.round((metCount / totalMonitored) * 100);

    const overallMaxMins = totalPeriodMinutes * totalMonitored;
    const overallActualDowntime = filteredDevices.reduce((sum, d) => sum + d.totalDowntimeMinutes, 0);
    const overallUptimePercent = Math.max(0, Math.min(100, Math.round(((overallMaxMins - overallActualDowntime) / overallMaxMins) * 10000) / 100));

    // 9. Root Cause Aggregation
    const causeMap = new Map<string, { count: number; downtime: number }>();
    incidents.forEach((i) => {
      const c = i.rootCause || 'Lainnya';
      const existing = causeMap.get(c) || { count: 0, downtime: 0 };
      existing.count += 1;
      existing.downtime += i.durationMinutes;
      causeMap.set(c, existing);
    });

    const rootCauses = Array.from(causeMap.entries()).map(([cause, data]) => ({
      cause,
      count: data.count,
      downtimeMinutes: data.downtime,
    })).sort((a, b) => b.count - a.count);

    // 10. Daily Trend
    const dailyTrends: Array<{ date: string; uptimePercent: number; incidentCount: number }> = [];
    for (let day = 1; day <= Math.min(30, totalDays); day++) {
      const dStr = `2026-08-${String(day).padStart(2, '0')}`;
      const dayIncs = incidents.filter((i) => i.incidentDate === dStr || i.incidentDate.endsWith(`-${String(day).padStart(2, '0')}`));
      const dayDown = dayIncs.reduce((sum, i) => sum + i.durationMinutes, 0);
      const dayPct = dayDown === 0 ? 100 : Math.max(92, Math.round(((1440 - dayDown) / 1440) * 10000) / 100);
      dailyTrends.push({
        date: `Tgl ${day}`,
        uptimePercent: dayPct,
        incidentCount: dayIncs.length,
      });
    }

    return {
      periodLabel,
      startDate: startDateStr,
      endDate: endDateStr,
      totalPeriodHours,
      totalPeriodMinutes,
      zabbixLiveConnected: isZabbixLive,
      liveOutageCount,
      overallUptimePercent,
      totalDowntimeMinutes,
      totalIncidents,
      mttrMinutes,
      mtbfHours,
      slaComplianceRatePercent,
      nodesMetCount: metCount,
      nodesBreachedCount: breachedCount,
      totalNodesMonitored: totalMonitored,
      devices: filteredDevices,
      pops,
      incidents,
      rootCauses,
      dailyTrends,
    };
  }

  /**
   * Seed realistic sample operational incidents if database is empty
   */
  private static async seedDefaultIncidents() {
    try {
      await pool.query(`
        INSERT INTO operational_incidents 
        (incident_date, report_time, resolved_time, affected_system, severity, description, impact, root_cause, action_taken, handled_by, status, sla_limit_minutes, sla_breached)
        VALUES
        ('2026-08-04', '10:15', '10:45', 'AP-Asrama-Putra-Lt3', 'Medium', 'AP mengalami loss packet tinggi akibat interferensi channel & overload klien', 'Koneksi asrama lantai 3 lambat', 'Interferensi Channel 2.4GHz & Overload', 'Pindah channel ke DFS 5GHz dan load balancing SSID', 'Rizal Kurniawan', 'Resolved', 60, 0),
        ('2026-08-11', '14:20', '14:55', 'SW-LAB-KOMP-LT2', 'High', 'Port Trunk Uplink SFP+ mengalami link flapping', 'Lab Multimedia sempat terputus 35 menit', 'Patch cord FO tertekuk di rack server', 'Cleaning core konektor FO & re-patching kabel jumper', 'Dian Prasetyo', 'Resolved', 45, 0),
        ('2026-08-18', '08:05', '08:25', 'AP-Kantin-Kampus', 'Low', 'Adaptor PoE mati akibat lonjakan arus listrik lokal', 'WiFi area food court kantin padam', 'Power surge trafo lokal', 'Penggantian adaptor PoE Gigabit 48V cadangan', 'Dika Admin', 'Resolved', 60, 0),
        ('2026-08-24', '13:00', '13:40', 'Backbone FO Rektorat - Lab', 'Critical', 'Kabel FO Dropcore terkena pengerjaan taman kampus', 'Koneksi Gedung Lab Komputer B beralih ke jalur backup', 'Kabel FO Cut / Putus Fisik', 'Splicing core fiber optic 6 core dengan Fusion Splicer', 'Rizal Kurniawan', 'Resolved', 60, 0)
      `);
      console.log('Seeded default realistic SLA operational incidents.');
    } catch (e) {
      console.error('Failed to seed incidents:', e);
    }
  }

  /**
   * Generate Native SpreadsheetML Excel XML (.xls / .xlsx compatible)
   */
  static generateExcelXml(report: SlaSummaryReport): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="HeaderTitle">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="16" ss:Bold="1" ss:Color="#1E3A8A"/>
  </Style>
  <Style ss:ID="SubTitle">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Italic="1" ss:Color="#4B5563"/>
  </Style>
  <Style ss:ID="TableHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiCardLabel">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#64748B"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="KpiCardVal">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#0284C7"/>
   <Interior ss:Color="#F0F9FF" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="CellMet">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Bold="1" ss:Color="#047857"/>
   <Interior ss:Color="#D1FAE5" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="CellBreached">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Bold="1" ss:Color="#B91C1C"/>
   <Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="DataCell">
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E293B"/>
  </Style>
  <Style ss:ID="DataCellCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E293B"/>
  </Style>
 </Styles>

 <!-- SHEET 1: RINGKASAN EKSEKUTIF SLA -->
 <Worksheet ss:Name="Ringkasan Eksekutif SLA">
  <Table ss:ExpandedColumnCount="7" x:FullColumns="1" x:FullRows="1" ss:DefaultRowHeight="18">
   <Column ss:Width="160"/>
   <Column ss:Width="140"/>
   <Column ss:Width="120"/>
   <Column ss:Width="120"/>
   <Column ss:Width="120"/>
   <Column ss:Width="120"/>
   <Column ss:Width="140"/>

   <Row ss:Height="24">
    <Cell ss:MergeAcross="6" ss:StyleID="HeaderTitle"><Data ss:Type="String">LAPORAN KINERJA KETERSEDIAAN JARINGAN &amp; SLA RESMI</Data></Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:MergeAcross="6" ss:StyleID="SubTitle"><Data ss:Type="String">Universitas 17 Agustus 1945 Banyuwangi • Direktorat IT NEMESYS • Periode: ${report.periodLabel}</Data></Cell>
   </Row>
   <Row ss:Height="10"/>

   <!-- KPI Cards -->
   <Row ss:Height="20">
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">OVERALL UPTIME SLA</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">MTTR (RATA-RATA PULIH)</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">MTBF (JARAK GANGGUAN)</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">TOTAL DOWNTIME</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">TOTAL INSIDEN</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">SLA COMPLIANCE</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">NODE STATUS</Data></Cell>
   </Row>
   <Row ss:Height="28">
    <Cell ss:StyleID="KpiCardVal"><Data ss:Type="String">${report.overallUptimePercent}%</Data></Cell>
    <Cell ss:StyleID="KpiCardVal"><Data ss:Type="String">${report.mttrMinutes} Menit</Data></Cell>
    <Cell ss:StyleID="KpiCardVal"><Data ss:Type="String">${report.mtbfHours} Jam</Data></Cell>
    <Cell ss:StyleID="KpiCardVal"><Data ss:Type="String">${report.totalDowntimeMinutes} Menit</Data></Cell>
    <Cell ss:StyleID="KpiCardVal"><Data ss:Type="String">${report.totalIncidents} Insiden</Data></Cell>
    <Cell ss:StyleID="KpiCardVal"><Data ss:Type="String">${report.slaComplianceRatePercent}%</Data></Cell>
    <Cell ss:StyleID="KpiCardVal"><Data ss:Type="String">${report.nodesMetCount} Met / ${report.nodesBreachedCount} Breached</Data></Cell>
   </Row>

   <Row ss:Height="18"/>

   <!-- Table Breakdown POP -->
   <Row ss:Height="20">
    <Cell ss:MergeAcross="6" ss:StyleID="HeaderTitle"><Data ss:Type="String">Rekapitulasi Ketersediaan Per POP / Gedung Kampus</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Nama POP / Gedung</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Jumlah Perangkat</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Target SLA</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Uptime Aktual</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Total Downtime</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Jumlah Insiden</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Status SLA</Data></Cell>
   </Row>
   ${report.pops.map(p => `
   <Row ss:Height="20">
    <Cell ss:StyleID="DataCell"><Data ss:Type="String">${p.popName}</Data></Cell>
    <Cell ss:StyleID="DataCellCenter"><Data ss:Type="Number">${p.nodeCount}</Data></Cell>
    <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${p.targetSlaPercent}%</Data></Cell>
    <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${p.actualUptimePercent}%</Data></Cell>
    <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${p.totalDowntimeMinutes} Mins</Data></Cell>
    <Cell ss:StyleID="DataCellCenter"><Data ss:Type="Number">${p.incidentCount}</Data></Cell>
    <Cell ss:StyleID="${p.status === 'MET' ? 'CellMet' : 'CellBreached'}"><Data ss:Type="String">${p.status}</Data></Cell>
   </Row>`).join('')}
  </Table>
 </Worksheet>

 <!-- SHEET 2: KETERSEDIAAN PER PERANGKAT -->
 <Worksheet ss:Name="Availability Per Perangkat">
  <Table ss:ExpandedColumnCount="9" x:FullColumns="1" x:FullRows="1" ss:DefaultRowHeight="18">
   <Column ss:Width="160"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="150"/>
   <Column ss:Width="90"/>
   <Column ss:Width="100"/>
   <Column ss:Width="110"/>
   <Column ss:Width="90"/>
   <Column ss:Width="90"/>

   <Row ss:Height="20">
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Nama Perangkat</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">IP Address</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Tipe Node</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Lokasi / POP</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Target SLA</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Uptime Aktual</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Total Downtime</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">MTTR</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Status</Data></Cell>
   </Row>
   ${report.devices.map(d => `
   <Row ss:Height="18">
    <Cell ss:StyleID="DataCell"><Data ss:Type="String">${d.name}</Data></Cell>
    <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${d.ip}</Data></Cell>
    <Cell ss:StyleID="DataCell"><Data ss:Type="String">${d.type}</Data></Cell>
    <Cell ss:StyleID="DataCell"><Data ss:Type="String">${d.location}</Data></Cell>
    <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${d.targetSlaPercent}%</Data></Cell>
    <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${d.actualUptimePercent}%</Data></Cell>
    <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${d.totalDowntimeMinutes} Mins</Data></Cell>
    <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${d.mttrMinutes} Mins</Data></Cell>
    <Cell ss:StyleID="${d.status === 'MET' ? 'CellMet' : 'CellBreached'}"><Data ss:Type="String">${d.status}</Data></Cell>
   </Row>`).join('')}
  </Table>
 </Worksheet>

 <!-- SHEET 3: LOG RIWAYAT INSIDEN -->
 <Worksheet ss:Name="Log Riwayat Gangguan">
  <Table ss:ExpandedColumnCount="9" x:FullColumns="1" x:FullRows="1" ss:DefaultRowHeight="18">
   <Column ss:Width="50"/>
   <Column ss:Width="90"/>
   <Column ss:Width="90"/>
   <Column ss:Width="100"/>
   <Column ss:Width="160"/>
   <Column ss:Width="140"/>
   <Column ss:Width="200"/>
   <Column ss:Width="120"/>
   <Column ss:Width="90"/>

   <Row ss:Height="20">
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">ID</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Tanggal</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Waktu</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Durasi Downtime</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Perangkat Terdampak</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Penyebab (Root Cause)</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Tindakan Perbaikan</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">Petugas / Teknisi</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">SLA Status</Data></Cell>
   </Row>
   ${report.incidents.map(inc => `
   <Row ss:Height="18">
    <Cell ss:StyleID="DataCellCenter"><Data ss:Type="Number">${inc.id}</Data></Cell>
    <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${inc.incidentDate}</Data></Cell>
    <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${inc.reportTime} - ${inc.resolvedTime}</Data></Cell>
    <Cell ss:StyleID="DataCellCenter"><Data ss:Type="String">${inc.durationMinutes} Menit</Data></Cell>
    <Cell ss:StyleID="DataCell"><Data ss:Type="String">${inc.affectedSystem}</Data></Cell>
    <Cell ss:StyleID="DataCell"><Data ss:Type="String">${inc.rootCause}</Data></Cell>
    <Cell ss:StyleID="DataCell"><Data ss:Type="String">${inc.actionTaken}</Data></Cell>
    <Cell ss:StyleID="DataCell"><Data ss:Type="String">${inc.handledBy}</Data></Cell>
    <Cell ss:StyleID="${!inc.slaBreached ? 'CellMet' : 'CellBreached'}"><Data ss:Type="String">${!inc.slaBreached ? 'SLA OK' : 'BREACHED'}</Data></Cell>
   </Row>`).join('')}
  </Table>
 </Worksheet>
</Workbook>`;
  }
}
