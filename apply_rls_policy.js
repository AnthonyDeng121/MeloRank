require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// 创建Supabase客户端
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyRLSPolicy() {
  try {
    console.log('正在应用RLS策略...');
    
    // 读取RLS策略SQL文件
    const fs = require('fs');
    const sql = fs.readFileSync('rls_policy.sql', 'utf8');
    
    // 执行SQL命令
    const { error } = await supabase.rpc('execute_sql', {
      sql: sql
    });
    
    if (error) {
      console.error('❌ 应用RLS策略时出错:', error);
      return;
    }
    
    console.log('✅ RLS策略应用成功！');
    console.log('策略内容:', sql);
  } catch (error) {
    console.error('❌ 应用RLS策略时发生异常:', error);
  }
}

applyRLSPolicy();