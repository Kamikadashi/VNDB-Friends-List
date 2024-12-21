// ==UserScript==
// @name         VNDB Friends List
// @namespace    http://tampermonkey.net/
// @version      1.54
// @description  Add friends list functionality to VNDB user pages
// @author       ALVIBO
// @match        https://vndb.org/u*
// @match        https://vndb.org/t/u*
// @match        https://vndb.org/w?u=u*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://ajax.googleapis.com/ajax/libs/jquery/2.1.1/jquery.min.js
// @license     http://creativecommons.org/licenses/by-nc-sa/4.0/
// @thanks     For the cover preview on mouseover, I drew some inspiration and used a few lines from the original VNDB Cover Preview script by Kuro_scripts
// @downloadURL https://update.greasyfork.org/scripts/521321/VNDB%20Friends%20List.user.js
// @updateURL https://update.greasyfork.org/scripts/521321/VNDB%20Friends%20List.meta.js
// ==/UserScript==

(function() {
    'use strict';

    // Check if we're on a valid user page and if edit link exists
    const userPageMatch = location.pathname.match(/^\/u\d+/) ||
                         location.pathname.match(/^\/t\/u\d+/) ||
                         location.search.match(/[?&]u=u\d+/);
    if (!userPageMatch) return;

    const editLink = document.querySelector('header nav menu li a[href$="/edit"]');
    if (!editLink) return;

    // Initialize state
    let friends = GM_getValue('vndb_friends', []);
    let friendsCache = GM_getValue('vndb_friends_cache', {});
    let currentPage = 1;
    const friendsPerPage = 10;
    let settings = GM_getValue('vndb_friends_settings', {
        textColor: null,
        buttonTextColor: null,
        backgroundColor: null,
        buttonBackgroundColor: null,
        titleColor: null,
        borderColor: null,
        separatorColor: null,
        fontSize: 17,
        buttonFontSize: 16,
        tabFontSize: 18,
        opacity: null,
        cacheDuration: 3,
        gamesPerFriend: 5,
        maxActivities: 51
    });

    // Get the base user URL (without additional paths)
    const baseUserUrl = location.pathname.split('/')[1] + (location.pathname.split('/')[2] || '');

    // Function to get computed background color
    function getBackgroundColor() {
        const bodyBg = window.getComputedStyle(document.body).backgroundColor;
        const rgb = bodyBg.match(/\d+/g);
        return rgb ? rgb.map(Number) : [255, 255, 255];
    }

    // Function to create theme-matching color
    function createThemeColors() {
        const bgColor = getBackgroundColor();
        const mainTextColor = window.getComputedStyle(document.body).color;
        const articleH1 = document.querySelector('article h1');
        const titleColor = articleH1 ? window.getComputedStyle(articleH1).color : mainTextColor;
        const opacity = settings.opacity || 0.70;

        return {
            containerBg: settings.backgroundColor ?
                `rgba(${parseInt(settings.backgroundColor.slice(1,3),16)},
                      ${parseInt(settings.backgroundColor.slice(3,5),16)},
                      ${parseInt(settings.backgroundColor.slice(5,7),16)},
                      ${opacity})` :
                `rgba(${bgColor[0]}, ${bgColor[1]}, ${bgColor[2]}, ${opacity})`,
            borderColor: mainTextColor,
            textColor: settings.textColor || mainTextColor,
            linkColor: settings.titleColor || titleColor
        };
    }

    // Create friends list container
    const friendsContainer = document.createElement('div');
    const themeColors = createThemeColors();

    friendsContainer.innerHTML = `
        <style>
            .friends-container {
                display: none;
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                padding: 20px;
                border: 1px solid ${themeColors.borderColor};
                z-index: 1000;
                min-width: 300px;
                font-size: ${settings.fontSize || '17px'};
                max-height: 80vh;
                max-width: 90vw;
                overflow-y: auto;
            }

            .friends-container::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                backdrop-filter: blur(5px);
                z-index: -1;
            }

            .friends-settings {
                margin-top: 10px;
                border-top: 1px solid ${themeColors.borderColor};
                padding-top: 10px;
                display: none;
            }
            .settings-group {
                margin: 5px 0;
                display: flex;
                align-items: center;
                gap: 5px;
            }
            .settings-group label {
                min-width: 120px;
            }
            .color-inputs {
                display: flex;
                gap: 5px;
                align-items: center;
            }
            .color-inputs input[type="text"],
            .color-inputs input[type="number"] {
                width: 70px;
                padding: 2px 4px;
                border: 1px solid;
                border-radius: 3px;
                background: inherit;
            }
            .settings-toggle {
                margin-top: 10px;
                text-align: center;
            }
            .friends-container h2,
            .friends-container h3 {
                color: ${themeColors.linkColor};
            }
            .friends-container .friend-link {
                color: ${themeColors.textColor} !important;
            }
            .tab-buttons {
                display: flex;
                margin-bottom: 15px;
                border-bottom: 1px solid ${themeColors.borderColor};
            }
            .tab-button {
                padding: 8px 16px;
                border: none;
                background: none;
                color: ${themeColors.textColor};
                cursor: pointer;
            }
            .tab-button.active {
                border-bottom: 2px solid ${themeColors.linkColor};
            }
            .tab-content {
                display: none;
            }
            .tab-content.active {
                display: block;
            }
            .activity-item {
                margin: 8px 0;
                padding: 8px;
                border-bottom: 1px solid ${settings.separatorColor || themeColors.borderColor};
                word-break: break-word;
                overflow-wrap: break-word;
            }
            .activity-date {
                color: ${themeColors.textColor};
                opacity: 0.8;
                font-size: 0.9em;
            }
            .friends-container::-webkit-scrollbar {
                width: 8px;
            }
            .friends-container::-webkit-scrollbar-track {
                background: rgba(0, 0, 0, 0.1);
            }
            .friends-container::-webkit-scrollbar-thumb {
                background: rgba(128, 128, 128, 0.5);
                border-radius: 4px;
            }
            #activityFeed {
                max-height: calc(80vh - 300px);
                overflow-y: auto;
                margin-bottom: 15px;
            }
            #activityFeed::-webkit-scrollbar {
                width: 8px;
            }
            #activityFeed::-webkit-scrollbar-track {
                background: rgba(0, 0, 0, 0.1);
            }
            #activityFeed::-webkit-scrollbar-thumb {
                background: rgba(128, 128, 128, 0.5);
                border-radius: 4px;
            }
            .activity-controls {
                margin-top: 10px;
                text-align: center;
            }
            .friends-container button:not(.tab-button) {
                font-size: ${settings.buttonFontSize ? `${settings.buttonFontSize}px` : '16px'} !important;
            }

            .tab-button {
                font-size: ${settings.tabFontSize ? `${settings.tabFontSize}px` : '18px'} !important;
            }
        </style>
        <div class="friends-container">
            <h2>Friends List</h2>
            <div class="tab-buttons">
                <button class="tab-button active" data-tab="friendsList">Friends List</button>
                <button class="tab-button" data-tab="activityFeed">Recent Activity</button>
            </div>
            <div id="friendsList" class="tab-content active"></div>
            <div id="activityFeed" class="tab-content"></div>
            <div class="activity-controls tab-content" data-tab="activityFeed">
                <button id="reloadActivity">Reload Activity</button>
            </div>
            <div id="pagination" style="margin-top: 10px; text-align: center;"></div>
            <div style="margin-top: 10px;">
                <input type="text" id="newFriend" placeholder="Username" style="margin-right: 5px;">
                <button id="addFriend">Add Friend</button>
            </div>
            <div class="settings-toggle">
                <button id="toggleSettings">Show Settings</button>
            </div>
            <div class="friends-settings">
                <h3>Settings</h3>
                <!-- Text Colors -->
                <div class="settings-group">
                    <label>Title Color:</label>
                    <div class="color-inputs">
                        <input type="color" id="titleColor">
                        <input type="text" id="titleColorHex" placeholder="#hex">
                    </div>
                    <button class="resetButton" data-setting="titleColor">Reset</button>
                </div>
                <div class="settings-group">
                    <label>Text Color:</label>
                    <div class="color-inputs">
                        <input type="color" id="textColor">
                        <input type="text" id="textColorHex" placeholder="#hex">
                    </div>
                    <button class="resetButton" data-setting="textColor">Reset</button>
                </div>
                <div class="settings-group">
                    <label>Button Text:</label>
                    <div class="color-inputs">
                        <input type="color" id="buttonTextColor">
                        <input type="text" id="buttonTextColorHex" placeholder="#hex">
                    </div>
                    <button class="resetButton" data-setting="buttonTextColor">Reset</button>
                </div>

                <!-- Background Colors -->
                <div class="settings-group">
                    <label>Background:</label>
                    <div class="color-inputs">
                        <input type="color" id="backgroundColor">
                        <input type="text" id="backgroundColorHex" placeholder="#hex">
                    </div>
                    <button class="resetButton" data-setting="backgroundColor">Reset</button>
                </div>
                <div class="settings-group">
                    <label>Button Color:</label>
                    <div class="color-inputs">
                        <input type="color" id="buttonBackgroundColor">
                        <input type="text" id="buttonBackgroundColorHex" placeholder="#hex">
                    </div>
                    <button class="resetButton" data-setting="buttonBackgroundColor">Reset</button>
                </div>

                <!-- Border Colors -->
                <div class="settings-group">
                    <label>Border Color:</label>
                    <div class="color-inputs">
                        <input type="color" id="borderColor">
                        <input type="text" id="borderColorHex" placeholder="#hex">
                    </div>
                    <button class="resetButton" data-setting="borderColor">Reset</button>
                </div>
                <div class="settings-group">
                    <label>Separator Color:</label>
                    <div class="color-inputs">
                        <input type="color" id="separatorColor">
                        <input type="text" id="separatorColorHex" placeholder="#hex">
                    </div>
                    <button class="resetButton" data-setting="separatorColor">Reset</button>
                </div>

                <!-- Other Settings -->
                <div class="settings-group">
                    <label>Font Size:</label>
                    <div class="color-inputs">
                        <input type="number" id="fontSize" min="8" max="24" step="1">
                        <span>px</span>
                    </div>
                    <button class="resetButton" data-setting="fontSize">Reset</button>
                </div>
                <div class="settings-group">
                    <label>Button Text Size:</label>
                    <div class="color-inputs">
                        <input type="number" id="buttonFontSize" min="8" max="24" step="1">
                        <span>px</span>
                    </div>
                    <button class="resetButton" data-setting="buttonFontSize">Reset</button>
                </div>
                <div class="settings-group">
                    <label>Tab Text Size:</label>
                    <div class="color-inputs">
                        <input type="number" id="tabFontSize" min="8" max="24" step="1">
                        <span>px</span>
                    </div>
                    <button class="resetButton" data-setting="tabFontSize">Reset</button>
                </div>
                <div class="settings-group">
                    <label>Opacity:</label>
                    <input type="range" id="opacity" min="0" max="100" step="5">
                    <span id="opacityValue"></span>%
                    <button class="resetButton" data-setting="opacity">Reset</button>
                </div>
                <div class="settings-group">
                    <label>Cache Duration:</label>
                    <div class="color-inputs">
                        <input type="number" id="cacheDuration" min="1" max="60" step="1">
                        <span>minutes</span>
                    </div>
                    <button class="resetButton" data-setting="cacheDuration">Reset</button>
                </div>
                <div class="settings-group">
                    <label>Games per Friend:</label>
                    <div class="color-inputs">
                        <input type="number" id="gamesPerFriend" min="1" max="50" step="1">
                        <span>games</span>
                    </div>
                    <button class="resetButton" data-setting="gamesPerFriend">Reset</button>
                </div>
                <div class="settings-group">
                    <label>Max Activities:</label>
                    <div class="color-inputs">
                        <input type="number" id="maxActivities" min="5" max="100" step="1">
                        <span>total</span>
                    </div>
                    <button class="resetButton" data-setting="maxActivities">Reset</button>
                </div>
            </div>
            <button id="closeFriends" style="margin-top: 10px;">Close</button>
        </div>
    `;
    document.body.appendChild(friendsContainer);

    const container = friendsContainer.querySelector('.friends-container');
    const settingsPanel = container.querySelector('.friends-settings');
    updateContainerStyle();

    // Function to update container style
    function updateContainerStyle() {
        const themeColors = createThemeColors();

        container.style.border = `1px solid ${settings.borderColor || themeColors.borderColor}`;
        container.style.background = themeColors.containerBg;
        container.style.color = settings.textColor || themeColors.textColor;
        container.style.fontSize = settings.fontSize ? `${settings.fontSize}px` : '17px';

        // Update titles specifically
        const titles = container.querySelectorAll('h2, h3');
        titles.forEach(title => {
            title.style.setProperty('color', settings.titleColor || themeColors.linkColor, 'important');
        });

        // Update other elements
        const friendLinks = container.querySelectorAll('.friend-link');
        friendLinks.forEach(link => {
            link.style.setProperty('color', settings.textColor || themeColors.textColor, 'important');
        });
    }

    // Create a style element for dynamic CSS rules
    const dynamicStyles = document.createElement('style');
    document.head.appendChild(dynamicStyles);

    // Function to update dynamic CSS rules
    function updateDynamicStyles() {
        const themeColors = createThemeColors();
        const opacity = settings.opacity || 0.70;

        // Convert hex background color to rgba if it exists
        let backgroundStyle = themeColors.containerBg;
        if (settings.backgroundColor) {
            const hex = settings.backgroundColor.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            backgroundStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
        }

        dynamicStyles.textContent = `
            .friends-container {
                border: 1px solid ${settings.borderColor || themeColors.borderColor} !important;
                background: ${backgroundStyle} !important;
            }
            .friends-container .friend-link {
                color: ${settings.textColor || themeColors.textColor} !important;
            }
            .friends-container h2,
            .friends-container h3 {
                color: ${settings.titleColor || themeColors.linkColor} !important;
            }
            .friends-container button {
                background-color: ${settings.buttonBackgroundColor || 'inherit'} !important;
                color: ${settings.buttonTextColor || themeColors.textColor} !important;
                font-size: ${settings.buttonFontSize ? `${settings.buttonFontSize}px` : '16px'} !important;
            }
            .friends-settings {
                border-top: 1px solid ${settings.separatorColor || themeColors.borderColor} !important;
            }
            .activity-item {
                border-bottom: 1px solid ${settings.separatorColor || themeColors.borderColor} !important;
            }
            .activity-date {
                color: ${settings.textColor || themeColors.textColor} !important;
                opacity: 0.8;
            }
            .tab-button {
                font-size: ${settings.tabFontSize ? `${settings.tabFontSize}px` : '18px'} !important;
            }
        `;
    }

    // Update both styles when theme changes
    function forceStyleUpdate() {
        updateContainerStyle();
        updateDynamicStyles();

        // Force update of activity items if they exist
        const activityItems = document.querySelectorAll('.activity-item');
        if (activityItems.length > 0) {
            const themeColors = createThemeColors();
            activityItems.forEach(item => {
                item.style.borderBottom = `1px solid ${settings.separatorColor || themeColors.borderColor}`;
            });

            const activityDates = document.querySelectorAll('.activity-date');
            activityDates.forEach(date => {
                date.style.color = settings.textColor || themeColors.textColor;
            });
        }

        // Force update button and tab font sizes with !important
        const buttons = container.querySelectorAll('button:not(.tab-button)');
        buttons.forEach(button => {
            if (settings.buttonFontSize) {
                button.style.setProperty('font-size', `${settings.buttonFontSize}px`, 'important');
            } else {
                button.style.removeProperty('font-size');
            }
        });

        const tabButtons = container.querySelectorAll('.tab-button');
        tabButtons.forEach(tab => {
            if (settings.tabFontSize) {
                tab.style.setProperty('font-size', `${settings.tabFontSize}px`, 'important');
            } else {
                tab.style.removeProperty('font-size');
            }
        });
    }

    // Modify the mutation observer to be more aggressive
    const themeObserver = new MutationObserver((mutations) => {
        if (container.style.display === 'block') {
            forceStyleUpdate();
            // Multiple delayed updates to ensure changes are caught
            setTimeout(forceStyleUpdate, 100);
            setTimeout(forceStyleUpdate, 300);
            setTimeout(forceStyleUpdate, 500);
        }
    });

    // Observe both document head and body
    themeObserver.observe(document.head, {
        attributes: true,
        childList: true,
        subtree: true
    });

    themeObserver.observe(document.body, {
        attributes: true,
        childList: true,
        subtree: true
    });

    // More frequent checks
    setInterval(() => {
        if (container.style.display === 'block') {
            forceStyleUpdate();
        }
    }, 250);

    // Settings management
    function resetSetting(setting) {
        switch(setting) {
            case 'cacheDuration':
                settings[setting] = 3;
                const cacheDurationInput = document.getElementById('cacheDuration');
                if (cacheDurationInput) {
                    cacheDurationInput.value = 3;
                    // Clear existing cache when duration is changed
                    activityCache.timestamp = 0;
                    sessionStorage.removeItem('vndb_activity_cache');
                    // Only update if we're on the activity tab
                    if (document.querySelector('.tab-button[data-tab="activityFeed"]').classList.contains('active')) {
                        updateActivityFeed();
                    }
                }
                break;
            case 'gamesPerFriend':
                settings[setting] = 5;
                const gamesPerFriendInput = document.getElementById('gamesPerFriend');
                if (gamesPerFriendInput) gamesPerFriendInput.value = 5;
                break;
            case 'maxActivities':
                settings[setting] = 51;
                const maxActivitiesInput = document.getElementById('maxActivities');
                if (maxActivitiesInput) maxActivitiesInput.value = 51;
                break;
            case 'fontSize':
                settings[setting] = 17;
                const fontSizeInput = document.getElementById('fontSize');
                if (fontSizeInput) fontSizeInput.value = 17;
                break;
            case 'buttonFontSize':
                settings[setting] = 16;
                const buttonFontSizeInput = document.getElementById('buttonFontSize');
                if (buttonFontSizeInput) buttonFontSizeInput.value = 16;
                break;
            case 'tabFontSize':
                settings[setting] = 18;
                const tabFontSizeInput = document.getElementById('tabFontSize');
                if (tabFontSizeInput) tabFontSizeInput.value = 18;
                break;
            case 'opacity':
                settings[setting] = 0.70;
                const opacityInput = document.getElementById('opacity');
                const opacityValue = document.getElementById('opacityValue');
                if (opacityInput) {
                    opacityInput.value = 70;
                    opacityValue.textContent = '70';
                }
                break;
            default:
                settings[setting] = null;
                const colorInput = document.getElementById(setting);
                const hexInput = document.getElementById(setting + 'Hex');
                if (colorInput && hexInput) {
                    colorInput.value = '#000000';
                    hexInput.value = '';
                }
        }

        GM_setValue('vndb_friends_settings', settings);
        forceStyleUpdate();
    }

    // Initialize settings inputs
    const settingsInputs = {
        textColor: document.getElementById('textColor'),
        backgroundColor: document.getElementById('backgroundColor'),
        fontSize: document.getElementById('fontSize'),
        opacity: document.getElementById('opacity')
    };

    Object.entries(settingsInputs).forEach(([setting, input]) => {
        if (settings[setting]) {
            if (setting === 'opacity') {
                input.value = settings[setting] * 100;
                document.getElementById('opacityValue').textContent = input.value;
            } else if (setting === 'fontSize') {
                input.value = settings[setting];
            } else {
                input.value = settings[setting];
            }
        } else if (setting === 'opacity') {
            input.value = 70;
            document.getElementById('opacityValue').textContent = '70';
        }

        input.addEventListener('change', function() {
            let value = this.value;
            if (setting === 'opacity') {
                value = this.value / 100;
                document.getElementById('opacityValue').textContent = this.value;
            } else if (setting === 'fontSize') {
                value = parseInt(this.value);
            }
            settings[setting] = value;
            GM_setValue('vndb_friends_settings', settings);
            updateContainerStyle();
        });
    });

    // Add Friends link to menu only if it doesn't already exist
    const menu = document.querySelector('header nav menu');
    if (!menu.querySelector('li a[href="#"]')) {
        const friendsLink = document.createElement('li');
        friendsLink.innerHTML = `<a href="#">friends</a>`;
        menu.appendChild(friendsLink);
    }

    // Modify this section to ensure pagination buttons are hidden on Recent Activity tab
    function updatePagination() {
        const totalPages = Math.ceil(friends.length / friendsPerPage);
        const pagination = document.getElementById('pagination');

        const activeTab = sessionStorage.getItem('vndb_friends_active_tab') || 'friendsList';

        if (activeTab === 'activityFeed') {
            pagination.style.display = 'none';
            return;
        }

        if (totalPages <= 1) {
            pagination.style.display = 'none';
            return;
        }

        pagination.style.display = 'block';
        pagination.innerHTML = `
            ${currentPage > 1 ? `<button class="pageButton" data-page="${currentPage - 1}">←</button>` : ''}
            Page ${currentPage} of ${totalPages}
            ${currentPage < totalPages ? `<button class="pageButton" data-page="${currentPage + 1}">→</button>` : ''}
        `;

        // Add event listeners to the newly created pagination buttons
        const pageButtons = pagination.querySelectorAll('.pageButton');
        pageButtons.forEach(button => {
            button.addEventListener('click', function() {
                changePage(parseInt(this.dataset.page));
            });
        });
    }

    // Ensure pagination visibility updates correctly on tab switches
    function handleTabSwitch(tabId) {
        const pagination = document.getElementById('pagination');

        if (tabId === 'activityFeed') {
            pagination.style.display = 'none';
        } else if (tabId === 'friendsList') {
            const totalPages = Math.ceil(friends.length / friendsPerPage);
            pagination.style.display = totalPages > 1 ? 'block' : 'none';
        }

        // Always call updatePagination to refresh buttons when switching tabs
        updatePagination();
    }

    // Listen for tab switches and update pagination accordingly
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            sessionStorage.setItem('vndb_friends_active_tab', tabId);
            handleTabSwitch(tabId);
        });
    });

    // Ensure pagination is not displayed even after a browser back action
    window.addEventListener('load', () => {
        const activeTab = sessionStorage.getItem('vndb_friends_active_tab') || 'friendsList';
        handleTabSwitch(activeTab);
    });

    // Function to change page
    function changePage(newPage) {
        currentPage = newPage;
        displayFriendsList();
    }

    // Function to display friends list from cache
    function displayFriendsList() {
        const friendsList = document.getElementById('friendsList');
        friendsList.innerHTML = '';

        const startIndex = (currentPage - 1) * friendsPerPage;
        const endIndex = startIndex + friendsPerPage;
        const currentFriends = friends.slice(startIndex, endIndex);

        for (const friend of currentFriends) {
            const userData = friendsCache[friend];
            if (userData) {
                const friendDiv = document.createElement('div');
                friendDiv.style.margin = '5px 0';
                friendDiv.innerHTML = `
                    <a href="/u${userData.id.slice(1)}" class="friend-link">${userData.username}</a>
                    <button class="removeFriend" data-username="${friend}" style="margin-left: 10px;">Remove</button>
                `;
                friendsList.appendChild(friendDiv);
            }
        }

        // Force style updates after adding new elements
        forceStyleUpdate();
        setTimeout(forceStyleUpdate, 100);
        setTimeout(forceStyleUpdate, 300);

        // Add event listeners to remove buttons
        const removeButtons = friendsList.querySelectorAll('.removeFriend');
        removeButtons.forEach(button => {
            button.addEventListener('click', function() {
                removeFriend(this.dataset.username);
            });
        });

        updatePagination();
    }

    // Function to fetch and cache friend data
    async function fetchFriendData(username) {
        try {
            const response = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: `https://api.vndb.org/kana/user?q=${username}`,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    onload: function(response) {
                        resolve(JSON.parse(response.responseText));
                    },
                    onerror: reject
                });
            });

            if (response[username]) {
                friendsCache[username] = response[username];
                GM_setValue('vndb_friends_cache', friendsCache);
                return response[username];
            }
            return null;
        } catch (error) {
            console.error(`Error fetching data for friend ${username}:`, error);
            return null;
        }
    }

    // Function to add new friend
    async function addFriend() {
        const input = document.getElementById('newFriend');
        const username = input.value.trim();

        if (!username) return;

        const userData = await fetchFriendData(username);
        if (userData) {
            if (!friends.includes(username)) {
                friends.push(username);
                GM_setValue('vndb_friends', friends);
                currentPage = Math.ceil(friends.length / friendsPerPage);
                displayFriendsList();
                input.value = '';
            }
        } else {
            alert('User not found!');
        }
    }

    // Function to remove friend
    function removeFriend(username) {
        friends = friends.filter(f => f !== username);
        delete friendsCache[username];
        GM_setValue('vndb_friends', friends);
        GM_setValue('vndb_friends_cache', friendsCache);

        const totalPages = Math.ceil(friends.length / friendsPerPage);
        if (currentPage > totalPages) {
            currentPage = Math.max(1, totalPages);
        }

        displayFriendsList();
    }

    // Event listeners
    const friendsLink = document.querySelector('header nav menu li a[href="#"]');
    friendsLink.addEventListener('click', async (e) => {
        e.preventDefault();
        const container = document.querySelector('.friends-container');
        if (container.style.display === 'block') {
            container.style.display = 'none';
            sessionStorage.setItem('vndb_friends_container_open', 'false');
        } else {
            showContainer();
        }
    });

    document.getElementById('closeFriends').addEventListener('click', () => {
        container.style.display = 'none';
        sessionStorage.setItem('vndb_friends_container_open', 'false');
    });

    document.getElementById('addFriend').addEventListener('click', addFriend);

    document.getElementById('newFriend').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addFriend();
        }
    });

    // Settings toggle
    const toggleButton = document.getElementById('toggleSettings');
    toggleButton.addEventListener('click', () => {
        const isVisible = settingsPanel.style.display === 'block';
        settingsPanel.style.display = isVisible ? 'none' : 'block';
        toggleButton.textContent = isVisible ? 'Show Settings' : 'Hide Settings';
    });

    // Reset buttons
    const resetButtons = document.querySelectorAll('.resetButton');
    resetButtons.forEach(button => {
        button.addEventListener('click', function() {
            resetSetting(this.dataset.setting);
        });
    });

    // Preload friend data
    (async function preloadFriendData() {
        for (const friend of friends) {
            if (!friendsCache[friend]) {
                await fetchFriendData(friend);
            }
        }
    })();

    // Add event listeners for all possible theme change triggers
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && container.style.display === 'block') {
            forceStyleUpdate();
        }
    });

    window.addEventListener('resize', () => {
        if (container.style.display === 'block') {
            forceStyleUpdate();
        }
    });

    // Monitor for CSS animations and transitions
    container.addEventListener('animationend', forceStyleUpdate);
    container.addEventListener('transitionend', forceStyleUpdate);

    // Monitor the container itself for any changes
    const containerObserver = new MutationObserver(() => {
        if (container.style.display === 'block') {
            forceStyleUpdate();
        }
    });

    containerObserver.observe(container, {
        attributes: true,
        childList: true,
        subtree: true,
        characterData: true
    });

    // Add color input sync function
    function syncColorInputs(colorId, hexId) {
        const colorInput = document.getElementById(colorId);
        const hexInput = document.getElementById(hexId);

        colorInput.addEventListener('input', (e) => {
            hexInput.value = e.target.value;
            settings[colorId] = e.target.value;
            GM_setValue('vndb_friends_settings', settings);
            forceStyleUpdate();
        });

        hexInput.addEventListener('input', (e) => {
            const hex = e.target.value;
            if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
                colorInput.value = hex;
                settings[colorId] = hex;
                GM_setValue('vndb_friends_settings', settings);
                forceStyleUpdate();
            }
        });
    }

    // Initialize color inputs
    function initializeColorInputs() {
        const colorPairs = [
            ['titleColor', 'titleColorHex'],
            ['textColor', 'textColorHex'],
            ['buttonTextColor', 'buttonTextColorHex'],
            ['backgroundColor', 'backgroundColorHex'],
            ['buttonBackgroundColor', 'buttonBackgroundColorHex'],
            ['borderColor', 'borderColorHex'],
            ['separatorColor', 'separatorColorHex']
        ];

        colorPairs.forEach(([colorId, hexId]) => {
            const colorInput = document.getElementById(colorId);
            const hexInput = document.getElementById(hexId);

            if (settings[colorId]) {
                colorInput.value = settings[colorId];
                hexInput.value = settings[colorId];
            }

            syncColorInputs(colorId, hexId);
        });

        // Initialize numeric inputs
        const numericInputs = [
            'fontSize',
            'buttonFontSize',
            'tabFontSize',
            'cacheDuration',
            'gamesPerFriend',
            'maxActivities'
        ];

        numericInputs.forEach(settingId => {
            const input = document.getElementById(settingId);
            if (input && settings[settingId] !== null) {
                input.value = settings[settingId];
            }

            // Add change listener
            input.addEventListener('change', function() {
                settings[settingId] = parseInt(this.value) || null;
                GM_setValue('vndb_friends_settings', settings);
                forceStyleUpdate();

                // Clear activity cache if relevant settings change
                if (settingId === 'cacheDuration' ||
                    settingId === 'gamesPerFriend' ||
                    settingId === 'maxActivities') {
                    activityCache.timestamp = 0;
                    sessionStorage.removeItem('vndb_activity_cache');
                    // Only update activity feed if we're already on that tab
                    if (document.querySelector('.tab-button[data-tab="activityFeed"]').classList.contains('active')) {
                        updateActivityFeed();
                    }
                }
            });
        });

        // Initialize opacity
        const opacityInput = document.getElementById('opacity');
        const opacityValue = document.getElementById('opacityValue');
        if (settings.opacity !== null) {
            opacityInput.value = settings.opacity * 100;
            opacityValue.textContent = Math.round(settings.opacity * 100);
        } else {
            opacityInput.value = 70;
            opacityValue.textContent = '70';
            settings.opacity = 0.70;
            GM_setValue('vndb_friends_settings', settings);
        }

        opacityInput.addEventListener('input', function() {
            opacityValue.textContent = this.value;
            settings.opacity = this.value / 100;
            GM_setValue('vndb_friends_settings', settings);
            forceStyleUpdate();
        });
    }

    // Add to the settings HTML, after the opacity setting
    const importExportHTML = `
        <div class="settings-group" style="margin-top: 20px;">
            <label>Backup:</label>
            <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                <button id="exportData">Export All</button>
                <button id="importData">Import</button>
            </div>
        </div>
        <div id="importOptions" style="display: none; margin-top: 10px;">
            <div style="margin-bottom: 10px;">
                <input type="file" id="importFile" accept=".json" style="display: none;">
                <label>Import options:</label>
                <div style="margin-top: 5px;">
                    <label style="font-weight: normal;">
                        <input type="checkbox" id="importFriends" checked> Friends List
                    </label>
                    <label style="font-weight: normal; margin-left: 10px;">
                        <input type="checkbox" id="importSettings" checked> Settings
                    </label>
                </div>
                <div style="margin-top: 10px;">
                    <button id="confirmImport">Confirm Import</button>
                    <button id="cancelImport">Cancel</button>
                </div>
            </div>
        </div>
    `;

    // Add event listeners for import/export functionality
    function setupImportExport() {
        const exportButton = document.getElementById('exportData');
        const importButton = document.getElementById('importData');
        const importOptions = document.getElementById('importOptions');
        const importFile = document.getElementById('importFile');
        const confirmImport = document.getElementById('confirmImport');
        const cancelImport = document.getElementById('cancelImport');
        const importFriendsCheck = document.getElementById('importFriends');
        const importSettingsCheck = document.getElementById('importSettings');

        // Export functionality
        exportButton.addEventListener('click', () => {
            const exportData = {
                friends: friends,
                friendsCache: friendsCache,
                settings: settings
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `vndb_friends_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });

        // Import functionality
        importButton.addEventListener('click', () => {
            importOptions.style.display = 'block';
            importButton.style.display = 'none';
        });

        cancelImport.addEventListener('click', () => {
            importOptions.style.display = 'none';
            importButton.style.display = 'block';
            importFile.value = '';
        });

        confirmImport.addEventListener('click', () => {
            importFile.click();
        });

        importFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const importData = JSON.parse(event.target.result);

                    if (importFriendsCheck.checked) {
                        friends = importData.friends || [];
                        friendsCache = importData.friendsCache || {};
                        GM_setValue('vndb_friends', friends);
                        GM_setValue('vndb_friends_cache', friendsCache);
                    }

                    if (importSettingsCheck.checked && importData.settings) {
                        // Ensure all settings are properly copied with new defaults
                        const newSettings = {
                            textColor: null,
                            buttonTextColor: null,
                            backgroundColor: null,
                            buttonBackgroundColor: null,
                            titleColor: null,
                            borderColor: null,
                            separatorColor: null,
                            fontSize: 17,
                            buttonFontSize: 16,
                            tabFontSize: 18,
                            opacity: null,
                            cacheDuration: 3,
                            gamesPerFriend: 5,
                            maxActivities: 51,
                            ...importData.settings
                        };

                        settings = newSettings;
                        GM_setValue('vndb_friends_settings', settings);
                        initializeColorInputs();
                    }

                    // Update display
                    displayFriendsList();
                    forceStyleUpdate();

                    // Reset import UI
                    importOptions.style.display = 'none';
                    importButton.style.display = 'block';
                    importFile.value = '';

                    // Show success message
                    alert('Import completed successfully!');
                } catch (error) {
                    alert('Error importing data. Please check the file format.');
                    console.error('Import error:', error);
                }
            };
            reader.readAsText(file);
        });

        // Validate that at least one option is selected
        function updateImportButton() {
            confirmImport.disabled = !importFriendsCheck.checked && !importSettingsCheck.checked;
        }

        importFriendsCheck.addEventListener('change', updateImportButton);
        importSettingsCheck.addEventListener('change', updateImportButton);
    }

    // Add a check to prevent duplicate initialization
    function initializeImportExport() {
        const settingsPanel = container.querySelector('.friends-settings');
        // Remove any existing import/export section first
        const existingSection = settingsPanel.querySelector('#importExportSection');
        if (existingSection) {
            existingSection.remove();
        }

        const importExportDiv = document.createElement('div');
        importExportDiv.id = 'importExportSection';
        importExportDiv.innerHTML = importExportHTML;
        settingsPanel.appendChild(importExportDiv);
        setupImportExport();
    }

    // Add near the top of the script, after initializing settings
    let isContainerOpen = sessionStorage.getItem('vndb_friends_container_open') === 'true';

    // Check if container should be open on page load
    if (isContainerOpen) {
        container.style.display = 'block';
        initializeColorInputs();
        initializeImportExport();
        forceStyleUpdate();
        displayFriendsList();
    }

    // Add new functions for activity handling
    let activityCache = JSON.parse(sessionStorage.getItem('vndb_activity_cache')) || {
        timestamp: 0,
        data: []
    };

    async function fetchFriendActivity(username) {
        try {
            // Get the numeric ID from the friendsCache
            const userData = friendsCache[username];
            if (!userData || !userData.id) {
                console.error(`No cached data found for user ${username}`);
                return [];
            }

            const response = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: 'https://api.vndb.org/kana/ulist',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    data: JSON.stringify({
                        "user": userData.id,
                        "fields": "id, vote, voted, vn.title",
                        "filters": ["label", "=", 7],
                        "sort": "voted",
                        "reverse": true,
                        "results": settings.gamesPerFriend || 5
                    }),
                    onload: function(response) {
                        if (response.status === 200) {
                            try {
                                const data = JSON.parse(response.responseText);
                                if (data && Array.isArray(data.results)) {
                                    resolve(data);
                                } else {
                                    console.error('Invalid API response structure:', data);
                                    resolve({ results: [] });
                                }
                            } catch (e) {
                                console.error('JSON parse error:', e);
                                resolve({ results: [] });
                            }
                        } else {
                            console.error('API error:', response.responseText);
                            resolve({ results: [] });
                        }
                    },
                    onerror: function(error) {
                        console.error('Request error:', error);
                        resolve({ results: [] });
                    }
                });
            });

            if (!response.results) {
                return [];
            }

            // Map the results to include the username
            return response.results.map(item => ({
                username,
                vnId: item.id,
                vnTitle: item.vn.title,
                vote: item.vote / 10,
                voted: item.voted
            }));
        } catch (error) {
            console.error(`Error fetching activity for ${username}:`, error);
            return [];
        }
    }

    async function updateActivityFeed() {
        const now = Date.now();
        const cacheDurationMs = (settings.cacheDuration || 3) * 60 * 1000; // Convert minutes to milliseconds
        const activityFeed = document.getElementById('activityFeed');

        // Check for valid cache in sessionStorage
        if (activityCache.data &&
            activityCache.data.length > 0 &&
            now - activityCache.timestamp < cacheDurationMs) {
            displayActivityFeed(activityCache.data);
            // Show quick cache message
            const cacheMsg = document.createElement('div');
            cacheMsg.style.textAlign = 'center';
            cacheMsg.style.fontSize = '0.8em';
            cacheMsg.style.opacity = '0.7';
            const timeLeft = Math.round((cacheDurationMs - (now - activityCache.timestamp)) / 1000);
            cacheMsg.textContent = `Loaded from cache (expires in ${timeLeft}s)`;
            activityFeed.insertAdjacentElement('afterbegin', cacheMsg);
            setTimeout(() => cacheMsg.remove(), 1500);
            return;
        }

        // Show loading message only when fetching from API
        activityFeed.innerHTML = '<div class="loading">Fetching new activity data...</div>';

        try {
            const activities = [];
            for (const friend of friends) {
                try {
                    const friendActivity = await fetchFriendActivity(friend);
                    activities.push(...friendActivity);
                } catch (error) {
                    console.error(`Error fetching activity for ${friend}:`, error);
                    continue;
                }
            }

            // Sort by vote date, most recent first
            activities.sort((a, b) => b.voted - a.voted);

            // Limit to 51 items
            const maxActivities = settings.maxActivities || 51;
            const limitedActivities = activities.slice(0, maxActivities);

            // Update cache and store in sessionStorage
            activityCache = {
                timestamp: now,
                data: limitedActivities
            };
            sessionStorage.setItem('vndb_activity_cache', JSON.stringify(activityCache));

            displayActivityFeed(limitedActivities);
        } catch (error) {
            console.error('Error updating activity feed:', error);
            activityFeed.innerHTML = '<div class="error">Error loading activity feed</div>';
        }
    }

    function displayActivityFeed(activities) {
        const activityFeed = document.getElementById('activityFeed');
        activityFeed.innerHTML = '';

        if (!activities || activities.length === 0) {
            activityFeed.innerHTML = '<div class="no-activity">No recent activity</div>';
            return;
        }

        const maxActivities = settings.maxActivities || 51;
        const limitedActivities = activities.slice(0, maxActivities);

        limitedActivities.forEach(activity => {
            if (!activity.voted || !activity.vnTitle) return;

            const date = new Date(activity.voted * 1000);
            const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;

            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item';

            const userData = friendsCache[activity.username];
            const userId = userData ? userData.id.slice(1) : '';

            activityItem.innerHTML = `
                <div>
                    <strong><a href="/u${userId}" class="friend-link">${activity.username}</a></strong> rated
                    <a href="/v${activity.vnId.toString().replace('v', '')}" class="friend-link vn-link">${activity.vnTitle}</a>
                    <strong>${activity.vote}</strong>
                </div>
                <div class="activity-date">${formattedDate}</div>
            `;
            activityFeed.appendChild(activityItem);
        });

        // Add event listeners using delegation
        const vnLinks = activityFeed.querySelectorAll('a.vn-link');
        vnLinks.forEach(link => {
            link.addEventListener('mouseenter', function() {
                handleFriendsMouseOver.call(this);
            });

            link.addEventListener('mouseleave', function() {
                handleFriendsMouseLeave.call(this);
            });
        });

        adjustContainerPosition();

        // Update scroll handler
        window.addEventListener('scroll', () => {
            if ($('#friendsPopover').css('display') === 'block') {
                $('#friendsPopover').friendsCenter();
            }
        });
    }

    // Add near the top where other state is initialized
    let activeTab = sessionStorage.getItem('vndb_friends_active_tab') || 'friendsList';

    // Update the tab switching functionality
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            // Update active states
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

            button.classList.add('active');
            const tabId = button.dataset.tab;

            // Show all tab content elements associated with this tab
            document.querySelectorAll(`.tab-content[data-tab="${tabId}"], #${tabId}`).forEach(content => {
                content.classList.add('active');
            });

            // Store active tab in session storage
            sessionStorage.setItem('vndb_friends_active_tab', tabId);
            activeTab = tabId;

            // Load activity feed if selected
            if (tabId === 'activityFeed') {
                updateActivityFeed();
            }
        });
    });

    // Update the section where container visibility is restored
    if (isContainerOpen) {
        container.style.display = 'block';
        initializeColorInputs();
        initializeImportExport();
        forceStyleUpdate();

        // Restore active tab
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        const activeTabButton = document.querySelector(`.tab-button[data-tab="${activeTab}"]`);
        const activeTabContent = document.getElementById(activeTab);

        if (activeTabButton && activeTabContent) {
            activeTabButton.classList.add('active');
            activeTabContent.classList.add('active');

            // Also show associated tab content elements
            document.querySelectorAll(`.tab-content[data-tab="${activeTab}"]`).forEach(content => {
                content.classList.add('active');
            });

            // Load activity feed if it was the active tab
            if (activeTab === 'activityFeed') {
                updateActivityFeed();
            } else {
                displayFriendsList();
            }
        }
    }

    // Function to adjust container position
    function adjustContainerPosition() {
        const container = document.querySelector('.friends-container');
        if (!container || container.style.display === 'none') return;

        // Get dimensions
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const containerHeight = container.offsetHeight;
        const containerWidth = container.offsetWidth;

        // Reset position to center
        container.style.top = '50%';
        container.style.left = '50%';
        container.style.transform = 'translate(-50%, -50%)';

        // Get the container's position after centering
        const rect = container.getBoundingClientRect();

        // Adjust if too tall for viewport
        if (containerHeight > viewportHeight - 40) {
            container.style.top = '20px';
            container.style.transform = 'translateX(-50%)';
            container.style.maxHeight = `${viewportHeight - 40}px`;
        } else if (rect.top < 20) {
            container.style.top = '20px';
            container.style.transform = 'translateX(-50%)';
        } else if (rect.bottom > viewportHeight - 20) {
            container.style.top = `${viewportHeight - containerHeight - 20}px`;
            container.style.transform = 'translateX(-50%)';
        }

        // Adjust if too wide for viewport
        if (containerWidth > viewportWidth - 40) {
            container.style.left = '20px';
            container.style.transform = 'none';
            container.style.maxWidth = `${viewportWidth - 40}px`;
        } else if (rect.left < 20) {
            container.style.left = '20px';
            container.style.transform = 'none';
        } else if (rect.right > viewportWidth - 20) {
            container.style.left = `${viewportWidth - containerWidth - 20}px`;
            container.style.transform = 'none';
        }
    }

    // Function to handle container visibility
    function showContainer() {
        const container = document.querySelector('.friends-container');
        container.style.display = 'block';

        // Force recalculation of position
        requestAnimationFrame(() => {
            adjustContainerPosition();
            // Double-check position after a short delay
            setTimeout(adjustContainerPosition, 100);
        });

        sessionStorage.setItem('vndb_friends_container_open', 'true');
        initializeColorInputs();
        initializeImportExport();
        forceStyleUpdate();
        displayFriendsList();
    }

    // Update the event listeners section to include scroll events
    window.addEventListener('resize', adjustContainerPosition);
    window.addEventListener('scroll', adjustContainerPosition);

    // Add near the top of the script, after other initial declarations
    let timeoutId;

    // Add after the existing container creation
    $('body').append('<div id="friendsPopover"></div>');
    $('#friendsPopover').css({
        position: 'absolute',
        zIndex: '1001',
        boxShadow: '0px 0px 5px black',
        display: 'none'
    });

    // Add the centering function
    jQuery.fn.friendsCenter = function () {
        const windowHeight = $(window).height();
        const boxHeight = $(this).outerHeight();
        const scrollOffset = $(window).scrollTop();
        const hoveredLink = $('.activity-item a:hover').get(0);

        if (!hoveredLink) return this;

        const rect = hoveredLink.getBoundingClientRect();
        const leftoffset = rect.left;
        const topoffset = rect.top;
        let newTopOffset;

        if (topoffset - boxHeight / 2 < 10) {
            newTopOffset = 10;
        } else if (topoffset + boxHeight / 2 > windowHeight - 10) {
            newTopOffset = windowHeight - boxHeight - 10;
        } else {
            newTopOffset = topoffset - boxHeight / 2;
        }

        this.css("top", newTopOffset + scrollOffset);
        this.css("left", Math.max(0, leftoffset - $(this).outerWidth() - 25));

        return this;
    };

    // Update the hover handlers
    function handleFriendsMouseOver() {
        // Only show covers if we're on the activity tab
        const activeTab = sessionStorage.getItem('vndb_friends_active_tab');
        if (activeTab !== 'activityFeed') {
            return;
        }

        const vnId = this.getAttribute('href');
        if (!vnId) return;

        const pagelink = 'https://vndb.org' + vnId;

        timeoutId = setTimeout(() => {
            if (GM_getValue(pagelink)) {
                const retrievedLink = GM_getValue(pagelink);
                $('#friendsPopover').empty().append('<img src="' + retrievedLink + '"></img>');
                $('#friendsPopover img').on('load', function() {
                    if (this.height === 0) {
                        GM_deleteValue(pagelink);
                    } else {
                        $('#friendsPopover').friendsCenter().css('display', 'block');
                    }
                });
            } else {
                $.ajax({
                    url: pagelink,
                    dataType: 'text',
                    success: function (data) {
                        const parser = new DOMParser();
                        const dataDOC = parser.parseFromString(data, 'text/html');
                        const imagelink = dataDOC.querySelector(".vnimg img").src;
                        if (!imagelink) return;

                        const img = new Image();
                        img.onload = function() {
                            // Check tab again before showing the image
                            // (in case user switched tabs during load)
                            const currentTab = sessionStorage.getItem('vndb_friends_active_tab');
                            if (currentTab !== 'activityFeed') return;

                            if (this.height === 0) return;
                            $('#friendsPopover').empty().append(this).friendsCenter().css('display', 'block');
                            GM_setValue(pagelink, imagelink);
                        };
                        img.src = imagelink;
                    }
                });
            }
        }, 250);
    }

    function handleFriendsMouseLeave() {
        const activeTab = sessionStorage.getItem('vndb_friends_active_tab');
        if (activeTab !== 'activityFeed') {
            return;
        }

        clearTimeout(timeoutId);
        $('#friendsPopover').css('display', 'none');
    }

    // Add mutation observer to handle dynamic page changes
    const pageObserver = new MutationObserver(() => {
        if (document.querySelector('.friends-container').style.display === 'block') {
            adjustContainerPosition();
        }
    });

    pageObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true
    });
})();
