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
        search: "",
        person: "",
        showNonArg: false,
        showRival: true
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
function getSingleMentionedPerson(title) {
    if (!title || typeof title !== 'string') return null;
    const lowerTitle = title.toLowerCase();
    const people = ['lautaro', 'will', 'laureano', 'chango', 'dustin', 'todos'];
    const matched = [];
    
    people.forEach(person => {
        const regex = new RegExp(`\\b${person}\\b`, 'i');
        if (regex.test(lowerTitle)) {
            matched.push(person);
        }
    });
    
    if (matched.length === 1) {
        return matched[0];
    }
    return null;
}

function getMentionedPeople(title) {
    if (!title || typeof title !== 'string') return [];
    const lowerTitle = title.toLowerCase();
    const people = ['lautaro', 'will', 'laureano', 'chango', 'dustin', 'todos'];
    const matched = [];
    
    people.forEach(person => {
        const regex = new RegExp(`\\b${person}\\b`, 'i');
        if (regex.test(lowerTitle)) {
            matched.push(person);
        }
    });
    
    return matched;
}

function highlightPeopleInTitle(title) {
    if (!title || typeof title !== 'string') return "";
    const people = ['lautaro', 'will', 'laureano', 'chango', 'dustin', 'todos'];
    let highlightedTitle = title;
    
    people.forEach(person => {
        const regex = new RegExp(`\\b(${person})\\b`, 'gi');
        highlightedTitle = highlightedTitle.replace(regex, `<span class="title-highlight-person person-${person}">$1</span>`);
    });
    
    return highlightedTitle;
}

function isDayHeader(col0, col1, col2) {
    if (!col0) return false;
    const clean = col0.trim().toLowerCase();
    const startsWithWeekday = WEEKDAYS.some(day => clean.startsWith(day));
    const isCol1Empty = !col1 || col1.trim() === '';
    const isCol2Empty = !col2 || col2.trim() === '';
    return startsWithWeekday && isCol1Empty && isCol2Empty;
}

function parseDate(dayStr) {
    if (!dayStr || typeof dayStr !== 'string') return null;
    const match = dayStr.match(/(\d+)\/(\d+)/);
    if (!match) return null;
    const day = parseInt(match[1]);
    const month = parseInt(match[2]) - 1;
    const year = 2026; 
    return new Date(year, month, day);
}

function categorizeEvent(emojiStr) {
    if (!emojiStr) return 'default';
    const lower = emojiStr.toLowerCase();
    
    if (lower.includes('🛫') || lower.includes('takeoff')) {
        return 'takeoff';
    }
    if (lower.includes('🛬') || lower.includes('landing')) {
        return 'landing';
    }
    if (lower.includes('🚗') || lower.includes('transfer')) {
        return 'transfer';
    }
    if (lower.includes('✈️') || lower.includes('trip') || lower.includes('vuelo')) {
        return 'flights';
    }
    if (lower.includes('⚽') || lower.includes('game') || lower.includes('partido') || lower.includes('worldcup')) {
        return 'worldcup';
    }
    if (lower.includes('💼') || lower.includes('reunion') || lower.includes('meeting') || lower.includes('reunión')) {
        return 'meetings';
    }
    if (lower.includes('🎈') || lower.includes('balloon') || lower.includes('sister')) {
        return 'fiesta-sister';
    }
    if (lower.includes('👾') || lower.includes('rival') || lower.includes('enemy')) {
        return 'fiesta-rival';
    }
    if (lower.includes('🎉') || lower.includes('🪩') || lower.includes('🥳') || lower.includes('fiesta') || lower.includes('party') || lower.includes('main')) {
        return 'fiesta-main';
    }
    if (lower.includes('🛎️') || lower.includes('hotel') || lower.includes('checkin') || lower.includes('check-in') || lower.includes('checkout') || lower.includes('check-out') || lower.includes('hospedaje')) {
        return 'hotel';
    }
    if (lower.includes('🦫') || lower.includes('ajf')) {
        return 'evento-ajf';
    }
    if (lower.includes('📅') || lower.includes('evento') || lower.includes('event')) {
        return 'evento';
    }
    if (lower.includes('📷') || lower.includes('📱') || lower.includes('contenido')) {
        return 'contenido';
    }
    if (lower.includes('🆓') || lower.includes('freetime') || lower.includes('tiempo libre') || lower.includes('free time') || lower.includes('libre')) {
        return 'freetime';
    }
    
    return 'default';
}

