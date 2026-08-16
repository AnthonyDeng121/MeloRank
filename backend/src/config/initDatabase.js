// 确保先加载环境变量
require('dotenv').config();

const supabase = require('./supabase');

// 初始化数据库表结构
const initDatabase = async () => {
  try {
    console.log('开始初始化数据库表结构...');

    // 1. 创建 users 表
    const createUsersTable = await supabase.rpc('sql', {
      query: `
        CREATE TABLE IF NOT EXISTS public.users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          username VARCHAR NOT NULL,
          email VARCHAR NOT NULL UNIQUE,
          password VARCHAR NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `
    });

    console.log('✅ users 表创建成功');

    // 2. 创建 user_data 表
    const createUserDataTable = await supabase.rpc('sql', {
      query: `
        CREATE TABLE IF NOT EXISTS public.user_data (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
          type VARCHAR NOT NULL,
          data JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `
    });

    console.log('✅ user_data 表创建成功');

    // 3. 为 user_data 表创建索引
    const createIndex = await supabase.rpc('sql', {
      query: `
        CREATE INDEX IF NOT EXISTS idx_user_data_user_id ON public.user_data(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_data_type ON public.user_data(type);
      `
    });

    console.log('✅ 索引创建成功');

    console.log('🎉 数据库初始化完成！');
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error.message);
    console.error('详细错误:', error);
  }
};

// 如果直接运行此脚本，则执行初始化
if (require.main === module) {
  initDatabase();
}

module.exports = initDatabase;