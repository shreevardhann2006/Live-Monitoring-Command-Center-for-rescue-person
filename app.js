/**
 * IoT Health Dashboard Application Logic
 * Simulates real-time telemetry from disaster response wearable sensors
 */

// Configuration & Thresholds
const THRESHOLDS = {
    hr: { min: 50, max: 120, critical_min: 40, critical_max: 140 }, // Heart Rate (bpm)
    spo2: { min: 94, critical_min: 90 }, // Oxygen saturation (%)
    temp: { min: 36.0, max: 38.0, critical_max: 39.5 }, // Body Temp (°C)
    env: { max: 45.0, critical_max: 55.0 } // Environment Temp (°C)
};

// Initial simulated workers
const workers = [
    { id: 'W-101', name: 'Alex Mercer', role: 'Firefighter - Alpha Team', location: 'Zone A - Sector 3', avatar: 'AM', status: 'normal', vitals: { hr: 75, spo2: 98, temp: 36.5, env: 35.0 }, battery: 85 },
    { id: 'W-102', name: 'Sarah Chen', role: 'Medic - Bravo Team', location: 'Zone B - Safehouse', avatar: 'SC', status: 'normal', vitals: { hr: 68, spo2: 99, temp: 36.2, env: 28.5 }, battery: 92 },
    { id: 'W-103', name: 'Marcus Johnson', role: 'Rescue Specialist', location: 'Zone A - Debris 4', avatar: 'MJ', status: 'normal', vitals: { hr: 82, spo2: 97, temp: 37.1, env: 38.0 }, battery: 60 },
    { id: 'W-104', name: 'Elena Rodriguez', role: 'Hazmat Expert', location: 'Zone C - Control', avatar: 'ER', status: 'normal', vitals: { hr: 71, spo2: 98, temp: 36.4, env: 25.0 }, battery: 45 },
    { id: 'W-105', name: 'David Kim', role: 'Firefighter - Alpha Team', location: 'Zone A - Sector 1', avatar: 'DK', status: 'normal', vitals: { hr: 90, spo2: 96, temp: 37.5, env: 42.0 }, battery: 78 },
    { id: 'W-106', name: 'Rachel Green', role: 'Medic - Alpha Team', location: 'Zone A - Sector 2', avatar: 'RG', status: 'normal', vitals: { hr: 76, spo2: 98, temp: 36.6, env: 34.0 }, battery: 88 },
    { id: 'W-107', name: 'Tom Hardy', role: 'Technical Rescue', location: 'Zone D - Basement', avatar: 'TH', status: 'warning', vitals: { hr: 115, spo2: 94, temp: 38.2, env: 46.0 }, battery: 30 },
    { id: 'W-108', name: 'Emma Stone', role: 'K9 Handler', location: 'Zone B - Perimeter', avatar: 'ES', status: 'normal', vitals: { hr: 85, spo2: 97, temp: 36.8, env: 30.0 }, battery: 95 }
];

let activeAlerts = [];
let currentFilter = 'all';

// DOM Elements
const workersGrid = document.getElementById('workersGrid');
const alertsPanel = document.getElementById('alertsPanel');
const statsNodes = {
    total: document.getElementById('totalWorkers'),
    stable: document.getElementById('stableWorkers'),
    warning: document.getElementById('warningWorkers'),
    critical: document.getElementById('criticalWorkers')
};
const toastContainer = document.getElementById('toastContainer');
const systemStatusIndicator = document.getElementById('systemStatusIndicator');
const filterBtns = document.querySelectorAll('.filter-btn');

// Initialize Dashboard
function init() {
    startClock();
    renderWorkers();
    updateStats();
    setupFilters();

    // Start simulation loop (every 2 seconds)
    setInterval(simulateTelemetry, 2000);
}

// Live Clock
function startClock() {
    const clockEl = document.getElementById('liveClock');
    setInterval(() => {
        const now = new Date();
        clockEl.innerText = now.toLocaleTimeString('en-US', { hour12: false });
    }, 1000);
}

