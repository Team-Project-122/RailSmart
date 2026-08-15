/**
 * Automated Test Suite for Backend Demo Scenarios & Conflict Lifecycle
 */

const assert = require('assert');
const simulator = require('../src/services/simulator');
const { query } = require('../src/db');
const { seedDatabase } = require('../src/db/seed');

async function runTests() {
  console.log('--- RUNNING BACKEND SCENARIOS & LIFECYCLE TESTS ---');

  // Test 1: Seed database
  seedDatabase();
  const stationCount = query('SELECT count(*) as count FROM stations')[0].count;
  assert.strictEqual(stationCount, 9, 'Must seed 9 stations');
  console.log('✓ Test 1: Seed database passed (9 stations)');

  // Test 2: Scenario 1 - Overtake
  const res1 = simulator.injectScenario('SCENARIO_OVERTAKE');
  assert.strictEqual(res1.status, 'SUCCESS', 'Overtake scenario must succeed');
  const t22436 = query("SELECT tr.* FROM train_runs tr JOIN trains t ON tr.train_id=t.train_id WHERE t.number='22436'")[0];
  assert.strictEqual(t22436.current_block_id, 'BLK-CNB-PRYJ');
  assert.strictEqual(t22436.speed_kmh, 125);
  console.log('✓ Test 2: SCENARIO_OVERTAKE injected successfully');

  // Test 3: Scenario 2 - Dense Fog NCR
  const res2 = simulator.injectScenario('SCENARIO_FOG_NCR');
  assert.strictEqual(res2.status, 'SUCCESS', 'Fog scenario must succeed');
  const wxAljn = query("SELECT * FROM weather_snapshots WHERE station_code='ALJN'")[0];
  assert.strictEqual(wxAljn.condition, 'FOG');
  assert.strictEqual(wxAljn.visibility_m, 150);
  console.log('✓ Test 3: SCENARIO_FOG_NCR injected successfully');

  // Test 4: Scenario 3 - Platform Bottleneck
  const res3 = simulator.injectScenario('SCENARIO_PLATFORM_BOTTLENECK');
  assert.strictEqual(res3.status, 'SUCCESS', 'Platform bottleneck must succeed');
  console.log('✓ Test 4: SCENARIO_PLATFORM_BOTTLENECK injected successfully');

  // Test 5: Scenario 4 - Head-On Single Line
  const res4 = simulator.injectScenario('SCENARIO_HEADON_SINGLE_LINE');
  assert.strictEqual(res4.status, 'SUCCESS', 'Head-On Single Line must succeed');
  const blk = query("SELECT * FROM block_sections WHERE block_id='BLK-ALJN-TDL'")[0];
  assert.strictEqual(blk.is_single_line, 1, 'Block must be single line');
  console.log('✓ Test 5: SCENARIO_HEADON_SINGLE_LINE injected successfully');

  // Test 6: Scenario 5 - Cascading Freight Backup
  const res5 = simulator.injectScenario('SCENARIO_CASCADING_FREIGHT_BACKUP');
  assert.strictEqual(res5.status, 'SUCCESS', 'Cascading Freight Backup must succeed');
  console.log('✓ Test 6: SCENARIO_CASCADING_FREIGHT_BACKUP injected successfully');

  // Test 7: Conflict Resolution State Machine (HOLD)
  simulator.injectScenario('SCENARIO_OVERTAKE');
  await simulator.step(); // Triggers detection -> ACTIVE
  
  const activeConf = simulator.activeConflicts[0];
  assert(activeConf, 'Must detect active conflict');
  assert.strictEqual(activeConf.status, 'ACTIVE');

  // Apply Option A (HOLD)
  const holdDecision = simulator.applyOperatorDecision(activeConf.conflict_id, {
    option_id: 'OPTION_A_HOLD',
    title: 'Option A — Pre-emptive Hold',
    action_type: 'HOLD',
    target_train_number: 'BCN-489',
    hold_duration_mins: 4
  });

  assert.strictEqual(holdDecision.status, 'SUCCESS');
  assert.strictEqual(holdDecision.conflict_status, 'RESOLVING');
  console.log('✓ Test 7: Conflict Lifecycle transitioned to RESOLVING for HOLD');

  // Test 8: Conflict Resolution State Machine (REROUTE physical loop move)
  simulator.injectScenario('SCENARIO_OVERTAKE');
  await simulator.step();
  const activeConf2 = simulator.activeConflicts[0];
  
  const rerouteDecision = simulator.applyOperatorDecision(activeConf2.conflict_id, {
    option_id: 'OPTION_C_REROUTE',
    title: 'Option C — Track/Platform Diversion',
    action_type: 'REROUTE',
    target_train_number: 'BCN-489'
  });

  assert.strictEqual(rerouteDecision.status, 'SUCCESS');
  const freightRun = query("SELECT tr.* FROM train_runs tr JOIN trains t ON tr.train_id=t.train_id WHERE t.number='BCN-489'")[0];
  assert(freightRun.current_block_id.endsWith('-LOOP'), 'Train must be moved to loop block');
  assert.strictEqual(freightRun.speed_kmh, 30, 'Turnout speed must be 30 km/h');
  console.log('✓ Test 8: REROUTE physically moved train to loop line block and capped speed');

  // Test 9: Reset Scenario
  const resReset = simulator.injectScenario('RESET');
  assert.strictEqual(resReset.status, 'SUCCESS');
  console.log('✓ Test 9: RESET scenario succeeded');

  console.log('\nALL 9 BACKEND INTEGRATION & SCENARIO TESTS PASSED!');
}

runTests().catch(err => {
  console.error('Test failure:', err);
  process.exit(1);
});
