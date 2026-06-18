console.log('customize.js loaded successfully');

const BACKEND_URL = "https://ca-backend-app-production.up.railway.app";

const customizations = [
    {
        id: "no_water",
        title: "No Water",
        description: "إزالة تأثير الماء من اللعبة لتحسين الأداء",
        icon: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>`
    },
    {
        id: "no_snow",
        title: "No Snow",
        description: "إزالة تأثير الثلج من اللعبة لتحسين الأداء",
        icon: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"></path><line x1="8" y1="16" x2="8.01" y2="16"></line><line x1="8" y1="20" x2="8.01" y2="20"></line><line x1="12" y1="18" x2="12.01" y2="18"></line><line x1="12" y1="22" x2="12.01" y2="22"></line><line x1="16" y1="16" x2="16.01" y2="16"></line><line x1="16" y1="20" x2="16.01" y2="20"></line></svg>`
    },
    {
        id: "no_mountain",
        title: "No Mountain",
        description: "إزالة الجبال من اللعبة لتحسين الأداء",
        icon: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16v-2l-8-5-3 3-3-3-5 5v2"></path><path d="M3 14v6h18v-6"></path></svg>`
    },
    {
        id: "no_rain",
        title: "No Rain",
        description: "إزالة تأثير المطر من اللعبة لتحسين الأداء",
        icon: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9"></path><path d="M8 19v2"></path><path d="M8 13v2"></path><path d="M16 19v2"></path><path d="M16 13v2"></path><path d="M12 21v2"></path><path d="M12 15v2"></path></svg>`
    }
];

async function fetchCustomizations() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/customizations`);
        const data = await response.json();
        return data.customizations || null;
    } catch (error) {
        console.error('Failed to fetch customizations:', error);
        return null;
    }
}

async function checkInstalledStatus() {
    const status = {};
    for (const customization of customizations) {
        try {
            const result = await window.api.customizations.checkInstalled(customization.id);
            status[customization.id] = result.success && result.installed;
        } catch (error) {
            console.error(`Failed to check ${customization.id}:`, error);
            status[customization.id] = false;
        }
    }
    return status;
}

function renderCustomizations(installedStatus, downloadUrls = {}) {
    const grid = document.getElementById('customizationsGrid');
    grid.innerHTML = '';

    customizations.forEach(customization => {
        const isInstalled = installedStatus[customization.id] || false;
        const card = document.createElement('div');
        card.className = `customization-card ${isInstalled ? 'installed' : ''}`;
        card.id = `card-${customization.id}`;

        card.innerHTML = `
            <div class="card-header">
                <div class="card-icon">${customization.icon}</div>
                <div>
                    <h3 class="card-title">${customization.title}</h3>
                    <span class="card-status ${isInstalled ? 'installed' : ''}">
                        ${isInstalled ? 'مثبت' : 'غير مثبت'}
                    </span>
                </div>
            </div>
            <p class="card-description">${customization.description}</p>
            <div class="card-actions">
                ${isInstalled ? `
                    <button class="btn btn-reinstall" onclick="installCustomization('${customization.id}')" id="btn-reinstall-${customization.id}">
                        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path><path d="M16 21h5v-5"></path></svg>
                        إعادة التثبيت
                    </button>
                    <button class="btn btn-delete" onclick="deleteCustomization('${customization.id}')" id="btn-delete-${customization.id}">
                        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        حذف
                    </button>
                ` : `
                    <button class="btn btn-install" onclick="installCustomization('${customization.id}')" id="btn-install-${customization.id}">
                        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        تثبيت
                    </button>
                `}
            </div>
        `;
        grid.appendChild(card);
    });
}

async function installCustomization(customizationId) {
    console.log('installCustomization called with:', customizationId);
    const btn = document.getElementById(`btn-install-${customizationId}`) || document.getElementById(`btn-reinstall-${customizationId}`);
    if (!btn) {
        console.error('Button not found for:', customizationId);
        return;
    }

    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<div class="loading-spinner"></div> جاري التثبيت...';

    try {
        console.log('Fetching customizations from backend...');
        // Fetch download URL from backend
        const customizationsData = await fetchCustomizations();
        console.log('Customizations data:', customizationsData);
        
        if (!customizationsData) {
            console.error('Failed to fetch customizations data');
            showNotification('فشل في الاتصال بالباكند', 'error');
            btn.disabled = false;
            btn.innerHTML = originalContent;
            return;
        }
        
        if (!customizationsData[customizationId]) {
            console.error('Customization ID not found in backend data:', customizationId);
            showNotification('فشل في الحصول على رابط التحميل', 'error');
            btn.disabled = false;
            btn.innerHTML = originalContent;
            return;
        }

        const downloadUrl = customizationsData[customizationId].download_url;
        console.log('Download URL:', downloadUrl);
        
        if (!downloadUrl) {
            console.error('No download URL found in backend data');
            showNotification('فشل في الحصول على رابط التحميل', 'error');
            btn.disabled = false;
            btn.innerHTML = originalContent;
            return;
        }
        
        // Install customization
        console.log('Installing customization...');
        const result = await window.api.customizations.install(customizationId, downloadUrl);
        console.log('Install result:', result);
        
        if (result.success) {
            showNotification('تم التثبيت بنجاح', 'success');
            // Refresh status
            const installedStatus = await checkInstalledStatus();
            renderCustomizations(installedStatus);
        } else {
            console.error('Install failed:', result.message);
            showNotification(result.message || 'فشل في التثبيت', 'error');
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    } catch (error) {
        console.error('Install error:', error);
        showNotification('حدث خطأ أثناء التثبيت: ' + error.message, 'error');
        btn.disabled = false;
        btn.innerHTML = originalContent;
    }
}

async function deleteCustomization(customizationId) {
    const btn = document.getElementById(`btn-delete-${customizationId}`);
    if (!btn) return;

    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<div class="loading-spinner"></div> جاري الحذف...';

    try {
        const result = await window.api.customizations.delete(customizationId);
        
        if (result.success) {
            showNotification('تم الحذف بنجاح', 'success');
            // Refresh status
            const installedStatus = await checkInstalledStatus();
            renderCustomizations(installedStatus);
        } else {
            showNotification(result.message || 'فشل في الحذف', 'error');
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    } catch (error) {
        console.error('Delete error:', error);
        showNotification('حدث خطأ أثناء الحذف', 'error');
        btn.disabled = false;
        btn.innerHTML = originalContent;
    }
}

function showNotification(message, type = 'info') {
    const notify = document.getElementById('notify');
    notify.textContent = message;
    notify.className = `notification ${type}`;
    notify.style.display = 'block';
    
    setTimeout(() => {
        notify.style.display = 'none';
    }, 3000);
}

// Initialize
async function init() {
    const installedStatus = await checkInstalledStatus();
    renderCustomizations(installedStatus);
}

// Run on page load
init();
