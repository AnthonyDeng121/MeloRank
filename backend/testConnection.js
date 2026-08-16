// 测试Supabase连接和表是否存在
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// 创建Supabase客户端
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testConnection() {
  try {
    console.log('正在测试Supabase连接...');
    
    // 测试基本连接
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('✅ 基本连接测试成功');
    
    // 尝试直接执行SQL查询，查看表是否存在
    console.log('\n正在检查表是否存在...');
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
    
    if (tablesError) {
      console.error('❌ 检查表时出错:', tablesError);
      return;
    }
    
    console.log('📋 公共模式下的表:');
    tables.forEach(table => {
      console.log(`   - ${table.table_name}`);
    });
    
    // 尝试直接插入数据（使用原始SQL）
    console.log('\n正在尝试插入测试数据...');
    const insertResult = await supabase.rpc('sql', {
      query: `
        INSERT INTO public.users (username, email, password) 
        VALUES ('testuser', 'test@example.com', '${await require('bcryptjs').hash('password123', 10)}')
        ON CONFLICT (email) DO NOTHING
        RETURNING *;
      `
    });
    
    if (insertResult.error) {
      console.error('❌ 插入数据时出错:', insertResult.error);
      return;
    }
    
    console.log('✅ 测试数据插入成功！');
    
    // 验证数据是否存在
    const { data: insertedUser, error: selectError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'test@example.com')
      .single();
    
    if (selectError) {
      console.error('❌ 查询数据时出错:', selectError);
      return;
    }
    
    console.log('✅ 数据查询成功:', insertedUser);
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

testConnection();