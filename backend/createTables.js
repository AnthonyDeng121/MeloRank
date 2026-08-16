// 直接使用SQL创建表
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// 创建Supabase客户端
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTables() {
  try {
    console.log('开始创建数据库表...');

    // 1. 创建 users 表
    const createUsersTable = await supabase
      .rpc('execute_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS users (
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
    const createUserDataTable = await supabase
      .rpc('execute_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS user_data (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR NOT NULL,
            data JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
          );
        `
      });

    console.log('✅ user_data 表创建成功');

    // 3. 尝试插入测试数据
    const insertUser = await supabase
      .rpc('execute_sql', {
        sql: `
          INSERT INTO users (username, email, password)
          VALUES ('testuser', 'test@example.com', '${await require('bcryptjs').hash('password123', 10)}')
          ON CONFLICT (email) DO NOTHING;
        `
      });

    console.log('✅ 测试用户创建成功');

    // 4. 验证数据
    const verifyUser = await supabase
      .rpc('execute_sql', {
        sql: `SELECT * FROM users WHERE email = 'test@example.com';`
      });

    console.log('✅ 数据验证成功');
    console.log('🎉 数据库表创建完成！');

  } catch (error) {
    console.error('❌ 出错了:', error);
    // 尝试使用另一种方式创建表
    try {
      console.log('\n🔄 尝试使用另一种方式创建表...');
      
      // 使用 Supabase 的 REST API 直接创建表（这种方式适用于新的 Supabase 项目）
      const { data: usersTable, error: usersError } = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/rpc/execute_sql`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY
          },
          body: JSON.stringify({
            sql: `
              CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                username VARCHAR NOT NULL,
                email VARCHAR NOT NULL UNIQUE,
                password VARCHAR NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
              );
              
              CREATE TABLE IF NOT EXISTS user_data (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR NOT NULL,
                data JSONB NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
              );
            `
          })
        }
      );

      if (usersError) {
        throw usersError;
      }

      console.log('✅ 使用REST API创建表成功！');
    } catch (restError) {
      console.error('❌ REST API创建表失败:', restError);
      console.log('\n💡 建议：请登录Supabase控制台，手动创建以下表：');
      console.log('\n1. users表：');
      console.log('   - id: UUID (Primary Key, Default: gen_random_uuid())');
      console.log('   - username: VARCHAR (Not Null)');
      console.log('   - email: VARCHAR (Not Null, Unique)');
      console.log('   - password: VARCHAR (Not Null)');
      console.log('   - created_at: TIMESTAMPTZ (Not Null, Default: now())');
      console.log('   - updated_at: TIMESTAMPTZ (Not Null, Default: now())');
      
      console.log('\n2. user_data表：');
      console.log('   - id: UUID (Primary Key, Default: gen_random_uuid())');
      console.log('   - user_id: UUID (Not Null, Foreign Key to users.id)');
      console.log('   - type: VARCHAR (Not Null)');
      console.log('   - data: JSONB (Not Null)');
      console.log('   - created_at: TIMESTAMPTZ (Not Null, Default: now())');
      console.log('   - updated_at: TIMESTAMPTZ (Not Null, Default: now())');
    }
  }
}

createTables();