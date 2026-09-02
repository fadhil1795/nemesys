import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Create the pool
export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'nemesys',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Helper to check connection and run auto migration
export async function initializeDatabase() {
  try {
    // 1. Establish connection to server to make sure database exists (or create it)
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
    });
    
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'nemesys'}\``);
    await connection.end();

    console.log('Database verification successful.');

    // 2. Initialize tables using the pool
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL DEFAULT 'password',
        name VARCHAR(150) NOT NULL,
        role ENUM('Administrator', 'Manager', 'Teknisi') NOT NULL,
        telegram_chat_id VARCHAR(100) NULL,
        status ENUM('Available', 'Busy') NOT NULL DEFAULT 'Available',
        daily_tasks_count INT NOT NULL DEFAULT 0,
        mission_completed INT NOT NULL DEFAULT 0,
        mission_incompleted INT NOT NULL DEFAULT 0
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS device_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        svg_icon LONGTEXT NULL
      ) ENGINE=InnoDB;
    `);

    // Migration: Modify type column to VARCHAR to allow custom categories
    try {
      await pool.query('ALTER TABLE devices MODIFY COLUMN type VARCHAR(100) NOT NULL');
      console.log('Migration: devices.type altered to VARCHAR(100).');
    } catch (e) {
      // ignore
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        type VARCHAR(100) NOT NULL,
        ip_address VARCHAR(45) NOT NULL,
        location VARCHAR(255) NOT NULL,
        latitude DOUBLE NOT NULL,
        longitude DOUBLE NOT NULL,
        status ENUM('Up', 'Down') NOT NULL DEFAULT 'Up',
        last_ping VARCHAR(100) NOT NULL,
        is_backbone BOOLEAN NOT NULL DEFAULT FALSE,
        battery_percentage INT NULL,
        voltage DOUBLE NULL,
        solar_status ENUM('Charging', 'Discharging', 'Full') NULL
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id BIGINT PRIMARY KEY,
        device_id INT NOT NULL,
        device_name VARCHAR(150) NOT NULL,
        ip_address VARCHAR(45) NOT NULL,
        location VARCHAR(255) NOT NULL,
        assigned_user_id INT NULL,
        assigned_user_name VARCHAR(150) NULL,
        status ENUM('Open', 'Approved', 'Rejected', 'In Progress', 'Completed') NOT NULL DEFAULT 'Open',
        severity ENUM('Warning', 'Alert', 'Emergency') NOT NULL DEFAULT 'Alert',
        started_at VARCHAR(100) NOT NULL,
        completed_at VARCHAR(100) NULL,
        sla_minutes INT NOT NULL DEFAULT 30
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS missions (
        id BIGINT PRIMARY KEY,
        task_id BIGINT NOT NULL,
        user_id INT NOT NULL,
        user_name VARCHAR(150) NOT NULL,
        task_device_name VARCHAR(150) NOT NULL,
        status ENUM('Completed', 'Incompleted') NOT NULL,
        completed_at VARCHAR(100) NOT NULL
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS temp_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        temperature DOUBLE NOT NULL,
        recorded_at VARCHAR(50) NOT NULL
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS daily_todos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        task_name VARCHAR(255) NOT NULL,
        is_completed BOOLEAN NOT NULL DEFAULT FALSE
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS custom_missions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NULL,
        slots INT NOT NULL DEFAULT 1,
        progress_percent INT NOT NULL DEFAULT 0,
        created_at VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'Active'
      ) ENGINE=InnoDB;
    `);

    // Add extra mission columns
    try {
      await pool.query("ALTER TABLE custom_missions ADD COLUMN created_by VARCHAR(150) NULL");
    } catch (e) {}
    try {
      await pool.query("ALTER TABLE custom_missions ADD COLUMN date_finished VARCHAR(100) NULL");
    } catch (e) {}
    try {
      await pool.query("ALTER TABLE custom_missions ADD COLUMN duration_str VARCHAR(100) NULL");
    } catch (e) {}
    try {
      await pool.query("ALTER TABLE custom_missions ADD COLUMN note TEXT NULL");
    } catch (e) {}
    try {
      await pool.query("ALTER TABLE custom_missions ADD COLUMN mission_image VARCHAR(255) NULL");
      console.log('Migration: Verified extra custom_missions columns.');
    } catch (e) {}

    await pool.query(`
      CREATE TABLE IF NOT EXISTS mission_participants (
        mission_id INT NOT NULL,
        user_id INT NOT NULL,
        PRIMARY KEY (mission_id, user_id)
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_tickets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ticket_number VARCHAR(50) NOT NULL UNIQUE,
        reporter_name VARCHAR(150) NOT NULL,
        reporter_id VARCHAR(50) NOT NULL,
        reporter_type VARCHAR(100) NOT NULL,
        reporter_unit VARCHAR(150) NOT NULL,
        email VARCHAR(150) NOT NULL,
        whatsapp VARCHAR(50) NOT NULL,
        category VARCHAR(150) NOT NULL,
        description TEXT NOT NULL,
        status ENUM('Open', 'In Progress', 'Completed', 'Rejected') NOT NULL DEFAULT 'Open',
        assigned_user_id INT NULL,
        assigned_user_name VARCHAR(150) NULL,
        resolution_notes TEXT NULL,
        created_at VARCHAR(100) NOT NULL,
        updated_at VARCHAR(100) NULL
      ) ENGINE=InnoDB;
    `);

    // Migration: Add password column to users if it doesn't exist
    try {
      await pool.query("ALTER TABLE users ADD COLUMN password VARCHAR(255) NOT NULL DEFAULT 'password'");
      console.log('Migration: Added password column to users table.');
    } catch (e) {
      // Column probably already exists
    }

    // Migration: Add new device columns if they don't exist
    try {
      await pool.query("ALTER TABLE devices ADD COLUMN description TEXT NULL");
    } catch (e) {}
    try {
      await pool.query("ALTER TABLE devices ADD COLUMN category VARCHAR(100) NULL");
    } catch (e) {}
    try {
      await pool.query("ALTER TABLE devices ADD COLUMN web_config_url VARCHAR(255) NULL");
    } catch (e) {}
    try {
      await pool.query("ALTER TABLE devices ADD COLUMN device_image VARCHAR(255) NULL");
    } catch (e) {}
    try {
      await pool.query("ALTER TABLE tasks ADD COLUMN resolution_notes TEXT NULL");
    } catch (e) {}
    try {
      await pool.query("ALTER TABLE tasks ADD COLUMN steps TEXT NULL");
    } catch (e) {}
    try {
      await pool.query("ALTER TABLE missions ADD COLUMN resolution_notes TEXT NULL");
      console.log('Migration: Added resolution_notes and steps to tasks and missions tables.');
    } catch (e) {}
    try {
      await pool.query("ALTER TABLE devices ADD COLUMN parent_id INT NULL");
      console.log('Migration: Verified extra device columns (description, category, web_config_url, device_image, parent_id).');
    } catch (e) {}

    // Create open_tickets table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS open_tickets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ticket_number VARCHAR(50) NOT NULL UNIQUE,
        full_name VARCHAR(150) NOT NULL,
        id_number VARCHAR(50) NOT NULL,
        category VARCHAR(100) NOT NULL,
        unit_specification VARCHAR(255) NOT NULL,
        email VARCHAR(100) NOT NULL,
        whatsapp_number VARCHAR(20) NOT NULL,
        service_type VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        status ENUM('Open', 'In Progress', 'Resolved', 'Closed') NOT NULL DEFAULT 'Open',
        assigned_user_id INT NULL,
        assigned_user_name VARCHAR(150) NULL,
        created_at VARCHAR(100) NOT NULL,
        updated_at VARCHAR(100) NOT NULL,
        resolution_notes TEXT NULL,
        image_url LONGTEXT NULL
      ) ENGINE=InnoDB;
    `);

    try {
      await pool.query("ALTER TABLE open_tickets MODIFY COLUMN category VARCHAR(100) NOT NULL");
      console.log("Migration: open_tickets.category altered to VARCHAR(100)");
    } catch (e) {}

    try {
      await pool.query("ALTER TABLE open_tickets ADD COLUMN image_url LONGTEXT NULL");
      console.log("Migration: open_tickets.image_url added as LONGTEXT");
    } catch (e) {}

    // Migration: Expand tasks status ENUM for Manager approve/reject workflow
    try {
      await pool.query("ALTER TABLE tasks MODIFY COLUMN status ENUM('Open', 'Approved', 'Rejected', 'In Progress', 'Completed') NOT NULL DEFAULT 'Open'");
      console.log('Migration: Expanded tasks.status ENUM with Approved/Rejected.');
    } catch (e) {}

    // Force update default users to have the correct password
    try {
      await pool.query("UPDATE users SET password = 'password' WHERE username IN ('rizal_tech', 'dian_tech')");
      await pool.query("UPDATE users SET password = 'admin123' WHERE username = 'admin_dika'");
      console.log('Migration: Default user passwords synchronized.');
    } catch (e) {
      // ignore
    }

    // Seed initial device categories if empty
    const [categoryRows]: any = await pool.query('SELECT COUNT(*) as count FROM device_categories');
    if (categoryRows[0].count === 0) {
      const defaultRouterSvg = `<svg width="34" height="34" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0px 3px 5px var(--shadow-color)); overflow: visible;">
  <defs>
    <linearGradient id="topGrad-router" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="var(--top-color-1)" />
      <stop offset="100%" stop-color="var(--top-color-2)" />
    </linearGradient>
    <linearGradient id="bodyGrad-router" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="var(--body-color-1)" />
      <stop offset="100%" stop-color="var(--body-color-2)" />
    </linearGradient>
  </defs>
  <ellipse cx="20" cy="26" rx="15" ry="6" fill="rgba(0,0,0,0.18)" />
  <path d="M 5,18 A 15,6 0 0,0 35,18 L 35,24 A 15,6 0 0,1 5,24 Z" fill="url(#bodyGrad-router)" />
  <ellipse cx="20" cy="18" rx="15" ry="6" fill="url(#topGrad-router)" stroke="#fff" stroke-width="0.8" />
  <path d="M 12,18 L 28,18 M 20,14 L 20,22" stroke="#fff" stroke-width="2" stroke-linecap="round" />
  <path d="M 15,16 L 12,18 L 15,20 M 25,16 L 28,18 L 25,20 M 18,16 L 20,14 L 22,16 M 18,20 L 20,22 L 22,20" fill="none" stroke="#fff" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
