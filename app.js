/**
 * AJF Live Brief & Worldcup - Mobile Minimalist Engine
 * Optimized for mobile views, single continuous vertical list, and OLED blacks.
 */

// ==========================================================================
// GLOBAL STATE & SETTINGS
// ==========================================================================
const DEFAULT_SHEET_ID = "1CmbXLN7YVziJKTkp8jwLtFfo0S5B9MZx5toL89WJTAU";

const STATE = {
    sheetId: localStorage.getItem("ajf_sheet_id") || DEFAULT_SHEET_ID,
    scheduleTitle: "AJF Live Brief",
    days: [],
    allEvents: [],
    filters: {
        category: "all",
        search: ""
    },
    currentPillEventId: null // Id of the event highlighted in the top status pill
};

// Emojis and keywords mapping for categorizations
const WEEKDAYS = [
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'lunes', 'martes', 'miercoles', 'miércoles', 'jueves', 'viernes', 'sabado', 'sábado', 'domingo'
];

const COUNTRY_FLAGS = {
    "argentina": "🇦🇷", "brazil": "🇧🇷", "brasil": "🇧🇷", "mexico": "🇲🇽", "méxico": "🇲🇽",
    "south africa": "🇿🇦", "south korea": "🇰🇷", "czechia": "🇨🇿", "canada": "🇨🇦",
    "bosnia and herzegovina": "🇧🇦", "bosnia": "🇧🇦", "usa": "🇺🇸", "paraguay": "🇵🇾",
    "qatar": "🇶🇦", "switzerland": "🇨🇭", "morocco": "🇲🇦", "haiti": "🇭🇹",
    "scotland": "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "australia": "🇦🇺", "türkiye": "🇹🇷", "turkey": "🇹🇷",
    "germany": "🇩🇪", "curaçao": "🇨🇼", "curacao": "🇨🇼", "netherlands": "🇳🇱",
    "japan": "🇯🇵", "ivory coast": "🇨🇮", "ecuador": "🇪🇨", "sweden": "🇸🇪",
    "tunisia": "🇹🇳", "spain": "🇪🇸", "cabo verde": "🇨🇻", "belgium": "🇧🇪",
    "egypt": "🇪🇬", "saudi arabia": "🇸🇦", "uruguay": "🇺🇾", "iran": "🇮🇷",
    "new zealand": "🇳🇿"
};

// ==========================================================================
// CSV PARSING ENGINE
// ==========================================================================
function parseCSV(text) {
    const lines = [];
    let row = [""];
    let insideQuote = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (insideQuote && nextChar === '"') {
                row[row.length - 1] += '"';
                i++; // Skip the next quote
            } else {
                insideQuote = !insideQuote;
            }
        } else if (char === ',' && !insideQuote) {
            row.push("");
        } else if ((char === '\r' || char === '\n') && !insideQuote) {
            if (char === '\r' && nextChar === '\n') {
                i++; // Skip \n
            }
            lines.push(row);
            row = [""];
        } else {
            row[row.length - 1] += char;
        }
    }
    if (row.length > 1 || row[0] !== "") {
        lines.push(row);
    }
    return lines;
}

// ==========================================================================
// CLASSIFICATION & PARSING HELPERS
// ==========================================================================
function isDayHeader(col0, col1) {
    if (!col0) return false;
    const clean = col0.trim().toLowerCase();
    const startsWithWeekday = WEEKDAYS.some(day => clean.startsWith(day));
    const isCol1Empty = !col1 || col1.trim() === '';
    return startsWithWeekday && isCol1Empty;
}

function parseDate(dayStr) {
    const match = dayStr.match(/(\d+)\/(\d+)/);
    if (!match) return null;
    const day = parseInt(match[1]);
    const month = parseInt(match[2]) - 1;
    const year = 2026; 
    return new Date(year, month, day);
}

