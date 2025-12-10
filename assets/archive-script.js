const CDN_BASE = "bing/old-2408/";
const FALLBACK_BASE = "https://testingcf.jsdelivr.net/gh/zigou23/Bing-Daily-Wallpaper@main/bing/old-2408/";

const REGIONS = [
    { code: "bing_ROW", label: "🌍 Rest of World" },
    { code: "bing_en-US", label: "🇺🇸 United States" },
    { code: "bing_en-GB", label: "🇬🇧 United Kingdom" },
    { code: "bing_en-CA", label: "🇨🇦 Canada (EN)" },
    { code: "bing_en-IN", label: "🇮🇳 India" },
    { code: "bing_de-DE", label: "🇩🇪 Germany" },
    { code: "bing_fr-FR", label: "🇫🇷 France" },
    { code: "bing_fr-CA", label: "🇨🇦 Canada (FR)" },
    { code: "bing_es-ES", label: "🇪🇸 Spain" },
    { code: "bing_it-IT", label: "🇮🇹 Italy" },
    { code: "bing_pt-BR", label: "🇧🇷 Brazil" },
    { code: "bing_ja-JP", label: "🇯🇵 Japan" },
    { code: "bing_zh-CN", label: "🇨🇳 China" }
];

const ITEMS_PER_PAGE = 31;

let allData = [];
let filteredData = [];
let currentPage = 1;
let currentRegion = "";

const galleryGrid = document.getElementById('gallery-grid');
const regionSelect = document.getElementById('region-select');
const monthSelect = document.getElementById('month-select');
const paginationEl = document.getElementById('pagination');
const loadingEl = document.getElementById('loading');
const lightbox = document.getElementById('lightbox');
const lbImg = document.getElementById('lightbox-img');
const lbError = document.getElementById('lightbox-error');
const lbTitle = document.getElementById('lb-title');
const lbDate = document.getElementById('lb-date');
const lbCopy = document.getElementById('lb-copyright');
const lbDesc = document.getElementById('lb-desc');
const btnUHD = document.getElementById('btn-dl-uhd');
const btnHD = document.getElementById('btn-dl-hd');
const closeLb = document.querySelector('.close-lightbox');

// Lazy Load Observer
const lazyObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
                img.src = img.dataset.src;
                img.onerror = () => {
                    img.classList.add('error');
                    const errorPlaceholder = img.parentElement.querySelector('.image-error');
                    if (errorPlaceholder) errorPlaceholder.classList.add('show');
                };
                img.onload = () => img.classList.add('loaded');
                img.removeAttribute('data-src');
                observer.unobserve(img);
            }
        }
    });
}, {
    rootMargin: '200px 0px',
    threshold: 0.01
});

function init() {
    populateRegionSelect();
    
    // --- URL State Initialization ---
    const params = new URLSearchParams(window.location.search);
    
    // 1. Determine Region
    let defRegion = params.get('country');
    if (!defRegion) {
        // Auto-detect if no parameter
        const lang = navigator.language;
        defRegion = "bing_ROW";
        const match = REGIONS.find(r => r.code === `bing_${lang}`);
        if(match) defRegion = match.code;
        else if (lang.includes('zh')) defRegion = "bing_zh-CN";
        else if (lang.includes('en')) defRegion = "bing_en-US";
        else if (lang.includes('ja')) defRegion = "bing_ja-JP";
        else if (lang.includes('de')) defRegion = "bing_de-DE";
        else if (lang.includes('fr')) defRegion = "bing_fr-FR";
        else if (lang.includes('es')) defRegion = "bing_es-ES";
    }
    
    // Validate region
    if (![...regionSelect.options].some(o => o.value === defRegion)) {
        defRegion = "bing_ROW";
    }
    regionSelect.value = defRegion;
    currentRegion = defRegion;

    // Load Data
    loadData(defRegion).then(() => {
        applyStateFromURL();
    });

    // Event Listeners
    regionSelect.addEventListener('change', (e) => {
        const newRegion = e.target.value;
        currentRegion = newRegion;
        const currentDate = monthSelect.value;
        // Change region -> Reset to Page 1, keep month, Close Photo
        updateQuery({ country: newRegion, page: 1, date: currentDate, photo: null });
        loadData(newRegion).then(() => {
            populateMonthDropdown();
            filterByMonth(monthSelect.value, 1); 
        });
    });

    monthSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        // Change Month -> Reset to Page 1
        updateQuery({ date: val, page: 1 });
        filterByMonth(val, 1);
    });

    closeLb.addEventListener('click', () => {
        closeLightbox();
        updateQuery({ photo: null }); // Remove photo param
    });
    
    document.addEventListener('keydown', (e) => {
        if(e.key === "Escape") {
            closeLightbox();
            updateQuery({ photo: null });
        }
    });

    window.addEventListener('popstate', () => {
        applyStateFromURL();
    });
}