</svg>`;

      const defaultSwitchSvg = `<svg width="34" height="34" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0px 3px 5px var(--shadow-color)); overflow: visible;">
  <defs>
    <linearGradient id="topGrad-switch" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="var(--top-color-1)" />
      <stop offset="100%" stop-color="var(--top-color-2)" />
    </linearGradient>
    <linearGradient id="bodyGrad-switch" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="var(--body-color-1)" />
      <stop offset="100%" stop-color="var(--body-color-2)" />
    </linearGradient>
    <linearGradient id="leftGrad-switch" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="var(--left-color-1)" />
      <stop offset="100%" stop-color="var(--left-color-2)" />
    </linearGradient>
  </defs>
  <polygon points="5,22 20,28 35,22 20,16" fill="rgba(0,0,0,0.18)" />
  <polygon points="5,16 20,10 35,16 20,22" fill="url(#topGrad-switch)" stroke="#fff" stroke-width="0.8" />
  <polygon points="5,16 20,22 20,27 5,21" fill="url(#leftGrad-switch)" />
  <polygon points="20,22 35,16 35,21 20,27" fill="url(#bodyGrad-switch)" />
  <line x1="8" y1="19" x2="17" y2="22.5" stroke="rgba(255,255,255,0.75)" stroke-width="1.5" stroke-dasharray="1.5,1.5" />
  <line x1="23" y1="22.5" x2="32" y2="19" stroke="rgba(255,255,255,0.75)" stroke-width="1.5" stroke-dasharray="1.5,1.5" />
  <path d="M 12,14 C 12,14 20,19 28,14 M 28,18 C 28,18 20,13 12,18" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" />
  <path d="M 25,13 L 28,14 L 26,11 M 15,19 L 12,18 L 14,21" fill="none" stroke="#fff" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
