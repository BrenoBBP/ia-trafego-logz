// ========================================
// KANBAN PAGE LOGIC
// ========================================

let currentUser = null;
let bugsSubscription = null;

// Initialize page
(async () => {
    showLoading('Carregando bugs...');

    // Check auth and role
    const profile = await requireRole(['DEV', 'ADM']);
    if (!profile) return;

    currentUser = profile;

    // Update user info in header
    document.getElementById('userName').textContent = profile.name;
    const roleEl = document.getElementById('userRole');
    roleEl.textContent = profile.role;
    roleEl.classList.add(profile.role.toLowerCase());

    // Show users nav for ADM
    if (profile.role === 'ADM') {
        document.getElementById('usersNavItem').classList.remove('hidden');
    }

    // Load bugs
    await loadBugs();

    // Subscribe to real-time updates
    subscribeToUpdates();

    hideLoading();
})();

// ========================================
// LOAD BUGS
// ========================================

async function loadBugs() {
    try {
        // Load bugs with their images
        const { data: bugs, error } = await supabase
            .from('bugs')
            .select(`
                *,
                bug_images (
                    id,
                    image_url
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Separate by status
        const pending = bugs.filter(b => b.status === 'PENDENTE');
        const resolved = bugs.filter(b => b.status === 'RESOLVIDO');

        // Render columns
        renderBugCards('pendingBugs', pending);
        renderBugCards('resolvedBugs', resolved);

        // Update counts
        document.getElementById('pendingCount').textContent = pending.length;
        document.getElementById('resolvedCount').textContent = resolved.length;

        // Update last update time
        document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString('pt-BR');

    } catch (error) {
        console.error('Error loading bugs:', error);
        showToast('Erro ao carregar bugs', 'error');
    }
}

// ========================================
// RENDER BUG CARDS
// ========================================

function renderBugCards(containerId, bugs) {
    const container = document.getElementById(containerId);

    if (bugs.length === 0) {
        const isResolved = containerId === 'resolvedBugs';
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">${isResolved ? '📭' : '🎉'}</div>
                <h4 class="empty-state-title">${isResolved ? 'Nenhum bug resolvido' : 'Nenhum bug pendente'}</h4>
                <p class="empty-state-text">${isResolved ? 'Os bugs resolvidos aparecerão aqui.' : 'Todos os bugs foram resolvidos!'}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = bugs.map(bug => {
        const images = bug.bug_images || [];
        const initials = getInitials(bug.reporter_name);

        return `
            <div class="bug-card" onclick="openBugModal('${bug.id}')">
                <div class="bug-card-header">
                    <div class="bug-card-reporter">
                        <div class="bug-card-reporter-avatar">${initials}</div>
                        <span>${bug.reporter_name}</span>
                    </div>
                    <span class="bug-card-date">${formatRelativeTime(bug.created_at)}</span>
                </div>
                
                <p class="bug-card-description">${escapeHtml(bug.description)}</p>
                
                ${images.length > 0 ? `
                    <div class="bug-card-images">
                        ${images.slice(0, 4).map(img => `
                            <img 
                                src="${img.image_url}" 
                                alt="Screenshot" 
                                class="bug-card-image"
                                onclick="event.stopPropagation(); openLightbox('${img.image_url}')"
                            >
                        `).join('')}
                        ${images.length > 4 ? `<span class="text-muted" style="align-self: center;">+${images.length - 4}</span>` : ''}
                    </div>
                ` : ''}
                
                ${bug.status === 'PENDENTE' ? `
                    <div class="bug-card-footer">
                        <button class="btn btn-success btn-sm" onclick="event.stopPropagation(); resolveBug('${bug.id}')">
                            ✓ Marcar Resolvido
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

// ========================================
// BUG MODAL
// ========================================

let currentBugData = null;

async function openBugModal(bugId) {
    showLoading('Carregando detalhes...');

    try {
        const { data: bug, error } = await supabase
            .from('bugs')
            .select(`
                *,
                bug_images (
                    id,
                    image_url
                )
            `)
            .eq('id', bugId)
            .single();

        if (error) throw error;

        currentBugData = bug;
        const images = bug.bug_images || [];

        // Render modal content
        document.getElementById('bugModalContent').innerHTML = `
            <div style="margin-bottom: 1.5rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;">
                    <div class="bug-card-reporter-avatar" style="width: 40px; height: 40px; font-size: 1rem;">
                        ${getInitials(bug.reporter_name)}
                    </div>
                    <div>
                        <p style="font-weight: 500; margin-bottom: 0.25rem;">${bug.reporter_name}</p>
                        <p class="text-muted" style="font-size: 0.875rem;">${formatDate(bug.created_at)}</p>
                    </div>
                </div>
                
                <div style="padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px; margin-bottom: 1.5rem;">
                    <p style="white-space: pre-wrap; line-height: 1.6;">${escapeHtml(bug.description)}</p>
                </div>

                ${images.length > 0 ? `
                    <div>
                        <h4 style="margin-bottom: 0.75rem; font-size: 0.875rem; color: var(--text-muted);">SCREENSHOTS (${images.length})</h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 0.75rem;">
                            ${images.map(img => `
                                <img 
                                    src="${img.image_url}" 
                                    alt="Screenshot" 
                                    style="width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: 8px; cursor: pointer; border: 1px solid var(--border-color);"
                                    onclick="openLightbox('${img.image_url}')"
                                >
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${bug.status === 'RESOLVIDO' ? `
                    <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 8px;">
                        <p class="text-success" style="font-weight: 500;">
                            ✅ Bug resolvido em ${formatDate(bug.resolved_at)}
                        </p>
                    </div>
                ` : ''}
            </div>
        `;

        // Render modal footer
        document.getElementById('bugModalFooter').innerHTML = bug.status === 'PENDENTE' ? `
            <button class="btn btn-ghost" onclick="closeBugModal()">Fechar</button>
            <button class="btn btn-success" onclick="resolveBug('${bug.id}'); closeBugModal();">
                ✓ Marcar como Resolvido
            </button>
        ` : `
            <button class="btn btn-ghost" onclick="closeBugModal()">Fechar</button>
            <button class="btn btn-danger" onclick="reopenBug('${bug.id}'); closeBugModal();">
                ↩ Reabrir Bug
            </button>
        `;

        // Show modal
        document.getElementById('bugModal').classList.add('active');

    } catch (error) {
        console.error('Error loading bug details:', error);
        showToast('Erro ao carregar detalhes do bug', 'error');
    } finally {
        hideLoading();
    }
}

function closeBugModal() {
    document.getElementById('bugModal').classList.remove('active');
    currentBugData = null;
}

// Close modal on backdrop click
document.getElementById('bugModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('bugModal')) {
        closeBugModal();
    }
});

// ========================================
// BUG ACTIONS
// ========================================

async function resolveBug(bugId) {
    try {
        const { error } = await supabase
            .from('bugs')
            .update({
                status: 'RESOLVIDO',
                resolved_by: currentUser.id,
                resolved_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', bugId);

        if (error) throw error;

        showToast('Bug marcado como resolvido! ✅', 'success');
        await loadBugs();

    } catch (error) {
        console.error('Error resolving bug:', error);
        showToast('Erro ao resolver bug', 'error');
    }
}

async function reopenBug(bugId) {
    try {
        const { error } = await supabase
            .from('bugs')
            .update({
                status: 'PENDENTE',
                resolved_by: null,
                resolved_at: null,
                updated_at: new Date().toISOString()
            })
            .eq('id', bugId);

        if (error) throw error;

        showToast('Bug reaberto', 'warning');
        await loadBugs();

    } catch (error) {
        console.error('Error reopening bug:', error);
        showToast('Erro ao reabrir bug', 'error');
    }
}

// ========================================
// REAL-TIME UPDATES
// ========================================

function subscribeToUpdates() {
    bugsSubscription = supabase
        .channel('bugs_channel')
        .on('postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'bugs'
            },
            (payload) => {
                console.log('Bug update received:', payload);
                loadBugs(); // Reload all bugs on any change
            }
        )
        .subscribe();
}

// ========================================
// UTILITIES
// ========================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (bugsSubscription) {
        supabase.removeChannel(bugsSubscription);
    }
});