// --- State Management ---
async function applyStateFromURL() {
    const params = new URLSearchParams(window.location.search);
    
    // 1. Check Region
    const regionParam = params.get('country');
    if (regionParam && regionParam !== currentRegion) {
        regionSelect.value = regionParam;
        currentRegion = regionParam;
        await loadData(regionParam);
    }

    // 2. Filter Month
    const dateParam = params.get('date') || 'all';
    monthSelect.value = dateParam;
    
    // 3. Page
    const pageParam = parseInt(params.get('page')) || 1;
    
    // Apply Data Filters
    filterByMonth(dateParam, pageParam);

    // 4. Lightbox (Photo)
    const photoParam = params.get('photo');
    if (photoParam) {
        // Find photo in currently loaded data
        const item = allData.find(i => i.date === photoParam);
        if (item) openLightbox(item);
    } else {
        lightbox.classList.remove('show');
        lbImg.src = "";
    }
}

function updateQuery(updates) {
    const params = new URLSearchParams(window.location.search);
    
    // Merge updates
    for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === 'all') {
            // Clean up defaults to keep URL clean
            if (key === 'date' && value === 'all') params.delete(key);
            else if (value === null) params.delete(key);
            else params.set(key, value);
        } else {
            params.set(key, value);
        }
    }
    
    // Default page 1 doesn't need to be in URL
    if (parseInt(params.get('page')) === 1) params.delete('page');

    const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    history.pushState(null, '', newUrl);
}

function populateRegionSelect() {
    regionSelect.innerHTML = REGIONS.map(r => `<option value="${r.code}">${r.label}</option>`).join('');
}

function getResUrl(item, type) {
    if (!item.urlbase) return item.url;
    switch(type) {
        case 'thumb':  return `${item.urlbase}_800x480.jpg`; 
        case 'medium': return `${item.urlbase}_1366x768.jpg`;
        case 'full':   return `${item.urlbase}_1920x1080.jpg`;
        case 'uhd':    return `${item.urlbase}_UHD.jpg`;
        default:       return `${item.urlbase}_1920x1080.jpg`;
    }
}

async function loadData(regionCode) {
    loadingEl.classList.add('show');
    try {
        let res = await fetch(`${CDN_BASE}${regionCode}.json`);
        if (!res.ok) {
            console.log('Local failed, trying CDN...');
            res = await fetch(`${FALLBACK_BASE}${regionCode}.json`);
        }
        allData = await res.json();
        
        // Remove duplicates
        const seen = new Set();
        allData = allData.filter(item => {
            if(seen.has(item.date)) return false;
            seen.add(item.date);
            return true;
        });

        populateMonthDropdown();

    } catch (err) {
        console.error(err);
        galleryGrid.innerHTML = '<h3 style="color:white;text-align:center;">Unable to load archive data</h3>';
    } finally {
        loadingEl.classList.remove('show');
    }
}

function populateMonthDropdown() {
    const currentVal = monthSelect.value;
    monthSelect.innerHTML = '<option value="all">All Months</option>';
    const months = new Set();
    allData.forEach(item => {
        if(item.date && item.date.length >= 6) months.add(item.date.substring(0, 6));
    });
    
    Array.from(months).sort().reverse().forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = `${m.substring(0,4)} ${m.substring(4,6)}`;
        monthSelect.appendChild(opt);
    });
    if (currentVal) monthSelect.value = currentVal;
}

