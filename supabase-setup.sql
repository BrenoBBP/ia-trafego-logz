-- ============================================
-- SUPABASE SETUP SCRIPT
-- Sistema de Relatório de Bugs
-- ============================================
-- Execute este script no SQL Editor do Supabase
-- (Dashboard > SQL Editor > New Query)
-- ============================================

-- 1. Criar tabela de perfis de usuários
CREATE TABLE IF NOT EXISTS users_profile (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADM', 'DEV', 'COLABORADOR')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Criar tabela de bugs
CREATE TABLE IF NOT EXISTS bugs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT, 
    description TEXT NOT NULL,
    expected_behavior TEXT,
    status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'RESOLVIDO')),
    reporter_id UUID REFERENCES users_profile(id),
    reporter_name TEXT NOT NULL,
    resolved_by UUID REFERENCES users_profile(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Criar tabela de imagens dos bugs
CREATE TABLE IF NOT EXISTS bug_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bug_id UUID REFERENCES bugs(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Habilitar Row Level Security (RLS)
ALTER TABLE users_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE bugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bug_images ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de acesso para users_profile
-- Usuários autenticados podem ver todos os perfis
CREATE POLICY "Authenticated users can view all profiles" ON users_profile
    FOR SELECT
    TO authenticated
    USING (true);

-- Usuários podem atualizar seu próprio perfil
CREATE POLICY "Users can update own profile" ON users_profile
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

-- Qualquer usuário autenticado pode inserir perfis (para criação de usuários)
CREATE POLICY "Authenticated users can insert profiles" ON users_profile
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Usuários podem deletar perfis (ADM apenas via lógica do app)
CREATE POLICY "Authenticated users can delete profiles" ON users_profile
    FOR DELETE
    TO authenticated
    USING (true);

-- 6. Políticas de acesso para bugs
-- Usuários autenticados podem ver todos os bugs
CREATE POLICY "Authenticated users can view all bugs" ON bugs
    FOR SELECT
    TO authenticated
    USING (true);

-- Usuários autenticados podem criar bugs
CREATE POLICY "Authenticated users can create bugs" ON bugs
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Usuários autenticados podem atualizar bugs (para marcar como resolvido)
CREATE POLICY "Authenticated users can update bugs" ON bugs
    FOR UPDATE
    TO authenticated
    USING (true);

-- 7. Políticas de acesso para bug_images
-- Usuários autenticados podem ver todas as imagens
CREATE POLICY "Authenticated users can view all bug images" ON bug_images
    FOR SELECT
    TO authenticated
    USING (true);

-- Usuários autenticados podem criar imagens
CREATE POLICY "Authenticated users can create bug images" ON bug_images
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- ============================================
-- STORAGE SETUP
-- ============================================
-- Execute esta parte separadamente se necessário

-- 8. Criar bucket para screenshots de bugs
INSERT INTO storage.buckets (id, name, public)
VALUES ('bug-screenshots', 'bug-screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- 9. Políticas de storage
-- Permitir que usuários autenticados façam upload
CREATE POLICY "Authenticated users can upload bug screenshots"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'bug-screenshots');

-- Permitir que qualquer um veja as imagens (bucket público)
CREATE POLICY "Anyone can view bug screenshots"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'bug-screenshots');

-- ============================================
-- REALTIME (opcional - já habilitado por padrão)
-- ============================================
-- Habilitar realtime para a tabela bugs
ALTER PUBLICATION supabase_realtime ADD TABLE bugs;

-- ============================================
-- CRIAR PRIMEIRO USUÁRIO ADM (opcional)
-- ============================================
-- Após criar um usuário via Auth, execute:
-- 
-- INSERT INTO users_profile (id, name, email, role)
-- VALUES (
--     'SEU_USER_ID_AQUI',  -- Pegue do Auth > Users
--     'Admin',
--     'admin@email.com',
--     'ADM'
-- );

-- ============================================
-- FIM DO SETUP
-- ============================================
