// ========================================
// KANBAN PAGE LOGIC
// ========================================

let currentUser = null;
let bugsSubscription = null;

// Initialize page
(async () => {
    showLoading('Carregando bugs...');

    // Initialize page with auth check and navigation (DEV and ADM only)
    const profile = await initPage(['DEV', 'ADM']);
    if (!profile) return;

    currentUser = profile;

    // Load bugs
    await loadBugs();

    // Subscribe to real-time updates
    subscribeToUpdates();

    // Initialize browser notifications for DEV users
    if (profile.role === 'DEV') {
        initDevNotifications();
    }

    hideLoading();
})();

// ========================================
// LOAD BUGS
// ========================================

async function loadBugs() {
    try {
        // Load bugs with their images
        const { data: bugs, error } = await supabaseClient
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
            <div class="bug-card" 
                 draggable="true" 
                 data-bug-id="${bug.id}"
                 data-bug-status="${bug.status}"
                 ondragstart="handleDragStart(event)"
                 ondragend="handleDragEnd(event)"
                 onclick="openBugModal('${bug.id}')">
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

    // Setup drop zones after rendering
    setupDropZones();
}

// ========================================
// BUG MODAL
// ========================================

let currentBugData = null;

async function openBugModal(bugId) {
    showLoading('Carregando detalhes...');

    try {
        const { data: bug, error } = await supabaseClient
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

        // Fetch reporter profile for additional info
        let reporterProfile = null;
        try {
            const { data: profile } = await supabaseClient
                .from('users_profile')
                .select('*')
                .eq('id', bug.reporter_id)
                .single();
            reporterProfile = profile;
        } catch (e) {
            console.log('Could not fetch reporter profile');
        }

        // Render modal content
        document.getElementById('bugModalContent').innerHTML = `
            <div style="margin-bottom: 1.5rem;">
                <div class="reporter-clickable" 
                     style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; cursor: pointer; padding: 0.5rem; border-radius: 8px; transition: background 0.2s;"
                     onclick="event.stopPropagation(); openReporterProfile('${bug.reporter_id}')"
                     onmouseover="this.style.background='rgba(255,255,255,0.05)'"
                     onmouseout="this.style.background='transparent'">
                    <div class="bug-card-reporter-avatar" style="width: 40px; height: 40px; font-size: 1rem; ${reporterProfile?.photo_url ? 'padding: 0; overflow: hidden;' : ''}">
                        ${reporterProfile?.photo_url ? `<img src="${reporterProfile.photo_url}" style="width: 100%; height: 100%; object-fit: cover;">` : getInitials(bug.reporter_name)}
                    </div>
                    <div style="flex: 1;">
                        <p style="font-weight: 500; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.5rem;">
                            ${bug.reporter_name}
                            <span style="font-size: 0.75rem; color: var(--text-muted);">👆 Ver perfil</span>
                        </p>
                        <p class="text-muted" style="font-size: 0.875rem;">${formatDate(bug.created_at)}</p>
                    </div>
                </div>
                
                <div style="margin-bottom: 1.5rem;">
                    <h4 style="margin-bottom: 0.5rem; font-size: 0.875rem; color: var(--text-muted);">🐛 DESCRIÇÃO DO BUG</h4>
                    <div style="padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px; border-left: 3px solid var(--danger);">
                        <p style="white-space: pre-wrap; line-height: 1.6;">${escapeHtml(bug.description)}</p>
                    </div>
                </div>

                ${bug.expected_behavior ? `
                    <div style="margin-bottom: 1.5rem;">
                        <h4 style="margin-bottom: 0.5rem; font-size: 0.875rem; color: var(--text-muted);">✅ COMPORTAMENTO ESPERADO</h4>
                        <div style="padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px; border-left: 3px solid var(--success);">
                            <p style="white-space: pre-wrap; line-height: 1.6;">${escapeHtml(bug.expected_behavior)}</p>
                        </div>
                    </div>
                ` : ''}

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
// REPORTER PROFILE POPUP
// ========================================

async function openReporterProfile(reporterId) {
    showLoading('Carregando perfil...');

    try {
        const { data: profile, error } = await supabaseClient
            .from('users_profile')
            .select('*')
            .eq('id', reporterId)
            .single();

        if (error) throw error;

        // Create profile popup
        const existingPopup = document.querySelector('.profile-popup');
        if (existingPopup) existingPopup.remove();

        const popup = document.createElement('div');
        popup.className = 'profile-popup';
        popup.innerHTML = `
            <div class="profile-popup-content">
                <button class="profile-popup-close" onclick="closeReporterProfile()">×</button>
                
                <div class="profile-popup-avatar">
                    ${profile.photo_url
                ? `<img src="${profile.photo_url}" alt="${profile.name}">`
                : `<span>${getInitials(profile.name)}</span>`
            }
                </div>
                
                <h3 class="profile-popup-name">${profile.name}</h3>
                <span class="profile-popup-role ${profile.role.toLowerCase()}">${profile.role}</span>
                
                <div class="profile-popup-info">
                    <div class="profile-popup-item">
                        <span class="profile-popup-icon">📧</span>
                        <span>${profile.email}</span>
                    </div>
                    
                    ${profile.whatsapp ? `
                        <a href="https://wa.me/55${profile.whatsapp.replace(/\D/g, '')}" 
                           target="_blank" 
                           class="profile-popup-whatsapp">
                            <span class="profile-popup-icon">📱</span>
                            <span>+55 ${profile.whatsapp}</span>
                            <span class="whatsapp-badge">💬 Abrir WhatsApp</span>
                        </a>
                    ` : `
                        <div class="profile-popup-item text-muted">
                            <span class="profile-popup-icon">📱</span>
                            <span>WhatsApp não cadastrado</span>
                        </div>
                    `}
                </div>
            </div>
        `;

        document.body.appendChild(popup);

        // Animate in
        requestAnimationFrame(() => {
            popup.classList.add('active');
        });

    } catch (error) {
        console.error('Error loading profile:', error);
        showToast('Erro ao carregar perfil', 'error');
    }

    hideLoading();
}

function closeReporterProfile() {
    const popup = document.querySelector('.profile-popup');
    if (popup) {
        popup.classList.remove('active');
        setTimeout(() => popup.remove(), 300);
    }
}

// ========================================
// BUG ACTIONS
// ========================================

async function resolveBug(bugId) {
    try {
        const { error } = await supabaseClient
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
        const { error } = await supabaseClient
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
    bugsSubscription = supabaseClient
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

// ========================================
// DRAG AND DROP
// ========================================

let draggedBugId = null;

function handleDragStart(event) {
    const card = event.target.closest('.bug-card');
    if (!card) return;

    draggedBugId = card.dataset.bugId;
    card.classList.add('dragging');

    // Set drag data
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', draggedBugId);

    // Add visual feedback to columns
    document.querySelectorAll('.kanban-cards').forEach(zone => {
        zone.classList.add('drop-zone');
    });
}

function handleDragEnd(event) {
    const card = event.target.closest('.bug-card');
    if (card) {
        card.classList.remove('dragging');
    }

    draggedBugId = null;

    // Remove visual feedback from columns
    document.querySelectorAll('.kanban-cards').forEach(zone => {
        zone.classList.remove('drop-zone', 'drag-over');
    });
}

function setupDropZones() {
    const pendingZone = document.getElementById('pendingBugs');
    const resolvedZone = document.getElementById('resolvedBugs');

    [pendingZone, resolvedZone].forEach(zone => {
        if (!zone) return;

        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            zone.classList.add('drag-over');
        });

        zone.addEventListener('dragleave', (e) => {
            // Only remove drag-over if actually leaving the zone
            if (!zone.contains(e.relatedTarget)) {
                zone.classList.remove('drag-over');
            }
        });

        zone.addEventListener('drop', async (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');

            const bugId = e.dataTransfer.getData('text/plain');
            if (!bugId) return;

            const newStatus = zone.id === 'resolvedBugs' ? 'RESOLVIDO' : 'PENDENTE';
            const currentCard = document.querySelector(`[data-bug-id="${bugId}"]`);
            const currentStatus = currentCard?.dataset.bugStatus;

            // Only update if status is changing
            if (currentStatus !== newStatus) {
                await updateBugStatus(bugId, newStatus);
            }
        });
    });
}

async function updateBugStatus(bugId, newStatus) {
    showLoading('Atualizando status...');

    try {
        const updateData = {
            status: newStatus,
            updated_at: new Date().toISOString()
        };

        // If resolving, add resolved info
        if (newStatus === 'RESOLVIDO') {
            updateData.resolved_by = currentUser.id;
            updateData.resolved_at = new Date().toISOString();
        } else {
            // If reopening, clear resolved info
            updateData.resolved_by = null;
            updateData.resolved_at = null;
        }

        const { error } = await supabaseClient
            .from('bugs')
            .update(updateData)
            .eq('id', bugId);

        if (error) throw error;

        showToast(newStatus === 'RESOLVIDO' ? 'Bug marcado como resolvido!' : 'Bug reaberto!', 'success');
        await loadBugs();

    } catch (error) {
        console.error('Error updating bug status:', error);
        showToast('Erro ao atualizar status do bug', 'error');
    }

    hideLoading();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (bugsSubscription) {
        supabaseClient.removeChannel(bugsSubscription);
    }
});