function categorizeEvent(title) {
    const lower = title.toLowerCase();
    if (title.includes('🛫')) {
        return 'takeoff';
    }
    if (title.includes('🛬')) {
        return 'landing';
    }
    if (lower.includes('transfer')) {
        return 'transfer';
    }
    if (lower.includes('flight') || 
        lower.includes('lga') || lower.includes('jfk') || 
        lower.includes('eze') || lower.includes('airport')) {
        return 'flights';
    }
    if (lower.includes('vs.') || lower.includes('worldcup') || 
        lower.includes('game') || lower.includes('semi-final') || 
        lower.includes('fixtures') || lower.includes('wc ')) {
        return 'worldcup';
    }
    if (lower.includes('meeting') || lower.includes('brief') || 
        lower.includes('reunión') || lower.includes('reunion')) {
        return 'meetings';
    }
    if (lower.includes('activacion') || lower.includes('activación') || lower.includes('activation')) {
        return 'activacion';
    }
    if (lower.includes('fiesta') || lower.includes('party')) {
        return 'fiesta';
    }
    if (lower.includes('contenido') || lower.includes('content') || lower.includes('shoot')) {
        return 'contenido';
    }
    return 'default';
}

function formatWorldcupTitle(title) {
    const parts = title.split(/\s+vs\.?\s+/i);
    if (parts.length === 2) {
        let teamA = parts[0].trim();
        let teamB = parts[1].trim();
        
        const flagA = COUNTRY_FLAGS[teamA.toLowerCase()] || '';
        const flagB = COUNTRY_FLAGS[teamB.toLowerCase()] || '';
        
        return `${flagA} ${teamA} <span class="vs-divider">vs</span> ${teamB} ${flagB}`.trim();
    }
    return title;
}

