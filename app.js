document.addEventListener('DOMContentLoaded', () => {
    // E2E Test Dashboard Overlay Controller
    const qaDashboardEl = document.getElementById('qa-test-dashboard');
    const qaFloatingBadge = document.getElementById('qa-floating-badge');
    const qaCompletionModal = document.getElementById('qa-completion-modal');
    
    if (qaDashboardEl) {
        const urlParams = new URLSearchParams(window.location.search);
        const isTestActive = urlParams.get('test') === 'true' || localStorage.getItem('e2e_test_active') === 'true';
        
        if (isTestActive) {
            localStorage.setItem('e2e_test_active', 'true');
            qaDashboardEl.style.setProperty('display', 'flex', 'important');
            if (qaFloatingBadge) qaFloatingBadge.style.setProperty('display', 'flex', 'important');
            
            // Default/Initial State
            let state = {
                currentStepIndex: 1,
                currentStepName: "Clean database & navigate to local server",
                percent: 10,
                timerSeconds: 180,
                stepsStatus: {
                    "1": "running", "2": "pending", "3": "pending", "4": "pending",
                    "5": "pending", "6": "pending", "7": "pending", "8": "running", "9": "pending"
                },
                logs: ["[SYSTEM] Ready to begin automated test..."],
                screens: {
                    "auth": "pending",
                    "onboarding": "pending",
                    "success": "pending",
                    "dashboard": "pending"
                }
            };
            
            // Try to restore state from sessionStorage
            const savedStateStr = sessionStorage.getItem('qa_test_dashboard_state');
            if (savedStateStr) {
                try {
                    const savedState = JSON.parse(savedStateStr);
                    state = { ...state, ...savedState };
                } catch (e) {
                    console.error("Error parsing saved E2E test state:", e);
                }
            }
            
            // UI Update Functions
            const renderState = () => {
                // Update badge and progress text
                const badgeEl = document.getElementById('qa-current-step-badge');
                if (badgeEl) badgeEl.innerText = `Step ${state.currentStepIndex}/9: ${state.currentStepName}`;
                
                const progressText = document.getElementById('qa-progress-text');
                if (progressText) progressText.innerText = `${state.percent}% Complete`;
                
                const progressFill = document.getElementById('qa-progress-fill');
                if (progressFill) progressFill.style.width = `${state.percent}%`;
                
                const badgeText = document.getElementById('qa-badge-text');
                if (badgeText) badgeText.innerText = `Test Active: ${state.percent}%`;
                
                // Update Timer
                const timerEl = document.getElementById('qa-timer-text');
                if (timerEl) {
                    const min = Math.floor(state.timerSeconds / 60);
                    const sec = state.timerSeconds % 60;
                    timerEl.innerText = `Est. remaining: ${min}m ${sec.toString().padStart(2, '0')}s`;
                }
                
                // Update Steps List in DOM
                for (let step = 1; step <= 9; step++) {
                    const stepEl = document.querySelector(`#qa-steps-checklist li[data-step="${step}"]`);
                    if (stepEl) {
                        const status = state.stepsStatus[step] || 'pending';
                        stepEl.className = status;
                    }
                }
                
                // Update Logs
                const logsBox = document.getElementById('qa-console-log');
                if (logsBox) {
                    logsBox.innerHTML = state.logs.map(log => {
                        let logClass = '';
                        if (log.includes('[SYSTEM]')) logClass = 'system';
                        else if (log.includes('[BROWSER CONSOLE]')) logClass = 'browser-console';
                        else if (log.includes('[OK]') || log.includes('[SUCCESS]')) logClass = 'success';
                        else if (log.includes('[ERROR]') || log.includes('[EXCEPTION]')) logClass = 'error';
                        return `<div class="log-line ${logClass}">${log}</div>`;
                    }).join('');
                    logsBox.scrollTop = logsBox.scrollHeight;
                }
                
                // Update screens tested
                for (const [screenKey, status] of Object.entries(state.screens)) {
                    const indicator = document.querySelector(`#screen-card-${screenKey} .screen-status-indicator`);
                    if (indicator) {
                        indicator.className = `screen-status-indicator ${status}`;
                    }
                }
            };
            
            // Intercept console.log to write to E2E log viewer
            const originalLog = console.log;
            console.log = (...args) => {
                originalLog.apply(console, args);
                const logText = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
                if (window.qaDashboard && !logText.includes('qa_test_dashboard_state') && !logText.includes('[DEBUG] STEP 5:')) {
                    state.logs.push(`[BROWSER CONSOLE] ${logText}`);
                    if (state.logs.length > 150) {
                        state.logs.shift();
                    }
                    saveState();
                    renderState();
                }
            };
            
            const saveState = () => {
                sessionStorage.setItem('qa_test_dashboard_state', JSON.stringify(state));
            };
            
            // Timer Loop
            const timerInterval = setInterval(() => {
                if (state.timerSeconds > 0) {
                    state.timerSeconds--;
                    saveState();
                    const timerEl = document.getElementById('qa-timer-text');
                    if (timerEl) {
                        const min = Math.floor(state.timerSeconds / 60);
                        const sec = state.timerSeconds % 60;
                        timerEl.innerText = `Est. remaining: ${min}m ${sec.toString().padStart(2, '0')}s`;
                    }
                } else {
                    clearInterval(timerInterval);
                }
            }, 1000);
            
            // Expand/Collapse Toggle
            const toggleBtn = document.getElementById('btn-qa-toggle-details');
            const drawer = document.getElementById('qa-details-drawer');
            if (toggleBtn && drawer) {
                toggleBtn.addEventListener('click', () => {
                    const isExpanded = drawer.classList.contains('expanded');
                    if (isExpanded) {
                        drawer.classList.remove('expanded');
                        drawer.classList.add('collapsed');
                        toggleBtn.querySelector('.chevron-icon').style.transform = 'rotate(0deg)';
                    } else {
                        drawer.classList.remove('collapsed');
                        drawer.classList.add('expanded');
                        toggleBtn.querySelector('.chevron-icon').style.transform = 'rotate(180deg)';
                    }
                });
            }
            
            // Visibility change handling for Floating Indicator
            document.addEventListener('visibilitychange', () => {
                const badgeDot = document.querySelector('#qa-floating-badge .qa-badge-dot');
                if (badgeDot) {
                    if (document.hidden) {
                        badgeDot.className = 'qa-badge-dot paused';
                        const badgeText = document.getElementById('qa-badge-text');
                        if (badgeText) badgeText.innerText = `Test Running (BG)`;
                    } else {
                        badgeDot.className = 'qa-badge-dot running';
                        const badgeText = document.getElementById('qa-badge-text');
                        if (badgeText) badgeText.innerText = `Test Active: ${state.percent}%`;
                    }
                }
            });
            
            // Define global API under window.qaDashboard
            window.qaDashboard = {
                updateStep: (stepIndex, stepName, percent, remainingTimeSecs) => {
                    state.currentStepIndex = stepIndex;
                    state.currentStepName = stepName;
                    state.percent = percent;
                    if (remainingTimeSecs !== undefined) {
                        state.timerSeconds = remainingTimeSecs;
                    }
                    
                    // Mark previous steps as completed
                    for (let i = 1; i < stepIndex; i++) {
                        state.stepsStatus[i] = 'completed';
                    }
                    state.stepsStatus[stepIndex] = 'running';
                    
                    // Map active screen states based on current step
                    if (stepIndex === 1) state.screens.auth = 'testing';
                    else if (stepIndex === 2) { state.screens.auth = 'success'; state.screens.onboarding = 'testing'; }
                    else if (stepIndex === 5) { state.screens.onboarding = 'success'; state.screens.success = 'testing'; }
                    else if (stepIndex === 6) { state.screens.success = 'success'; state.screens.dashboard = 'testing'; }
                    else if (stepIndex === 8) { state.screens.dashboard = 'success'; }
                    
                    saveState();
                    renderState();
                },
                addLog: (text) => {
                    state.logs.push(text);
                    if (state.logs.length > 150) {
                        state.logs.shift();
                    }
                    saveState();
                    renderState();
                },
                setStepStatus: (stepIndex, status) => {
                    state.stepsStatus[stepIndex] = status;
                    saveState();
                    renderState();
                },
                setFinalReport: (reportData) => {
                    clearInterval(timerInterval);
                    
                    const badgeDot = document.querySelector('#qa-floating-badge .qa-badge-dot');
                    if (badgeDot) {
                        badgeDot.className = reportData.success ? 'qa-badge-dot completed' : 'qa-badge-dot failed';
                    }
                    
                    qaDashboardEl.style.setProperty('display', 'none', 'important');
                    if (qaFloatingBadge) qaFloatingBadge.style.setProperty('display', 'none', 'important');
                    
                    if (qaCompletionModal) {
                        qaCompletionModal.style.setProperty('display', 'flex', 'important');
                        
                        const iconContainer = document.getElementById('qa-modal-icon-container');
                        const modalTitle = document.getElementById('qa-modal-title');
                        const statStatus = document.getElementById('qa-stat-status');
                        const statDuration = document.getElementById('qa-stat-duration');
                        const statScreens = document.getElementById('qa-stat-screens');
                        const issuesContainer = document.getElementById('qa-modal-issues-container');
                        const issuesList = document.getElementById('qa-modal-issues-list');
                        
                        if (iconContainer) {
                            iconContainer.className = `qa-modal-icon ${reportData.success ? 'success' : 'failed'}`;
                            iconContainer.innerHTML = reportData.success 
                                ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="24" height="24"><polyline points="20 6 9 17 4 12"></polyline></svg>`
                                : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="24" height="24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
                        }
                        
                        if (modalTitle) modalTitle.innerText = reportData.success ? "E2E Test Run Passed!" : "E2E Test Run Failed";
                        if (statStatus) {
                            statStatus.innerText = reportData.success ? "Passed" : "Failed";
                            statStatus.className = `qa-stat-val ${reportData.success ? 'success' : 'failed'}`;
                        }
                        if (statDuration) statDuration.innerText = reportData.duration || '0.0s';
                        
                        let successScreensCount = 0;
                        for (const status of Object.values(state.screens)) {
                            if (status === 'success') successScreensCount++;
                        }
                        if (statScreens) statScreens.innerText = `${successScreensCount} / 4`;
                        
                        if (reportData.issues && reportData.issues.length > 0) {
                            if (issuesContainer) issuesContainer.style.display = 'block';
                            if (issuesList) {
                                issuesList.innerHTML = reportData.issues.map(iss => `<li>${iss}</li>`).join('');
                            }
                        } else {
                            if (issuesContainer) issuesContainer.style.display = 'none';
                        }
                        
                        let countdownSeconds = 10;
                        const closingText = document.getElementById('qa-closing-countdown');
                        
                        const closingInterval = setInterval(() => {
                            countdownSeconds--;
                            if (closingText) {
                                closingText.innerText = `Returning to Antigravity chat window in ${countdownSeconds}s...`;
                            }
                            if (countdownSeconds <= 0) {
                                clearInterval(closingInterval);
                                localStorage.removeItem('e2e_test_active');
                                sessionStorage.removeItem('qa_test_dashboard_state');
                            }
                        }, 1000);
                    }
                }
            };
            
            renderState();
        }
    }

    // DOM Elements - Login Screen
    const toggleLogin = document.getElementById('toggle-login');
    const toggleSignup = document.getElementById('toggle-signup');
    const authTitle = document.getElementById('auth-title');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const btnGuest = document.getElementById('btn-guest-mode');

    // DOM Elements - Onboarding Screen
    const authScreen = document.getElementById('auth-screen');
    const onboardingScreen = document.getElementById('onboarding-screen');
    const successScreen = document.getElementById('success-screen');
    const dashboardScreen = document.getElementById('dashboard-screen');
    const progressWrapper = document.getElementById('onboarding-progress-wrapper');
    const progressPercent = document.getElementById('progress-percent');
    const progressIndicator = document.getElementById('progress-indicator');
    const stepTextEl = document.getElementById('onboarding-step-text');

    // Onboarding Form Elements
    const onboardTitle = document.getElementById('onboard-title');
    const onboardExp = document.getElementById('onboard-exp');
    const btnOnboardNext = document.getElementById('btn-onboard-next');
    const btnOnboardBack = document.getElementById('btn-onboard-back');
    const headerBackBtn = document.getElementById('onboard-header-back');
    const headerCloseBtn = document.getElementById('onboard-header-close');
    const btnSuccessContinue = document.getElementById('btn-success-continue');

    // Supabase Client Initialization
    const supabaseUrl = 'https://vpmngcagfxyqvemdgzav.supabase.co';
    const supabaseKey = 'sb_publishable_YG5n4OWJxPLrkWN61rMXoA_LNUdE8IJ';
    const supabase = window.supabase ? window.supabase.createClient(supabaseUrl, supabaseKey) : null;

    // -----------------------------------------------------------------
    // STATE MACHINE / SCREEN ROUTER
    // -----------------------------------------------------------------
    let activePage = 'login';
    window.activePage = activePage;
    let customLocations = [];

    function syncPreferencesToFormAndProfile() {
        const storedFirstName = localStorage.getItem('pref_first_name') || '';
        const storedTitle = localStorage.getItem('pref_job_title') || '';
        const storedExp = localStorage.getItem('pref_experience') || '';
        
        let storedRoles = [];
        try {
            storedRoles = JSON.parse(localStorage.getItem('pref_roles')) || [];
        } catch (e) {
            storedRoles = [];
        }
        
        let storedLocs = [];
        try {
            storedLocs = JSON.parse(localStorage.getItem('pref_locations')) || [];
        } catch (e) {
            storedLocs = [];
        }

        const expLabels = {
            '0-1': '0–1 Years',
            '1-3': '1–3 Years',
            '3-5': '3–5 Years',
            '5-10': '5–10 Years',
            '10+': '10+ Years'
        };
        const formattedExp = expLabels[storedExp] || storedExp || 'Not Specified';

        // Update Dashboard Greeting
        const welcomeGreeting = document.getElementById('welcome-greeting');
        if (welcomeGreeting) {
            if (storedFirstName) {
                welcomeGreeting.innerText = `Welcome Back, ${storedFirstName}`;
            } else {
                welcomeGreeting.innerText = 'Welcome Back';
            }
        }

        // Update Dashboard Name, Title & Avatar (Sidebar)
        const dashUserName = document.getElementById('dash-user-name');
        if (dashUserName) {
            if (storedFirstName) {
                dashUserName.innerText = storedFirstName;
            } else if (localStorage.getItem('user_email') === 'guest@fundedjobs.ai') {
                dashUserName.innerText = 'Guest User';
            } else {
                dashUserName.innerText = 'User';
            }
        }

        const dashUserTitle = document.getElementById('dash-user-title');
        if (dashUserTitle) {
            if (storedTitle) {
                dashUserTitle.innerText = storedTitle;
            } else if (localStorage.getItem('user_email') === 'guest@fundedjobs.ai') {
                dashUserTitle.innerText = 'Guest';
            } else {
                dashUserTitle.innerText = 'Not Specified';
            }
        }

        const userAvatar = document.querySelector('.sidebar-user-widget .user-avatar-circle');
        if (userAvatar) {
            if (storedFirstName) {
                userAvatar.innerText = storedFirstName.substring(0, 2).toUpperCase();
            } else if (localStorage.getItem('user_email') === 'guest@fundedjobs.ai') {
                userAvatar.innerText = 'GU';
            } else {
                userAvatar.innerText = 'U';
            }
        }

        // Update Profile Pane (now an editable form)
        const profileEmail = document.getElementById('profile-user-email');
        const profileEditFirstName = document.getElementById('profile-edit-first-name');
        const profileEditTitle = document.getElementById('profile-edit-title');
        const profileEditTitleOther = document.getElementById('profile-edit-title-other');
        const profileTitleOtherGroup = document.getElementById('profile-title-other-group');
        const profileEditExp = document.getElementById('profile-edit-exp');
        const profileEditLocations = document.getElementById('profile-edit-locations');

        if (profileEditFirstName) profileEditFirstName.value = storedFirstName;
        if (profileEditExp) profileEditExp.value = storedExp;
        if (profileEditLocations) profileEditLocations.value = storedLocs.join(', ');

        // Populate Job Title dropdown — handle 'Other' case
        if (profileEditTitle) {
            const titleOptions = Array.from(profileEditTitle.options).map(o => o.value);
            if (storedTitle && titleOptions.includes(storedTitle)) {
                profileEditTitle.value = storedTitle;
                if (profileTitleOtherGroup) profileTitleOtherGroup.style.display = 'none';
                if (profileEditTitleOther) profileEditTitleOther.value = '';
            } else if (storedTitle) {
                profileEditTitle.value = 'Other';
                if (profileTitleOtherGroup) profileTitleOtherGroup.style.display = 'block';
                if (profileEditTitleOther) profileEditTitleOther.value = storedTitle;
            }
        }

        // Sync role chips on profile page
        const profileRoleChips = document.querySelectorAll('#profile-roles-chips .chip-btn');
        profileRoleChips.forEach(chip => {
            if (storedRoles.includes(chip.getAttribute('data-value'))) {
                chip.classList.add('selected');
            } else {
                chip.classList.remove('selected');
            }
        });

        // Update Edit Form Inputs (legacy preferences form — kept for safety, no-op if elements absent)
        const editFirstName = document.getElementById('edit-first-name');
        const editJobTitle = document.getElementById('edit-job-title');
        const editExp = document.getElementById('edit-experience');
        const editRoles = document.getElementById('edit-roles');
        const editLocations = document.getElementById('edit-locations');

        if (editFirstName) editFirstName.value = storedFirstName;
        if (editJobTitle) editJobTitle.value = storedTitle;
        if (editExp) editExp.value = storedExp;
        if (editRoles) editRoles.value = storedRoles.join(', ');
        if (editLocations) editLocations.value = storedLocs.join(', ');
    }

    // Global references to current dashboard state data
    let currentStartups = [];
    let currentMatchedJobs = [];

    // Developer Mode State and Initialization
    let devMode = localStorage.getItem('dev_mode') === 'true' || window.location.search.includes('dev=true') || window.location.search.includes('admin=true');
    if (window.location.search.includes('dev=true') || window.location.search.includes('admin=true')) {
        localStorage.setItem('dev_mode', 'true');
        devMode = true;
    }

    function syncDevMode() {
        const debugStatusPanel = document.getElementById('debug-status-panel');
        const matchingDebugSection = document.getElementById('matching-debug-section');
        const devBadge = document.getElementById('dev-mode-badge');
        
        // Sync local flag with storage
        devMode = localStorage.getItem('dev_mode') === 'true';
        
        if (devMode) {
            if (debugStatusPanel) debugStatusPanel.style.setProperty('display', 'block', 'important');
            if (matchingDebugSection) matchingDebugSection.style.setProperty('display', 'block', 'important');
            if (devBadge) devBadge.style.setProperty('display', 'inline-block', 'important');
        } else {
            if (debugStatusPanel) debugStatusPanel.style.setProperty('display', 'none', 'important');
            if (matchingDebugSection) matchingDebugSection.style.setProperty('display', 'none', 'important');
            if (devBadge) devBadge.style.setProperty('display', 'none', 'important');
        }
    }
    window.syncDevMode = syncDevMode;

    // Toggle dev mode using Ctrl+Shift+D keyboard shortcut
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
            e.preventDefault();
            devMode = !devMode;
            localStorage.setItem('dev_mode', devMode.toString());
            syncDevMode();
            showToast(devMode ? 'Developer Mode Enabled' : 'Developer Mode Disabled');
        }
    });

    // Run initial sync
    syncDevMode();

    function timeAgo(dateString) {
        try {
            const now = new Date();
            const date = new Date(dateString);
            const seconds = Math.floor((now - date) / 1000);
            if (seconds < 0) return 'Just now';
            if (seconds < 60) return 'Just now';
            const minutes = Math.floor(seconds / 60);
            if (minutes < 60) return `${minutes}m ago`;
            const hours = Math.floor(minutes / 60);
            if (hours < 24) return `${hours}h ago`;
            const days = Math.floor(hours / 24);
            return `${days}d ago`;
        } catch (e) {
            return 'Recently';
        }
    }

    async function loadDashboardData() {
        console.log('[DEBUG] loadDashboardData started');
        const isGuest = localStorage.getItem('user_email') === 'guest@fundedjobs.ai';
        const onboardingCompleted = localStorage.getItem('onboarding_completed') === 'true';
        
        let preferredRoles = [];
        try {
            preferredRoles = JSON.parse(localStorage.getItem('pref_roles')) || [];
        } catch (e) {
            preferredRoles = [];
        }
        let preferredLocations = [];
        try {
            preferredLocations = JSON.parse(localStorage.getItem('pref_locations')) || [];
        } catch (e) {
            preferredLocations = [];
        }
        const prefEmailAlerts = localStorage.getItem('pref_email_alerts') || 'false';

        // Elements
        // Stats card 1: recently funded startups count
        const statsStartupMatches = document.getElementById('stats-startup-matches');
        const statsStartupMatchesSubtext = document.getElementById('stats-startup-matches-subtext');
        if (statsStartupMatches) statsStartupMatches.innerText = matchedStartups.length;
        if (statsStartupMatchesSubtext) statsStartupMatchesSubtext.innerText = matchedStartups.length === 1 ? '1 funded startup found.' : `${matchedStartups.length} funded startups found.`;

        // Stats card 2: total startups in DB
        const statsOpenRoles = document.getElementById('stats-open-roles');
        const statsOpenRolesSubtext = document.getElementById('stats-open-roles-subtext');
        if (statsOpenRoles) statsOpenRoles.innerText = startups.length;
        if (statsOpenRolesSubtext) statsOpenRolesSubtext.innerText = startups.length === 1 ? '1 startup discovered.' : `${startups.length} startups in database.`;

        // Stats card 3: emails sent
        const statsEmailCount = document.getElementById('stats-email-alerts-count');
        const statsEmailSubtext = document.getElementById('stats-email-alerts-subtext');
        if (statsEmailCount) statsEmailCount.innerText = emailLogs.length;
        if (statsEmailSubtext) statsEmailSubtext.innerText = emailLogs.length === 0 ? 'No alerts sent yet.' : `${emailLogs.length} alert${emailLogs.length !== 1 ? 's' : ''} sent to you.`;

        const startupsGrid = document.querySelector('.startup-cards-grid');
        const alertsList = document.querySelector('.email-alerts-list');

        // Render skeletons in grid during data loading
        if (startupsGrid) {
            startupsGrid.innerHTML = `
                <div class="skeleton-card">
                    <div class="skeleton-logo"></div>
                    <div class="skeleton-line title"></div>
                    <div class="skeleton-line subtitle"></div>
                    <div class="skeleton-line desc"></div>
                    <div class="skeleton-line footer"></div>
                </div>
                <div class="skeleton-card">
                    <div class="skeleton-logo"></div>
                    <div class="skeleton-line title"></div>
                    <div class="skeleton-line subtitle"></div>
                    <div class="skeleton-line desc"></div>
                    <div class="skeleton-line footer"></div>
                </div>
                <div class="skeleton-card">
                    <div class="skeleton-logo"></div>
                    <div class="skeleton-line title"></div>
                    <div class="skeleton-line subtitle"></div>
                    <div class="skeleton-line desc"></div>
                    <div class="skeleton-line footer"></div>
                </div>
            `;
        }

        let startups = [];
        let jobs = [];
        let emailLogs = [];
        let applications = [];

        // Load data from Supabase
        if (supabase) {
            try {
                // Fetch startups & jobs
                const { data: startupData, error: startupErr } = await supabase
                    .from('fj_funded_startups')
                    .select('*');
                if (startupErr) console.error('Error fetching startups:', startupErr);
                else startups = startupData || [];

                const { data: jobData, error: jobErr } = await supabase
                    .from('fj_startup_jobs')
                    .select('*');
                if (jobErr) console.error('Error fetching jobs:', jobErr);
                else jobs = jobData || [];

                // If authenticated user, fetch email logs
                if (!isGuest) {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        const { data: logs, error: logsErr } = await supabase
                            .from('fj_notifications')
                            .select('*')
                            .eq('user_id', user.id)
                            .order('sent_at', { ascending: false });
                        if (logsErr) console.error('Error fetching email logs:', logsErr);
                        else emailLogs = logs || [];
                    }
                } else {
                    // Fetch guest test email logs
                    const { data: logs, error: logsErr } = await supabase
                        .from('fj_notifications')
                        .select('*')
                        .is('user_id', null)
                        .order('sent_at', { ascending: false });
                    if (logsErr) console.error('Error fetching guest email logs:', logsErr);
                    else emailLogs = logs || [];
                }
            } catch (err) {
                console.error('Error loading Supabase tables:', err);
            }
        }

        // If guest mode and no logs fetched from database, fallback to local storage
        if (isGuest && emailLogs.length === 0) {
            try {
                emailLogs = JSON.parse(localStorage.getItem('guest_email_logs')) || [];
            } catch (e) {
                emailLogs = [];
            }
        }

        // Match startup jobs against preferences with live log generation
        let matchingLogs = [];
        let matchedJobs = [];
        if (onboardingCompleted) {
            matchedJobs = jobs.filter(job => {
                const startup = startups.find(s => s.id === job.startup_id);
                const sName = startup ? startup.startup_name : 'Unknown Startup';
                const titleLower = (job.job_title || '').toLowerCase().trim();
                const locLower = (job.location || '').toLowerCase().trim();

                let matchedRoleName = '';
                const roleMatched = preferredRoles.some(role => {
                    const rLower = role.toLowerCase().trim();
                    if (titleLower === rLower || titleLower.includes(rLower)) {
                        matchedRoleName = role;
                        return true;
                    }
                    return false;
                });

                let matchedLocName = '';
                const locMatched = preferredLocations.some(loc => {
                    const lLower = loc.toLowerCase().trim();
                    if (locLower === lLower || locLower.includes(lLower)) {
                        matchedLocName = loc;
                        return true;
                    }
                    return false;
                });

                const isPass = roleMatched && locMatched;
                let reason = '';
                if (isPass) {
                    reason = `Role matched (${matchedRoleName}) and Location matched (${matchedLocName})`;
                } else if (!roleMatched && !locMatched) {
                    reason = `Role mismatch AND Location mismatch`;
                } else if (!roleMatched) {
                    reason = `Role mismatch (Job: '${job.job_title}')`;
                } else {
                    reason = `Location mismatch (Job: '${job.location}')`;
                }

                matchingLogs.push({
                    startupName: sName,
                    jobTitle: job.job_title,
                    location: job.location,
                    result: isPass ? 'PASS' : 'FAIL',
                    reason: reason
                });

                return isPass;
            });
        }

        // Deduplicate matchedJobs by startup name and job title
        const seenJobKeys = new Set();
        const uniqueMatchedJobs = [];
        matchedJobs.forEach(job => {
            const startup = startups.find(s => s.id === job.startup_id);
            if (startup) {
                const key = `${startup.startup_name.toLowerCase().trim()}::${job.job_title.toLowerCase().trim()}`;
                if (!seenJobKeys.has(key)) {
                    seenJobKeys.add(key);
                    uniqueMatchedJobs.push(job);
                }
            }
        });

        // Match startups containing at least one matched job, ensuring uniqueness by name
        const seenNames = new Set();
        const matchedStartups = [];
        startups.forEach(startup => {
            const hasMatchedJob = uniqueMatchedJobs.some(job => {
                const jStartup = startups.find(s => s.id === job.startup_id);
                return jStartup && jStartup.startup_name.toLowerCase().trim() === startup.startup_name.toLowerCase().trim();
            });
            if (hasMatchedJob) {
                const nameKey = (startup.startup_name || '').toLowerCase().trim();
                if (!seenNames.has(nameKey)) {
                    seenNames.add(nameKey);
                    matchedStartups.push(startup);
                }
            }
        });

        // Store globally for roles modal usage
        currentStartups = startups;
        currentMatchedJobs = uniqueMatchedJobs;

        // Update statistics counters
        if (statsMatchesVal) statsMatchesVal.innerText = matchedStartups.length;
        if (statsRolesVal) statsRolesVal.innerText = uniqueMatchedJobs.length;
        if (statsAlertsVal) statsAlertsVal.innerText = emailLogs.length;

        // Update welcome subtitle dynamically based on matches count
        const welcomeSubtitle = document.querySelector('.welcome-section .welcome-subtitle');
        if (welcomeSubtitle) {
            if (matchedStartups.length > 0) {
                welcomeSubtitle.innerText = `Discover recently funded startups and get instant email alerts. ${matchedStartups.length} startup${matchedStartups.length !== 1 ? 's' : ''} in the database.`;
            } else {
                welcomeSubtitle.innerText = 'Discover recently funded startups and get instant email alerts.';
            }
        }

        // Update subtext messages
        if (statsMatchesSub) {
            statsMatchesSub.innerText = matchedStartups.length > 0 
                ? 'Matches updated today' 
                : 'No startup matches found yet.';
        }
        if (statsRolesSub) {
            statsRolesSub.innerText = uniqueMatchedJobs.length > 0
                ? `Verified across ${matchedStartups.length} startup${matchedStartups.length > 1 ? 's' : ''}`
                : 'No matching opportunities found yet.';
        }
        if (statsAlertsSub) {
            statsAlertsSub.innerText = emailLogs.length > 0
                ? `Status: ${prefEmailAlerts === 'true' ? 'On' : 'Off'}`
                : 'No alerts sent yet.';
        }

        // Update debug panel stats
        if (supabase) {
            try {
                // Fetch stats for debug panel
                const { count: startupsCount } = await supabase
                    .from('fj_funded_startups')
                    .select('*', { count: 'exact', head: true });
                const { count: jobsCount } = await supabase
                    .from('fj_startup_jobs')
                    .select('*', { count: 'exact', head: true });
                const { data: latestArticles } = await supabase
                    .from('fj_processed_articles')
                    .select('processed_at')
                    .order('processed_at', { ascending: false })
                    .limit(1);
                const { data: allNotifications } = await supabase
                    .from('fj_notifications')
                    .select('user_id, email_sent');

                let totalUsersMatched = 0;
                let totalEmailsSent = 0;
                if (allNotifications) {
                    const nonNullUsers = new Set(allNotifications.filter(n => n.user_id !== null).map(n => n.user_id));
                    const hasGuestLog = allNotifications.some(n => n.user_id === null);
                    totalUsersMatched = nonNullUsers.size + (hasGuestLog ? 1 : 0);
                    totalEmailsSent = allNotifications.filter(n => n.email_sent === true).length;
                }

                // Populate debug panel elements
                const debugRssEl = document.getElementById('debug-rss-last-run');
                const debugStartupsEl = document.getElementById('debug-startups-count');
                const debugJobsEl = document.getElementById('debug-jobs-count');
                const debugUsersEl = document.getElementById('debug-users-matched');
                const debugEmailsEl = document.getElementById('debug-emails-sent');

                if (debugRssEl) {
                    debugRssEl.innerText = (latestArticles && latestArticles.length > 0)
                        ? new Date(latestArticles[0].processed_at).toLocaleString()
                        : 'Never';
                }
                if (debugStartupsEl) debugStartupsEl.innerText = startupsCount !== null ? startupsCount : 0;
                if (debugJobsEl) debugJobsEl.innerText = jobsCount !== null ? jobsCount : 0;
                if (debugUsersEl) debugUsersEl.innerText = totalUsersMatched;
                if (debugEmailsEl) debugEmailsEl.innerText = totalEmailsSent;

                // Live debug panel rendering
                const debugPrefRolesEl = document.getElementById('debug-pref-roles');
                const debugPrefLocationsEl = document.getElementById('debug-pref-locations');
                const debugMatchingLogsEl = document.getElementById('debug-matching-logs-container');
                const debugSumStartupsEl = document.getElementById('debug-sum-startups');
                const debugSumJobsEl = document.getElementById('debug-sum-jobs');
                const debugSumUsersEl = document.getElementById('debug-sum-users');
                const debugSumMatchesEl = document.getElementById('debug-sum-matches');
                const debugEmailLogsEl = document.getElementById('debug-email-logs-container');

                if (debugPrefRolesEl) debugPrefRolesEl.innerText = JSON.stringify(preferredRoles);
                if (debugPrefLocationsEl) debugPrefLocationsEl.innerText = JSON.stringify(preferredLocations);
                if (debugSumStartupsEl) debugSumStartupsEl.innerText = startups.length;
                if (debugSumJobsEl) debugSumJobsEl.innerText = jobs.length;
                if (debugSumUsersEl) debugSumUsersEl.innerText = totalUsersMatched;
                if (debugSumMatchesEl) debugSumMatchesEl.innerText = matchedJobs.length;

                if (debugMatchingLogsEl) {
                    debugMatchingLogsEl.innerHTML = '';
                    if (matchingLogs.length === 0) {
                        debugMatchingLogsEl.innerHTML = '<div>No job matching logs processed. Make sure onboarding is completed.</div>';
                    } else {
                        matchingLogs.forEach(log => {
                            const item = document.createElement('div');
                            item.style.padding = '4px 0';
                            item.style.borderBottom = '1px solid rgba(255, 255, 255, 0.02)';
                            const color = log.result === 'PASS' ? '#10b981' : '#ef4444';
                            item.innerHTML = `
                                <strong>[${log.startupName}]</strong> ${log.jobTitle} (${log.location}) -> 
                                <span style="color: ${color}; font-weight: bold;">${log.result}</span> - <em>${log.reason}</em>
                            `;
                            debugMatchingLogsEl.appendChild(item);
                        });
                    }
                }

                if (debugEmailLogsEl) {
                    debugEmailLogsEl.innerHTML = '';
                    if (emailLogs.length === 0) {
                        debugEmailLogsEl.innerHTML = '<div>No email notifications found for this user in the database.</div>';
                    } else {
                        emailLogs.forEach(log => {
                            const item = document.createElement('div');
                            item.style.padding = '4px 0';
                            const startup = startups.find(s => s.id === log.startup_id);
                            const sName = startup ? startup.startup_name : 'Unknown Startup';
                            const statusColor = log.email_sent ? '#10b981' : '#f59e0b';
                            item.innerHTML = `
                                <strong>[${new Date(log.sent_at).toLocaleTimeString()}]</strong> matched role '${log.job_title}' at ${sName} | Status: <span style="color: ${statusColor}; font-weight: bold;">${log.email_sent ? 'Email Sent' : 'Queue/Simulated'}</span>
                            `;
                            debugEmailLogsEl.appendChild(item);
                        });
                    }
                }
            } catch (err) {
                console.error('Error updating debug panel stats:', err);
            }
        }


        // Render Startups Grid
        if (startupsGrid) {
            startupsGrid.innerHTML = '';
            if (matchedStartups.length === 0) {
                startupsGrid.innerHTML = `
                    <div class="dashboard-empty-state" id="startups-empty-state">
                        <div class="empty-state-icon">
                            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                        </div>
                        <h3>No matching funded startups found yet.</h3>
                        <p>We are continuously scanning for newly funded companies matching your preferences.</p>
                    </div>
                `;
            } else {
                matchedStartups.forEach((startup, idx) => {
                    const startupJobs = uniqueMatchedJobs.filter(job => {
                        const jStartup = startups.find(s => s.id === job.startup_id);
                        return jStartup && jStartup.startup_name.toLowerCase().trim() === startup.startup_name.toLowerCase().trim();
                    });
                    
                    // Logo gradients
                    const logoGradients = [
                        'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
                        'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
                        'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
                        'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                        'linear-gradient(135deg, #3b82f6 0%, #10b981 100%)'
                    ];
                    const logoGradient = logoGradients[idx % logoGradients.length];

                    // Avatar group
                    const avatarHtml = startupJobs.slice(0, 3).map((job, avIdx) => {
                        const colors = ['avatar-blue', 'avatar-purple', 'avatar-green', 'avatar-orange', 'avatar-red'];
                        const colorClass = colors[avIdx % colors.length];
                        const initials = job.job_title.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
                        return `<div class="avatar-small ${colorClass}" title="${job.job_title}">${initials}</div>`;
                    }).join('');

                    const card = document.createElement('div');
                    card.className = 'startup-card';
                    card.setAttribute('data-startup-id', startup.id);
                    card.innerHTML = `
                        <div class="startup-card-top">
                            <div class="startup-logo-wrapper" style="background: ${logoGradient}">
                                <span style="font-weight: 700; font-size: 1.2rem;">${(startup.startup_name || '').substring(0, 2).toUpperCase()}</span>
                            </div>
                            <div class="startup-info-header">
                                <div class="startup-name-row">
                                    <h3>${startup.startup_name}</h3>
                                    <span class="startup-stage-badge">${startup.funding_stage}</span>
                                </div>
                                <div class="startup-location">
                                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 4px; opacity: 0.7;">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                        <circle cx="12" cy="10" r="3"></circle>
                                    </svg>
                                    ${startup.location}
                                </div>
                            </div>
                            <div class="startup-funding-amount">${startup.funding_amount}</div>
                        </div>
                        <p class="startup-desc">${startup.description || 'No description available.'}</p>
                        <div class="startup-links" style="margin: 12px 0 4px 0; display: flex; gap: 15px;">
                            ${startup.website ? `
                                <a href="${startup.website}" target="_blank" class="card-link-btn" style="color: #3b82f6; text-decoration: none; font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                                    Website
                                </a>
                            ` : ''}
                            ${startup.source_url ? `
                                <a href="${startup.source_url}" target="_blank" class="card-link-btn" style="color: rgba(255, 255, 255, 0.5); text-decoration: none; font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                    Source Article
                                </a>
                            ` : ''}
                        </div>
                        <div class="startup-card-footer">
                            <div class="footer-left">
                                <span class="footer-meta" style="color: rgba(255,255,255,0.45); font-size: 0.78rem;">${startup.funding_date ? `Funded: ${startup.funding_date}` : startup.funding_stage}</span>
                            </div>
                            <button type="button" class="view-roles-btn" data-startup-id="${startup.id}">View Details</button>
                        </div>
                    `;
                    startupsGrid.appendChild(card);
                });

                // Attach modal open triggers to dynamic buttons
                startupsGrid.querySelectorAll('.view-roles-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const startupId = btn.getAttribute('data-startup-id');
                        openRolesModalForStartup(startupId);
                    });
                });
            }
        }

        // Render Email Alerts List
        if (alertsList) {
            alertsList.innerHTML = '';
            if (emailLogs.length === 0) {
                alertsList.innerHTML = `
                    <div class="dashboard-empty-state compact" id="alerts-empty-state">
                        <div class="empty-state-icon">
                            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                <polyline points="22,6 12,13 2,6"></polyline>
                            </svg>
                        </div>
                        <h3>No email alerts have been sent yet.</h3>
                        <p>When matching startups are found, your alerts will appear here.</p>
                    </div>
                `;
            } else {
                emailLogs.forEach(log => {
                    const row = document.createElement('div');
                    row.className = 'email-alert-row';

                    // Look up startup details using startup_id
                    const startup = startups.find(s => s.id === log.startup_id);
                    const startupName = startup ? startup.startup_name : 'Unknown Startup';
                    const amount = startup ? startup.funding_amount : '';
                    const stage = startup ? startup.funding_stage : '';

                    // Find corresponding job to get apply url
                    const job = jobs.find(j => j.startup_id === log.startup_id && j.job_title === log.job_title);
                    const applyUrl = job ? job.apply_url : '';

                    const titleText = `${startupName} raised ${amount} ${stage}`.trim();
                    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
                    const formattedDate = new Date(log.sent_at).toLocaleDateString('en-US', dateOptions);
                    const sentLabel = `Sent: ${formattedDate}`;

                    row.innerHTML = `
                        <div class="alert-icon-wrapper">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                <polyline points="22,6 12,13 2,6"></polyline>
                            </svg>
                        </div>
                        <div class="alert-info">
                            <h4>${titleText}</h4>
                            <p>${sentLabel}</p>
                        </div>
                        <svg class="alert-arrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    `;
                    row.addEventListener('click', () => {
                        alert(`Alert Email Body:\n\nStartup: ${startupName}\nStage: ${stage}\nAmount: ${amount}\nMatching Role: ${log.job_title}`);
                    });
                    alertsList.appendChild(row);
                });
            }
        }
    }

    async function handleAuthSuccess() {
        console.log('[DEBUG] handleAuthSuccess started');
        if (!supabase) {
            console.log('[DEBUG] Supabase client missing in handleAuthSuccess');
            const onboardingCompleted = localStorage.getItem('onboarding_completed') === 'true';
            if (onboardingCompleted) {
                syncPreferencesToFormAndProfile();
                await updateActivePage('dashboard');
            } else {
                await updateActivePage('onboarding-step-1');
            }
            return;
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const { data: { user } } = await supabase.auth.getUser();
            console.log('[DEBUG] STEP 3: Current authenticated user:', user ? user.email : 'None');
            console.log('[DEBUG] STEP 3: Current session:', session ? session : 'None');
            
            if (user) {
                console.log('[DEBUG] Login Success: detected user', user.email);
                // SECURITY CHECK: Is email verified?
                const isEmailConfirmed = user.email_confirmed_at || user.confirmed_at || user.email_confirmed;
                if (!isEmailConfirmed) {
                    console.log('[DEBUG] Login Failure: unverified email', user.email);
                    alert('Please verify your email before signing in.');
                    try {
                        await supabase.auth.signOut();
                    } catch (signOutErr) {
                        console.error('Error signing out unverified user:', signOutErr);
                    }
                    localStorage.removeItem('user_email');
                    showLogin();
                    await updateActivePage('login');
                    return;
                }

                // Fetch profile
                const { data: profile, error: profileErr } = await supabase
                    .from('fj_profiles')
                    .select('*')
                    .eq('id', user.id)
                    .maybeSingle();

                // Fetch preferences
                const { data: preferences, error: prefErr } = await supabase
                    .from('fj_preferences')
                    .select('*')
                    .eq('user_id', user.id)
                    .maybeSingle();

                const combinedProfile = profile ? {
                    ...profile,
                    preferred_roles: preferences ? preferences.preferred_roles : [],
                    preferred_locations: preferences ? preferences.preferred_locations : [],
                    startup_stages: preferences ? preferences.startup_stages : '',
                    email_alerts: preferences ? preferences.email_alerts : false
                } : null;

                if (combinedProfile) {
                    console.log('[DEBUG] Profile found for user. Navigating to dashboard.');
                    localStorage.setItem('pref_first_name', combinedProfile.first_name || '');
                    localStorage.setItem('pref_job_title', combinedProfile.job_title || '');
                    localStorage.setItem('pref_experience', combinedProfile.experience || '');
                    localStorage.setItem('pref_roles', JSON.stringify(combinedProfile.preferred_roles || []));
                    localStorage.setItem('pref_locations', JSON.stringify(combinedProfile.preferred_locations || []));
                    localStorage.setItem('pref_startup_stage', combinedProfile.startup_stages || '');
                    localStorage.setItem('pref_email_alerts', (combinedProfile.email_alerts || false).toString());
                    localStorage.setItem('onboarding_completed', 'true');
                    localStorage.setItem('user_email', user.email);

                    syncPreferencesToFormAndProfile();
                    await updateActivePage('dashboard');
                } else {
                    console.log('[DEBUG] No profile found. Navigating to onboarding.');
                    // Start onboarding fresh for new user
                    localStorage.removeItem('pref_first_name');
                    localStorage.removeItem('pref_job_title');
                    localStorage.removeItem('pref_experience');
                    localStorage.removeItem('pref_roles');
                    localStorage.removeItem('pref_locations');
                    localStorage.removeItem('pref_startup_stage');
                    localStorage.removeItem('pref_email_alerts');
                    localStorage.setItem('onboarding_completed', 'false');
                    localStorage.setItem('user_email', user.email);

                    await updateActivePage('onboarding-step-1');
                }
            } else {
                console.log('[DEBUG] Session missing: no user object returned');
                await updateActivePage('login');
            }
        } catch (err) {
            console.error('[DEBUG] Login failure / verification error:', err);
            await updateActivePage('login');
        }
    }

    function renderActivePage() {
        // Hide all major screens
        if (authScreen) authScreen.style.display = 'none';
        if (onboardingScreen) onboardingScreen.style.display = 'none';
        if (successScreen) successScreen.style.display = 'none';
        if (dashboardScreen) dashboardScreen.style.display = 'none';
        if (progressWrapper) progressWrapper.style.display = 'none';

        if (activePage === 'login') {
            if (authScreen) authScreen.style.display = 'grid';
        } else if (activePage.startsWith('onboarding-step-')) {
            if (onboardingScreen) onboardingScreen.style.display = 'flex';
            if (progressWrapper) progressWrapper.style.display = 'flex';

            const stepNum = parseInt(activePage.replace('onboarding-step-', ''));
            
            // Show only the current step pane
            document.querySelectorAll('.onboarding-step-pane').forEach(pane => {
                const paneStep = parseInt(pane.getAttribute('data-step'));
                if (paneStep === stepNum) {
                    pane.style.display = 'block';
                } else {
                    pane.style.display = 'none';
                }
            });

            // Update step header label
            if (stepTextEl) {
                if (stepNum === 4) {
                    stepTextEl.innerText = 'Step 4 of 4';
                } else {
                    stepTextEl.innerText = `Step ${stepNum} of 4`;
                }
            }

            // Sync progress bar values
            const percentage = stepNum * 25;
            if (progressPercent) {
                progressPercent.innerText = `${percentage}%`;
            }
            if (progressIndicator) {
                progressIndicator.style.width = `${percentage}%`;
            }

            // Sync NEXT / FINISH button content
            if (btnOnboardNext) {
                if (stepNum === 4) {
                    btnOnboardNext.innerHTML = `
                        <span>FINISH SETUP</span>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 8px; vertical-align: middle;">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    `;
                } else {
                    btnOnboardNext.innerHTML = '<span>NEXT &gt;</span>';
                }
            }

            // Validate fields for current step
            validateStep(stepNum);
        } else if (activePage === 'onboarding-success') {
            if (successScreen) successScreen.style.display = 'flex';
        } else if (activePage === 'dashboard') {
            if (dashboardScreen) dashboardScreen.style.display = 'flex';
        }
    }

    async function verifyRouteProtection(targetPage) {
        console.log(`[DEBUG] STEP 7: Routing requested to page: "${targetPage}"`);
        const isGuest = localStorage.getItem('user_email') === 'guest@fundedjobs.ai';
        const onboardingCompleted = localStorage.getItem('onboarding_completed') === 'true';
        let hasSession = false;

        if (supabase) {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session && session.user) {
                    const user = session.user;
                    const isEmailConfirmed = user.email_confirmed_at || user.confirmed_at || user.email_confirmed;
                    if (isEmailConfirmed) {
                        hasSession = true;
                        console.log('[DEBUG] STEP 7: Active and verified session detected for:', user.email);
                    } else {
                        console.log('[DEBUG] STEP 7: Session user is unverified:', user.email);
                    }
                } else {
                    console.log('[DEBUG] STEP 7: Session missing');
                }
            } catch (err) {
                console.error('[DEBUG] STEP 7: Session verification error:', err);
            }
        } else {
            console.log('[DEBUG] STEP 7: Supabase client unavailable, relying on guest checks');
        }

        const isPublicPage = targetPage === 'login';
        if (isPublicPage) {
            if (hasSession || isGuest) {
                console.log('[DEBUG] STEP 7: Authenticated user/guest attempted to access public login page. Redirecting.');
                return onboardingCompleted ? 'dashboard' : 'onboarding-step-1';
            }
            return 'login';
        }

        if (hasSession || isGuest) {
            if (targetPage === 'dashboard' && !onboardingCompleted) {
                console.log('[DEBUG] STEP 7: User attempted to access dashboard before completing onboarding. Redirecting to onboarding step 1.');
                return 'onboarding-step-1';
            }
            if (targetPage.startsWith('onboarding-') && targetPage !== 'onboarding-success' && onboardingCompleted) {
                console.log('[DEBUG] STEP 7: User already completed onboarding. Redirecting to dashboard.');
                return 'dashboard';
            }
            return targetPage;
        }

        console.log('[DEBUG] STEP 7: Unauthenticated access blocked. Redirecting to login.');
        return 'login';
    }

    async function updateActivePage(newPage) {
        const resolvedPage = await verifyRouteProtection(newPage);
        activePage = resolvedPage;
        window.activePage = resolvedPage;
        
        if (activePage === 'dashboard') {
            await loadDashboardData();
        }
        
        renderActivePage();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // -----------------------------------------------------------------
    // SCREEN 1 - AUTH STATE SWITCHING (LOGIN / SIGN UP)
    // -----------------------------------------------------------------
    function showLogin() {
        if (toggleLogin) toggleLogin.classList.add('active');
        if (toggleSignup) toggleSignup.classList.remove('active');
        if (authTitle) authTitle.textContent = 'Welcome Back';
        if (loginForm) loginForm.style.display = 'flex';
        if (signupForm) signupForm.style.display = 'none';
    }

    function showSignup() {
        if (toggleSignup) toggleSignup.classList.add('active');
        if (toggleLogin) toggleLogin.classList.remove('active');
        if (authTitle) authTitle.textContent = 'Create Account';
        if (loginForm) loginForm.style.display = 'none';
        if (signupForm) signupForm.style.display = 'flex';
    }

    if (toggleLogin) toggleLogin.addEventListener('click', showLogin);
    if (toggleSignup) toggleSignup.addEventListener('click', showSignup);

    // Login Form Submit Logger
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('login-email');
            const passwordInput = document.getElementById('login-password');
            const email = emailInput ? emailInput.value.trim() : '';
            const password = passwordInput ? passwordInput.value : '';
            console.log('[DEBUG] Login request: email', email);
            
            // Client-side validations
            if (!email) {
                alert('Sign In Error: Please enter your email address.');
                return;
            }
            if (!password) {
                alert('Sign In Error: Please enter your password.');
                return;
            }
            
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalText = submitBtn ? submitBtn.innerHTML : '';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span>Signing In...</span>';
            }
            
            try {
                if (supabase) {
                    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                    if (error) {
                        console.error('[DEBUG] Login failure / authentication error:', error.message);
                        alert('Sign In Error: ' + error.message);
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.innerHTML = originalText;
                        }
                        return;
                    }
                } else {
                    localStorage.setItem('user_email', email);
                }
                console.log('[DEBUG] Login success / password authentication complete');
                await handleAuthSuccess();
            } catch (err) {
                console.error('[DEBUG] Login submit exception occurred:', err);
                alert('Sign In Error: ' + err.message);
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }
            }
        });
    }

    // Signup Form Submit Logger
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('signup-email');
            const passwordInput = document.getElementById('signup-password');
            const confirmPasswordInput = document.getElementById('signup-confirm-password');
            
            const email = emailInput ? emailInput.value.trim() : '';
            const password = passwordInput ? passwordInput.value : '';
            const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';
            console.log('[DEBUG] STEP 1: Signup request started');
            console.log('[DEBUG] STEP 1: Email entered:', email);
            
            // Client-side validations
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!email) {
                alert('Sign Up Error: Please enter an email address.');
                return;
            }
            if (!emailRegex.test(email)) {
                alert('Sign Up Error: Please enter a valid email address.');
                return;
            }
            if (!password) {
                alert('Sign Up Error: Please enter a password.');
                return;
            }
            if (password.length < 6) {
                alert('Sign Up Error: Password must be at least 6 characters long.');
                return;
            }
            if (!confirmPassword) {
                alert('Sign Up Error: Please confirm your password.');
                return;
            }
            if (password !== confirmPassword) {
                alert('Sign Up Error: Passwords do not match.');
                return;
            }
            
            const submitBtn = signupForm.querySelector('button[type="submit"]');
            const originalText = submitBtn ? submitBtn.innerHTML : '';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span>Creating Account...</span>';
            }
            
            try {
                if (supabase) {
                    const { data, error } = await supabase.auth.signUp({ email, password });
                    if (error) {
                        console.error('[DEBUG] STEP 2: Signup failure - Full error message:', error);
                        alert('Sign Up Error: ' + error.message);
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.innerHTML = originalText;
                        }
                        return;
                    }
                    console.log('[DEBUG] STEP 2: Signup response:', data);
                    if (data && data.user) {
                        console.log('[DEBUG] STEP 2: User ID returned:', data.user.id);
                    }
                    
                    if (data && data.session) {
                        console.log('[DEBUG] STEP 2: Signup response: Auto-login successful (Confirm email is OFF)');
                        localStorage.setItem('user_email', email);
                        await handleAuthSuccess();
                    } else {
                        console.log('[DEBUG] STEP 2: Signup response: Verification email required (Confirm email is ON)');
                        // Call signOut immediately to ensure they are not logged in without verification
                        try {
                            await supabase.auth.signOut();
                        } catch (signOutErr) {
                            console.error('Error signing out unverified user:', signOutErr);
                        }
                        alert('Please verify your email address before continuing.');
                        showLogin();
                        await updateActivePage('login');
                    }
                } else {
                    console.log('[DEBUG] STEP 2: Signup response: local success (Guest Mode)');
                    localStorage.setItem('user_email', email);
                    await handleAuthSuccess();
                }
            } catch (err) {
                console.error('[DEBUG] STEP 2: Signup failure - Full error message:', err.message || err);
                alert('Sign Up Error: ' + err.message);
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }
            }
        });
    }

    // Guest Mode entry trigger
    if (btnGuest) {
        btnGuest.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log('Continue as Guest clicked');
            
            if (supabase) {
                await supabase.auth.signOut();
            }
            
            localStorage.setItem('user_email', 'guest@fundedjobs.ai');
            const profileEmail = document.getElementById('profile-user-email');
            if (profileEmail) profileEmail.innerText = 'guest@fundedjobs.ai';
            await handleAuthSuccess();
        });
    }

    // Forgot Password entry trigger
    const forgotPasswordLink = document.getElementById('forgot-password');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Forgot Password clicked');
            const emailInput = document.getElementById('login-email');
            const emailVal = emailInput ? emailInput.value.trim() : '';
            if (emailVal) {
                showToast(`Simulated: Recovery link sent to ${emailVal}`);
            } else {
                alert('Please enter your email address in the email field first.');
            }
        });
    }


    // -----------------------------------------------------------------
    // WIZARD VALIDATIONS & INTERACTIVES
    // -----------------------------------------------------------------
    function validateStep(stepNum) {
        let isValid = false;

        if (stepNum === 1) {
            const firstNameEl = document.getElementById('onboard-first-name');
            const firstName = firstNameEl ? firstNameEl.value.trim() : '';

            const titleSelect = onboardTitle ? onboardTitle.value : '';
            const expVal = onboardExp ? onboardExp.value : '';
            
            let isTitleValid = false;
            if (titleSelect === 'Other') {
                const titleOtherVal = document.getElementById('onboard-title-other') ? document.getElementById('onboard-title-other').value.trim() : '';
                // Required, min 2 chars, max 100 chars
                isTitleValid = (titleOtherVal.length >= 2 && titleOtherVal.length <= 100);
            } else {
                isTitleValid = (titleSelect !== '');
            }

            isValid = (firstName.length >= 1 && isTitleValid && expVal !== '' && expVal !== null);
        } else if (stepNum === 2) {
            const selectedRolesCount = document.querySelectorAll('#roles-chips-wrapper .chip-btn.selected').length;
            let isRoleOtherValid = true;
            
            const otherRoleChip = document.querySelector('#roles-chips-wrapper .chip-btn[data-value="Other"]');
            const isOtherRoleSelected = otherRoleChip ? otherRoleChip.classList.contains('selected') : false;
            
            if (isOtherRoleSelected) {
                const otherRoleVal = document.getElementById('onboard-role-other') ? document.getElementById('onboard-role-other').value.trim() : '';
                // Required when selected, min 2 chars, max 100 chars
                isRoleOtherValid = (otherRoleVal.length >= 2 && otherRoleVal.length <= 100);
            }

            isValid = (selectedRolesCount >= 1 && selectedRolesCount <= 5 && isRoleOtherValid);
        } else if (stepNum === 3) {
            const selectedLocsCount = document.querySelectorAll('#locations-grid-wrapper .location-option-card.selected:not(.more-loc-card)').length;
            const selectedDropdownCount = document.querySelectorAll('#cities-checklist-wrapper input[type="checkbox"]:checked:not([data-city="Other"])').length;
            const customChipsCount = customLocations.length;
            isValid = ((selectedLocsCount + selectedDropdownCount + customChipsCount) >= 1);
        } else if (stepNum === 4) {
            // Optional preferences, Next button is always active
            isValid = true;
        }

        if (btnOnboardNext) {
            btnOnboardNext.disabled = !isValid;
            btnOnboardNext.style.opacity = isValid ? '1' : '0.5';
            btnOnboardNext.style.cursor = isValid ? 'pointer' : 'not-allowed';
        }
    }

    // Step 1 listeners
    const onboardTitleOtherGroup = document.getElementById('onboard-title-other-group');
    const onboardTitleOther = document.getElementById('onboard-title-other');

    const onboardFirstName = document.getElementById('onboard-first-name');
    if (onboardFirstName) {
        onboardFirstName.addEventListener('input', () => validateStep(1));
    }

    if (onboardTitle) {
        onboardTitle.addEventListener('change', () => {
            if (onboardTitle.value === 'Other') {
                if (onboardTitleOtherGroup) onboardTitleOtherGroup.style.display = 'block';
            } else {
                if (onboardTitleOtherGroup) onboardTitleOtherGroup.style.display = 'none';
                if (onboardTitleOther) onboardTitleOther.value = '';
            }
            validateStep(1);
        });
    }
    if (onboardTitleOther) {
        onboardTitleOther.addEventListener('input', () => validateStep(1));
    }
    if (onboardExp) {
        onboardExp.addEventListener('change', () => validateStep(1));
    }

    // Step 2 Roles Selection pill toggle rules
    const roleChips = document.querySelectorAll('#roles-chips-wrapper .chip-btn');
    const onboardRoleOtherGroup = document.getElementById('onboard-role-other-group');
    const onboardRoleOther = document.getElementById('onboard-role-other');

    roleChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const isSelected = chip.classList.contains('selected');
            const currentlySelectedCount = document.querySelectorAll('#roles-chips-wrapper .chip-btn.selected').length;

            if (isSelected) {
                chip.classList.remove('selected');
                if (chip.getAttribute('data-value') === 'Other') {
                    if (onboardRoleOtherGroup) onboardRoleOtherGroup.style.display = 'none';
                    if (onboardRoleOther) onboardRoleOther.value = '';
                }
            } else {
                // Maximum 5 roles rule check
                if (currentlySelectedCount < 5) {
                    chip.classList.add('selected');
                    if (chip.getAttribute('data-value') === 'Other') {
                        if (onboardRoleOtherGroup) onboardRoleOtherGroup.style.display = 'block';
                    }
                } else {
                    console.log('Maximum 5 role selections allowed.');
                }
            }
            validateStep(2);
        });
    });

    if (onboardRoleOther) {
        onboardRoleOther.addEventListener('input', () => validateStep(2));
    }

    // Step 3 Location Selection card toggle rules (exclude More Locations card)
    const locCards = document.querySelectorAll('#locations-grid-wrapper .location-option-card:not(.more-loc-card)');
    locCards.forEach(card => {
        card.addEventListener('click', () => {
            card.classList.toggle('selected');
            validateStep(3);
        });
    });

    // Toggle More Locations Dropdown
    const btnMoreLocations = document.getElementById('btn-more-locations');
    const moreLocsDropdown = document.getElementById('more-locations-dropdown-container');
    if (btnMoreLocations) {
        btnMoreLocations.addEventListener('click', () => {
            btnMoreLocations.classList.toggle('selected');
            if (moreLocsDropdown) {
                if (moreLocsDropdown.style.display === 'none') {
                    moreLocsDropdown.style.display = 'flex';
                } else {
                    moreLocsDropdown.style.display = 'none';
                }
            }
        });
    }

    // Search filter logic for dropdown
    const locSearchInput = document.getElementById('onboard-loc-search');
    if (locSearchInput) {
        locSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const options = document.querySelectorAll('#cities-checklist-wrapper .city-option');
            options.forEach(opt => {
                const cityName = opt.querySelector('span').innerText.toLowerCase();
                if (cityName.includes(query)) {
                    opt.style.display = 'flex';
                } else {
                    opt.style.display = 'none';
                }
            });
        });
    }

    // Selected location chips rendering function
    function renderLocationChips() {
        const chipsContainer = document.getElementById('selected-locations-chips');
        if (!chipsContainer) return;
        chipsContainer.innerHTML = '';

        // Dropdown selected cities (except 'Other')
        document.querySelectorAll('#cities-checklist-wrapper input[type="checkbox"]:checked').forEach(chk => {
            const cityName = chk.getAttribute('data-city');
            if (cityName === 'Other') return;
            
            const chip = document.createElement('div');
            chip.className = 'loc-chip';
            chip.innerHTML = `
                <span>${cityName}</span>
                <button type="button" class="chip-close" data-city="${cityName}">&times;</button>
            `;
            chipsContainer.appendChild(chip);
        });

        // Custom entered locations
        customLocations.forEach(locName => {
            const chip = document.createElement('div');
            chip.className = 'loc-chip';
            chip.innerHTML = `
                <span>${locName}</span>
                <button type="button" class="chip-close" data-custom="${locName}">&times;</button>
            `;
            chipsContainer.appendChild(chip);
        });

        // Event listeners to dismiss chips
        chipsContainer.querySelectorAll('.chip-close').forEach(btn => {
            btn.addEventListener('click', () => {
                const city = btn.getAttribute('data-city');
                const custom = btn.getAttribute('data-custom');
                if (city) {
                    const chk = document.querySelector(`#cities-checklist-wrapper input[data-city="${city}"]`);
                    if (chk) {
                        chk.checked = false;
                        chk.dispatchEvent(new Event('change'));
                    }
                } else if (custom) {
                    customLocations = customLocations.filter(c => c !== custom);
                    renderLocationChips();
                    validateStep(3);
                }
            });
        });
    }

    // Dropdown checkbox selections
    const cityCheckboxes = document.querySelectorAll('#cities-checklist-wrapper input[type="checkbox"]');
    const locOtherGroup = document.getElementById('onboard-loc-other-group');
    const locOtherInput = document.getElementById('onboard-loc-other');

    cityCheckboxes.forEach(chk => {
        chk.addEventListener('change', () => {
            const cityName = chk.getAttribute('data-city');
            if (cityName === 'Other') {
                if (chk.checked) {
                    if (locOtherGroup) locOtherGroup.style.display = 'block';
                    if (locOtherInput) locOtherInput.focus();
                } else {
                    if (locOtherGroup) locOtherGroup.style.display = 'none';
                    if (locOtherInput) locOtherInput.value = '';
                }
            }
            renderLocationChips();
            validateStep(3);
        });
    });

    // Custom Location Add button action
    const btnAddOtherLoc = document.getElementById('btn-add-other-loc');
    function addCustomLocation() {
        if (!locOtherInput) return;
        const val = locOtherInput.value.trim();
        if (val.length >= 2 && val.length <= 100) {
            if (!customLocations.includes(val)) {
                customLocations.push(val);
            }
            locOtherInput.value = '';
            renderLocationChips();
            validateStep(3);
        }
    }

    if (btnAddOtherLoc) {
        btnAddOtherLoc.addEventListener('click', addCustomLocation);
    }
    if (locOtherInput) {
        locOtherInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addCustomLocation();
            }
        });
    }

    // Step 4 Preferences Toggle logic
    const stageCards = document.querySelectorAll('#stages-grid-wrapper .stage-option-card');
    stageCards.forEach(card => {
        card.addEventListener('click', () => {
            card.classList.toggle('selected');
            validateStep(4);
        });
    });

    // Save Preference variables to LocalStorage on onboarding completion
    // Save Preference variables to LocalStorage on onboarding completion
    async function savePreferences() {
        const firstNameEl = document.getElementById('onboard-first-name');
        const firstName = firstNameEl ? firstNameEl.value.trim() : '';

        const titleSelect = onboardTitle ? onboardTitle.value : '';
        let title = titleSelect;
        if (titleSelect === 'Other') {
            const titleOther = document.getElementById('onboard-title-other');
            title = titleOther ? titleOther.value.trim() : 'Other';
        }
        const exp = onboardExp ? onboardExp.value : '';

        const roles = [];
        document.querySelectorAll('#roles-chips-wrapper .chip-btn.selected').forEach(chip => {
            const val = chip.getAttribute('data-value');
            if (val === 'Other') {
                const otherRoleInput = document.getElementById('onboard-role-other');
                roles.push(otherRoleInput ? otherRoleInput.value.trim() : 'Other');
            } else {
                roles.push(val);
            }
        });

        const locations = [];
        // Popular locations card selections (excluding more-loc-card)
        document.querySelectorAll('#locations-grid-wrapper .location-option-card.selected:not(.more-loc-card)').forEach(card => {
            locations.push(card.getAttribute('data-value'));
        });
        // Search dropdown selected checklist cities (except 'Other')
        document.querySelectorAll('#cities-checklist-wrapper input[type="checkbox"]:checked').forEach(chk => {
            const cityName = chk.getAttribute('data-city');
            if (cityName !== 'Other') {
                locations.push(cityName);
            }
        });
        // Custom added locations
        customLocations.forEach(locName => {
            locations.push(locName);
        });

        const stages = [];
        document.querySelectorAll('#stages-grid-wrapper .stage-option-card.selected').forEach(card => {
            stages.push(card.getAttribute('data-value'));
        });

        const emailAlerts = document.getElementById('onboard-email-alerts').checked;

        localStorage.setItem('pref_first_name', firstName);
        localStorage.setItem('pref_job_title', title);
        localStorage.setItem('pref_experience', exp);
        localStorage.setItem('pref_roles', JSON.stringify(roles));
        localStorage.setItem('pref_locations', JSON.stringify(locations));
        localStorage.setItem('pref_startup_stage', stages.join(', '));
        localStorage.setItem('pref_email_alerts', emailAlerts.toString());
        localStorage.setItem('onboarding_completed', 'true');

        // Write to Supabase if logged in
        if (supabase) {
            try {
                console.log('[DEBUG] savePreferences: Attempting to fetch authenticated user from Supabase...');
                const { data: { user }, error: userErr } = await supabase.auth.getUser();
                if (userErr) {
                    console.error('[DEBUG] savePreferences: getUser error:', userErr);
                }
                if (user) {
                    console.log('[DEBUG] savePreferences: Authenticated user found:', user.email, 'ID:', user.id);
                    
                    const profilePayload = {
                        id: user.id,
                        first_name: firstName,
                        email: user.email,
                        job_title: title,
                        experience: exp
                    };
                    const preferencesPayload = {
                        user_id: user.id,
                        preferred_roles: roles,
                        preferred_locations: locations,
                        startup_stages: stages.join(', '),
                        email_alerts: emailAlerts
                    };
                    console.log('[DEBUG] STEP 4: Profile payload:', profilePayload);
                    console.log('[DEBUG] STEP 4: Preferences payload:', preferencesPayload);

                    // Upsert to fj_profiles
                    console.log('[DEBUG] STEP 4: Attempting to upsert profile to fj_profiles...');
                    const { error: profileErr } = await supabase
                        .from('fj_profiles')
                        .upsert(profilePayload);
                    if (profileErr) {
                        console.error('[DEBUG] STEP 4: Profile insert failure. Full error:', profileErr);
                        console.error('[DEBUG] STEP 6: Profile RLS/database error:', profileErr);
                    } else {
                        console.log('[DEBUG] STEP 4: Profile insert success');
                    }

                    // Upsert to fj_preferences
                    console.log('[DEBUG] STEP 4: Attempting to upsert preferences to fj_preferences...');
                    const { error: prefErr } = await supabase
                        .from('fj_preferences')
                        .upsert(preferencesPayload, { onConflict: 'user_id' });
                    if (prefErr) {
                        console.error('[DEBUG] STEP 4: Preferences insert failure. Full error:', prefErr);
                        console.error('[DEBUG] STEP 6: Preferences RLS/database error:', prefErr);
                    } else {
                        console.log('[DEBUG] STEP 4: Preferences insert success');
                    }

                    // STEP 5: Database Verification
                    console.log('[DEBUG] STEP 5: Database Verification immediately after save attempt...');
                    try {
                        const { data: profRows, error: profVerErr, count: profCount } = await supabase
                            .from('fj_profiles')
                            .select('*', { count: 'exact' });
                        console.log('[DEBUG] STEP 5: SELECT COUNT(*) FROM fj_profiles count result:', profCount, 'rows returned:', profRows ? profRows.length : 0);
                        if (profVerErr) {
                            console.error('[DEBUG] STEP 5: profile verify query error:', profVerErr);
                        }
                    } catch (verifyEx) {
                        console.error('[DEBUG] STEP 5: Exception during profiles count verification:', verifyEx);
                    }

                    try {
                        const { data: prefRows, error: prefVerErr, count: prefCount } = await supabase
                            .from('fj_preferences')
                            .select('*', { count: 'exact' });
                        console.log('[DEBUG] STEP 5: SELECT COUNT(*) FROM fj_preferences count result:', prefCount, 'rows returned:', prefRows ? prefRows.length : 0);
                        if (prefVerErr) {
                            console.error('[DEBUG] STEP 5: preferences verify query error:', prefVerErr);
                        }
                    } catch (verifyEx) {
                        console.error('[DEBUG] STEP 5: Exception during preferences count verification:', verifyEx);
                    }

                } else {
                    console.warn('[DEBUG] savePreferences: No authenticated user session found (Guest Mode). Supabase database writes skipped.');
                }
            } catch (err) {
                console.error('[DEBUG] savePreferences: Exception occurred during database save:', err);
            }
        }

        console.log('Preferences saved successfully to local storage:', {
            pref_job_title: title,
            pref_experience: exp,
            pref_roles: roles,
            pref_locations: locations,
            pref_startup_stage: stages.join(', '),
            pref_email_alerts: emailAlerts
        });
    }

    // -----------------------------------------------------------------
    // NAVIGATION WIZARD EVENTS
    // -----------------------------------------------------------------
    if (btnOnboardNext) {
        btnOnboardNext.addEventListener('click', async () => {
            if (activePage === 'onboarding-step-1') {
                updateActivePage('onboarding-step-2');
            } else if (activePage === 'onboarding-step-2') {
                updateActivePage('onboarding-step-3');
            } else if (activePage === 'onboarding-step-3') {
                updateActivePage('onboarding-step-4');
            } else if (activePage === 'onboarding-step-4') {
                await savePreferences();
                // Aha-moment: send one welcome email on first onboarding completion
                // Guard: check fj_profiles.welcome_email_sent in Supabase (not localStorage)
                try {
                    let ahaMail = localStorage.getItem('user_email') || '';
                    let ahaUserId = null;
                    let ahaName = localStorage.getItem('pref_first_name') || 'there';
                    if (supabase) {
                        const { data: { user: ahaUser } } = await supabase.auth.getUser();
                        if (ahaUser) {
                            ahaMail = ahaUser.email;
                            ahaUserId = ahaUser.id;
                            // Check welcome_email_sent in fj_profiles
                            const { data: ahaProfile } = await supabase
                                .from('fj_profiles')
                                .select('welcome_email_sent')
                                .eq('id', ahaUser.id)
                                .maybeSingle();
                            const alreadySent = ahaProfile && ahaProfile.welcome_email_sent === true;
                            if (!alreadySent && ahaMail && ahaMail !== 'guest@fundedjobs.ai') {
                                console.log('[AHA] Sending first-time welcome email to', ahaMail);
                                const ahaRes = await fetch('/api/send-test-email', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ email: ahaMail, user_id: ahaUserId, first_name: ahaName })
                                });
                                const ahaData = await ahaRes.json();
                                if (ahaData.success) {
                                    // Persist in Supabase so it never fires again on any device
                                    await supabase
                                        .from('fj_profiles')
                                        .update({ welcome_email_sent: true })
                                        .eq('id', ahaUser.id);
                                    console.log('[AHA] Welcome email sent and recorded in Supabase.');
                                } else {
                                    console.warn('[AHA] Welcome email send failed:', ahaData);
                                }
                            } else if (alreadySent) {
                                console.log('[AHA] Welcome email already sent. Skipping.');
                            }
                        }
                    }
                } catch (ahaErr) {
                    console.warn('[AHA] Welcome email error (non-blocking):', ahaErr);
                }
                updateActivePage('onboarding-success');
            }
        });
    }

    function goBack() {
        if (activePage === 'onboarding-step-1') {
            updateActivePage('login');
        } else if (activePage === 'onboarding-step-2') {
            updateActivePage('onboarding-step-1');
        } else if (activePage === 'onboarding-step-3') {
            updateActivePage('onboarding-step-2');
        } else if (activePage === 'onboarding-step-4') {
            updateActivePage('onboarding-step-3');
        }
    }

    if (btnOnboardBack) btnOnboardBack.addEventListener('click', goBack);
    if (headerBackBtn) headerBackBtn.addEventListener('click', goBack);

    // Header Close Button redirects to login
    if (headerCloseBtn) {
        headerCloseBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to exit setup? Progress will be lost.')) {
                // Reset inputs
                if (onboardTitle) onboardTitle.value = '';
                if (onboardExp) onboardExp.selectedIndex = 0;
                document.querySelectorAll('.chip-btn.selected, .location-option-card.selected, .stage-option-card.selected').forEach(el => el.classList.remove('selected'));
                
                // Reset Step 3 Location selection states
                customLocations = [];
                document.querySelectorAll('#cities-checklist-wrapper input[type="checkbox"]').forEach(chk => chk.checked = false);
                const locChipsContainer = document.getElementById('selected-locations-chips');
                if (locChipsContainer) locChipsContainer.innerHTML = '';
                const locSearch = document.getElementById('onboard-loc-search');
                if (locSearch) locSearch.value = '';
                
                const moreLocsDropdown = document.getElementById('more-locations-dropdown-container');
                if (moreLocsDropdown) moreLocsDropdown.style.display = 'none';
                const locOtherGroup = document.getElementById('onboard-loc-other-group');
                if (locOtherGroup) locOtherGroup.style.display = 'none';
                const locOtherInput = document.getElementById('onboard-loc-other');
                if (locOtherInput) locOtherInput.value = '';
                
                updateActivePage('login');
            }
        });
    }

    // Success Screen continue trigger - redirects to Dashboard
    if (btnSuccessContinue) {
        btnSuccessContinue.addEventListener('click', () => {
            console.log('Profile setup complete. Directing to Dashboard.');
            syncPreferencesToFormAndProfile();
            updateActivePage('dashboard');
        });
    }

    // Sidebar navigation toggling between content panes
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Toggle active sidebar item class
            navItems.forEach(btn => btn.classList.remove('active'));
            item.classList.add('active');
            
            // Toggle active content pane
            const targetPane = item.getAttribute('data-pane');
            document.querySelectorAll('.main-content .content-pane').forEach(pane => {
                if (pane.id === targetPane) {
                    pane.classList.add('active');
                } else {
                    pane.classList.remove('active');
                }
            });
        });
    });

    // Preferences Edit Form Submission
    const prefEditForm = document.getElementById('preferences-edit-form');
    if (prefEditForm) {
        prefEditForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const editFirstName = document.getElementById('edit-first-name');
            const editJobTitle = document.getElementById('edit-job-title');
            const editExp = document.getElementById('edit-experience');
            const editRoles = document.getElementById('edit-roles');
            const editLocations = document.getElementById('edit-locations');

            const newFirstName = editFirstName ? editFirstName.value.trim() : '';
            const newTitle = editJobTitle ? editJobTitle.value.trim() : '';
            const newExp = editExp ? editExp.value : '';

            // Roles parsed from comma separated string
            const rawRoles = editRoles ? editRoles.value : '';
            const newRoles = rawRoles.split(',').map(r => r.trim()).filter(r => r.length > 0);

            // Locations parsed from comma separated string
            const rawLocs = editLocations ? editLocations.value : '';
            const newLocs = rawLocs.split(',').map(l => l.trim()).filter(l => l.length > 0);
            
            if (newFirstName.length < 1) {
                alert('First Name is required.');
                return;
            }
            if (newTitle.length < 2 || newTitle.length > 100) {
                alert('Job Title must be between 2 and 100 characters.');
                return;
            }

            localStorage.setItem('pref_first_name', newFirstName);
            localStorage.setItem('pref_job_title', newTitle);
            localStorage.setItem('pref_experience', newExp);
            localStorage.setItem('pref_roles', JSON.stringify(newRoles));
            localStorage.setItem('pref_locations', JSON.stringify(newLocs));
            
            // Write to Supabase if logged in
            if (supabase) {
                try {
                    console.log('[DEBUG] Profile edit form: Fetching user...');
                    const { data: { user }, error: userErr } = await supabase.auth.getUser();
                    if (userErr) console.error('[DEBUG] Profile edit form: getUser error:', userErr);
                    if (user) {
                        console.log('[DEBUG] Profile edit form: Authenticated user found:', user.email);
                        
                        // Upsert to fj_profiles
                        console.log('[DEBUG] Profile edit form: Attempting profile update...');
                        const { error: profileErr } = await supabase
                            .from('fj_profiles')
                            .upsert({
                                id: user.id,
                                first_name: newFirstName,
                                email: user.email,
                                job_title: newTitle,
                                experience: newExp
                            });
                        if (profileErr) {
                            console.error('[DEBUG] Profile insert failure. Full error:', profileErr);
                        } else {
                            console.log('[DEBUG] Profile insert success');
                        }

                        // Upsert to fj_preferences
                        console.log('[DEBUG] Profile edit form: Attempting preferences update...');
                        const { error: prefErr } = await supabase
                            .from('fj_preferences')
                            .upsert({
                                user_id: user.id,
                                preferred_roles: newRoles,
                                preferred_locations: newLocs,
                                startup_stages: localStorage.getItem('pref_startup_stage') || '',
                                email_alerts: localStorage.getItem('pref_email_alerts') === 'true'
                            }, { onConflict: 'user_id' });
                        if (prefErr) {
                            console.error('[DEBUG] Preferences insert failure. Full error:', prefErr);
                        } else {
                            console.log('[DEBUG] Preferences insert success');
                        }
                    } else {
                        console.warn('[DEBUG] Profile edit form: No user found. Updates skipped.');
                    }
                } catch (err) {
                    console.error('Supabase preferences update error:', err);
                }
            }

            syncPreferencesToFormAndProfile();
            await loadDashboardData();
            showToast('Preferences updated successfully!');
        });
    }

    // -----------------------------------------------------------------------
    // PROFILE EDIT FORM — replaces old preferences-edit-form
    // -----------------------------------------------------------------------
    function setupProfileEditForm() {
        const profileEditForm = document.getElementById('profile-edit-form');
        if (!profileEditForm) return;

        // Job Title dropdown: show/hide "Other" custom input
        const profileEditTitle = document.getElementById('profile-edit-title');
        const profileTitleOtherGroup = document.getElementById('profile-title-other-group');
        if (profileEditTitle && profileTitleOtherGroup) {
            profileEditTitle.addEventListener('change', () => {
                profileTitleOtherGroup.style.display = profileEditTitle.value === 'Other' ? 'block' : 'none';
            });
        }

        // Preferred Roles chip selection (up to 5)
        const profileRoleChips = document.querySelectorAll('#profile-roles-chips .chip-btn');
        profileRoleChips.forEach(chip => {
            chip.addEventListener('click', () => {
                const isSelected = chip.classList.contains('selected');
                const currentSelected = document.querySelectorAll('#profile-roles-chips .chip-btn.selected');
                if (!isSelected && currentSelected.length >= 5) return; // max 5
                chip.classList.toggle('selected');
            });
        });

        // Form submit
        profileEditForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const profileEditFirstName = document.getElementById('profile-edit-first-name');
            const profileEditTitleSel = document.getElementById('profile-edit-title');
            const profileEditTitleOther = document.getElementById('profile-edit-title-other');
            const profileEditExp = document.getElementById('profile-edit-exp');
            const profileEditLocations = document.getElementById('profile-edit-locations');

            const newFirstName = profileEditFirstName ? profileEditFirstName.value.trim() : '';
            let newTitle = profileEditTitleSel ? profileEditTitleSel.value : '';
            if (newTitle === 'Other' && profileEditTitleOther) {
                newTitle = profileEditTitleOther.value.trim() || 'Other';
            }
            const newExp = profileEditExp ? profileEditExp.value : '0-1';
            const rawLocs = profileEditLocations ? profileEditLocations.value : '';
            const newLocs = rawLocs.split(',').map(l => l.trim()).filter(l => l.length > 0);

            // Collect selected role chips
            const selectedChips = document.querySelectorAll('#profile-roles-chips .chip-btn.selected');
            const newRoles = Array.from(selectedChips).map(c => c.getAttribute('data-value'));

            if (newFirstName.length < 1) {
                alert('First Name is required.');
                return;
            }

            localStorage.setItem('pref_first_name', newFirstName);
            localStorage.setItem('pref_job_title', newTitle);
            localStorage.setItem('pref_experience', newExp);
            localStorage.setItem('pref_roles', JSON.stringify(newRoles));
            localStorage.setItem('pref_locations', JSON.stringify(newLocs));

            if (supabase) {
                try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        const { error: profileErr } = await supabase
                            .from('fj_profiles')
                            .upsert({
                                id: user.id,
                                first_name: newFirstName,
                                email: user.email,
                                job_title: newTitle,
                                experience: newExp
                            });
                        if (profileErr) console.error('[Profile] Profile update error:', profileErr);

                        const { error: prefErr } = await supabase
                            .from('fj_preferences')
                            .upsert({
                                user_id: user.id,
                                preferred_roles: newRoles,
                                preferred_locations: newLocs,
                                startup_stages: localStorage.getItem('pref_startup_stage') || '',
                                email_alerts: localStorage.getItem('pref_email_alerts') === 'true'
                            }, { onConflict: 'user_id' });
                        if (prefErr) console.error('[Profile] Preferences update error:', prefErr);
                    }
                } catch (err) {
                    console.error('[Profile] Supabase update error:', err);
                }
            }

            syncPreferencesToFormAndProfile();
            await loadDashboardData();
            showToast('Profile updated successfully!');
        });
    }
    setupProfileEditForm();

    // -----------------------------------------------------------------------
    // NOTIFICATION PANEL — fresh Supabase data, no localStorage
    // -----------------------------------------------------------------------
    async function loadNotifications() {
        const panelBody = document.getElementById('notif-panel-body');
        if (!panelBody) return;
        panelBody.innerHTML = '<div class="notif-empty">Loading...</div>';

        if (!supabase) {
            panelBody.innerHTML = '<div class="notif-empty">Not available offline.</div>';
            return;
        }

        try {
            const { data: startups, error } = await supabase
                .from('fj_funded_startups')
                .select('id, startup_name, funding_amount, funding_stage, funding_date')
                .order('funding_date', { ascending: false })
                .limit(20);

            if (error || !startups || startups.length === 0) {
                panelBody.innerHTML = '<div class="notif-empty">No funded startups discovered yet.</div>';
                return;
            }

            panelBody.innerHTML = '';
            startups.forEach(s => {
                const item = document.createElement('div');
                item.className = 'notif-item';
                const relativeDate = s.funding_date ? timeAgo(s.funding_date) : '';
                item.innerHTML = `
                    <div class="notif-item-body">
                        <div class="notif-item-logo">${(s.startup_name || '?').substring(0, 2).toUpperCase()}</div>
                        <div class="notif-item-text">
                            <div class="notif-item-name">${s.startup_name}</div>
                            <div class="notif-item-meta">
                                <span class="startup-stage-badge" style="font-size:0.7rem; padding: 2px 6px;">${s.funding_stage}</span>
                                <span style="color: rgba(255,255,255,0.5); font-size: 0.78rem; margin-left: 6px;">${s.funding_amount || ''}</span>
                            </div>
                            <div class="notif-item-date">${relativeDate}</div>
                        </div>
                    </div>
                `;
                item.addEventListener('click', () => {
                    const notifPanel = document.getElementById('notification-panel');
                    if (notifPanel) notifPanel.style.display = 'none';
                    openRolesModalForStartup(s.id);
                });
                panelBody.appendChild(item);
            });
        } catch (err) {
            console.error('[Notifications] Error:', err);
            panelBody.innerHTML = '<div class="notif-empty">Failed to load notifications.</div>';
        }
    }

    // Bell button toggle
    const bellBtn = document.getElementById('notification-bell-btn');
    const notifPanel = document.getElementById('notification-panel');
    const notifBadgeDot = document.getElementById('notif-badge-dot');

    if (bellBtn && notifPanel) {
        bellBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = notifPanel.style.display !== 'none';
            notifPanel.style.display = isOpen ? 'none' : 'block';
            if (!isOpen) {
                // Hide unread dot when panel is opened
                if (notifBadgeDot) notifBadgeDot.style.display = 'none';
                loadNotifications();
            }
        });

        // Close panel on outside click
        document.addEventListener('click', (e) => {
            if (!bellBtn.contains(e.target) && !notifPanel.contains(e.target)) {
                notifPanel.style.display = 'none';
            }
        });
    }

    // -----------------------------------------------------------------------
    // EMAIL HISTORY — load from fj_notifications
    // -----------------------------------------------------------------------
    async function loadEmailHistory() {
        const historyList = document.getElementById('email-history-list');
        const historyCount = document.getElementById('email-history-count');
        const sendAgainBtn = document.getElementById('btn-send-mail-again');
        if (!historyList) return;

        historyList.innerHTML = '<div class="notif-empty" style="padding: 40px 20px; text-align: center; color: rgba(255,255,255,0.4);">Loading email history...</div>';
        if (historyCount) historyCount.innerText = 'Loading...';

        if (!supabase) {
            historyList.innerHTML = '<div class="notif-empty" style="padding: 40px 20px; text-align: center;">Not available offline.</div>';
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                historyList.innerHTML = '<div class="notif-empty" style="padding: 40px 20px; text-align: center;">Please log in to view email history.</div>';
                return;
            }

            // Fetch notification logs for this user
            const { data: logs, error: logsErr } = await supabase
                .from('fj_notifications')
                .select('id, startup_id, job_title, email_sent, sent_at')
                .eq('user_id', user.id)
                .order('sent_at', { ascending: false });

            if (logsErr) throw logsErr;

            if (!logs || logs.length === 0) {
                if (historyCount) historyCount.innerText = '0 emails sent';
                historyList.innerHTML = `
                    <div style="padding: 48px 20px; text-align: center;">
                        <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.25; display:block; margin: 0 auto 14px auto;">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                            <polyline points="22,6 12,13 2,6"></polyline>
                        </svg>
                        <p style="color: rgba(255,255,255,0.35); font-size: 0.9rem;">No emails have been sent to you yet.</p>
                    </div>`;
                return;
            }

            // Fetch all relevant startups
            const startupIds = [...new Set(logs.filter(l => l.startup_id).map(l => l.startup_id))];
            let startupsMap = {};
            if (startupIds.length > 0) {
                const { data: startups } = await supabase
                    .from('fj_funded_startups')
                    .select('id, startup_name, funding_amount, funding_stage, funding_date')
                    .in('id', startupIds);
                if (startups) startups.forEach(s => { startupsMap[s.id] = s; });
            }

            if (historyCount) historyCount.innerText = `${logs.length} email${logs.length !== 1 ? 's' : ''} sent`;

            historyList.innerHTML = '';

            // Header row
            const headerRow = document.createElement('div');
            headerRow.className = 'email-history-header-row';
            headerRow.innerHTML = `
                <div style="width: 28px;"></div>
                <div class="eh-col eh-col-name">Startup</div>
                <div class="eh-col eh-col-amount">Amount</div>
                <div class="eh-col eh-col-stage">Stage</div>
                <div class="eh-col eh-col-date">Date Sent</div>
                <div class="eh-col eh-col-status">Status</div>
            `;
            historyList.appendChild(headerRow);

            logs.forEach((log, idx) => {
                const startup = startupsMap[log.startup_id] || {};
                const startupName = startup.startup_name || 'Unknown Startup';
                const amount = startup.funding_amount || '—';
                const stage = startup.funding_stage || '—';
                const dateStr = log.sent_at ? new Date(log.sent_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
                const statusClass = log.email_sent ? 'eh-status-delivered' : 'eh-status-failed';
                const statusLabel = log.email_sent ? 'Delivered' : 'Failed';

                const row = document.createElement('div');
                row.className = 'email-history-row';
                row.dataset.startupId = log.startup_id || '';
                row.dataset.logId = log.id;
                row.innerHTML = `
                    <div style="width: 28px; display: flex; align-items: center; justify-content: center;">
                        <input type="checkbox" class="eh-checkbox" data-startup-id="${log.startup_id || ''}" style="width: 16px; height: 16px; cursor: pointer; accent-color: #3b82f6;">
                    </div>
                    <div class="eh-col eh-col-name">
                        <span class="eh-startup-logo">${(startupName).substring(0, 2).toUpperCase()}</span>
                        <span>${startupName}</span>
                    </div>
                    <div class="eh-col eh-col-amount" style="color: rgba(255,255,255,0.7); font-size: 0.85rem;">${amount}</div>
                    <div class="eh-col eh-col-stage"><span class="startup-stage-badge" style="font-size: 0.72rem;">${stage}</span></div>
                    <div class="eh-col eh-col-date" style="color: rgba(255,255,255,0.55); font-size: 0.82rem;">${dateStr}</div>
                    <div class="eh-col eh-col-status"><span class="${statusClass}">${statusLabel}</span></div>
                `;
                historyList.appendChild(row);
            });

            // Checkbox logic — enable/disable Send Mail Again button
            const checkboxes = historyList.querySelectorAll('.eh-checkbox');
            function updateSendAgainBtn() {
                const anyChecked = Array.from(checkboxes).some(c => c.checked && c.dataset.startupId);
                if (sendAgainBtn) {
                    sendAgainBtn.disabled = !anyChecked;
                    sendAgainBtn.style.opacity = anyChecked ? '1' : '0.5';
                    sendAgainBtn.style.cursor = anyChecked ? 'pointer' : 'not-allowed';
                }
            }
            checkboxes.forEach(c => c.addEventListener('change', updateSendAgainBtn));

        } catch (err) {
            console.error('[EmailHistory] Error:', err);
            historyList.innerHTML = '<div style="padding: 40px 20px; text-align: center; color: rgba(255,255,255,0.4);">Failed to load email history.</div>';
        }
    }

    // Send Mail Again button handler
    const btnSendMailAgain = document.getElementById('btn-send-mail-again');
    if (btnSendMailAgain) {
        btnSendMailAgain.addEventListener('click', async () => {
            const checkboxes = document.querySelectorAll('#email-history-list .eh-checkbox:checked');
            if (checkboxes.length === 0) return;

            let userEmail = localStorage.getItem('user_email') || '';
            let userId = null;
            let firstName = localStorage.getItem('pref_first_name') || 'there';

            if (supabase) {
                try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) { userEmail = user.email; userId = user.id; }
                } catch (e) {}
            }
            if (!userId) userId = '00000000-0000-0000-0000-000000000000';

            btnSendMailAgain.disabled = true;
            btnSendMailAgain.innerText = 'Sending...';

            let successCount = 0;
            const startupIds = [...new Set(Array.from(checkboxes).map(c => c.dataset.startupId).filter(Boolean))];

            for (const startupId of startupIds) {
                try {
                    const res = await fetch('/api/send-test-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: userEmail, user_id: userId, first_name: firstName, startup_id: startupId })
                    });
                    const data = await res.json();
                    if (data.success) successCount++;
                } catch (err) {
                    console.error('[SendMailAgain] Error for startup', startupId, err);
                }
            }

            btnSendMailAgain.disabled = false;
            btnSendMailAgain.innerText = 'Send Mail Again';
            btnSendMailAgain.style.opacity = '0.5';
            btnSendMailAgain.style.cursor = 'not-allowed';

            showToast(successCount > 0 ? `${successCount} email${successCount !== 1 ? 's' : ''} sent successfully!` : 'No emails were sent.');
            // Uncheck all and reload
            document.querySelectorAll('#email-history-list .eh-checkbox').forEach(c => c.checked = false);
            await loadEmailHistory();
        });
    }

    // Logout Action
    async function handleLogout() {
        if (confirm('Are you sure you want to logout?')) {
            // Clear Supabase session
            if (supabase) {
                try {
                    await supabase.auth.signOut();
                } catch (err) {
                    console.error('Supabase signOut error:', err);
                }
            }

            // Clear local storage preferences
            localStorage.removeItem('pref_first_name');
            localStorage.removeItem('pref_job_title');
            localStorage.removeItem('pref_experience');
            localStorage.removeItem('pref_roles');
            localStorage.removeItem('pref_locations');
            localStorage.removeItem('pref_startup_stage');
            localStorage.removeItem('pref_email_alerts');
            localStorage.removeItem('onboarding_completed');
            localStorage.removeItem('user_email');
            localStorage.removeItem('e2e_test_active');
            sessionStorage.removeItem('test_timer_seconds');
            sessionStorage.removeItem('qa_test_dashboard_state');
            const qaDashboard = document.getElementById('qa-test-dashboard');
            const qaBadge = document.getElementById('qa-floating-badge');
            const qaModal = document.getElementById('qa-completion-modal');
            if (qaDashboard) qaDashboard.style.setProperty('display', 'none', 'important');
            if (qaBadge) qaBadge.style.setProperty('display', 'none', 'important');
            if (qaModal) qaModal.style.setProperty('display', 'none', 'important');
            
            // Reset active navigation item
            navItems.forEach(btn => btn.classList.remove('active'));
            const defaultNav = document.querySelector('.sidebar-nav .nav-item[data-pane="pane-dashboard"]');
            if (defaultNav) defaultNav.classList.add('active');
            
            // Reset active content pane
            document.querySelectorAll('.main-content .content-pane').forEach(pane => {
                if (pane.id === 'pane-dashboard') {
                    pane.classList.add('active');
                } else {
                    pane.classList.remove('active');
                }
            });
            
            // Go to Login
            updateActivePage('login');
        }
    }

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', handleLogout);
    }

    const headerBtnLogout = document.getElementById('header-btn-logout');
    if (headerBtnLogout) {
        headerBtnLogout.addEventListener('click', handleLogout);
    }

    const rolesModal = document.getElementById('view-roles-modal');
    const modalCloseBtn = document.getElementById('btn-close-modal');
    const modalStartupName = document.getElementById('modal-startup-name');
    const modalFundingStage = document.getElementById('modal-funding-stage');
    const modalFundingAmount = document.getElementById('modal-funding-amount');
    const modalStartupLocation = document.getElementById('modal-startup-location');
    const modalStartupDesc = document.getElementById('modal-startup-desc');
    const modalFundingDate = document.getElementById('modal-funding-date');
    const modalMatchingReasons = document.getElementById('modal-matching-reasons');
    const modalLinkWebsite = document.getElementById('modal-link-website');
    const modalLinkArticle = document.getElementById('modal-link-article');

    // Open Startup Details Modal popup dynamically
    function openRolesModalForStartup(startupId) {
        const startup = currentStartups.find(s => s.id === startupId);
        if (!startup || !rolesModal) return;

        // Populate metadata
        if (modalStartupName) modalStartupName.innerText = startup.startup_name;
        if (modalFundingStage) modalFundingStage.innerText = startup.funding_stage;
        if (modalFundingAmount) modalFundingAmount.innerText = startup.funding_amount;
        if (modalStartupLocation) modalStartupLocation.innerText = startup.location;
        if (modalStartupDesc) modalStartupDesc.innerText = startup.description || 'No description available.';
        if (modalFundingDate) modalFundingDate.innerText = startup.funding_date || 'N/A';

        // Populate new funding detail spans
        const modalFundingStageDetail = document.getElementById('modal-funding-stage-detail');
        const modalFundingAmountDetail = document.getElementById('modal-funding-amount-detail');
        if (modalFundingStageDetail) modalFundingStageDetail.innerText = startup.funding_stage || 'N/A';
        if (modalFundingAmountDetail) modalFundingAmountDetail.innerText = startup.funding_amount || 'N/A';

        // Set website link CTA
        if (modalLinkWebsite) {
            modalLinkWebsite.href = startup.website || '#';
            if (startup.website) {
                modalLinkWebsite.style.display = 'inline-flex';
            } else {
                modalLinkWebsite.style.display = 'none';
            }
        }

        // Set article/funding news link CTA
        if (modalLinkArticle) {
            modalLinkArticle.href = startup.source_url || '#';
            if (startup.source_url) {
                modalLinkArticle.style.display = 'inline-flex';
            } else {
                modalLinkArticle.style.display = 'none';
            }
        }

        // Populate matching reasons
        if (modalMatchingReasons) {
            modalMatchingReasons.innerHTML = '';
            const startupJobs = currentMatchedJobs.filter(job => {
                const jStartup = currentStartups.find(s => s.id === job.startup_id);
                return jStartup && jStartup.startup_name.toLowerCase().trim() === startup.startup_name.toLowerCase().trim();
            });
            
            // Extract matching job titles and location names
            const matchedRoles = [...new Set(startupJobs.map(job => job.job_title))];
            const matchedLocs = [...new Set(startupJobs.map(job => job.location))];
            
            matchedRoles.forEach(role => {
                const li = document.createElement('li');
                li.innerText = `Preferred Role: ${role}`;
                modalMatchingReasons.appendChild(li);
            });
            
            matchedLocs.forEach(loc => {
                const li = document.createElement('li');
                li.innerText = `Preferred Location: ${loc}`;
                modalMatchingReasons.appendChild(li);
            });
            
            const liFunding = document.createElement('li');
            liFunding.innerText = 'Startup recently raised funding';
            modalMatchingReasons.appendChild(liFunding);
        }

        rolesModal.style.display = 'flex';
    }

    // Close Modal action trigger
    if (modalCloseBtn && rolesModal) {
        modalCloseBtn.addEventListener('click', () => {
            rolesModal.style.display = 'none';
        });
    }
    if (rolesModal) {
        rolesModal.addEventListener('click', (e) => {
            if (e.target === rolesModal) {
                rolesModal.style.display = 'none';
            }
        });
    }

    // Dynamic Toast Notification helper
    function showToast(message) {
        const toast = document.getElementById('app-toast');
        const toastMsg = document.getElementById('toast-message');
        if (toast && toastMsg) {
            toastMsg.innerText = message;
            toast.style.display = 'block';
            
            // Auto hide after 3 seconds
            setTimeout(() => {
                toast.style.display = 'none';
            }, 3000);
        }
    }

    // Password Visibility Toggle Logic
    const passwordToggles = document.querySelectorAll('.password-toggle-btn');
    passwordToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const wrapper = toggle.closest('.password-wrapper');
            const input = wrapper ? wrapper.querySelector('input') : null;
            if (input) {
                const isPassword = input.getAttribute('type') === 'password';
                input.setAttribute('type', isPassword ? 'text' : 'password');
                
                // Toggle icons
                const eyeShow = toggle.querySelector('.eye-show');
                const eyeHide = toggle.querySelector('.eye-hide');
                if (eyeShow && eyeHide) {
                    eyeShow.style.display = isPassword ? 'none' : 'block';
                    eyeHide.style.display = isPassword ? 'block' : 'none';
                }
            }
        });
    });

    // Send Test Email event listener
    const btnSendTestEmail = document.getElementById('btn-send-test-email');
    if (btnSendTestEmail) {
        btnSendTestEmail.addEventListener('click', async () => {
            const isGuest = localStorage.getItem('user_email') === 'guest@fundedjobs.ai';
            let userEmail = localStorage.getItem('user_email') || 'guest@fundedjobs.ai';
            let userId = null;
            let firstName = localStorage.getItem('pref_first_name') || 'Guest User';
            
            if (supabase && !isGuest) {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    userEmail = user.email;
                    userId = user.id;
                }
            }
            
            if (!userId) {
                // Mock UUID for guest testing
                userId = '00000000-0000-0000-0000-000000000000';
            }
            
            btnSendTestEmail.disabled = true;
            btnSendTestEmail.innerText = 'Sending...';
            
            try {
                const response = await fetch('/api/send-test-email', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email: userEmail,
                        user_id: userId,
                        first_name: firstName
                    })
                });
                
                const result = await response.json();
                if (result.success) {
                    showToast('Test email sent successfully!');
                    if (isGuest) {
                        // Append a mock guest email log to guest_email_logs in localStorage
                        const mockLog = {
                            id: 'guest-notification-' + Date.now(),
                            user_id: '00000000-0000-0000-0000-000000000000',
                            startup_id: currentStartups.length > 0 ? currentStartups[0].id : null,
                            job_title: 'Product Manager',
                            email_sent: true,
                            sent_at: new Date().toISOString()
                        };
                        const logs = JSON.parse(localStorage.getItem('guest_email_logs')) || [];
                        logs.unshift(mockLog);
                        localStorage.setItem('guest_email_logs', JSON.stringify(logs));
                    }
                    await loadDashboardData();
                } else {
                    const errMsg = result.status && result.status.message 
                        ? result.status.message 
                        : (typeof result.status === 'object' ? JSON.stringify(result.status) : result.status);
                    alert('Failed to send test email: ' + errMsg);
                }
            } catch (err) {
                console.error('Error sending test email:', err);
                alert('Error sending test email. Make sure server.py is running.');
            } finally {
                btnSendTestEmail.disabled = false;
                btnSendTestEmail.innerText = 'Send Test Email';
            }
        });
    }

    // Initialize display state
    async function initSession() {
        console.log('[DEBUG] initSession started');
        if (supabase) {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const user = session ? session.user : null;
                console.log('[DEBUG] STEP 3: Current authenticated user:', user ? user.email : 'None');
                console.log('[DEBUG] STEP 3: Current session:', session ? session : 'None');
                if (session && session.user) {
                    const isEmailConfirmed = user.email_confirmed_at || user.confirmed_at || user.email_confirmed;
                    if (!isEmailConfirmed) {
                        console.log('[DEBUG] Session user is unverified. Logging out.');
                        try {
                            await supabase.auth.signOut();
                        } catch (signOutErr) {
                            console.error('Error signing out unverified user:', signOutErr);
                        }
                        localStorage.removeItem('user_email');
                        showLogin();
                        await updateActivePage('login');
                        return;
                    }

                    localStorage.setItem('user_email', user.email);
                    
                    // Fetch latest profile from Supabase
                    const { data: profile, error: profileErr } = await supabase
                        .from('fj_profiles')
                        .select('*')
                        .eq('id', user.id)
                        .maybeSingle();

                    // Fetch preferences
                    const { data: preferences, error: prefErr } = await supabase
                        .from('fj_preferences')
                        .select('*')
                        .eq('user_id', user.id)
                        .maybeSingle();

                    const combinedProfile = profile ? {
                        ...profile,
                        preferred_roles: preferences ? preferences.preferred_roles : [],
                        preferred_locations: preferences ? preferences.preferred_locations : [],
                        startup_stages: preferences ? preferences.startup_stages : '',
                        email_alerts: preferences ? preferences.email_alerts : false
                    } : null;

                    if (combinedProfile) {
                        console.log('[DEBUG] User has profile. Routing to dashboard.');
                        localStorage.setItem('pref_first_name', combinedProfile.first_name || '');
                        localStorage.setItem('pref_job_title', combinedProfile.job_title || '');
                        localStorage.setItem('pref_experience', combinedProfile.experience || '');
                        localStorage.setItem('pref_roles', JSON.stringify(combinedProfile.preferred_roles || []));
                        localStorage.setItem('pref_locations', JSON.stringify(combinedProfile.preferred_locations || []));
                        localStorage.setItem('pref_startup_stage', combinedProfile.startup_stages || '');
                        localStorage.setItem('pref_email_alerts', (combinedProfile.email_alerts || false).toString());
                        localStorage.setItem('onboarding_completed', 'true');

                        syncPreferencesToFormAndProfile();
                        const profileEmail = document.getElementById('profile-user-email');
                        if (profileEmail) profileEmail.innerText = session.user.email;
                        await updateActivePage('dashboard');
                        return;
                    } else {
                        console.log('[DEBUG] User has no profile. Routing to onboarding-step-1.');
                        localStorage.setItem('onboarding_completed', 'false');
                        await updateActivePage('onboarding-step-1');
                        return;
                    }
                } else {
                    console.log('[DEBUG] Session missing / unauthenticated on init');
                }
            } catch (err) {
                console.error('[DEBUG] Session initialization error:', err);
            }
        } else {
            console.log('[DEBUG] Supabase not initialized, skipping session check');
        }

        // Guest fallback or returning user check
        const isGuest = localStorage.getItem('user_email') === 'guest@fundedjobs.ai';
        if (isGuest || localStorage.getItem('onboarding_completed') === 'true') {
            console.log('[DEBUG] Returning guest or onboarded user detected. Navigating to dashboard.');
            syncPreferencesToFormAndProfile();
            const storedEmail = localStorage.getItem('user_email') || 'guest@fundedjobs.ai';
            const profileEmail = document.getElementById('profile-user-email');
            if (profileEmail) profileEmail.innerText = storedEmail;
            await updateActivePage('dashboard');
        } else {
            console.log('[DEBUG] New visitor. Navigating to login page.');
            showLogin();
            await updateActivePage('login');
        }
    }

    initSession();
});
