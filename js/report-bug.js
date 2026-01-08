// ========================================
// REPORT BUG PAGE LOGIC
// ========================================

let currentUser = null;
let selectedFiles = [];

// Initialize page
(async () => {
    showLoading('Carregando...');

    // Initialize page with auth check and navigation (COLABORADOR and ADM)
    const profile = await initPage(['COLABORADOR', 'ADM']);
    if (!profile) return;

    currentUser = profile;

    // Check if profile is complete (WhatsApp is required)
    if (!profile.whatsapp) {
        showToast('Complete seu perfil com o WhatsApp para reportar bugs', 'warning');
        setTimeout(() => {
            window.location.href = 'profile.html?from=report-bug';
        }, 1500);
        return;
    }

    hideLoading();
    initFileUpload();
})();

// ========================================
// FILE UPLOAD HANDLING
// ========================================

function initFileUpload() {
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('screenshots');
    const previewGrid = document.getElementById('previewGrid');

    // Drag and drop events
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });
}

function handleFiles(files) {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];

    for (const file of files) {
        // Validate file type
        if (!allowedTypes.includes(file.type)) {
            showToast(`Arquivo "${file.name}" não é uma imagem válida`, 'error');
            continue;
        }

        // Validate file size
        if (file.size > maxSize) {
            showToast(`Arquivo "${file.name}" excede o limite de 5MB`, 'error');
            continue;
        }

        // Check for duplicates
        if (selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
            continue;
        }

        selectedFiles.push(file);
    }

    updatePreviewGrid();
}

function updatePreviewGrid() {
    const previewGrid = document.getElementById('previewGrid');

    if (selectedFiles.length === 0) {
        previewGrid.innerHTML = '';
        return;
    }

    previewGrid.innerHTML = selectedFiles.map((file, index) => {
        const url = URL.createObjectURL(file);
        return `
            <div class="image-preview-item">
                <img src="${url}" alt="Preview ${index + 1}">
                <button type="button" class="image-preview-remove" onclick="removeFile(${index})">
                    ✕
                </button>
            </div>
        `;
    }).join('');
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    updatePreviewGrid();
}

// ========================================
// FORM SUBMISSION
// ========================================

document.getElementById('bugForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const description = document.getElementById('description').value.trim();
    const expectedBehavior = document.getElementById('expectedBehavior').value.trim();
    const submitBtn = document.getElementById('submitBtn');

    // Validate
    if (selectedFiles.length === 0) {
        showToast('Por favor, adicione pelo menos uma screenshot', 'error');
        return;
    }

    if (!description) {
        showToast('Por favor, descreva o bug encontrado', 'error');
        return;
    }

    if (!expectedBehavior) {
        showToast('Por favor, explique o comportamento esperado', 'error');
        return;
    }

    // Disable button
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading-spinner" style="width: 20px; height: 20px; border-width: 2px;"></span> <span>Enviando...</span>';

    try {
        // 1. Create the bug record
        const { data: bug, error: bugError } = await supabaseClient
            .from('bugs')
            .insert({
                description: description,
                expected_behavior: expectedBehavior,
                reporter_id: currentUser.id,
                reporter_name: currentUser.name,
                status: 'PENDENTE'
            })
            .select()
            .single();

        if (bugError) throw bugError;

        // 2. Upload images to storage
        const imageUrls = [];

        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            const fileExt = file.name.split('.').pop();
            const fileName = `${bug.id}/${Date.now()}_${i}.${fileExt}`;

            const { data: uploadData, error: uploadError } = await supabaseClient.storage
                .from('bug-screenshots')
                .upload(fileName, file);

            if (uploadError) {
                console.error('Upload error:', uploadError);
                continue;
            }

            // Get public URL
            const { data: urlData } = supabaseClient.storage
                .from('bug-screenshots')
                .getPublicUrl(fileName);

            imageUrls.push(urlData.publicUrl);
        }

        // 3. Save image URLs to database
        if (imageUrls.length > 0) {
            const imageRecords = imageUrls.map(url => ({
                bug_id: bug.id,
                image_url: url
            }));

            const { error: imagesError } = await supabaseClient
                .from('bug_images')
                .insert(imageRecords);

            if (imagesError) {
                console.error('Error saving image records:', imagesError);
            }
        }

        // 4. Send WhatsApp notification to DEV users
        notifyDevsViaCallMeBot({
            reporterName: currentUser.name,
            description: description,
            expectedBehavior: expectedBehavior
        });

        // Success!
        showToast('Bug reportado com sucesso! 🎉', 'success');

        // Reset form
        document.getElementById('bugForm').reset();
        selectedFiles = [];
        updatePreviewGrid();

    } catch (error) {
        console.error('Error submitting bug:', error);
        showToast('Erro ao enviar o bug. Tente novamente.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>📤</span> <span>Enviar Bug</span>';
    }
});