</svg>`;

      const defaultAccessPointSvg = `<svg width="34" height="34" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0px 3px 5px var(--shadow-color)); overflow: visible;">
  <defs>
    <linearGradient id="topGrad-ap" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="var(--top-color-1)" />
      <stop offset="100%" stop-color="var(--top-color-2)" />
    </linearGradient>
    <linearGradient id="bodyGrad-ap" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="var(--body-color-1)" />
      <stop offset="100%" stop-color="var(--body-color-2)" />
    </linearGradient>
  </defs>
  <ellipse cx="20" cy="28" rx="13" ry="5" fill="rgba(0,0,0,0.18)" />
  <path d="M 8,22 A 12,5 0 0,0 32,22 L 32,25 A 12,5 0 0,1 8,25 Z" fill="url(#bodyGrad-ap)" />
  <ellipse cx="20" cy="22" rx="12" ry="5" fill="url(#topGrad-ap)" stroke="#fff" stroke-width="0.8" />
  <path d="M 20,22 L 20,10" stroke="#fff" stroke-width="2" stroke-linecap="round" />
  <circle cx="20" cy="9" r="1.5" fill="#fff" />
  <path d="M 14,9 A 8,8 0 0,1 26,9" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity="0.85" />
  <path d="M 11,6 A 12,12 0 0,1 29,6" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity="0.6" />
