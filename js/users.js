// ========================================
// USER MANAGEMENT PAGE LOGIC
// ========================================

let currentUser = null;
let editingUserId = null;

// Initialize page
(async () => {
    showLoading('Carregando usuários...');

    // Initialize page with auth check and navigation (ADM only)
    const profile = await initPage(['ADM']);
    if (!profile) return;

    currentUser = profile;

    // Load users
    await loadUsers();

    hideLoading();
})();

// ========================================
// LOAD USERS
// ========================================

async function loadUsers() {
    try {
        const { data: users, error } = await supabaseClient
            .from('users_profile')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        renderUsersTable(users);

    } catch (error) {
        console.error('Error loading users:', error);
        showToast('Erro ao carregar usuários', 'error');
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');

    if (users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted" style="padding: 2rem;">
                    Nenhum usuário cadastrado
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = users.map(user => {
        const isCurrentUser = user.id === currentUser.id;

        return `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div class="bug-card-reporter-avatar" style="width: 32px; height: 32px; font-size: 0.75rem;">
                            ${getInitials(user.name)}
                        </div>
                        <span style="color: var(--text-primary);">${user.name}</span>
                        ${isCurrentUser ? '<span class="text-muted" style="font-size: 0.75rem;">(você)</span>' : ''}
                    </div>
                </td>
                <td>${user.email}</td>
                <td>
                    <span class="user-role ${user.role.toLowerCase()}">${user.role}</span>
                </td>
                <td>${formatDate(user.created_at)}</td>
                <td class="actions">
                    <button class="btn btn-ghost btn-sm" onclick="openEditModal('${user.id}')" title="Editar">
                        ✏️
                    </button>
                    ${!isCurrentUser ? `
                        <button class="btn btn-ghost btn-sm" onclick="openDeleteModal('${user.id}', '${user.name}')" title="Excluir">
                            🗑️
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

// ========================================
// CREATE/EDIT USER MODAL
// ========================================

function openCreateModal() {
    editingUserId = null;
    document.getElementById('modalTitle').textContent = 'Novo Usuário';
    document.getElementById('submitUserBtn').textContent = 'Criar Usuário';
    document.getElementById('userForm').reset();
    document.getElementById('passwordGroup').style.display = 'block';
    document.getElementById('userPassword').required = true;
    document.getElementById('userEmail').disabled = false;
    document.getElementById('userModal').classList.add('active');
}

async function openEditModal(userId) {
    showLoading('Carregando dados...');

    try {
        const { data: user, error } = await supabaseClient
            .from('users_profile')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) throw error;

        editingUserId = userId;
        document.getElementById('modalTitle').textContent = 'Editar Usuário';
        document.getElementById('submitUserBtn').textContent = 'Salvar Alterações';
        document.getElementById('userNameInput').value = user.name;
        document.getElementById('userEmail').value = user.email;
        document.getElementById('userEmail').disabled = true; // Can't change email
        document.getElementById('userRoleSelect').value = user.role;
        document.getElementById('passwordGroup').style.display = 'none';
        document.getElementById('userPassword').required = false;
        document.getElementById('userModal').classList.add('active');

    } catch (error) {
        console.error('Error loading user:', error);
        showToast('Erro ao carregar dados do usuário', 'error');
    } finally {
        hideLoading();
    }
}

function closeUserModal() {
    document.getElementById('userModal').classList.remove('active');
    document.getElementById('userForm').reset();
    editingUserId = null;
}

// Form submission
document.getElementById('userForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('userNameInput').value.trim();
    const email = document.getElementById('userEmail').value.trim();
    const password = document.getElementById('userPassword').value;
    const role = document.getElementById('userRoleSelect').value;

    const submitBtn = document.getElementById('submitUserBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading-spinner" style="width: 16px; height: 16px; border-width: 2px;"></span>';

    try {
        if (editingUserId) {
            // UPDATE existing user
            const { error } = await supabaseClient
                .from('users_profile')
                .update({
                    name: name,
                    role: role,
                    updated_at: new Date().toISOString()
                })
                .eq('id', editingUserId);

            if (error) throw error;

            showToast('Usuário atualizado com sucesso!', 'success');
        } else {
            // Check if supabase auth is available
            if (!supabaseClient || !supabaseClient.auth) {
                throw new Error('Conexão com autenticação não disponível. Faça login novamente.');
            }

            // CREATE new user via Supabase Auth Admin API
            // Note: Using admin.createUser would be better but requires service role key
            // For now, we use signUp with email confirmation disabled in Supabase settings
            const { data: authData, error: authError } = await supabaseClient.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        name: name
                    },
                    emailRedirectTo: window.location.origin + '/index.html'
                }
            });

            if (authError) throw authError;

            // Check if user was actually created (signUp might not create if email exists)
            if (!authData.user) {
                throw new Error('Falha ao criar usuário. Verifique se o email já está cadastrado.');
            }

            // Check if user needs email confirmation
            if (authData.user.identities && authData.user.identities.length === 0) {
                throw new Error('Este email já está cadastrado.');
            }

            // Create profile record
            const { error: profileError } = await supabaseClient
                .from('users_profile')
                .insert({
                    id: authData.user.id,
                    name: name,
                    email: email,
                    role: role
                });

            if (profileError) throw profileError;

            showToast('Usuário criado com sucesso! 🎉', 'success');
        }

        closeUserModal();
        await loadUsers();

    } catch (error) {
        console.error('Error saving user:', error);

        let message = 'Erro ao salvar usuário';

        // Handle specific error messages
        if (error.message) {
            if (error.message.includes('already registered')) {
                message = 'Este email já está cadastrado';
            } else if (error.message.includes('Conexão com autenticação')) {
                message = error.message;
            } else if (error.message.includes('Falha ao criar') || error.message.includes('Este email já')) {
                message = error.message;
            } else if (error.message.includes('Password should be')) {
                message = 'A senha deve ter pelo menos 6 caracteres';
            } else if (error.message.includes('Invalid email')) {
                message = 'Email inválido';
            } else if (error.message.includes('rate limit')) {
                message = 'Muitas tentativas. Aguarde alguns minutos.';
            }
        }

        showToast(message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = editingUserId ? 'Salvar Alterações' : 'Criar Usuário';
    }
});

// ========================================
// DELETE USER MODAL
// ========================================

let deletingUserId = null;

function openDeleteModal(userId, userName) {
    deletingUserId = userId;
    document.getElementById('deleteUserName').textContent = userName;
    document.getElementById('deleteModal').classList.add('active');
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('active');
    deletingUserId = null;
}

document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    if (!deletingUserId) return;

    const btn = document.getElementById('confirmDeleteBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner" style="width: 16px; height: 16px; border-width: 2px;"></span>';

    try {
        // Delete profile (this doesn't delete the auth user, but disables access)
        const { error } = await supabaseClient
            .from('users_profile')
            .delete()
            .eq('id', deletingUserId);

        if (error) throw error;

        showToast('Usuário excluído com sucesso', 'success');
        closeDeleteModal();
        await loadUsers();

    } catch (error) {
        console.error('Error deleting user:', error);
        showToast('Erro ao excluir usuário', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Excluir';
    }
});

// Close modals on backdrop click
document.getElementById('userModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('userModal')) {
        closeUserModal();
    }
});

document.getElementById('deleteModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('deleteModal')) {
        closeDeleteModal();
    }
});