// ==========================================================================
// ASYNC FETCH & DATA PROCESSOR
// ==========================================================================
async function fetchScheduleData() {
    showSkeleton(true);
    
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${STATE.sheetId}/gviz/tq?tqx=out:csv&gid=0`;
    
    try {
        const response = await fetch(spreadsheetUrl);
        if (!response.ok) {
            throw new Error(`Fallo de red: ${response.statusText}`);
        }
        
        const csvText = await response.text();
        processCSVText(csvText);
        
    } catch (error) {
        console.error("Error al obtener Sheet:", error);
        alert("No se pudo conectar al Google Sheet. Revisa que el ID sea correcto y que la hoja esté configurada como pública.");
        showEmptyState(true);
    } finally {
        showSkeleton(false);
    }
}

function processCSVText(csvText) {
    const rows = parseCSV(csvText);
    if (rows.length === 0) {
        showEmptyState(true);
        return;
    }
    
    // Parse dynamic main title
    if (rows[0] && rows[0][0] && rows[0][0].trim() !== "" && (!rows[0][1] || rows[0][1].trim() === "")) {
        STATE.scheduleTitle = rows[0][0].trim();
        document.getElementById("app-title").textContent = STATE.scheduleTitle;
    }
    
    const parsedDays = [];
    let currentDay = null;
    
    for (let i = 1; i < rows.length; i++) {
        const col0 = rows[i][0] ? rows[i][0].trim() : "";
        const col1 = rows[i][1] ? rows[i][1].trim() : "";
        
        if (col0 === "" && col1 === "") continue; // Skip spacers
        
        if (isDayHeader(col0, col1)) {
            // Check duplicates to merge them
            const existingDay = parsedDays.find(d => d.dateStr.toLowerCase() === col0.toLowerCase());
            if (existingDay) {
                currentDay = existingDay;
            } else {
                currentDay = {
                    dateStr: col0,
                    date: parseDate(col0),
                    events: []
                };
                parsedDays.push(currentDay);
            }
        } else if (currentDay) {
            const eventTitle = col1 !== "" ? col1 : col0;
            const eventTime = col1 !== "" ? col0 : "";
            
            if (eventTitle === "") continue;
            
            const category = categorizeEvent(eventTitle);
            const id = `evt-${Math.random().toString(36).substr(2, 9)}`;
            
            currentDay.events.push({
                id: id,
                time: eventTime,
                title: eventTitle,
                category: category
            });
        }
    }
    
    // Filter out empty days
    STATE.days = parsedDays.filter(day => day.events.length > 0);
    
    // Flatten global array for highlights calculations
    STATE.allEvents = [];
    STATE.days.forEach(day => {
        day.events.forEach(evt => {
            let startDate = null;
            if (evt.time && evt.time.includes(':')) {
                const [h, m] = evt.time.split(':').map(Number);
                startDate = new Date(day.date.getFullYear(), day.date.getMonth(), day.date.getDate(), h, m);
            } else {
                startDate = new Date(day.date.getFullYear(), day.date.getMonth(), day.date.getDate(), 0, 0);
            }
            
            const durationMs = evt.time ? 2 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
            const endDate = new Date(startDate.getTime() + durationMs);
            
            STATE.allEvents.push({
                ...evt,
                dayStr: day.dateStr,
                dayDate: day.date,
                startDate: startDate,
                endDate: endDate
            });
        });
    });
    
    // Sort chronologically
    STATE.allEvents.sort((a, b) => a.startDate - b.startDate);
    
    if (STATE.days.length === 0) {
        showEmptyState(true);
        return;
    }
    
    // Render the entire list vertically
    renderTimeline();
    updateLiveHighlights();
}

// ==========================================================================
// RENDER FULL VERTICAL TIMELINE
// ==========================================================================
function renderTimeline() {
    const timelineList = document.getElementById("timeline-list");
    const timelineEmpty = document.getElementById("timeline-empty");
    const filterStatus = document.getElementById("filter-status");
    
    timelineList.innerHTML = "";
    
    const isFilterActive = STATE.filters.search !== "" || STATE.filters.category !== "all";
    let totalRenderedEvents = 0;
    const now = new Date();
    
    // Process Day by Day
    STATE.days.forEach(day => {
        // Filter events within this day
        const matchingEvents = day.events.filter(evt => {
            const matchesSearch = STATE.filters.search === "" || 
                                 evt.title.toLowerCase().includes(STATE.filters.search.toLowerCase()) ||
                                 (evt.time && evt.time.includes(STATE.filters.search));
            
            const matchesCategory = STATE.filters.category === "all" || 
                                    evt.category === STATE.filters.category ||
                                    (STATE.filters.category === "trip" && (evt.category === "flights" || evt.category === "takeoff" || evt.category === "landing" || evt.category === "transfer"));
            
            return matchesSearch && matchesCategory;
        });
        
        // If there are matching events, render the sticky header and rows
        if (matchingEvents.length > 0) {
            // 1. Day Sticky Header
            const headerDiv = document.createElement("div");
            headerDiv.className = "day-header";
            headerDiv.textContent = day.dateStr;
            timelineList.appendChild(headerDiv);
            
            // 2. Events Rows
            matchingEvents.forEach(evt => {
                const fullEvt = STATE.allEvents.find(e => e.id === evt.id);
                const isLive = fullEvt && now >= fullEvt.startDate && now < fullEvt.endDate;
                
                const row = document.createElement("div");
                row.id = evt.id;
                row.className = `event-row cat-${evt.category} ${isLive ? 'is-active-now' : ''} ${evt.time === '' ? 'is-all-day' : ''}`;
                
                let displayTitle = evt.title;
                let catIcon = "📅";
                let catText = "Evento";
                
                if (evt.category === 'flights') {
                    catIcon = "✈️";
                    catText = "Vuelo";
                } else if (evt.category === 'transfer') {
                    catIcon = "🚗";
                    catText = "Transfer";
                } else if (evt.category === 'takeoff') {
                    catIcon = "🛫";
                    catText = "Vuelo";
                    displayTitle = displayTitle.replace(/🛫|🛬/g, '').trim();
                } else if (evt.category === 'landing') {
                    catIcon = "🛬";
                    catText = "Vuelo";
                    displayTitle = displayTitle.replace(/🛫|🛬/g, '').trim();
                } else if (evt.category === 'worldcup') {
                    catIcon = "⚽";
                    catText = "Game";
                    displayTitle = formatWorldcupTitle(displayTitle);
                } else if (evt.category === 'meetings') {
                    catIcon = "💼";
                    catText = "Reunión";
                } else if (evt.category === 'activacion') {
                    catIcon = "🎤";
                    catText = "Activación";
                } else if (evt.category === 'fiesta') {
                    catIcon = "🎉";
                    catText = "Fiesta";
                } else if (evt.category === 'contenido') {
                    catIcon = "📷";
                    catText = "Contenido";
                }
                
                const displayTime = evt.time ? evt.time : "—";
                
                // Flight code detection
                let flightLinkHtml = "";
                const flightMatch = evt.title.match(/\b([A-Z]{2}|[A-Z]\d)\s?(\d{2,4})\b/i);
                if (flightMatch) {
                    const carrier = flightMatch[1].toUpperCase();
                    const number = flightMatch[2];
                    const flightCode = `${carrier}${number}`;
                    flightLinkHtml = `
                        <a href="https://www.google.com/search?q=vuelo+${flightCode}" 
                           target="_blank" 
                           class="flight-status-link" 
                           rel="noopener noreferrer" 
                           title="Consultar estado de vuelo en tiempo real en Google">
                            Info ↗
                        </a>
                    `;
                }
                
                let liveIndicatorHtml = isLive ? `
                    <span class="row-live-indicator">
                        <span></span>EN VIVO
                    </span>
                ` : "";
                
                row.innerHTML = `
                    <div class="row-category-bar"></div>
                    <div class="row-time">${displayTime}</div>
                    <div class="row-icon">${catIcon}</div>
                    <div class="row-info">
                        <div class="row-title">${displayTitle}</div>
                        <div class="row-meta">
                            <span>${catText}</span>
                            ${flightLinkHtml}
                            ${liveIndicatorHtml}
                        </div>
                    </div>
                `;
                
                timelineList.appendChild(row);
                totalRenderedEvents++;
            });
        }
    });
    
    // Manage Status & Empty states
    if (isFilterActive) {
        filterStatus.style.display = "flex";
        let label = "Filtro activo";
        if (STATE.filters.category !== "all") {
            label = `Categoría: ${STATE.filters.category.toUpperCase()}`;
        }
        if (STATE.filters.search !== "") {
            label += (STATE.filters.category !== "all" ? " + " : "") + `"${STATE.filters.search}"`;
        }
        document.getElementById("status-query").textContent = `${label} (${totalRenderedEvents})`;
    } else {
        filterStatus.style.display = "none";
    }
    
    if (totalRenderedEvents === 0) {
        timelineList.style.display = "none";
        timelineEmpty.style.display = "flex";
    } else {
        timelineEmpty.style.display = "none";
        timelineList.style.display = "flex";
    }
}

// ==========================================================================
// COMPACT DYNAMIC ISLAND STATUS WIDGET
// ==========================================================================
function updateLiveHighlights() {
    const now = new Date();
    
    // 1. Find Live event
    const liveEvent = STATE.allEvents.find(evt => now >= evt.startDate && now < evt.endDate);
    
    const pill = document.getElementById("status-pill");
    const pillContent = document.getElementById("pill-content");
    const container = document.getElementById("status-pill-container");
    
    // Clear classes & state
    pill.classList.remove("is-active", "is-active-live", "is-active-upcoming");
    STATE.currentPillEventId = null;
    
    if (liveEvent) {
        container.style.display = "block";
        pill.classList.add("is-active", "is-active-live");
        STATE.currentPillEventId = liveEvent.id;
        
        // Calculate remaining minutes
        const diffMins = Math.ceil((liveEvent.endDate - now) / (60 * 1000));
        
        let displayTitle = liveEvent.title;
        if (liveEvent.category === 'takeoff' || liveEvent.category === 'landing') {
            displayTitle = displayTitle.replace(/🛫|🛬/g, '').trim();
        }
        
        pillContent.innerHTML = `🟢 <strong>AHORA:</strong> ${displayTitle} <span style="color: var(--color-worldcup)">(${diffMins}m rest.)</span>`;
        
    } else {
        container.style.display = "none";
    }
}

// ==========================================================================
// CONTROLS & INTERACTION ENGINE
// ==========================================================================
function initControls() {
    // Dynamic Island clicking feature (smoothly scroll to target event)
    document.getElementById("status-pill").addEventListener("click", () => {
        if (STATE.currentPillEventId) {
            // If category filters are active, clear them so the target event is visible!
            if (STATE.filters.category !== "all" || STATE.filters.search !== "") {
                clearAllFilters();
            }
            
            setTimeout(() => {
                const element = document.getElementById(STATE.currentPillEventId);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    // Add beautiful temporary flashing border
                    element.style.background = "rgba(255, 255, 255, 0.08)";
                    setTimeout(() => {
                        element.style.background = "";
                    }, 1200);
                }
            }, 50);
        }
    });

    // Search bar
    const searchInput = document.getElementById("search-input");
    const searchClearBtn = document.getElementById("search-clear-btn");
    
    searchInput.addEventListener("input", (e) => {
        STATE.filters.search = e.target.value.trim();
        searchClearBtn.style.display = STATE.filters.search !== "" ? "block" : "none";
        renderTimeline();
    });
    
    searchClearBtn.addEventListener("click", () => {
        searchInput.value = "";
        STATE.filters.search = "";
        searchClearBtn.style.display = "none";
        renderTimeline();
    });
    
    // Categories tabs
    const tabButtons = document.querySelectorAll(".tab-btn");
    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            tabButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            STATE.filters.category = btn.dataset.category;
            renderTimeline();
        });
    });
    
    // Refresh button
    document.getElementById("btn-refresh").addEventListener("click", () => {
        fetchScheduleData();
    });
    
    
    // Filter status bar clear button
    document.getElementById("btn-clear-filters").addEventListener("click", () => {
        clearAllFilters();
    });
}

function clearAllFilters() {
    // Clear search
    const searchInput = document.getElementById("search-input");
    const searchClearBtn = document.getElementById("search-clear-btn");
    searchInput.value = "";
    STATE.filters.search = "";
    searchClearBtn.style.display = "none";
    
    // Reset tabs
    document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
    const allTab = document.querySelector(".tab-btn[data-category='all']");
    if (allTab) allTab.classList.add("active");
    
    STATE.filters.category = "all";
    renderTimeline();
}

// ==========================================================================
// SYSTEM CLOCK & SKELETON DISPLAY
// ==========================================================================
function startLiveClock() {
    const liveClock = document.getElementById("live-clock");
    
    function tick() {
        const now = new Date();
        const options = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
        let str = now.toLocaleDateString('es-ES', options).toUpperCase();
        // Format layout "20 MAY • 17:12:05"
        str = str.replace(',', ' •');
        liveClock.textContent = str;
        
        // Recalculate highlights dynamically every minute
        if (now.getSeconds() === 0 && STATE.allEvents.length > 0) {
            updateLiveHighlights();
        }
    }
    
    tick();
    setInterval(tick, 1000);
}

function showSkeleton(show) {
    const skeleton = document.getElementById("timeline-skeleton");
    const list = document.getElementById("timeline-list");
    const empty = document.getElementById("timeline-empty");
    
    if (show) {
        skeleton.style.display = "flex";
        list.style.display = "none";
        empty.style.display = "none";
    } else {
        skeleton.style.display = "none";
    }
}

function showEmptyState(show) {
    const empty = document.getElementById("timeline-empty");
    const list = document.getElementById("timeline-list");
    const skeleton = document.getElementById("timeline-skeleton");
    
    if (show) {
        empty.style.display = "flex";
        list.style.display = "none";
        skeleton.style.display = "none";
    } else {
        empty.style.display = "none";
    }
}

// ==========================================================================
// APP INITIALIZATION ENTRY POINT
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    startLiveClock();
    initControls();
    fetchScheduleData();
});