</svg>`;

      await pool.query(
        'INSERT INTO device_categories (name, svg_icon) VALUES (?, ?), (?, ?), (?, ?)',
        ['Router', defaultRouterSvg, 'Switch', defaultSwitchSvg, 'Access_Point', defaultAccessPointSvg]
      );
      console.log('Seeded default device categories.');
    }

    // Seed initial users if empty
    const [rows]: any = await pool.query('SELECT COUNT(*) as count FROM users');
    if (rows[0].count === 0) {
      await pool.query(`
        INSERT INTO users (id, username, password, name, role, telegram_chat_id, status, daily_tasks_count, mission_completed, mission_incompleted) VALUES
        (1, 'rizal_tech', 'password', 'Rizal Kurniawan', 'Teknisi', '12345678', 'Available', 0, 12, 1),
        (2, 'dian_tech', 'password', 'Dian Prasetyo', 'Teknisi', '87654321', 'Available', 0, 9, 2),
        (3, 'admin_dika', 'admin123', 'Dika Admin', 'Administrator', NULL, 'Available', 0, 0, 0)
      `);
      console.log('Seeded default users.');
    }

    // Seed initial devices (Refreshed for UNTAG Banyuwangi Campus layout)
    const [deviceRows]: any = await pool.query('SELECT COUNT(*) as count FROM devices');
    // If we have old coordinates (Malang/Jember or old off-center BWI), reset devices for precise UNTAG BWI coordinates
    const [sampleDev]: any = await pool.query('SELECT latitude, longitude FROM devices LIMIT 1');
    const needsBwiReset = sampleDev.length > 0 && (sampleDev[0].longitude < 114.3 || sampleDev[0].latitude > -8.225);

    if (deviceRows[0].count === 0 || needsBwiReset) {
      await pool.query('DELETE FROM devices');
      await pool.query(`
        INSERT INTO devices (id, name, type, ip_address, location, latitude, longitude, status, last_ping, is_backbone, battery_percentage, voltage, solar_status) VALUES
        (1, 'Core Router Utama UNTAG BWI', 'Router', '10.10.10.1', 'Gedung Rektorat Lt 1', -8.229581, 114.363231, 'Up', 'Just now', TRUE, NULL, NULL, NULL),
        (2, 'Switch Backbone Rektorat', 'Switch', '10.10.10.2', 'Server Room Rektorat', -8.229181, 114.362931, 'Up', 'Just now', TRUE, NULL, NULL, NULL),
        (3, 'Switch Gedung Kopi BWI', 'Switch', '10.10.20.1', 'Gedung Kopi Center BWI', -8.231181, 114.364131, 'Down', '5m ago', FALSE, NULL, NULL, NULL),
        (4, 'AP-GedungKopi-BWI-01', 'Access_Point', '10.10.20.11', 'Lobi Gazebo Gedung Kopi', -8.231281, 114.364231, 'Down', '5m ago', FALSE, NULL, NULL, NULL),
        (5, 'AP-Rektorat-Lobi', 'Access_Point', '10.10.30.11', 'Lobi Rektorat UNTAG', -8.229081, 114.363031, 'Up', 'Just now', FALSE, NULL, NULL, NULL),
        (6, 'AP-Perpustakaan-Lt1', 'Access_Point', '10.10.40.11', 'Perpustakaan Lt 1', -8.230081, 114.363831, 'Up', 'Just now', FALSE, NULL, NULL, NULL),
        (7, 'AP-Teknik-GdA', 'Access_Point', '10.10.50.11', 'Fakultas Teknik Gd A', -8.230581, 114.362231, 'Up', 'Just now', FALSE, NULL, NULL, NULL),
        (8, 'AP-Teknik-GdB', 'Access_Point', '10.10.50.12', 'Fakultas Teknik Gd B', -8.230881, 114.361931, 'Up', 'Just now', FALSE, NULL, NULL, NULL),
        (9, 'AP-Hukum-RuangBaca', 'Access_Point', '10.10.60.11', 'Fakultas Hukum R. Baca', -8.228581, 114.362731, 'Up', 'Just now', FALSE, NULL, NULL, NULL),
        (10, 'AP-Ekonomi-Lobi', 'Access_Point', '10.10.60.12', 'Fakultas Ekonomi Lobi', -8.229381, 114.364531, 'Up', 'Just now', FALSE, NULL, NULL, NULL),
        (11, 'AP-FISIP-Lobi', 'Access_Point', '10.10.70.11', 'FISIP Lobi Utama', -8.229881, 114.363631, 'Up', 'Just now', FALSE, NULL, NULL, NULL),
        (12, 'AP-Masjid-Darussalam', 'Access_Point', '10.10.80.11', 'Masjid UNTAG BWI', -8.228281, 114.362531, 'Up', 'Just now', FALSE, NULL, NULL, NULL),
        (13, 'AP-Student-Center', 'Access_Point', '10.10.90.11', 'Student Center Hall', -8.229681, 114.362731, 'Down', '10m ago', FALSE, NULL, NULL, NULL),
        (14, 'AP-Auditorium-Lt1', 'Access_Point', '10.10.100.11', 'Auditorium Lt 1', -8.230281, 114.363231, 'Up', 'Just now', FALSE, NULL, NULL, NULL),
        (15, 'AP-Auditorium-Lt2', 'Access_Point', '10.10.100.12', 'Auditorium Lt 2', -8.230381, 114.363331, 'Up', 'Just now', FALSE, NULL, NULL, NULL),
        (16, 'AP-Lab-Komputer', 'Access_Point', '10.10.110.11', 'Lab Komputer Bersama', -8.230481, 114.362531, 'Up', 'Just now', FALSE, NULL, NULL, NULL),
        (17, 'AP-Gazebo-Utara', 'Access_Point', '10.10.120.11', 'Gazebo Area Utara', -8.227881, 114.362831, 'Up', 'Just now', FALSE, NULL, NULL, NULL),
        (18, 'AP-Kantin-Kampus', 'Access_Point', '10.10.130.11', 'Kantin Kampus UNTAG', -8.231381, 114.362631, 'Up', 'Just now', FALSE, NULL, NULL, NULL),
        (19, 'AP-Parkir-Utama', 'Access_Point', '10.10.140.11', 'Area Parkir Utama', -8.228081, 114.363731, 'Up', 'Just now', FALSE, NULL, NULL, NULL),
        (20, 'AP-Solar-OutdoorBWI', 'Access_Point', '10.10.150.11', 'AP Solar Lapangan Basket', -8.230181, 114.364431, 'Up', 'Just now', FALSE, 90, 12.8, 'Charging'),
        (21, 'AP-Koperasi-Mahasiswa', 'Access_Point', '10.10.160.11', 'Koperasi Mahasiswa BWI', -8.231581, 114.363531, 'Down', '15m ago', FALSE, NULL, NULL, NULL),
        (22, 'AP-Gedung-B-Lobi', 'Access_Point', '10.10.170.11', 'Gedung B Lobi Tengah', -8.230781, 114.362831, 'Up', 'Just now', FALSE, NULL, NULL, NULL)
      `);
      console.log('Seeded UNTAG Banyuwangi precise default devices.');
    }

    // ============================================================
    // GACS MIGRATION — GenieACS / PON Topology Tables
    // ============================================================

    // Credentials for GenieACS ACS
    await pool.query(`
      CREATE TABLE IF NOT EXISTS genieacs_credentials (
        id INT AUTO_INCREMENT PRIMARY KEY,
        host VARCHAR(255) NOT NULL,
        port INT NOT NULL DEFAULT 7557,
        username VARCHAR(100) NULL,
        password VARCHAR(255) NULL,
        is_connected TINYINT(1) NOT NULL DEFAULT 0,
        last_test DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // Credentials for MikroTik RouterOS API
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mikrotik_credentials (
        id INT AUTO_INCREMENT PRIMARY KEY,
        host VARCHAR(255) NOT NULL,
        port INT NOT NULL DEFAULT 8728,
        username VARCHAR(100) NOT NULL,
        password VARCHAR(255) NOT NULL,
        is_connected TINYINT(1) NOT NULL DEFAULT 0,
        last_test DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // Telegram bot config (for GACS-style notifications)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS telegram_bot_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bot_token VARCHAR(255) NOT NULL,
        chat_id VARCHAR(100) NOT NULL,
        is_connected TINYINT(1) NOT NULL DEFAULT 0,
        last_test DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // PON Network Topology — Map Items (GPS markers)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS map_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        item_type ENUM('server','isp','mikrotik','olt','odc','odp','onu','other') NOT NULL,
        parent_id INT NULL,
        name VARCHAR(255) NOT NULL,
        latitude DECIMAL(10,8) NOT NULL DEFAULT 0,
        longitude DECIMAL(11,8) NOT NULL DEFAULT 0,
        genieacs_device_id VARCHAR(255) NULL,
        status ENUM('online','offline','unknown') NOT NULL DEFAULT 'unknown',
        properties LONGTEXT NULL COMMENT 'JSON extra properties',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES map_items(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // PON Network Topology — Connections/Polylines
    await pool.query(`
      CREATE TABLE IF NOT EXISTS map_connections (
        id INT AUTO_INCREMENT PRIMARY KEY,
        from_item_id INT NOT NULL,
        to_item_id INT NOT NULL,
        connection_type ENUM('online','offline','unknown') NOT NULL DEFAULT 'online',
        path_coordinates LONGTEXT NULL COMMENT 'JSON array of [lat, lng] waypoints',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (from_item_id) REFERENCES map_items(id) ON DELETE CASCADE,
        FOREIGN KEY (to_item_id) REFERENCES map_items(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // OLT Config
    await pool.query(`
      CREATE TABLE IF NOT EXISTS olt_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        map_item_id INT NOT NULL UNIQUE,
        output_power DECIMAL(5,2) NOT NULL DEFAULT 2.00,
        pon_count INT NOT NULL DEFAULT 1,
        attenuation_db DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        olt_link VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (map_item_id) REFERENCES map_items(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // OLT PON Ports
    await pool.query(`
      CREATE TABLE IF NOT EXISTS olt_pon_ports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        olt_item_id INT NOT NULL,
        pon_number INT NOT NULL,
        output_power DECIMAL(5,2) NOT NULL DEFAULT 9.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY (olt_item_id, pon_number),
        FOREIGN KEY (olt_item_id) REFERENCES map_items(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // ODC Config
    await pool.query(`
      CREATE TABLE IF NOT EXISTS odc_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        map_item_id INT NOT NULL UNIQUE,
        olt_pon_port_id INT NULL,
        port_count INT NOT NULL DEFAULT 8,
        parent_attenuation_db DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        calculated_power DECIMAL(5,2) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (map_item_id) REFERENCES map_items(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // ODP Config
    await pool.query(`
      CREATE TABLE IF NOT EXISTS odp_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        map_item_id INT NOT NULL UNIQUE,
        odc_port INT NULL,
        input_power DECIMAL(5,2) NULL,
        port_count INT NOT NULL DEFAULT 8,
        use_splitter TINYINT(1) NOT NULL DEFAULT 0,
        splitter_ratio VARCHAR(20) NULL,
        calculated_power DECIMAL(5,2) NULL,
        port_rx_power LONGTEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (map_item_id) REFERENCES map_items(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // ONU Config
    await pool.query(`
      CREATE TABLE IF NOT EXISTS onu_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        map_item_id INT NOT NULL UNIQUE,
        odp_port INT NULL,
        customer_name VARCHAR(255) NULL,
        genieacs_device_id VARCHAR(255) NULL,
        calculated_rx_power DECIMAL(5,2) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (map_item_id) REFERENCES map_items(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // Server PON Ports
    await pool.query(`
      CREATE TABLE IF NOT EXISTS server_pon_ports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id INT NOT NULL,
        port_number INT NOT NULL,
        port_name VARCHAR(50) DEFAULT NULL,
        output_power DECIMAL(5,2) DEFAULT 7.00,
        status ENUM('active','inactive','broken') DEFAULT 'active',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        -- Note: Loose coupling for server_id to map_items
      ) ENGINE=InnoDB;
    `);

    // Add calculated_rx_power to onu_config if missing
    try {
      await pool.query("ALTER TABLE onu_config ADD COLUMN calculated_rx_power DECIMAL(5,2) NULL");
    } catch (e) {}

    // ---- Phase 4: Monitoring & Scheduled Reports ----
    await pool.query(`
      CREATE TABLE IF NOT EXISTS device_monitoring (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        device_id VARCHAR(255) NOT NULL,
        status ENUM('online','offline','unknown') NOT NULL,
        notified TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_device_id (device_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS mac_vendor_cache (
        id INT AUTO_INCREMENT PRIMARY KEY,
        oui VARCHAR(10) NOT NULL UNIQUE,
        vendor_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS telegram_report_schedules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        chat_id VARCHAR(100) NOT NULL,
        report_type ENUM('daily','weekly') NOT NULL,
        schedule_time TIME NOT NULL,
        schedule_day INT NULL COMMENT '0-6 for weekly',
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        last_sent_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS telegram_report_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        schedule_id INT NOT NULL,
        status VARCHAR(50) NOT NULL,
        message TEXT NULL,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (schedule_id) REFERENCES telegram_report_schedules(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // System Logs / Audit Trail
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        action VARCHAR(255) NOT NULL,
        details TEXT NULL,
        ip_address VARCHAR(45) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB;
    `);

    // GAP #4: Client Logs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS client_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        level ENUM('INFO', 'WARN', 'ERROR', 'DEBUG') NOT NULL DEFAULT 'INFO',
        message TEXT NOT NULL,
        url VARCHAR(500) NULL,
        user_agent VARCHAR(500) NULL,
        user_id INT NULL,
        ip_address VARCHAR(45) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // GAP #11: Report Schedules (configurable from UI)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS report_schedules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        report_type ENUM('daily', 'weekly') NOT NULL DEFAULT 'daily',
        schedule_time VARCHAR(5) NOT NULL DEFAULT '08:00',
        schedule_day TINYINT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        chat_id VARCHAR(100) NULL,
        last_sent_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // GAP #12: Webhook Logs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS webhook_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        source VARCHAR(100) NOT NULL,
        payload JSON NOT NULL,
        processed TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // Operational Tables (Network Engginer.xlsx integration)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS operational_incidents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        incident_date VARCHAR(50) NOT NULL,
        report_time VARCHAR(20) NULL,
        resolved_time VARCHAR(50) NULL,
        affected_system VARCHAR(255) NOT NULL,
        severity ENUM('Low', 'Medium', 'High', 'Critical') NOT NULL DEFAULT 'Medium',
        description TEXT NOT NULL,
        impact TEXT NULL,
        root_cause TEXT NULL,
        action_taken TEXT NULL,
        handled_by VARCHAR(150) NOT NULL,
        status ENUM('Open', 'In Progress', 'Resolved', 'Closed') NOT NULL DEFAULT 'In Progress',
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS operational_change_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        request_date VARCHAR(50) NOT NULL,
        cr_code VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        reason TEXT NOT NULL,
        affected_devices TEXT NOT NULL,
        requested_by VARCHAR(150) NOT NULL,
        approved_by VARCHAR(150) NULL,
        implementation_schedule VARCHAR(100) NULL,
        rollback_plan TEXT NULL,
        status ENUM('Draft', 'Diajukan', 'Disetujui', 'Diimplementasi', 'Ditolak', 'Selesai') NOT NULL DEFAULT 'Diajukan',
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS operational_procurements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        item_name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        sub_category VARCHAR(100) NULL,
        location VARCHAR(150) NOT NULL,
        brand VARCHAR(100) NULL,
        color VARCHAR(50) NULL,
        unit_price DOUBLE NOT NULL DEFAULT 0,
        quantity DOUBLE NOT NULL DEFAULT 1,
        unit_name VARCHAR(50) NULL,
        acquisition_date VARCHAR(100) NULL,
        lifespan VARCHAR(100) NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS operational_backup_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        backup_date VARCHAR(50) NOT NULL,
        device_name VARCHAR(255) NOT NULL,
        backup_type ENUM('Full', 'Manual', 'Auto') NOT NULL DEFAULT 'Full',
        storage_location TEXT NULL,
        file_size VARCHAR(50) NULL,
        performed_by VARCHAR(150) NOT NULL,
        verification_status ENUM('Berhasil', 'Gagal', 'Pending') NOT NULL DEFAULT 'Berhasil',
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS operational_access_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        access_date VARCHAR(50) NOT NULL,
        access_time VARCHAR(20) NOT NULL,
        accessor_name VARCHAR(150) NOT NULL,
        target_device VARCHAR(255) NOT NULL,
        purpose TEXT NOT NULL,
        access_method VARCHAR(50) NOT NULL DEFAULT 'Web/GUI',
        approved_by VARCHAR(150) NULL,
        end_time VARCHAR(20) NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS operational_daily_checklists (
        id INT AUTO_INCREMENT PRIMARY KEY,
        inspection_item TEXT NOT NULL,
        is_completed BOOLEAN NOT NULL DEFAULT FALSE,
        inspected_by VARCHAR(150) NOT NULL,
        inspection_time VARCHAR(100) NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS operational_monitoring_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        report_date VARCHAR(50) NOT NULL,
        device_name VARCHAR(255) NOT NULL,
        uptime_pct VARCHAR(50) NULL,
        bandwidth_util VARCHAR(100) NULL,
        cpu_pct VARCHAR(50) NULL,
        memory_pct VARCHAR(50) NULL,
        latency_ms VARCHAR(50) NULL,
        packet_loss_pct VARCHAR(50) NULL,
        status ENUM('Normal', 'Warning', 'Nonaktif', 'Critical') NOT NULL DEFAULT 'Normal',
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    try {
      await pool.query("ALTER TABLE operational_incidents ADD COLUMN ticket_id INT NULL");
    } catch (e) {}

    try {
      await pool.query("ALTER TABLE operational_incidents ADD COLUMN sla_limit_minutes INT NOT NULL DEFAULT 60");
    } catch (e) {}
    try {
      await pool.query("ALTER TABLE operational_incidents ADD COLUMN sla_breached TINYINT(1) NOT NULL DEFAULT 0");
    } catch (e) {}
    try {
      await pool.query("ALTER TABLE operational_incidents ADD COLUMN proof_image_url LONGTEXT NULL");
    } catch (e) {}

    await pool.query(`
      CREATE TABLE IF NOT EXISTS device_qr_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_id INT NULL,
        asset_code VARCHAR(100) NOT NULL UNIQUE,
        qr_data TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // ============================================================
    // IT INVENTORY & COMPONENT SUITE TABLES
    // ============================================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS it_inventory_assets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        asset_code VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(200) NOT NULL,
        category VARCHAR(100) NOT NULL,
        brand VARCHAR(100) NULL,
        model_number VARCHAR(100) NULL,
        serial_number VARCHAR(100) NULL,
        mac_address VARCHAR(50) NULL,
        ip_address VARCHAR(50) NULL,
        location VARCHAR(150) NOT NULL,
        assigned_user VARCHAR(150) NULL,
        status ENUM('Baik / Aktif', 'Rusak Ringan', 'Rusak Berat', 'Cadangan / Stock', 'Dipinjamkan', 'Afkir / Disposed') NOT NULL DEFAULT 'Baik / Aktif',
        purchase_date VARCHAR(50) NULL,
        purchase_cost DOUBLE NOT NULL DEFAULT 0,
        vendor VARCHAR(150) NULL,
        warranty_expiry VARCHAR(50) NULL,
        specs TEXT NULL,
        image_url LONGTEXT NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS it_inventory_components (
        id INT AUTO_INCREMENT PRIMARY KEY,
        component_code VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(200) NOT NULL,
        category VARCHAR(100) NOT NULL,
        brand VARCHAR(100) NULL,
        model_number VARCHAR(100) NULL,
        stock_quantity INT NOT NULL DEFAULT 0,
        min_stock_alert INT NOT NULL DEFAULT 2,
        unit VARCHAR(50) NOT NULL DEFAULT 'Pcs',
        condition_status ENUM('Baru', 'Bekas Bagus', 'Rusak / Rusak Part') NOT NULL DEFAULT 'Baru',
        storage_location VARCHAR(150) NOT NULL,
        unit_price DOUBLE NOT NULL DEFAULT 0,
        supplier VARCHAR(150) NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS it_asset_components (
        id INT AUTO_INCREMENT PRIMARY KEY,
        asset_id INT NOT NULL,
        component_id INT NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        installed_at VARCHAR(50) NOT NULL,
        installed_by VARCHAR(150) NOT NULL,
        slot_or_position VARCHAR(100) NULL,
        status ENUM('Installed', 'Removed') NOT NULL DEFAULT 'Installed',
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (asset_id) REFERENCES it_inventory_assets(id) ON DELETE CASCADE,
        FOREIGN KEY (component_id) REFERENCES it_inventory_components(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS it_inventory_mutations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        reference_id INT NOT NULL,
        reference_name VARCHAR(255) NOT NULL,
        details TEXT NOT NULL,
        quantity_change INT NULL,
        actor_name VARCHAR(150) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // Seed initial IT Assets if empty
    const [itAssetRows]: any = await pool.query('SELECT COUNT(*) as count FROM it_inventory_assets');
    if (itAssetRows[0].count === 0) {
      await pool.query(`
        INSERT INTO it_inventory_assets 
        (id, asset_code, name, category, brand, model_number, serial_number, mac_address, ip_address, location, assigned_user, status, purchase_date, purchase_cost, vendor, warranty_expiry, specs, notes) 
        VALUES
        (1, 'AST-SRV-0001', 'Server Database Utama UNTAG', 'Server', 'Dell', 'PowerEdge R740', 'DL-SRV-98721X', '00:1E:67:D2:AA:01', '10.10.10.5', 'Server Room Rektorat', 'Dika Admin', 'Baik / Aktif', '2023-01-15', 48500000, 'PT Multidata Infokom', '2026-01-15', '2x Intel Xeon Gold 5218R, 64GB DDR4 ECC, 4x 1.2TB SAS 10K RAID-10, Dual 750W PSU', 'Server utama database kampus dan portal akademik'),
        (2, 'AST-SWT-0002', 'Core Switch Backbone', 'Switch', 'Cisco', 'Catalyst WS-C2960X-24TD-L', 'FOC2134S881', '70:69:79:81:44:99', '10.10.10.2', 'Server Room Rektorat', 'Rizal Kurniawan', 'Baik / Aktif', '2022-06-10', 28000000, 'PT Mitra Integrasi', '2025-06-10', '24 Port Gigabit Ethernet, 2x 10G SFP+ Uplink, Layer 2 Enterprise', 'Switch distribusi core gedung rektorat'),
        (3, 'AST-RTR-0003', 'MikroTik Cloud Core Router Gateway', 'Router', 'MikroTik', 'CCR1036-8G-2S+', 'CCR-BWI-7762', '48:8F:5A:11:32:00', '10.10.10.1', 'Gedung Rektorat Lt 1', 'Rizal Kurniawan', 'Baik / Aktif', '2022-08-20', 17500000, 'Citraweb Solusi', '2024-08-20', '36 Cores Tile-Gx CPU, 8x Gigabit LAN, 2x SFP+ 10G, 4GB RAM', 'Gateway utama routing internet & bandwidth management kampus'),
        (4, 'AST-PC-0004', 'PC Workstation Lab Komputer 1-01', 'PC / Desktop', 'Lenovo', 'ThinkCentre M70t Gen 3', 'MJ089921', 'A4:BB:6D:32:11:F4', '10.10.110.21', 'Lab Komputer Bersama', 'Dian Prasetyo', 'Baik / Aktif', '2023-05-12', 12500000, 'CV Bintang Mandiri', '2026-05-12', 'Intel Core i7-12700, 16GB DDR4, 512GB NVMe SSD, Monitor 24 FHD', 'PC Praktikum Mahasiswa Lab 1'),
        (5, 'AST-LAP-0005', 'Laptop Operasional Teknisi Lapangan', 'Laptop', 'ASUS', 'ExpertBook B1400', 'AS-EXP-66219', '8C:1D:96:44:88:E1', '10.10.30.55', 'Ruang IT Helpdesk', 'Rizal Kurniawan', 'Baik / Aktif', '2023-09-01', 9800000, 'ASUS Store Surabaya', '2025-09-01', 'Intel Core i5-1135G7, 16GB DDR4, 512GB SSD, Windows 11 Pro', 'Laptop untuk troubleshooting teknisi jaringan & on-site repair'),
        (6, 'AST-AP-0006', 'Access Point Outdoor Gedung Kopi', 'Access Point', 'Ubiquiti', 'UniFi U6-Mesh Outdoor', 'U6M-88912B', 'F4:92:BF:88:12:33', '10.10.20.11', 'Lobi Gazebo Gedung Kopi', 'Dian Prasetyo', 'Rusak Ringan', '2023-03-10', 3200000, 'Ubiquiti Distributor Indo', '2024-03-10', 'WiFi 6 Dual-Band AX3000, IPX5 Weatherproof, PoE 802.3af', 'Port PoE kadang drop saat hujan lebat, butuh pengecekan kabel patchcord'),
        (7, 'AST-PRN-0007', 'Printer Ink Tank Administrasi BAAK', 'Printer / Scanner', 'Epson', 'EcoTank L3210', 'X76Y99120', NULL, NULL, 'Ruang BAAK Rektorat', 'Staff BAAK', 'Baik / Aktif', '2024-02-18', 2450000, 'Toko Komputer Banyuwangi', '2025-02-18', 'All-in-One Print, Scan, Copy, Borderless 4R, Resolusi 5760 dpi', 'Printer cetak surat & kartu ujian civitas'),
        (8, 'AST-UPS-0008', 'UPS Rak Server Rektorat', 'UPS / Power', 'APC by Schneider', 'Smart-UPS SMT3000RMI2U', 'UPS-APC-3301', NULL, NULL, 'Server Room Rektorat', 'Dika Admin', 'Baik / Aktif', '2022-01-10', 21000000, 'PT Schneider Electric Indo', '2025-01-10', '3000VA / 2700W, Pure Sine Wave, LCD Interface, SmartSlot Web Card', 'Backup daya darurat rak server utama rektorat')
      `);
      console.log('Seeded initial IT Assets.');
    }

    // Seed initial IT Components if empty
    const [itCompRows]: any = await pool.query('SELECT COUNT(*) as count FROM it_inventory_components');
    if (itCompRows[0].count === 0) {
      await pool.query(`
        INSERT INTO it_inventory_components 
        (id, component_code, name, category, brand, model_number, stock_quantity, min_stock_alert, unit, condition_status, storage_location, unit_price, supplier, notes) 
        VALUES
        (1, 'CMP-RAM-001', 'RAM Server DDR4 ECC 32GB 3200MHz', 'RAM / Memory', 'Kingston', 'KSM32ED8/32HC', 6, 2, 'Pcs', 'Baru', 'Lemari Sparepart Lab 1 (Rak A1)', 1850000, 'PT Multidata Infokom', 'Memory ECC khusus server Dell PowerEdge / HP ProLiant'),
        (2, 'CMP-RAM-002', 'RAM Desktop DDR4 8GB 3200MHz', 'RAM / Memory', 'Corsair', 'Vengeance LPX 8GB', 12, 3, 'Pcs', 'Baru', 'Lemari Sparepart Lab 1 (Rak A2)', 380000, 'Toko Komputer Banyuwangi', 'RAM untuk PC workstation laboratorium'),
        (3, 'CMP-SSD-001', 'SSD NVMe M.2 1TB PCIe 4.0', 'Storage / SSD', 'Samsung', '980 PRO NVMe 1TB', 4, 2, 'Pcs', 'Baru', 'Gudang IT Server Room (Box B1)', 1650000, 'CV Bintang Mandiri', 'Storage high speed untuk server & PC desainer'),
        (4, 'CMP-SSD-002', 'SSD SATA 2.5 Inch 512GB', 'Storage / SSD', 'Kingston', 'KC600 512GB', 1, 3, 'Pcs', 'Baru', 'Gudang IT Server Room (Box B2)', 620000, 'CV Bintang Mandiri', 'PENGINGAT: Stok kritis sisa 1 pcs untuk upgrade PC lama'),
        (5, 'CMP-SFP-001', 'Modul Transceiver SFP+ 10G LC 10km', 'Fiber Optic / SFP', 'MikroTik', 'S+31DLC10D', 5, 2, 'Pcs', 'Baru', 'Lemari Jaringan (Rak SFP)', 850000, 'Citraweb Solusi', 'Modul uplink SFP 10G antar gedung'),
        (6, 'CMP-FBR-001', 'Patch Cord Fiber Optic LC-LC Duplex 3M', 'Fiber Optic / SFP', 'COMMSCOPE', 'FPC-LCLC-SM-3M', 18, 5, 'Pcs', 'Baru', 'Lemari Jaringan (Laci FO)', 95000, 'PT Mitra Integrasi', 'Patchcord jumper dari ODF ke Switch Core'),
        (7, 'CMP-CBL-001', 'Kabel UTP Cat6 Pure Copper 305M Roll', 'Kabel & Konektor', 'Belden', 'Cat6 7814A UTP', 3, 1, 'Roll', 'Baru', 'Gudang IT Lantai Dasar', 1950000, 'PT Mitra Integrasi', 'Kabel tarikan LAN backbone gedung baru'),
        (8, 'CMP-CON-001', 'Konektor RJ45 Cat6 Pass-Through (Box 100pcs)', 'Kabel & Konektor', 'Vention', 'IDBR0', 4, 2, 'Box', 'Baru', 'Lemari Sparepart Lab 1 (Rak A3)', 150000, 'Marketplace Official', 'Konektor crimping teknisi'),
        (9, 'CMP-PSU-001', 'Power Supply Redundant Dell 750W Titanium', 'Power Supply / Adaptor', 'Dell', '0W8R3C 750W', 2, 1, 'Pcs', 'Baru', 'Server Room Rektorat (Box PSU)', 3200000, 'PT Multidata Infokom', 'Cadangan hot-plug PSU server database'),
        (10, 'CMP-TNR-001', 'Toner Cartridge HP 85A Black', 'Consumable & Peripheral', 'HP', 'CE285A Original', 0, 2, 'Pcs', 'Baru', 'Lemari Administrasi IT', 950000, 'ATK Kampus', 'STOK HABIS: Perlu PO pengadaan ulang untuk printer dosen')
      `);
      console.log('Seeded initial IT Components.');
    }

    // Seed initial Asset Components installation if empty
    const [itAttachRows]: any = await pool.query('SELECT COUNT(*) as count FROM it_asset_components');
    if (itAttachRows[0].count === 0) {
      await pool.query(`
        INSERT INTO it_asset_components 
        (id, asset_id, component_id, quantity, installed_at, installed_by, slot_or_position, status, notes) 
        VALUES
        (1, 1, 1, 2, '2023-01-16', 'Dika Admin', 'DIMM Slot A1 & A2 (Total 64GB)', 'Installed', 'RAM ECC terpasang saat inisialisasi server database'),
        (2, 1, 9, 2, '2023-01-16', 'Dika Admin', 'PSU Bay 1 & Bay 2 (Redundant Dual 750W)', 'Installed', 'Power supply redundant aktif'),
        (3, 2, 5, 2, '2022-06-12', 'Rizal Kurniawan', 'SFP+ Port Te1/0/1 & Te1/0/2', 'Installed', 'Transceiver uplink 10G ke Gateway Rektorat & Server DB'),
        (4, 4, 2, 2, '2023-05-14', 'Dian Prasetyo', 'DIMM Slot 1 & 2 (Dual Channel 16GB)', 'Installed', 'Upgrade RAM untuk lab praktikum multimedia'),
        (5, 4, 3, 1, '2023-05-14', 'Dian Prasetyo', 'M.2 NVMe Slot 1', 'Installed', 'System Drive Windows 11')
      `);
      console.log('Seeded initial installed Asset Components.');
    }

    // Seed initial mutation logs if empty
    const [itMutRows]: any = await pool.query('SELECT COUNT(*) as count FROM it_inventory_mutations');
    if (itMutRows[0].count === 0) {
      await pool.query(`
        INSERT INTO it_inventory_mutations 
        (type, reference_id, reference_name, details, quantity_change, actor_name) 
        VALUES
        ('Asset Create', 1, 'Server Database Utama UNTAG', 'Registrasi aset baru server Dell PowerEdge R740 ke sistem', NULL, 'Dika Admin'),
        ('Stock In', 1, 'RAM Server DDR4 ECC 32GB 3200MHz', 'Penerimaan stok awal komponen dari supplier PT Multidata Infokom (8 Pcs)', 8, 'Dika Admin'),
        ('Install Component', 1, 'Server Database Utama UNTAG', 'Pemasangan 2x RAM DDR4 ECC 32GB ke Slot A1-A2 server', -2, 'Dika Admin'),
        ('Stock In', 5, 'Modul Transceiver SFP+ 10G LC 10km', 'Penerimaan pengadaan modul SFP+ 10G (7 Pcs)', 7, 'Rizal Kurniawan'),
        ('Install Component', 2, 'Core Switch Backbone', 'Pemasangan 2x SFP+ 10G ke Port Te1/0/1 & Te1/0/2 Cisco WS-C2960X', -2, 'Rizal Kurniawan')
      `);
      console.log('Seeded initial IT inventory mutations.');
    }

    console.log('Database tables verified/created successfully');

  } catch (error) {
    console.error('Error setting up database tables:', error);
  }
};

export const writeLog = async (userId: number | null, action: string, details: string | null = null, ipAddress: string | null = null) => {
  try {
    await pool.query(
      'INSERT INTO system_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
      [userId, action, details, ipAddress]
    );
  } catch (error) {
    console.error('Failed to write system log:', error);
  }
};