function formatWorldcupTitle(title) {
    if (!title || typeof title !== 'string') return "";
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
        
        // Auto-fallback to default ID if localStorage ID failed
        if (STATE.sheetId !== DEFAULT_SHEET_ID) {
            console.warn("Fallo con el ID personalizado de localStorage. Reintentando con el ID por defecto...");
            localStorage.removeItem("ajf_sheet_id");
            STATE.sheetId = DEFAULT_SHEET_ID;
            return fetchScheduleData();
        }
        
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
        const appTitle = document.getElementById("app-title");
        if (appTitle) {
            appTitle.textContent = STATE.scheduleTitle;
        }
    }
    
    const parsedDays = [];
    let currentDay = null;
    
    for (let i = 1; i < rows.length; i++) {
        const col0 = rows[i][0] ? rows[i][0].trim() : "";
        const col1 = rows[i][1] ? rows[i][1].trim() : "";
        const col2 = rows[i][2] ? rows[i][2].trim() : "";
        
        if (col0 === "" && col1 === "" && col2 === "") continue; // Skip spacers
        
        if (isDayHeader(col0, col1, col2)) {
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
            // New format: col0 (Time), col1 (Emoji/Category), col2 (Event Title)
            const eventTime = col0;
            const emojiStr = col1;
            // Fallback for legacy 2 column format: if col2 is empty, assume col1 is the event title
            const eventTitle = col2 !== "" ? col2 : (col1 !== "" ? col1 : "Sin Título");
            
            if (eventTitle === "" && eventTime === "") continue;
            
            const category = categorizeEvent(emojiStr !== "" && col2 !== "" ? emojiStr : eventTitle);
            const id = `evt-${Math.random().toString(36).substr(2, 9)}`;
            
            // Check for end time in any event (e.g. "meeting till 13:00 DUSTIN...")
            const endTimeMatch = eventTitle.match(/(?:till|hasta(?: las)?|to|until)\s+(\d{1,2}:\d{2})/i);
            let cleanedTitle = eventTitle;
            let eventEndTime = null;
            if (endTimeMatch) {
                eventEndTime = endTimeMatch[1];
                cleanedTitle = eventTitle.replace(endTimeMatch[0], '').replace(/\s+/g, ' ').trim();
            }
            
            currentDay.events.push({
                id: id,
                time: eventTime,
                endTime: eventEndTime,
                title: cleanedTitle,
                category: category
            });
        }
    }
    
    // Filter out empty days and days older than yesterday
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    STATE.days = parsedDays.filter(day => {
        if (day.events.length === 0) return false;
        if (day.date instanceof Date && !isNaN(day.date)) {
            return day.date >= yesterday;
        }
        return true;
    });

    // Helper to get time value in minutes for sorting and date parsing
    const getTimeValue = (timeStr) => {
        if (!timeStr || typeof timeStr !== 'string') return -1;
        const clean = timeStr.trim();
        if (!clean.includes(':')) return -1;
        const match = clean.match(/^(\d{1,2}):(\d{2})/);
        if (!match) return 9999;
        let h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const isPm = /pm/i.test(clean);
        const isAm = /am/i.test(clean);
        if (isPm && h < 12) h += 12;
        if (isAm && h === 12) h = 0;
        return h * 60 + m;
    };

    // Sort events within each day chronologically (all-day events first)
    STATE.days.forEach(day => {
        day.events.sort((a, b) => getTimeValue(a.time) - getTimeValue(b.time));
    });
    
    // Flatten global array for highlights calculations
    STATE.allEvents = [];
    STATE.days.forEach(day => {
        day.events.forEach(evt => {
            let startDate = null;
            const dayDate = (day.date instanceof Date && !isNaN(day.date)) ? day.date : new Date(2026, 5, 1);
            const timeVal = getTimeValue(evt.time);
            
            if (timeVal !== -1 && timeVal !== 9999) {
                const h = Math.floor(timeVal / 60);
                const m = timeVal % 60;
                startDate = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), h, m);
            } else {
                startDate = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 0, 0);
            }
            
            let endDate = null;
            if (evt.endTime) {
                const endTimeVal = getTimeValue(evt.endTime);
                if (endTimeVal !== -1 && endTimeVal !== 9999) {
                    const endH = Math.floor(endTimeVal / 60);
                    const endM = endTimeVal % 60;
                    endDate = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), endH, endM);
                    if (endDate < startDate) {
                        endDate.setDate(endDate.getDate() + 1);
                    }
                }
            }
            if (!endDate) {
                const durationMs = evt.time ? 2 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
                endDate = new Date(startDate.getTime() + durationMs);
            }
            
            STATE.allEvents.push({
                ...evt,
                dayStr: day.dateStr,
                dayDate: dayDate,
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
    
    const isFilterActive = STATE.filters.search !== "" || STATE.filters.category !== "all" || STATE.filters.person !== "";
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
                                    (STATE.filters.category === "trip" && (evt.category === "flights" || evt.category === "takeoff" || evt.category === "landing" || evt.category === "transfer" || evt.category === "hotel")) ||
                                    (STATE.filters.category === "fiesta" && (evt.category === "fiesta-main" || evt.category === "fiesta-sister" || evt.category === "fiesta-rival")) ||
                                    (STATE.filters.category === "evento" && (evt.category === "evento" || evt.category === "evento-ajf"));
            
            const matchesPerson = STATE.filters.person === "" || getMentionedPeople(evt.title).includes(STATE.filters.person);
            
            const isNonArgMatch = evt.category === "worldcup" && !evt.title.toLowerCase().includes("argentina");
            const matchesNonArg = STATE.filters.showNonArg || !isNonArgMatch;
            
            const isRivalMatch = evt.category === "fiesta-rival";
            const matchesRival = STATE.filters.showRival || !isRivalMatch;
            
            return matchesSearch && matchesCategory && matchesPerson && matchesNonArg && matchesRival;
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
                
                // Person detection & classes (Only color rows containing DUSTIN or TODOS)
                const mentionedPeople = getMentionedPeople(evt.title);
                const hasDustin = mentionedPeople.includes("dustin");
                const hasTodos = mentionedPeople.includes("todos");
                const isMultiplePeople = mentionedPeople.length > 1 || hasTodos;
                    
                let personClass = "";
                if (hasDustin || hasTodos) {
                    if (isMultiplePeople) {
                        personClass = "person-dustin-group";
                    } else {
                        personClass = "person-dustin";
                    }
                }
                
                // Argentina match detection
                const isArgentina = evt.title && evt.title.toLowerCase().includes("argentina");
                
                const row = document.createElement("div");
                row.id = evt.id;
                row.className = `event-row cat-${evt.category} ${isLive ? 'is-active-now' : ''} ${evt.time === '' ? 'is-all-day' : ''} ${evt.endTime ? 'has-end-time' : ''} ${personClass} ${isArgentina ? 'is-argentina' : ''}`;
                
                let displayTitle = evt.title;
                let parenthesesText = "";
                const parenthesesMatch = displayTitle.match(/\(([^)]+)\)/);
                if (parenthesesMatch) {
                    parenthesesText = parenthesesMatch[1].trim();
                    displayTitle = displayTitle.replace(/\s*\([^)]+\)/g, '').trim();
                }
                
                // Extract URLs from displayTitle and replace with placeholders to prevent name highlight collision
                const urls = [];
                const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
                displayTitle = displayTitle.replace(urlRegex, (url) => {
                    urls.push(url);
                    return `__URL_PLACEHOLDER_${urls.length - 1}__`;
                });
                
                let catIcon = "📅";
                let catText = "Evento";
                
                if (evt.category === 'flights') {
                    catIcon = "✈️";
                    catText = "Vuelo";
                } else if (evt.category === 'transfer') {
                    catIcon = "🚗";
                    catText = "Transfer";
                } else if (evt.category === 'hotel') {
                    catIcon = "🛎️";
                    const lowerTitle = evt.title.toLowerCase();
                    if (lowerTitle.includes('checkin') || lowerTitle.includes('check-in')) {
                        catText = "Check-in";
                    } else if (lowerTitle.includes('checkout') || lowerTitle.includes('check-out')) {
                        catText = "Check-out";
                    } else {
                        catText = "Hotel";
                    }
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
                } else if (evt.category === 'evento') {
                    catIcon = "📅";
                    catText = "Event";
                } else if (evt.category === 'evento-ajf') {
                    catIcon = `<img src="carpincho.png" alt="🦫" class="mascot-icon">`;
                    catText = "AJF Event";
                } else if (evt.category === 'fiesta-main') {
                    catIcon = "🎉";
                    catText = "Main";
                } else if (evt.category === 'fiesta-sister') {
                    catIcon = `<img src="cerveza.png" alt="🎈" class="mascot-icon">`;
                    catText = "Sister";
                } else if (evt.category === 'fiesta-rival') {
                    catIcon = "👾";
                    catText = "Rival";
                } else if (evt.category === 'contenido') {
                    catIcon = "📷";
                    catText = "Contenido";
                } else if (evt.category === 'freetime') {
                    catIcon = "🆓";
                    catText = "Freetime";
                }
                
                let timeHtml = "";
                if (evt.time) {
                    if (evt.endTime) {
                        timeHtml = `<div class="time-start">${evt.time}</div><div class="time-end">${evt.endTime}</div>`;
                    } else {
                        timeHtml = evt.time;
                    }
                } else {
                    timeHtml = "—";
                }
                
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
                
                let personTagHtml = "";
                if (mentionedPeople.length > 0) {
                    mentionedPeople.forEach(person => {
                        const capName = person.charAt(0).toUpperCase() + person.slice(1);
                        const isActive = STATE.filters.person === person;
                        personTagHtml += `<span class="person-tag tag-${person} ${isActive ? 'is-active-filter' : ''}">${capName}</span>`;
                    });
                }
                
                let argentinaTagHtml = "";
                if (isArgentina) {
                    argentinaTagHtml = `<span class="argentina-tag">🇦🇷 Argentina</span>`;
                }
                
                let parenthesesHtml = "";
                if (parenthesesText) {
                    const isUrl = /^(https?:\/\/[^\s]+|www\.[^\s]+)$/i.test(parenthesesText);
                    if (isUrl) {
                        let href = parenthesesText;
                        if (!/^https?:\/\//i.test(parenthesesText)) {
                            href = 'https://' + parenthesesText;
                        }
                        parenthesesHtml = `<a href="${href}" target="_blank" class="row-parentheses-link" rel="noopener noreferrer" title="Abrir enlace"><strong>LINK ↗</strong></a>`;
                    } else {
                        parenthesesHtml = `<a href="https://www.google.com/search?q=${encodeURIComponent(parenthesesText)}" target="_blank" class="row-parentheses" rel="noopener noreferrer" title="Buscar locación en Google"><strong>${parenthesesText}</strong></a>`;
                    }
                }
                
                let highlightedTitle = highlightPeopleInTitle(displayTitle);
                
                // Restore URLs as LINK hyperlinks
                urls.forEach((url, idx) => {
                    let href = url;
                    if (!/^https?:\/\//i.test(url)) {
                        href = 'https://' + url;
                    }
                    const linkHtml = `<a href="${href}" target="_blank" rel="noopener noreferrer" class="event-title-link">LINK</a>`;
                    highlightedTitle = highlightedTitle.replace(`__URL_PLACEHOLDER_${idx}__`, linkHtml);
                });
                
                row.innerHTML = `
                    <div class="row-category-bar"></div>
                    <div class="row-time">${timeHtml}</div>
                    <div class="row-icon">${catIcon}</div>
                    <div class="row-info">
                        <div class="row-title">${highlightedTitle}</div>
                        <div class="row-meta">
                            <span>${catText}</span>
                            ${parenthesesHtml}
                            ${flightLinkHtml}
                            ${personTagHtml}
                            ${argentinaTagHtml}
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
        if (STATE.filters.person !== "") {
            label = (label === "Filtro activo" ? "" : label + " + ") + `Persona: ${STATE.filters.person.toUpperCase()}`;
        }
        if (STATE.filters.search !== "") {
            label = (label === "Filtro activo" ? "" : label + " + ") + `"${STATE.filters.search}"`;
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
    pill.classList.remove("is-active", "is-active-live", "is-active-upcoming", "is-argentina-pill");
    STATE.currentPillEventId = null;
    
    if (liveEvent) {
        container.style.display = "block";
        pill.classList.add("is-active", "is-active-live");
        STATE.currentPillEventId = liveEvent.id;
        
        // Calculate remaining minutes
        const diffMins = Math.ceil((liveEvent.endDate - now) / (60 * 1000));
        
        let displayTitle = liveEvent.title;
        displayTitle = displayTitle.replace(/\s*\([^)]+\)/g, '').trim();
        if (liveEvent.category === 'takeoff' || liveEvent.category === 'landing') {
            displayTitle = displayTitle.replace(/🛫|🛬/g, '').trim();
        }
        
        // Argentina live highlight
        const isArg = displayTitle && displayTitle.toLowerCase().includes("argentina");
        if (isArg) {
            pill.classList.add("is-argentina-pill");
            pillContent.innerHTML = `🇦🇷 <strong>AHORA:</strong> ${displayTitle} <span style="color: var(--color-argentina)">(${diffMins}m rest.)</span>`;
        } else {
            pillContent.innerHTML = `🟢 <strong>AHORA:</strong> ${displayTitle} <span style="color: var(--color-worldcup)">(${diffMins}m rest.)</span>`;
        }
        
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
    const btnRefresh = document.getElementById("btn-refresh");
    if (btnRefresh) {
        btnRefresh.addEventListener("click", () => {
            fetchScheduleData();
        });
    }
    
    // Toggle non-Argentina matches
    const toggleNonArg = document.getElementById("toggle-non-arg");
    if (toggleNonArg) {
        toggleNonArg.checked = STATE.filters.showNonArg;
        toggleNonArg.addEventListener("change", (e) => {
            STATE.filters.showNonArg = e.target.checked;
            renderTimeline();
        });
    }
    
    // Toggle Rival events
    const toggleRival = document.getElementById("toggle-rival");
    if (toggleRival) {
        toggleRival.checked = STATE.filters.showRival;
        toggleRival.addEventListener("change", (e) => {
            STATE.filters.showRival = e.target.checked;
            renderTimeline();
        });
    }
    
    // Filter status bar clear button
    document.getElementById("btn-clear-filters").addEventListener("click", () => {
        clearAllFilters();
    });
    
    // Person tag click event delegation
    document.getElementById("timeline-list").addEventListener("click", (e) => {
        const tag = e.target.closest(".person-tag");
        if (tag) {
            const personName = tag.textContent.trim().toLowerCase();
            if (personName) {
                filterByPerson(personName);
            }
        }
    });
}

function filterByPerson(person) {
    // Toggle: clear filter if same person clicked again
    if (STATE.filters.person === person) {
        STATE.filters.person = "";
    } else {
        STATE.filters.person = person;
    }
    renderTimeline();
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
    STATE.filters.person = ""; // Clear person filter
    
    // Reset toggle
    const toggleNonArg = document.getElementById("toggle-non-arg");
    if (toggleNonArg) {
        toggleNonArg.checked = false;
    }
    STATE.filters.showNonArg = false;
    
    const toggleRival = document.getElementById("toggle-rival");
    if (toggleRival) {
        toggleRival.checked = true;
    }
    STATE.filters.showRival = true;
    
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
        if (liveClock) {
            liveClock.textContent = str;
        }
        
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
    const pillContainer = document.getElementById("status-pill-container");
    
    if (show) {
        empty.style.display = "flex";
        list.style.display = "none";
        skeleton.style.display = "none";
        if (pillContainer) pillContainer.style.display = "none";
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