// Generate slight random variations in vitals
function simulateTelemetry() {
    let statsChanged = false;
    let newCriticalSpotted = false;

    workers.forEach(w => {
        const oldStatus = w.status;

        // Random walks for vitals
        w.vitals.hr += Math.floor(Math.random() * 7) - 3; // -3 to +3
        w.vitals.spo2 += Math.random() > 0.7 ? (Math.floor(Math.random() * 3) - 1) : 0; // slower change
        w.vitals.temp += (Math.random() * 0.4 - 0.2); // -0.2 to +0.2
        w.vitals.env += (Math.random() * 1.0 - 0.5);

        // Clamping to somewhat realistic extremes
        w.vitals.hr = Math.max(30, Math.min(190, w.vitals.hr));
        w.vitals.spo2 = Math.max(80, Math.min(100, w.vitals.spo2));
        w.vitals.temp = Math.max(34.0, Math.min(42.0, w.vitals.temp));

        // Occasional battery drain
        if (Math.random() > 0.9) w.battery = Math.max(0, w.battery - 1);

        // Evaluate Status
        evaluateWorkerStatus(w);

        if (oldStatus !== w.status) {
            statsChanged = true;
            if (w.status === 'critical' && oldStatus !== 'critical') {
                newCriticalSpotted = true;
                generateAlert(w);
            }
        }
    });

    // Re-render
    renderWorkers();

    if (statsChanged) {
        updateStats();
    }

    if (newCriticalSpotted) {
        document.querySelector('.alert-card').classList.add('active-alert');
        systemStatusIndicator.classList.add('critical-global');
        systemStatusIndicator.innerHTML = `<span class="pulse-dot"></span> EMERGENCY DETECTED`;
        setTimeout(() => {
            document.querySelector('.alert-card').classList.remove('active-alert');

            // Only reset system status if no critical workers remain
            const criticalCount = workers.filter(w => w.status === 'critical').length;
            if (criticalCount === 0) {
                systemStatusIndicator.classList.remove('critical-global');
                systemStatusIndicator.innerHTML = `<span class="pulse-dot"></span> System Online`;
            }
        }, 3000);
    } else {
        // Keep system status critical if there are ANY critical workers
        const criticalCount = workers.filter(w => w.status === 'critical').length;
        if (criticalCount === 0) {
            systemStatusIndicator.classList.remove('critical-global');
            systemStatusIndicator.innerHTML = `<span class="pulse-dot"></span> System Online`;
        } else {
            systemStatusIndicator.classList.add('critical-global');
            systemStatusIndicator.innerHTML = `<span class="pulse-dot"></span> EMERGENCY DETECTED`;
        }
    }
}

// Determine if Normal, Warning, or Critical based on thresholds
function evaluateWorkerStatus(w) {
    let isCritical = false;
    let isWarning = false;

    w.issues = []; // Track specific issues

    // HR Check
    if (w.vitals.hr <= THRESHOLDS.hr.critical_min || w.vitals.hr >= THRESHOLDS.hr.critical_max) {
        isCritical = true; w.issues.push('Abnormal Heart Rate');
    } else if (w.vitals.hr <= THRESHOLDS.hr.min || w.vitals.hr >= THRESHOLDS.hr.max) {
        isWarning = true;
    }

    // SpO2 Check
    if (w.vitals.spo2 <= THRESHOLDS.spo2.critical_min) {
        isCritical = true; w.issues.push('Critical Hypoxia');
    } else if (w.vitals.spo2 <= THRESHOLDS.spo2.min) {
        isWarning = true;
    }

    // Temp Check
    if (w.vitals.temp >= THRESHOLDS.temp.critical_max) {
        isCritical = true; w.issues.push('Hyperthermia Risk');
    } else if (w.vitals.temp >= THRESHOLDS.temp.max) {
        isWarning = true;
    }

    // Env Temp Check
    if (w.vitals.env >= THRESHOLDS.env.critical_max) {
        isCritical = true; w.issues.push('Extreme Environment');
    }

    if (isCritical) w.status = 'critical';
    else if (isWarning) w.status = 'warning';
    else w.status = 'normal';
}

