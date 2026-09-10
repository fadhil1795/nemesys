import { pool } from '../db';

export interface CampusBuildingDto {
  id: string;
  name: string;
  code: string;
  category: 'datacenter' | 'faculty' | 'lab' | 'library' | 'dormitory' | 'canteen';
  status: 'healthy' | 'warning' | 'critical';
  x: number;
  y: number;
  floorsCount: number;
  totalClients: number;
  trafficInMbps: number;
  trafficOutMbps: number;
  pingMs: number;
  uplinkSpeed: string;
  uplinkType: '10G Fiber' | '1G SFP' | '1G UTP';
  description: string;
  switchesCount: number;
  apsCount: number;
  floors: Array<{
    floorId: number;
    floorNumber: number;
    floorName: string;
    switchName: string;
    switchIp?: string;
    switchStatus: 'healthy' | 'warning' | 'down';
    activePorts: number;
    totalPorts: number;
    accessPoints: Array<{
      apId: number;
      name: string;
      ip: string;
      channel: string;
      band: string;
      clients: number;
      status: 'healthy' | 'warning' | 'down';
    }>;
  }>;
}

export interface CampusFiberLinkDto {
  id: number;
  fromBuildingId: string;
  toBuildingId: string;
  speed: string;
  status: 'healthy' | 'warning' | 'down';
}

export class NocCampusService {
  /**
   * Get all campus buildings with full floors and access points
   */
  static async getCampusBuildings(): Promise<CampusBuildingDto[]> {
    const [bldgRows]: any = await pool.query('SELECT * FROM campus_buildings ORDER BY name ASC');
    const [floorRows]: any = await pool.query('SELECT * FROM campus_building_floors ORDER BY building_id, floor_number ASC');
    const [apRows]: any = await pool.query('SELECT * FROM campus_floor_aps ORDER BY floor_id, name ASC');

    const buildings: CampusBuildingDto[] = bldgRows.map((b: any) => {
      const bFloors = floorRows
        .filter((f: any) => f.building_id === b.id)
        .map((f: any) => {
          const fAps = apRows
            .filter((a: any) => a.floor_id === f.id)
            .map((a: any) => ({
              apId: a.id,
              name: a.name,
              ip: a.ip,
              channel: a.channel || 'Ch 36 (5GHz)',
              band: a.band || 'Wi-Fi 6 AX',
              clients: Number(a.clients_count) || 0,
              status: (a.status as any) || 'healthy',
            }));

          return {
            floorId: f.id,
            floorNumber: Number(f.floor_number),
            floorName: f.floor_name,
            switchName: f.switch_name,
            switchIp: f.switch_ip,
            switchStatus: (f.switch_status as any) || 'healthy',
            activePorts: Number(f.active_ports),
            totalPorts: Number(f.total_ports),
            accessPoints: fAps,
          };
        });

      // Calculate total clients dynamically from APs
      const calculatedClients = bFloors.reduce(
        (acc: number, fl: any) => acc + fl.accessPoints.reduce((a2: number, ap: any) => a2 + ap.clients, 0),
        0
      );

      const totalAps = bFloors.reduce((acc: number, fl: any) => acc + fl.accessPoints.length, 0);

      return {
        id: b.id,
        name: b.name,
        code: b.code,
        category: b.category as any,
        status: b.status as any,
        x: Number(b.x),
        y: Number(b.y),
        floorsCount: bFloors.length || Number(b.floors_count) || 1,
        totalClients: calculatedClients > 0 ? calculatedClients : Number(b.total_clients) || 0,
        trafficInMbps: Number(b.traffic_in_mbps) || 0,
        trafficOutMbps: Number(b.traffic_out_mbps) || 0,
        pingMs: Number(b.ping_ms) || 1.0,
        uplinkSpeed: b.uplink_speed || '10G SFP+ Trunk',
        uplinkType: (b.uplink_type as any) || '10G Fiber',
        description: b.description || '',
        switchesCount: bFloors.length,
        apsCount: totalAps,
        floors: bFloors,
      };
    });

    return buildings;
  }

