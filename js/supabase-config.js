// ========================================
// SUPABASE CONFIGURATION
// ========================================

// Supabase credentials
const SUPABASE_URL = 'https://hifffeaitermzwjpupnx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpZmZmZWFpdGVybXp3anB1cG54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MTI4NDIsImV4cCI6MjA4MzI4ODg0Mn0.lGIlgm54NmftRxtMr7hyCd8z3hz2EW3b9QQGVBgfswk';

// Initialize Supabase client - Use the createClient from the global supabase object
// The CDN script exposes the library at window.supabase, we create the client from it
const { createClient } = window.supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Expose as 'supabase' for backward compatibility with other scripts
window.supabase = supabaseClient;

// ========================================
// AUTH HELPERS
// ========================================

/**
 * Get the current authenticated user
 */
async function getCurrentUser() {
    const { data: { user }, error } = await supabaseClient.auth.getUser();
    if (error) {
        console.error('Error getting user:', error);
        return null;
    }
    return user;
}

/**
 * Get the current user's profile with role
 */
async function getCurrentUserProfile() {
    const user = await getCurrentUser();
    if (!user) return null;

    const { data: profile, error } = await supabaseClient
        .from('users_profile')
        .select('*')
        .eq('id', user.id)
        .single();

    if (error) {
        console.error('Error getting profile:', error);
        return null;
    }

    return profile;
}

/**
 * Sign in with email and password
 */
async function signIn(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        throw error;
    }

    return data;
}

/**
 * Sign up with email and password
 */
async function signUp(email, password, name) {
    const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
            data: {
                name: name
            }
        }
    });

    if (error) {
        throw error;
    }

    return data;
}

/**
 * Sign out the current user
 */
async function signOut() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        throw error;
    }
    window.location.href = 'index.html';
}

/**
 * Check if user is authenticated, redirect to login if not
 */
async function requireAuth() {
    const user = await getCurrentUser();
    if (!user) {
        window.location.href = 'index.html';
        return null;
    }
    return user;
}

/**
 * Check if user has required role
 */
async function requireRole(allowedRoles) {
    const profile = await getCurrentUserProfile();
    if (!profile) {
        window.location.href = 'index.html';
        return null;
    }

    if (!allowedRoles.includes(profile.role)) {
        showToast('Você não tem permissão para acessar esta página', 'error');
        window.location.href = 'dashboard.html';
        return null;
    }

    return profile;
}

// ========================================
// TOAST NOTIFICATIONS
// ========================================

/**
 * Show a toast notification
 */
function showToast(message, type = 'success') {
    // Create toast container if it doesn't exist
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : '⚠';
    toast.innerHTML = `
        <span style="font-size: 1.25rem;">${icon}</span>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // Remove toast after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ========================================
// LOADING STATE
// ========================================

/**
 * Show loading overlay
 */
function showLoading(message = 'Carregando...') {
    const existing = document.querySelector('.loading-overlay');
    if (existing) return;

    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
        <div class="loading-spinner"></div>
        <p class="loading-text">${message}</p>
    `;
    document.body.appendChild(overlay);
}

/**
 * Hide loading overlay
 */
function hideLoading() {
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) {
        overlay.remove();
    }
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Format date to Brazilian format
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Format relative time (e.g., "há 2 horas")
 */
function formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'agora mesmo';
    if (diffMins < 60) return `há ${diffMins} min`;
    if (diffHours < 24) return `há ${diffHours}h`;
    if (diffDays < 7) return `há ${diffDays} dias`;

    return formatDate(dateString);
}

/**
 * Get initials from a name
 */
function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// ========================================
// LIGHTBOX FOR IMAGES
// ========================================

/**
 * Open image in lightbox
 */
function openLightbox(imageUrl) {
    const existing = document.querySelector('.lightbox');
    if (existing) existing.remove();

    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.innerHTML = `
        <button class="lightbox-close">&times;</button>
        <img src="${imageUrl}" alt="Screenshot">
    `;

    document.body.appendChild(lightbox);

    // Animate in
    requestAnimationFrame(() => {
        lightbox.classList.add('active');
    });

    // Close handlers
    const close = () => {
        lightbox.classList.remove('active');
        setTimeout(() => lightbox.remove(), 300);
    };

    lightbox.querySelector('.lightbox-close').addEventListener('click', close);
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) close();
    });

    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
            close();
            document.removeEventListener('keydown', escHandler);
        }
    });
}

// ========================================
// DYNAMIC NAVIGATION
// ========================================

/**
 * Navigation configuration by role
 */
const NAV_CONFIG = {
    'COLABORADOR': [
        { href: 'dashboard.html', icon: '🏠', label: 'Dashboard' },
        { href: 'report-bug.html', icon: '🐛', label: 'Reportar Bug' },
        { href: 'my-bugs.html', icon: '📋', label: 'Meus Bugs' },
        { href: 'profile.html', icon: '👤', label: 'Meu Perfil' }
    ],
    'DEV': [
        { href: 'dashboard.html', icon: '🏠', label: 'Dashboard' },
        { href: 'kanban.html', icon: '📋', label: 'Kanban' },
        { href: 'reports.html', icon: '📊', label: 'Relatórios' },
        { href: 'profile.html', icon: '👤', label: 'Meu Perfil' }
    ],
    'ADM': [
        { href: 'dashboard.html', icon: '🏠', label: 'Dashboard' },
        { href: 'report-bug.html', icon: '🐛', label: 'Reportar Bug' },
        { href: 'kanban.html', icon: '📋', label: 'Kanban' },
        { href: 'reports.html', icon: '📊', label: 'Relatórios' },
        { href: 'users.html', icon: '👥', label: 'Usuários' },
        { href: 'profile.html', icon: '👤', label: 'Meu Perfil' }
    ]
};

