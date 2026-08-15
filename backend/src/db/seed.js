const { db, run, query } = require('./index');

function seedDatabase() {
  console.log('Seeding RailSmart database with Indian Railways Golden Corridor data...');

  // 1. Clear existing data
  db.exec(`
    DELETE FROM recommendations;
    DELETE FROM conflict_events;
    DELETE FROM simulated_platform_assignments;
    DELETE FROM train_runs;
    DELETE FROM weather_snapshots;
    DELETE FROM block_sections;
    DELETE FROM trains;
    DELETE FROM stations;
    DELETE FROM operator_decisions_log;
    DELETE FROM synthetic_historical_trends;
  `);

  // 2. Insert Stations
  const stations = [
    { code: 'NDLS', name: 'New Delhi', platforms: 16, lat: 28.6143, lng: 77.2188, zone: 'NR', is_junction: 1 },
    { code: 'GZB', name: 'Ghaziabad Jn', platforms: 6, lat: 28.6538, lng: 77.4300, zone: 'NR', is_junction: 1 },
    { code: 'ALJN', name: 'Aligarh Jn', platforms: 7, lat: 27.8974, lng: 78.0880, zone: 'NCR', is_junction: 1 },
    { code: 'TDL', name: 'Tundla Jn', platforms: 5, lat: 27.2065, lng: 78.2410, zone: 'NCR', is_junction: 1 },
    { code: 'CNB', name: 'Kanpur Central', platforms: 10, lat: 26.4547, lng: 80.3507, zone: 'NCR', is_junction: 1 },
    { code: 'PRYJ', name: 'Prayagraj Jn', platforms: 10, lat: 25.4497, lng: 81.8282, zone: 'NCR', is_junction: 1 },
    { code: 'DDU', name: 'Pt. Deen Dayal Upadhyaya Jn', platforms: 8, lat: 25.2818, lng: 83.1189, zone: 'ECR', is_junction: 1 },
    { code: 'PNBE', name: 'Patna Jn', platforms: 10, lat: 25.6033, lng: 85.1384, zone: 'ECR', is_junction: 1 },
    { code: 'HWH', name: 'Howrah Jn', platforms: 23, lat: 22.5840, lng: 88.3426, zone: 'ER', is_junction: 1 }
  ];

  const insertStation = db.prepare(`
    INSERT INTO stations (station_code, name, platform_count, lat, lng, zone, is_junction)
    VALUES (@code, @name, @platforms, @lat, @lng, @zone, @is_junction)
  `);
  for (const s of stations) insertStation.run(s);

  // 3. Insert Block Sections (Mainline + Loop Siding Graphs)
  const blocks = [
    { id: 'BLK-NDLS-GZB', from: 'NDLS', to: 'GZB', len: 25.0, single: 0, speed: 110.0 },
    { id: 'BLK-NDLS-GZB-LOOP', from: 'NDLS', to: 'GZB', len: 25.0, single: 0, speed: 30.0 },
    { id: 'BLK-GZB-ALJN', from: 'GZB', to: 'ALJN', len: 106.0, single: 0, speed: 130.0 },
    { id: 'BLK-GZB-ALJN-LOOP', from: 'GZB', to: 'ALJN', len: 106.0, single: 0, speed: 30.0 },
    { id: 'BLK-ALJN-TDL', from: 'ALJN', to: 'TDL', len: 78.0, single: 0, speed: 130.0 },
    { id: 'BLK-ALJN-TDL-LOOP', from: 'ALJN', to: 'TDL', len: 78.0, single: 0, speed: 30.0 },
    { id: 'BLK-TDL-CNB', from: 'TDL', to: 'CNB', len: 228.0, single: 0, speed: 130.0 },
    { id: 'BLK-TDL-CNB-LOOP', from: 'TDL', to: 'CNB', len: 228.0, single: 0, speed: 30.0 },
    { id: 'BLK-CNB-PRYJ', from: 'CNB', to: 'PRYJ', len: 194.0, single: 0, speed: 130.0 },
    { id: 'BLK-CNB-PRYJ-LOOP', from: 'CNB', to: 'PRYJ', len: 194.0, single: 0, speed: 30.0 },
    { id: 'BLK-PRYJ-DDU', from: 'PRYJ', to: 'DDU', len: 153.0, single: 0, speed: 130.0 },
    { id: 'BLK-PRYJ-DDU-LOOP', from: 'PRYJ', to: 'DDU', len: 153.0, single: 0, speed: 30.0 },
    { id: 'BLK-DDU-PNBE', from: 'DDU', to: 'PNBE', len: 211.0, single: 0, speed: 120.0 },
    { id: 'BLK-DDU-PNBE-LOOP', from: 'DDU', to: 'PNBE', len: 211.0, single: 0, speed: 30.0 },
    { id: 'BLK-PNBE-HWH', from: 'PNBE', to: 'HWH', len: 532.0, single: 0, speed: 130.0 },
    { id: 'BLK-PNBE-HWH-LOOP', from: 'PNBE', to: 'HWH', len: 532.0, single: 0, speed: 30.0 }
  ];

  const insertBlock = db.prepare(`
    INSERT INTO block_sections (block_id, from_station, to_station, length_km, is_single_line, max_speed_kmh, simulated_signal_state)
    VALUES (@id, @from, @to, @len, @single, @speed, 'GREEN')
  `);
  for (const b of blocks) insertBlock.run(b);

  // 4. Insert Trains
  const trains = [
    { id: 'T-22436', num: '22436', name: 'Vande Bharat Express', class: 'VANDE_BHARAT', rank: 1, src: 'NDLS', dst: 'PRYJ', max_spd: 130.0 },
    { id: 'T-12302', num: '12302', name: 'Howrah Rajdhani Express', class: 'RAJDHANI_SHATABDI', rank: 1, src: 'NDLS', dst: 'HWH', max_spd: 130.0 },
    { id: 'T-12004', num: '12004', name: 'Lucknow Shatabdi Express', class: 'RAJDHANI_SHATABDI', rank: 1, src: 'NDLS', dst: 'CNB', max_spd: 130.0 },
    { id: 'T-12560', num: '12560', name: 'Shiv Ganga Superfast', class: 'SUPERFAST', rank: 2, src: 'NDLS', dst: 'PRYJ', max_spd: 110.0 },
    { id: 'T-12802', num: '12802', name: 'Purushottam Express', class: 'SUPERFAST', rank: 2, src: 'NDLS', dst: 'HWH', max_spd: 110.0 },
    { id: 'T-14218', num: '14218', name: 'Unchahar Express', class: 'MAIL_EXPRESS', rank: 3, src: 'GZB', dst: 'PRYJ', max_spd: 100.0 },
    { id: 'T-04183', num: '04183', name: 'Aligarh - Tundla MEMU', class: 'PASSENGER', rank: 4, src: 'ALJN', dst: 'TDL', max_spd: 80.0 },
    { id: 'T-BCN489', num: 'BCN-489', name: 'Container Freight Rake', class: 'FREIGHT', rank: 5, src: 'GZB', dst: 'DDU', max_spd: 65.0 },
    { id: 'T-BOXN912', num: 'BOXN-912', name: 'Coal Freight Rake', class: 'FREIGHT', rank: 5, src: 'DDU', dst: 'NDLS', max_spd: 60.0 }
  ];

  const insertTrain = db.prepare(`
    INSERT INTO trains (train_id, number, name, class, priority_rank, source_station, destination_station, max_speed_kmh)
    VALUES (@id, @num, @name, @class, @rank, @src, @dst, @max_spd)
  `);
  for (const t of trains) insertTrain.run(t);

  // 5. Insert Active Train Runs (Positions along corridor)
  const runs = [
    {
      id: 'RUN-22436',
      tid: 'T-22436',
      cur_stn: 'CNB',
      next_stn: 'PRYJ',
      prev_stn: 'CNB',
      delay: 2,
      lat: 26.0500,
      lng: 80.9500,
      spd: 125.0,
      dir: 'DN',
      blk: 'BLK-CNB-PRYJ',
      prog: 0.38,
      plat: 1,
      eta: 45.0,
      dist: 120.0
    },
    {
      id: 'RUN-BCN489',
      tid: 'T-BCN489',
      cur_stn: 'CNB',
      next_stn: 'PRYJ',
      prev_stn: 'CNB',
      delay: 18,
      lat: 26.0200,
      lng: 81.0100,
      spd: 55.0,
      dir: 'DN',
      blk: 'BLK-CNB-PRYJ',
      prog: 0.42,
      plat: null,
      eta: 95.0,
      dist: 112.0
    },
    {
      id: 'RUN-12302',
      tid: 'T-12302',
      cur_stn: 'GZB',
      next_stn: 'ALJN',
      prev_stn: 'GZB',
      delay: 0,
      lat: 28.3200,
      lng: 77.7200,
      spd: 128.0,
      dir: 'DN',
      blk: 'BLK-GZB-ALJN',
      prog: 0.55,
      plat: 2,
      eta: 25.0,
      dist: 48.0
    },
    {
      id: 'RUN-12560',
      tid: 'T-12560',
      cur_stn: 'GZB',
      next_stn: 'ALJN',
      prev_stn: 'GZB',
      delay: 4,
      lat: 28.4500,
      lng: 77.5800,
      spd: 105.0,
      dir: 'DN',
      blk: 'BLK-GZB-ALJN',
      prog: 0.35,
      plat: 3,
      eta: 40.0,
      dist: 69.0
    },
    {
      id: 'RUN-12004',
      tid: 'T-12004',
      cur_stn: 'TDL',
      next_stn: 'CNB',
      prev_stn: 'TDL',
      delay: 1,
      lat: 26.8500,
      lng: 79.3500,
      spd: 115.0,
      dir: 'DN',
      blk: 'BLK-TDL-CNB',
      prog: 0.60,
      plat: 1,
      eta: 50.0,
      dist: 91.0
    },
    {
      id: 'RUN-04183',
      tid: 'T-04183',
      cur_stn: 'ALJN',
      next_stn: 'TDL',
      prev_stn: 'ALJN',
      delay: 12,
      lat: 27.5500,
      lng: 78.1600,
      spd: 65.0,
      dir: 'DN',
      blk: 'BLK-ALJN-TDL',
      prog: 0.45,
      plat: 4,
      eta: 30.0,
      dist: 42.0
    },
    {
      id: 'RUN-12802',
      tid: 'T-12802',
      cur_stn: 'PRYJ',
      next_stn: 'DDU',
      prev_stn: 'PRYJ',
      delay: 6,
      lat: 25.3500,
      lng: 82.4500,
      spd: 108.0,
      dir: 'DN',
      blk: 'BLK-PRYJ-DDU',
      prog: 0.50,
      plat: 2,
      eta: 40.0,
      dist: 76.0
    },
    {
      id: 'RUN-BOXN912',
      tid: 'T-BOXN912',
      cur_stn: 'PRYJ',
      next_stn: 'CNB',
      prev_stn: 'PRYJ',
      delay: 25,
      lat: 25.8500,
      lng: 81.2500,
      spd: 50.0,
      dir: 'UP',
      blk: 'BLK-CNB-PRYJ',
      prog: 0.70,
      plat: null,
      eta: 80.0,
      dist: 60.0
    }
  ];

  const insertRun = db.prepare(`
    INSERT INTO train_runs (
      run_id, train_id, date, current_station, next_station, prev_station,
      live_delay_minutes, live_lat, live_lng, speed_kmh, direction,
      current_block_id, block_progress, simulated_platform,
      eta_next_station_mins, distance_to_next_km, status
    ) VALUES (
      @id, @tid, date('now'), @cur_stn, @next_stn, @prev_stn,
      @delay, @lat, @lng, @spd, @dir,
      @blk, @prog, @plat,
      @eta, @dist, 'RUNNING'
    )
  `);
  for (const r of runs) insertRun.run(r);

  // 6. Insert Weather Snapshots
  const weather = [
    { id: 'WX-NDLS', stn: 'NDLS', cond: 'CLEAR', vis: 3000, temp: 32, wind: 8 },
    { id: 'WX-GZB', stn: 'GZB', cond: 'MIST', vis: 450, temp: 24, wind: 10 },
    { id: 'WX-ALJN', stn: 'ALJN', cond: 'FOG', vis: 180, temp: 16, wind: 6 },
    { id: 'WX-TDL', stn: 'TDL', cond: 'CLEAR', vis: 2500, temp: 30, wind: 12 },
    { id: 'WX-CNB', stn: 'CNB', cond: 'CLEAR', vis: 4000, temp: 33, wind: 9 },
    { id: 'WX-PRYJ', stn: 'PRYJ', cond: 'RAIN', vis: 1500, temp: 26, wind: 22 },
    { id: 'WX-DDU', stn: 'DDU', cond: 'CLEAR', vis: 5000, temp: 34, wind: 7 },
    { id: 'WX-PNBE', stn: 'PNBE', cond: 'CLEAR', vis: 6000, temp: 31, wind: 11 },
    { id: 'WX-HWH', stn: 'HWH', cond: 'THUNDERSTORM', vis: 800, temp: 27, wind: 35 }
  ];

  const insertWx = db.prepare(`
    INSERT INTO weather_snapshots (snapshot_id, station_code, condition, visibility_m, temp_c, wind_speed_kmh, is_cached)
    VALUES (@id, @stn, @cond, @vis, @temp, @wind, 1)
  `);
  for (const w of weather) insertWx.run(w);

  // 7. Insert Initial Simulated Platform Allocations (Clearly Tagged Simulated)
  const platforms = [
    { id: 'SIM-PL-NDLS-1', stn: 'NDLS', tid: 'T-22436', plat: 1, mins: 20, stat: 'OCCUPIED' },
    { id: 'SIM-PL-NDLS-2', stn: 'NDLS', tid: 'T-12302', plat: 2, mins: 15, stat: 'OCCUPIED' },
    { id: 'SIM-PL-CNB-1', stn: 'CNB', tid: 'T-12004', plat: 1, mins: 10, stat: 'RESERVED' },
    { id: 'SIM-PL-CNB-2', stn: 'CNB', tid: 'T-12560', plat: 2, mins: 8, stat: 'RESERVED' },
    { id: 'SIM-PL-PRYJ-1', stn: 'PRYJ', tid: 'T-12802', plat: 1, mins: 12, stat: 'OCCUPIED' }
  ];

  const insertPlat = db.prepare(`
    INSERT INTO simulated_platform_assignments (assignment_id, station_code, train_id, platform_number, expected_departure_mins, status)
    VALUES (@id, @stn, @tid, @plat, @mins, @stat)
  `);
  for (const p of platforms) insertPlat.run(p);

  // 8. Insert Synthetic Historical Delay Trends (For trend analytics view, labeled simulated)
  const trends = [
    { id: 'TR-1', date: '2026-08-08', corridor: 'NCR Mainline', punct: 88.4, delay: 14.2, wx_factor: 1.1, conflicts: 18, trust: 92.5 },
    { id: 'TR-2', date: '2026-08-09', corridor: 'NCR Mainline', punct: 85.1, delay: 18.6, wx_factor: 1.4, conflicts: 24, trust: 89.0 },
    { id: 'TR-3', date: '2026-08-10', corridor: 'NCR Mainline', punct: 91.2, delay: 11.5, wx_factor: 1.0, conflicts: 12, trust: 95.0 },
    { id: 'TR-4', date: '2026-08-11', corridor: 'NCR Mainline', punct: 79.5, delay: 24.8, wx_factor: 2.2, conflicts: 31, trust: 87.5 },
    { id: 'TR-5', date: '2026-08-12', corridor: 'NCR Mainline', punct: 86.8, delay: 16.0, wx_factor: 1.3, conflicts: 20, trust: 91.0 },
    { id: 'TR-6', date: '2026-08-13', corridor: 'NCR Mainline', punct: 93.0, delay: 8.9, wx_factor: 0.9, conflicts: 9, trust: 97.0 },
    { id: 'TR-7', date: '2026-08-14', corridor: 'NCR Mainline', punct: 90.5, delay: 12.3, wx_factor: 1.1, conflicts: 15, trust: 94.0 }
  ];

  const insertTrend = db.prepare(`
    INSERT INTO synthetic_historical_trends (trend_id, date, corridor_name, avg_punctuality_percent, avg_delay_mins, weather_disruption_factor, conflicts_resolved_count, system_trust_score_percent)
    VALUES (@id, @date, @corridor, @punct, @delay, @wx_factor, @conflicts, @trust)
  `);
  for (const tr of trends) insertTrend.run(tr);

  // 9. Initial Operator Decisions Log
  const logs = [
    { id: 'LOG-01', rec: 'REC-INIT-1', conf: 'CONF-OVERTAKE-22436-BCN489', opt: 'OPTION_A_HOLD', act: 'ACCEPTED', notes: 'Held freight at CNB Loop Line' },
    { id: 'LOG-02', rec: 'REC-INIT-2', conf: 'CONF-PLAT-12560-12004-CNB', opt: 'OPTION_C_REROUTE', act: 'ACCEPTED', notes: 'Reallocated to Platform 3' }
  ];
  const insertLog = db.prepare(`
    INSERT INTO operator_decisions_log (log_id, rec_id, conflict_id, selected_option_id, action, notes)
    VALUES (@id, @rec, @conf, @opt, @act, @notes)
  `);
  for (const l of logs) insertLog.run(l);

  console.log('Database seeding complete with full Golden Corridor network!');
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