// Update High-Level Stats
function updateStats() {
    let stable = 0, warning = 0, critical = 0;

    workers.forEach(w => {
        if (w.status === 'normal') stable++;
        if (w.status === 'warning') warning++;
        if (w.status === 'critical') critical++;
    });

    statsNodes.total.innerText = workers.length;
    statsNodes.stable.innerText = stable;
    statsNodes.warning.innerText = warning;
    statsNodes.critical.innerText = critical;
}

// Generate UI Alerts
function generateAlert(worker) {
    const issueText = worker.issues.join(' & ');
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });

    const alertId = 'alert-' + Date.now();
    const alertOb = { id: alertId, workerId: worker.id, msg: `${worker.name} (${worker.id}): ${issueText}`, time };

    activeAlerts.unshift(alertOb);
    if (activeAlerts.length > 5) activeAlerts.pop(); // Keep max 5 alerts visible

    // Save to historical alerts array
    historicalAlerts.unshift(alertOb);

    renderAlertsPanel();
    renderAlertsHistory();
    showToast(alertOb.msg);
}

function renderAlertsPanel() {
    if (activeAlerts.length === 0) {
        alertsPanel.classList.add('hidden');
        return;
    }

    alertsPanel.classList.remove('hidden');
    let html = `<h4><i class="fa-solid fa-triangle-exclamation"></i> Active Emergency Alerts</h4>`;

    activeAlerts.forEach(a => {
        html += `
        <div class="alert-item" id="${a.id}">
            <div class="alert-msg">
                <i class="fa-solid fa-circle-exclamation"></i>
                <span>${a.msg}</span>
                <span class="alert-time">${a.time}</span>
            </div>
            <button class="alert-action" onclick="acknowledgeAlert('${a.id}')">ACKNOWLEDGE</button>
        </div>`;
    });

    alertsPanel.innerHTML = html;
}

// Global function to be called from inline HTML
window.acknowledgeAlert = function (alertId) {
    activeAlerts = activeAlerts.filter(a => a.id !== alertId);
    renderAlertsPanel();
}

function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <i class="fa-solid fa-bell toast-icon"></i>
        <div class="toast-content">
            <h4>Critical Event Detected</h4>
            <p>${msg}</p>
        </div>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 400); // Wait for anim
    }, 4000);
}

// Helpers for metric rendering
function getMetricClass(val, min, max, critMin, critMax) {
    if ((critMin && val <= critMin) || (critMax && val >= critMax)) return 'metric-critical';
    if ((min && val <= min) || (max && val >= max)) return 'metric-warning';
    return '';
}

