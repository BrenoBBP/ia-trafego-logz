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