function filterByMonth(val, page) {
    if (val === 'all' || !val) filteredData = allData;
    else filteredData = allData.filter(item => item.date.startsWith(val));
    
    currentPage = page || 1;
    renderGallery();
    renderPagination();
}

function renderGallery() {
    galleryGrid.innerHTML = '';
    
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageItems = filteredData.slice(start, end);

    if (pageItems.length === 0) {
        galleryGrid.innerHTML = '<p style="color:#888;">No data</p>';
        return;
    }

    pageItems.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'card';
        
        const imgUrl = getResUrl(item, 'thumb');
        const dateStr = `${item.date.substring(0,4)}-${item.date.substring(4,6)}-${item.date.substring(6,8)}`;
        const year = item.date.substring(0,4);
        const title = item.copyrightKeyword || item.copyright?.split('(')[0]?.trim() || 'Bing Wallpaper';

        card.innerHTML = `
            <span class="archive-year-badge">${year}</span>
            <img data-src="${imgUrl}" alt="${title}" class="card-img">
            <div class="image-error">
                <i class="fa-solid fa-image-slash"></i>
                <div class="image-error-title">Image Unavailable</div>
                <div class="image-error-text">Historical image no longer accessible</div>
            </div>
            <div class="card-overlay"></div>
            <div class="card-content">
                <h3 class="card-title">${title}</h3>
                <div class="card-date">${dateStr}</div>
                ${item.description ? `<p class="card-desc">${item.description}</p>` : ''}
            </div>
        `;

        const img = card.querySelector('img');
        lazyObserver.observe(img);

        card.addEventListener('click', () => {
            openLightbox(item);
            updateQuery({ photo: item.date }); // Add photo param
        });
        galleryGrid.appendChild(card);
    });
}

function openLightbox(item) {
    lightbox.classList.add('show');
    lbError.classList.remove('show');
    
    const imgSrc = getResUrl(item, 'full');
    lbImg.src = imgSrc;
    lbImg.style.display = 'block';

    lbImg.onerror = () => {
        lbImg.style.display = 'none';
        lbError.classList.add('show');
        btnUHD.disabled = true;
        btnHD.disabled = true;
    };

    lbImg.onload = () => {
        btnUHD.disabled = false;
        btnHD.disabled = false;
    };

    const dateStr = `${item.date.substring(0,4)}-${item.date.substring(4,6)}-${item.date.substring(6,8)}`;
    lbTitle.textContent = item.copyrightKeyword || "Bing Wallpaper";
    lbDate.textContent = dateStr;
    lbCopy.textContent = item.copyright || 'No copyright information available';
    lbDesc.textContent = item.description || "No description available";

    btnUHD.href = getResUrl(item, 'uhd');
    btnHD.href = getResUrl(item, 'full');
}

function closeLightbox() {
    lightbox.classList.remove('show');
    lbImg.src = "";
}

function renderPagination() {
    paginationEl.innerHTML = '';
    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
    if (totalPages <= 1) return;

    const addBtn = (p) => {
        const btn = document.createElement('button');
        btn.className = `page-btn ${p === currentPage ? 'active' : ''}`;
        btn.textContent = p;
        btn.onclick = () => {
            currentPage = p;
            renderGallery();
            renderPagination();
            updateQuery({ page: p }); // Update page param
            window.scrollTo({top:0, behavior:'smooth'});
        }
        paginationEl.appendChild(btn);
    };

    const addDots = () => {
        const span = document.createElement('span');
        span.className = 'page-dots';
        span.textContent = '...';
        paginationEl.appendChild(span);
    }

    addBtn(1);
    if(currentPage > 4) addDots();

    let start = Math.max(2, currentPage - 2);
    let end = Math.min(totalPages - 1, currentPage + 2);

    if(currentPage < 5) end = Math.min(totalPages - 1, 5);
    if(currentPage > totalPages - 4) start = Math.max(2, totalPages - 4);

    for(let i=start; i<=end; i++) addBtn(i);

    if(currentPage < totalPages - 3) addDots();
    if(totalPages > 1) addBtn(totalPages);
}

document.addEventListener('DOMContentLoaded', init);