function renderWorkers() {
    let html = '';

    const displayWorkers = workers.filter(w => {
        if (currentFilter === 'all') return true;
        return w.status === currentFilter;
    });

    displayWorkers.forEach(w => {
        // Evaluate individual metric classes
        const hrClass = getMetricClass(w.vitals.hr, THRESHOLDS.hr.min, THRESHOLDS.hr.max, THRESHOLDS.hr.critical_min, THRESHOLDS.hr.critical_max);
        const spo2Class = getMetricClass(w.vitals.spo2, THRESHOLDS.spo2.min, null, THRESHOLDS.spo2.critical_min, null);
        const tempClass = getMetricClass(w.vitals.temp, null, THRESHOLDS.temp.max, null, THRESHOLDS.temp.critical_max);
        const envClass = getMetricClass(w.vitals.env, null, null, null, THRESHOLDS.env.critical_max);

        const batteryColor = w.battery > 50 ? '#10b981' : (w.battery > 20 ? '#f59e0b' : '#ef4444');

        html += `
        <div class="worker-card status-${w.status}">
            <div class="worker-header">
                <div class="worker-identity">
                    <div class="worker-avatar">${w.avatar}</div>
                    <div class="worker-info">
                        <h4>${w.name}</h4>
                        <div class="worker-role">
                            <i class="fa-solid fa-id-badge"></i> ${w.id} | ${w.role}
                        </div>
                    </div>
                </div>
                <div class="battery-status" style="color: ${batteryColor}">
                    <i class="fa-solid fa-battery-${w.battery > 75 ? 'full' : (w.battery > 50 ? 'three-quarters' : (w.battery > 25 ? 'half' : 'empty'))}"></i>
                    ${w.battery}%
                </div>
            </div>

            <div class="vitals-grid">
                <!-- Heart Rate -->
                <div class="vital-metric ${hrClass}">
                    <div class="vital-icon icon-hr"><i class="fa-solid fa-heart-pulse heart-beat"></i></div>
                    <div class="vital-data">
                        <span class="vital-label">BPM</span>
                        <div class="vital-value">${w.vitals.hr} <span class="vital-unit">bpm</span></div>
                    </div>
                </div>
                
                <!-- SpO2 -->
                <div class="vital-metric ${spo2Class}">
                    <div class="vital-icon icon-spo2"><i class="fa-solid fa-lungs"></i></div>
                    <div class="vital-data">
                        <span class="vital-label">SpO2</span>
                        <div class="vital-value">${w.vitals.spo2} <span class="vital-unit">%</span></div>
                    </div>
                </div>

                <!-- Body Temp -->
                <div class="vital-metric ${tempClass}">
                    <div class="vital-icon icon-temp"><i class="fa-solid fa-temperature-half"></i></div>
                    <div class="vital-data">
                        <span class="vital-label">BODY TEMP</span>
                        <div class="vital-value">${w.vitals.temp.toFixed(1)} <span class="vital-unit">°C</span></div>
                    </div>
                </div>

                <!-- Environment -->
                <div class="vital-metric ${envClass}">
                    <div class="vital-icon icon-env"><i class="fa-solid fa-fire-flame-curved"></i></div>
                    <div class="vital-data">
                        <span class="vital-label">ENV TEMP</span>
                        <div class="vital-value">${w.vitals.env.toFixed(1)} <span class="vital-unit">°C</span></div>
                    </div>
                </div>
            </div>

            <div class="worker-footer">
                <div class="location-info">
                    <i class="fa-solid fa-location-dot"></i> ${w.location}
                </div>
                <button class="btn-contact">
                    <i class="fa-solid fa-walkie-talkie"></i> COMMS
                </button>
            </div>
        </div>
        `;
    });

    if (displayWorkers.length === 0) {
        html = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); padding: 3rem;">No personnel matching this filter.</div>`;
    }

    workersGrid.innerHTML = html;
}

// Filter Logic
function setupFilters() {
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.getAttribute('data-filter');
            renderWorkers();
        });
    });
}

// Global scope buttons setup
document.addEventListener('click', function (e) {
    // Comms Action
    if (e.target.closest('.btn-contact')) {
        const card = e.target.closest('.worker-card');
        const workerName = card.querySelector('h4').innerText;
        showToast('Initiating radio contact with ' + workerName + '...');
    }

    // Emergency Action
    if (e.target.closest('.btn-emergency')) {
        systemStatusIndicator.classList.add('critical-global');
        systemStatusIndicator.innerHTML = `<span class="pulse-dot"></span> EMERGENCY BROADCAST SENT`;
        showToast('All units advised to evacuate immediately.');

        // Reset broadcast status after 10s if no critical
        setTimeout(() => {
            const criticalCount = workers.filter(w => w.status === 'critical').length;
            if (criticalCount === 0) {
                systemStatusIndicator.classList.remove('critical-global');
                systemStatusIndicator.innerHTML = `<span class="pulse-dot"></span> System Online`;
            } else {
                systemStatusIndicator.innerHTML = `<span class="pulse-dot"></span> EMERGENCY DETECTED`;
            }
        }, 10000);
    }

    // Sidebar Nav Links
    if (e.target.closest('.side-nav a')) {
        e.preventDefault();
        const link = e.target.closest('a');
        const navItem = link.parentElement;

        document.querySelectorAll('.side-nav li').forEach(li => li.classList.remove('active'));
        navItem.classList.add('active');

        const targetViewName = link.getAttribute('data-target');

        if (targetViewName) {
            document.querySelectorAll('.page-view').forEach(view => {
                view.style.display = 'none';
                view.classList.remove('active');
            });

            const targetView = document.getElementById('view-' + targetViewName);
            if (targetView) {
                targetView.style.display = 'block';
                targetView.classList.add('active');

                if (targetViewName === 'units') {
                    renderAllUnitsGrid();
                } else if (targetViewName === 'map') {
                    document.getElementById('mapUnitCount').innerText = workers.length;
                } else if (targetViewName === 'alerts') {
                    renderAlertsHistory();
                }
            }
        }

        showToast('Navigating to ' + e.target.innerText.trim());
    }

    // Profile Menu Click
    if (e.target.closest('.profile-menu')) {
        showToast('Opening commander profile settings...');
    }
});