  /**
   * Create new building
   */
  static async createBuilding(data: {
    id?: string;
    name: string;
    code: string;
    category?: string;
    x?: number;
    y?: number;
    uplinkSpeed?: string;
    uplinkType?: string;
    description?: string;
  }): Promise<string> {
    const id = data.id || `bldg-${Date.now().toString(36)}`;
    await pool.query(
      `INSERT INTO campus_buildings 
       (id, name, code, category, x, y, uplink_speed, uplink_type, description, floors_count, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'healthy')`,
      [
        id,
        data.name,
        data.code || id.toUpperCase(),
        data.category || 'faculty',
        data.x !== undefined ? data.x : 50,
        data.y !== undefined ? data.y : 50,
        data.uplinkSpeed || '10G SFP+ Trunk',
        data.uplinkType || '10G Fiber',
        data.description || '',
        1,
      ]
    );

    // Create default Floor 1
    const [res]: any = await pool.query(
      `INSERT INTO campus_building_floors 
       (building_id, floor_number, floor_name, switch_name, switch_status, active_ports, total_ports) 
       VALUES (?, 1, 'Lantai 1 - Distribusi Utama', ?, 'healthy', 16, 24)`,
      [id, `SW-${data.code || id}-LT1`]
    );

    const floorId = res.insertId;

    // Create default AP
    await pool.query(
      `INSERT INTO campus_floor_aps 
       (floor_id, building_id, name, ip, channel, band, clients_count, status) 
       VALUES (?, ?, ?, '192.168.50.100', 'Ch 36 (5GHz)', 'Wi-Fi 6', 15, 'healthy')`,
      [floorId, id, `AP-${data.code || id}-01`]
    );

    return id;
  }

