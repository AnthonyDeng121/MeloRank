-- 允许所有用户读user_data表
CREATE POLICY "allow_select_for_all" ON user_data FOR SELECT USING (true);

-- 允许所有用户写user_data表
CREATE POLICY "allow_insert_for_all" ON user_data FOR INSERT WITH CHECK (true);