// Theme Toggle Logic
const themeBtn = document.getElementById('themeToggle');
const lightIcon = themeBtn.querySelector('.light-icon');
const darkIcon = themeBtn.querySelector('.dark-icon');

themeBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');

    if (currentTheme === 'light') {
        document.documentElement.removeAttribute('data-theme');
        lightIcon.style.display = 'block';
        darkIcon.style.display = 'none';
        showToast('Switched to Dark Mode');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        lightIcon.style.display = 'none';
        darkIcon.style.display = 'block';
        showToast('Switched to Light Mode');
    }
});

// Additional View Rendering Logic
let historicalAlerts = [];

function renderAllUnitsGrid() {
    const unitsGrid = document.getElementById('allUnitsGrid');
    if (!unitsGrid) return;

    let html = workers.map(w => {
        const batteryColor = w.battery > 50 ? '#10b981' : (w.battery > 20 ? '#f59e0b' : '#ef4444');
        return `
        <div class="worker-card status-${w.status}">
            <div class="worker-header">
                <div class="worker-identity">
                    <div class="worker-avatar">${w.avatar}</div>
                    <div class="worker-info">
                        <h4>${w.name}</h4>
                        <div class="worker-role"><i class="fa-solid fa-id-badge"></i> ${w.id} | ${w.role}</div>
                    </div>
                </div>
                <div class="battery-status" style="color: ${batteryColor}">
                    ${w.battery}% <i class="fa-solid fa-bolt"></i>
                </div>
            </div>
            <div class="worker-footer" style="flex-direction: column; align-items: flex-start; gap: 8px;">
                <div class="location-info"><i class="fa-solid fa-location-dot"></i> ${w.location}</div>
                <div style="font-size: 0.85rem; color: var(--text-secondary);">
                    HR: ${w.vitals.hr} | SpO2: ${w.vitals.spo2}% | Temp: ${w.vitals.temp.toFixed(1)}°C
                </div>
            </div>
        </div>`;
    }).join('');

    unitsGrid.innerHTML = html;
}

function renderAlertsHistory() {
    const listEl = document.getElementById('alertsHistoryList');
    if (!listEl) return;

    if (historicalAlerts.length === 0) {
        listEl.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-secondary);">No historical alerts recorded.</div>`;
        return;
    }

    listEl.innerHTML = historicalAlerts.map(a => `
        <div class="worker-card" style="margin-bottom: 1rem; flex-direction: row; justify-content: space-between; align-items: center; padding: 1rem 1.5rem;">
            <div style="display: flex; gap: 1rem; align-items: center;">
                <div class="stat-icon bg-red" style="width: 40px; height: 40px; font-size: 1.2rem;"><i class="fa-solid fa-triangle-exclamation"></i></div>
                <div>
                    <strong style="color: var(--text-primary);">${a.msg}</strong>
                    <div style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 4px;">Worker ID: ${a.workerId}</div>
                </div>
            </div>
            <div style="color: var(--text-secondary); font-size: 0.9rem;">
                <i class="fa-regular fa-clock"></i> ${a.time}
            </div>
        </div>
    `).join('');
}

window.clearAlertHistory = function () {
    historicalAlerts = [];
    renderAlertsHistory();
    showToast('Alert history cleared.');
};

window.saveSettings = function () {
    showToast('Settings saved successfully.');
};

// Run Startup
document.addEventListener('DOMContentLoaded', init);