/**
 * Build dynamic navigation based on user role
 */
function buildNavigation(role) {
    const navMenu = document.querySelector('.nav-menu');
    if (!navMenu) return;

    const navItems = NAV_CONFIG[role] || [];
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    navMenu.innerHTML = navItems.map(item => {
        const isActive = item.href === currentPage ? 'active' : '';
        return `
            <li>
                <a href="${item.href}" class="nav-link ${isActive}">
                    <span>${item.icon}</span>
                    <span>${item.label}</span>
                </a>
            </li>
        `;
    }).join('');
}

/**
 * Initialize page with user data and navigation
 */
async function initPage(allowedRoles = null) {
    const profile = allowedRoles
        ? await requireRole(allowedRoles)
        : await getCurrentUserProfile();

    if (!profile) return null;

    // Update user info in header
    const userNameEl = document.getElementById('userName');
    const userRoleEl = document.getElementById('userRole');

    if (userNameEl) userNameEl.textContent = profile.name;
    if (userRoleEl) {
        userRoleEl.textContent = profile.role;
        userRoleEl.classList.add(profile.role.toLowerCase());
    }

    // Build navigation
    buildNavigation(profile.role);

    return profile;
}

// ========================================
// CALLMEBOT WHATSAPP NOTIFICATIONS
// ========================================

/**
 * Send WhatsApp notification to all DEV users via CallMeBot
 * @param {Object} bugData - Bug information to include in notification
 */
async function notifyDevsViaCallMeBot(bugData) {
    try {
        // Fetch all DEV users with callmebot_apikey
        const { data: devUsers, error } = await supabaseClient
            .from('users_profile')
            .select('name, whatsapp, callmebot_apikey')
            .eq('role', 'DEV')
            .not('callmebot_apikey', 'is', null);

        if (error) {
            console.error('Error fetching DEV users:', error);
            return;
        }

        if (!devUsers || devUsers.length === 0) {
            console.log('No DEV users with CallMeBot configured');
            return;
        }

        // Build message
        const message = `🐛 *NOVO BUG REPORTADO*

👤 Enviado por: ${bugData.reporterName}
📝 ${bugData.description.substring(0, 200)}${bugData.description.length > 200 ? '...' : ''}
${bugData.expectedBehavior ? `✅ Esperado: ${bugData.expectedBehavior.substring(0, 100)}${bugData.expectedBehavior.length > 100 ? '...' : ''}` : ''}

🔗 Ver no Kanban: ${window.location.origin}/kanban.html`;

        // Send to each DEV
        for (const dev of devUsers) {
            if (!dev.whatsapp || !dev.callmebot_apikey) continue;

            // Clean phone number (remove non-digits)
            const phone = dev.whatsapp.replace(/\D/g, '');
            const apikey = dev.callmebot_apikey.trim();

            // CallMeBot API URL
            const url = `https://api.callmebot.com/whatsapp.php?phone=55${phone}&text=${encodeURIComponent(message)}&apikey=${apikey}`;

            // Send notification (fire and forget)
            fetch(url, { mode: 'no-cors' })
                .then(() => console.log(`Notification sent to ${dev.name}`))
                .catch(err => console.error(`Failed to notify ${dev.name}:`, err));
        }

        console.log(`Sent notifications to ${devUsers.length} DEV(s)`);

    } catch (error) {
        console.error('Error sending CallMeBot notifications:', error);
    }
}

// ========================================
// BROWSER PUSH NOTIFICATIONS
// ========================================

/**
 * Request notification permission from the user
 * @returns {Promise<boolean>} Whether permission was granted
 */
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('Browser does not support notifications');
        return false;
    }

    if (Notification.permission === 'granted') {
        return true;
    }

    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }

    return false;
}

/**
 * Show a browser notification for new bug
 * @param {Object} bugData - Bug information
 */
function showBrowserNotification(bugData) {
    if (Notification.permission !== 'granted') return;

    const notification = new Notification('🐛 Novo Bug Reportado!', {
        body: `${bugData.reporter_name}: ${bugData.description.substring(0, 100)}${bugData.description.length > 100 ? '...' : ''}`,
        icon: '🐛',
        tag: 'new-bug',
        requireInteraction: true
    });

    notification.onclick = () => {
        window.focus();
        window.location.href = '/kanban.html';
        notification.close();
    };

    // Auto close after 10 seconds
    setTimeout(() => notification.close(), 10000);
}

/**
 * Subscribe to real-time bug notifications (for DEV users)
 */
function subscribeToBugNotifications() {
    // Only subscribe if we have notification permission
    if (Notification.permission !== 'granted') return;

    const channel = supabaseClient
        .channel('new_bugs_notifications')
        .on('postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'bugs'
            },
            (payload) => {
                console.log('New bug received:', payload);
                showBrowserNotification(payload.new);
            }
        )
        .subscribe();

    console.log('Subscribed to bug notifications');
    return channel;
}

/**
 * Initialize notifications for DEV users
 * Call this after user is authenticated and is a DEV
 */
async function initDevNotifications() {
    const hasPermission = await requestNotificationPermission();

    if (hasPermission) {
        subscribeToBugNotifications();
        console.log('DEV notifications initialized');
    } else {
        console.log('Notification permission not granted');
    }
}
