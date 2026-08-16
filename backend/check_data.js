require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// 创建Supabase客户端
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkData() {
  try {
    console.log('正在查询user_data表...');
    
    // 直接查询user_data表，使用service_role_key应该可以绕过RLS
    const { data, error } = await supabase
      .from('user_data')
      .select('*')
      .eq('type', 'song_review')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ 查询数据时出错:', error);
      return;
    }
    
    console.log('✅ 查询成功，返回数据数量:', data.length);
    console.log('📋 数据详情:', data);
    
    // 尝试使用anon key查询，模拟前端的情况
    console.log('\n🔍 尝试使用anon key查询...');
    const anonSupabase = createClient(
      process.env.SUPABASE_URL,
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hcnJwZW1ncmp2a3ZiZHF3b2p2ciIsInR5cGUiOiJhbm9uIiwiaWF0IjoxNzU5Mzk5MDExLCJleHAiOjE3OTA5NTY2MTF9.AAA' // 这里使用的是模拟的anon key，实际应该使用正确的anon key
    );
    
    const { data: anonData, error: anonError } = await anonSupabase
      .from('user_data')
      .select('*')
      .eq('type', 'song_review')
      .order('created_at', { ascending: false });
    
    if (anonError) {
      console.error('❌ 使用anon key查询时出错:', anonError);
      console.log('⚠️  这可能是导致前端无法获取数据的原因！');
    } else {
      console.log('✅ 使用anon key查询成功，返回数据数量:', anonData.length);
    }
  } catch (error) {
    console.error('❌ 检查过程中发生异常:', error);
  }
}

checkData();