  /**
   * Update building details
   */
  static async updateBuilding(
    id: string,
    data: {
      name?: string;
      code?: string;
      category?: string;
      status?: string;
      x?: number;
      y?: number;
      uplinkSpeed?: string;
      uplinkType?: string;
      description?: string;
      trafficInMbps?: number;
      trafficOutMbps?: number;
      pingMs?: number;
    }
  ): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.code !== undefined) { fields.push('code = ?'); values.push(data.code); }
    if (data.category !== undefined) { fields.push('category = ?'); values.push(data.category); }
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    if (data.x !== undefined) { fields.push('x = ?'); values.push(data.x); }
    if (data.y !== undefined) { fields.push('y = ?'); values.push(data.y); }
    if (data.uplinkSpeed !== undefined) { fields.push('uplink_speed = ?'); values.push(data.uplinkSpeed); }
    if (data.uplinkType !== undefined) { fields.push('uplink_type = ?'); values.push(data.uplinkType); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
    if (data.trafficInMbps !== undefined) { fields.push('traffic_in_mbps = ?'); values.push(data.trafficInMbps); }
    if (data.trafficOutMbps !== undefined) { fields.push('traffic_out_mbps = ?'); values.push(data.trafficOutMbps); }
    if (data.pingMs !== undefined) { fields.push('ping_ms = ?'); values.push(data.pingMs); }

    if (fields.length === 0) return true;

    values.push(id);
    await pool.query(`UPDATE campus_buildings SET ${fields.join(', ')} WHERE id = ?`, values);
    return true;
  }

  /**
   * Batch update multiple building layout coordinates (x, y)
   */
  static async updateBuildingPositions(positions: Array<{ id: string; x: number; y: number }>): Promise<boolean> {
    for (const pos of positions) {
      if (pos.id && pos.x !== undefined && pos.y !== undefined) {
        await pool.query('UPDATE campus_buildings SET x = ?, y = ? WHERE id = ?', [
          Math.max(5, Math.min(95, pos.x)),
          Math.max(5, Math.min(95, pos.y)),
          pos.id
        ]);
      }
    }
    return true;
  }

  /**
   * Delete building and cascade
   */
  static async deleteBuilding(id: string): Promise<boolean> {
    await pool.query('DELETE FROM campus_fiber_links WHERE from_building_id = ? OR to_building_id = ?', [id, id]);
    await pool.query('DELETE FROM campus_floor_aps WHERE building_id = ?', [id]);
    await pool.query('DELETE FROM campus_building_floors WHERE building_id = ?', [id]);
    await pool.query('DELETE FROM campus_buildings WHERE id = ?', [id]);
    return true;
  }

  /**
   * Add floor to building
   */
  static async addFloor(
    buildingId: string,
    data: {
      floorNumber: number;
      floorName: string;
      switchName?: string;
      switchIp?: string;
      activePorts?: number;
      totalPorts?: number;
    }
  ): Promise<number> {
    const [res]: any = await pool.query(
      `INSERT INTO campus_building_floors 
       (building_id, floor_number, floor_name, switch_name, switch_ip, active_ports, total_ports, switch_status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 'healthy')`,
      [
        buildingId,
        data.floorNumber,
        data.floorName,
        data.switchName || `SW-DISTRIB-LT${data.floorNumber}`,
        data.switchIp || null,
        data.activePorts || 16,
        data.totalPorts || 24,
      ]
    );

    // Update floors_count in building
    const [countRows]: any = await pool.query('SELECT COUNT(*) as count FROM campus_building_floors WHERE building_id = ?', [buildingId]);
    await pool.query('UPDATE campus_buildings SET floors_count = ? WHERE id = ?', [countRows[0].count, buildingId]);

    return res.insertId;
  }

  /**
   * Update floor
   */
  static async updateFloor(
    floorId: number,
    data: {
      floorNumber?: number;
      floorName?: string;
      switchName?: string;
      switchIp?: string;
      switchStatus?: string;
      activePorts?: number;
      totalPorts?: number;
    }
  ): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.floorNumber !== undefined) { fields.push('floor_number = ?'); values.push(data.floorNumber); }
    if (data.floorName !== undefined) { fields.push('floor_name = ?'); values.push(data.floorName); }
    if (data.switchName !== undefined) { fields.push('switch_name = ?'); values.push(data.switchName); }
    if (data.switchIp !== undefined) { fields.push('switch_ip = ?'); values.push(data.switchIp); }
    if (data.switchStatus !== undefined) { fields.push('switch_status = ?'); values.push(data.switchStatus); }
    if (data.activePorts !== undefined) { fields.push('active_ports = ?'); values.push(data.activePorts); }
    if (data.totalPorts !== undefined) { fields.push('total_ports = ?'); values.push(data.totalPorts); }

    if (fields.length === 0) return true;

    values.push(floorId);
    await pool.query(`UPDATE campus_building_floors SET ${fields.join(', ')} WHERE id = ?`, values);
    return true;
  }

  /**
   * Delete floor
   */
  static async deleteFloor(floorId: number): Promise<boolean> {
    const [floor]: any = await pool.query('SELECT building_id FROM campus_building_floors WHERE id = ?', [floorId]);
    if (floor.length > 0) {
      const buildingId = floor[0].building_id;
      await pool.query('DELETE FROM campus_floor_aps WHERE floor_id = ?', [floorId]);
      await pool.query('DELETE FROM campus_building_floors WHERE id = ?', [floorId]);
      const [countRows]: any = await pool.query('SELECT COUNT(*) as count FROM campus_building_floors WHERE building_id = ?', [buildingId]);
      await pool.query('UPDATE campus_buildings SET floors_count = ? WHERE id = ?', [countRows[0].count, buildingId]);
    }
    return true;
  }

  /**
   * Add Access Point
   */
  static async addAccessPoint(
    floorId: number,
    buildingId: string,
    data: {
      name: string;
      ip: string;
      channel?: string;
      band?: string;
      clientsCount?: number;
      status?: string;
    }
  ): Promise<number> {
    const [res]: any = await pool.query(
      `INSERT INTO campus_floor_aps 
       (floor_id, building_id, name, ip, channel, band, clients_count, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        floorId,
        buildingId,
        data.name,
        data.ip,
        data.channel || 'Ch 36 (5GHz)',
        data.band || 'Wi-Fi 6 AX',
        data.clientsCount || 10,
        data.status || 'healthy',
      ]
    );
    return res.insertId;
  }

  /**
   * Delete Access Point
   */
  static async deleteAccessPoint(apId: number): Promise<boolean> {
    await pool.query('DELETE FROM campus_floor_aps WHERE id = ?', [apId]);
    return true;
  }

  /**
   * Get all inter-building fiber links
   */
  static async getFiberLinks(): Promise<CampusFiberLinkDto[]> {
    const [rows]: any = await pool.query('SELECT * FROM campus_fiber_links ORDER BY id ASC');
    return rows.map((r: any) => ({
      id: r.id,
      fromBuildingId: r.from_building_id,
      toBuildingId: r.to_building_id,
      speed: r.speed || '10G FO',
      status: r.status || 'healthy',
    }));
  }

  /**
   * Save / Create fiber link
   */
  static async saveFiberLink(
    fromBuildingId: string,
    toBuildingId: string,
    speed: string = '10G FO',
    status: string = 'healthy'
  ): Promise<number> {
    const [res]: any = await pool.query(
      `INSERT INTO campus_fiber_links (from_building_id, to_building_id, speed, status) VALUES (?, ?, ?, ?)`,
      [fromBuildingId, toBuildingId, speed, status]
    );
    return res.insertId;
  }

  /**
   * Delete fiber link
   */
  static async deleteFiberLink(id: number): Promise<boolean> {
    await pool.query('DELETE FROM campus_fiber_links WHERE id = ?', [id]);
    return true;
  }
}
