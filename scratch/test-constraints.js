const { getDb } = require('../server/src/db/database');
const { validateEntry } = require('../server/src/engine/constraintEngine');

async function test() {
  const db = await getDb();
  const cse1 = await db.get("SELECT * FROM student_groups WHERE name = 'CSE1'");
  const cse2 = await db.get("SELECT * FROM student_groups WHERE name = 'CSE2'");
  const comp = await db.get("SELECT * FROM course_components LIMIT 1");
  const teachers = await db.all("SELECT * FROM teachers");
  const rooms = await db.all("SELECT * FROM rooms");
  const slotP5 = await db.get("SELECT * FROM time_slots WHERE day = 'Thu' AND period = 5");
  const slotP6 = await db.get("SELECT * FROM time_slots WHERE day = 'Thu' AND period = 6");

  console.log('Slot P5:', slotP5);
  console.log('Slot P6:', slotP6);

  // Test 1: Validate 2h lab for CSE1 at P5
  const res1 = await validateEntry({
    class_id: 6,
    course_component_id: comp.id,
    teacher_id: teachers[0].id,
    room_id: rooms[0].id,
    time_slot_id: slotP5.id,
    group_id: cse1.id,
    duration_hours: 2,
  });
  console.log('Test 1 (CSE1 2h at P5):', res1);

  // Test 2: Validate 1h lab for CSE2 at P5 with different teacher and room
  const res2 = await validateEntry({
    class_id: 6,
    course_component_id: comp.id,
    teacher_id: teachers[1].id,
    room_id: rooms[1].id,
    time_slot_id: slotP5.id,
    group_id: cse2.id,
    duration_hours: 1,
  });
  console.log('Test 2 (CSE2 1h at P5):', res2);

  // Test 3: Validate 1h lab for CSE2 at P6 with different teacher and room
  const res3 = await validateEntry({
    class_id: 6,
    course_component_id: comp.id,
    teacher_id: teachers[1].id,
    room_id: rooms[1].id,
    time_slot_id: slotP6.id,
    group_id: cse2.id,
    duration_hours: 1,
  });
  console.log('Test 3 (CSE2 1h at P6):', res3);
}

test().catch(console.error);
