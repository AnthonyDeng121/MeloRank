require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// 创建Supabase客户端
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRLSStatus() {
  try {
    console.log('正在检查user_data表的RLS状态...');
    
    // 检查表的RLS状态
    const { data: tableStatus, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name, is_row_level_security_enabled')
      .eq('table_schema', 'public')
      .eq('table_name', 'user_data')
      .single();
    
    if (tableError) {
      console.error('❌ 检查表状态时出错:', tableError);
      return;
    }
    
    console.log('📋 表状态:', tableStatus);
    
    // 检查现有策略
    const { data: policies, error: policiesError } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('schemaname', 'public')
      .eq('tablename', 'user_data');
    
    if (policiesError) {
      console.error('❌ 检查策略时出错:', policiesError);
      return;
    }
    
    console.log('📋 现有策略:', policies);
    
    // 尝试直接查询数据
    console.log('\n🔍 尝试直接查询数据...');
    const { data: reviews, error: selectError } = await supabase
      .from('user_data')
      .select('*')
      .eq('type', 'song_review')
      .order('created_at', { ascending: false });
    
    if (selectError) {
      console.error('❌ 查询数据时出错:', selectError);
      return;
    }
    
    console.log('✅ 查询成功，数据数量:', reviews.length);
    console.log('📋 部分数据示例:', reviews.slice(0, 2));
  } catch (error) {
    console.error('❌ 检查过程中发生异常:', error);
  }
}

checkRLSStatus();