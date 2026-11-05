import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

async function migrate() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env file.');
    process.exit(1);
  }

  console.log(`Connecting to Supabase at: ${supabaseUrl}`);
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const dbPath = path.resolve(process.cwd(), 'data', 'database.json');
  if (!fs.existsSync(dbPath)) {
    console.error(`❌ Local database file not found at: ${dbPath}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(dbPath, 'utf-8');
  const jsonData = JSON.parse(rawData);

  console.log('📦 Local database summary:');
  console.log(` - Admin: ${jsonData.admin ? jsonData.admin.email : 'None'}`);
  console.log(` - Candidates: ${jsonData.candidates ? jsonData.candidates.length : 0}`);
  console.log(` - Courses: ${jsonData.courses ? jsonData.courses.length : 0}`);
  console.log(` - Batches: ${jsonData.batches ? jsonData.batches.length : 0}`);
  console.log(` - Tutors: ${jsonData.tutors ? jsonData.tutors.length : 0}`);
  console.log(` - Meetings: ${jsonData.meetingSessions ? jsonData.meetingSessions.length : 0}`);
  console.log(` - Attendance Records: ${jsonData.attendance ? jsonData.attendance.length : 0}`);

  console.log('\n🚀 Uploading local database to Supabase table "lms_state"...');

  const { data, error } = await supabase.from('lms_state').upsert(
    {
      id: 'primary',
      data: jsonData,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  ).select();

  if (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.code === '42P01' || error.message.includes('relation "lms_state" does not exist') || error.message.includes('not found')) {
      console.error('\n⚠️ The "lms_state" table does not exist in your Supabase database yet.');
      console.error('Please run the following SQL in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql):\n');
      console.error(`CREATE TABLE IF NOT EXISTS public.lms_state (
  id TEXT PRIMARY KEY DEFAULT 'primary',
  data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::TEXT, now()) NOT NULL
);

ALTER TABLE public.lms_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to lms_state" ON public.lms_state;
CREATE POLICY "Allow all access to lms_state"
  ON public.lms_state
  FOR ALL
  USING (true)
  WITH CHECK (true);`);
    }
    process.exit(1);
  }

  console.log('✅ Migration succeeded! Supabase response:');
  console.log(data);

  // Verification step
  console.log('\n🔍 Verifying data from Supabase...');
  const verifyRes = await supabase.from('lms_state').select('id, updated_at, data').eq('id', 'primary').single();
  if (verifyRes.error) {
    console.error('❌ Verification failed:', verifyRes.error.message);
  } else {
    const verifiedData = verifyRes.data.data;
    console.log(`✅ Verified! Candidates in Supabase: ${verifiedData.candidates?.length}, Courses: ${verifiedData.courses?.length}`);
    console.log(`Last updated: ${verifyRes.data.updated_at}`);
  }
}

migrate().catch((err) => {
  console.error('Fatal error during migration:', err);
  process.exit(1);
});

