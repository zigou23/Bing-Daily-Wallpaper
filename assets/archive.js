// archive.js - 基于年份的懒加载数据管理
// 仅加载当前年数据和索引，翻页时按需加载历史年份

const ARCHIVE_CONFIG = {
    cdnBase: "bing/",
    fallbackBase: "https://testingcf.jsdelivr.net/gh/zigou23/Bing-Daily-Wallpaper@main/bing/",
    itemsPerPage: 31,
    enableFeatured: true
};

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

// 全局变量
let dataIndex = null;         // data_index.json 内容
let yearCache = {};           // { year: { regionCode: data[] } }
let allData = [];             // 当前合并后的完整数据（已加载年份）
let filteredData = [];
let currentPage = 1;
let currentRegion = "";
let currentSearchQuery = "";
let searchDebounceTimer = null;
let totalItemCount = 0;       // 从索引计算的总条目数
let yearOrder = [];           // 年份按降序排列
let yearOffsets = {};         // { year: { start, count } } 每个年份在虚拟列表中的偏移
let isSearchMode = false;     // 搜索模式下需要加载所有数据
let loadingYears = new Set(); // 正在加载的年份

// DOM 元素
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
const btn2K = document.getElementById('btn-dl-2k');
const btnMobile = document.getElementById('btn-dl-mobile');
const btnWallpaper = document.getElementById('btn-dl-wallpaper');
const closeLb = document.querySelector('.close-lightbox');
const searchInput = document.getElementById('search-input');
const moreBtnGroup = document.querySelector('.dl-btn-group');
const dropdownMenu = document.querySelector('.dl-dropdown');

// 懒加载观察器
const lazyObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
                img.src = img.dataset.src;
                img.onload = () => {
                    const isPlaceholder = (img.naturalWidth === img.naturalHeight) && (img.naturalWidth <= 600);
                    if (isPlaceholder) {
                        img.classList.add('error');
                        const errorPlaceholder = img.parentElement.querySelector('.image-error');
                        if (errorPlaceholder) errorPlaceholder.classList.add('show');
                    } else {
                        img.classList.add('loaded');
                    }
                };
                img.onerror = () => {
                    img.classList.add('error');
                    const errorPlaceholder = img.parentElement.querySelector('.image-error');
                    if (errorPlaceholder) errorPlaceholder.classList.add('show');
                };
                img.removeAttribute('data-src');
                observer.unobserve(img);
            }
        }
    });
}, {
    rootMargin: '200px 0px',
    threshold: 0.01
});

// ============ 初始化 ============

async function init() {
    populateRegionSelect();
    setupMobileSearch();

    const params = new URLSearchParams(window.location.search);

    // 确定区域
    let defRegion = params.get('country');
    if (!defRegion) {
        const lang = navigator.language;
        defRegion = "bing_ROW";
        const match = REGIONS.find(r => r.code === `bing_${lang}`);
        if (match) defRegion = match.code;
        else if (lang.includes('zh')) defRegion = "bing_zh-CN";
        else if (lang.includes('en')) defRegion = "bing_en-US";
        else if (lang.includes('ja')) defRegion = "bing_ja-JP";
        else if (lang.includes('de')) defRegion = "bing_de-DE";
        else if (lang.includes('fr')) defRegion = "bing_fr-FR";
        else if (lang.includes('es')) defRegion = "bing_es-ES";
    }

    // 验证区域
    if (![...regionSelect.options].some(o => o.value === defRegion)) {
        defRegion = "bing_ROW";
    }
    regionSelect.value = defRegion;
    currentRegion = defRegion;

    // 加载索引和当前年数据
    loadingEl.classList.add('show');
    try {
        await loadIndex();
        const currentYear = String(dataIndex.currentYear);
        await loadYearData(currentYear, defRegion);
        rebuildAllData();
        computeYearOffsets();
        populateMonthDropdown();
        applyStateFromURL();
    } catch (err) {
        console.error('Init error:', err);
        galleryGrid.innerHTML = '<h3 style="color:white;text-align:center;">Unable to load data</h3>';
    } finally {
        loadingEl.classList.remove('show');
    }

    // 事件监听器
    regionSelect.addEventListener('change', async (e) => {
        const newRegion = e.target.value;
        currentRegion = newRegion;
        updateQuery({ country: newRegion, page: 1, date: monthSelect.value, photo: null });

        // 清空缓存，需要重新加载
        yearCache = {};
        loadingEl.classList.add('show');
        try {
            const currentYear = String(dataIndex.currentYear);
            await loadYearData(currentYear, newRegion);
            rebuildAllData();
            computeYearOffsets();
            populateMonthDropdown();
            filterData(monthSelect.value, currentSearchQuery, 1);
        } catch (err) {
            console.error(err);
        } finally {
            loadingEl.classList.remove('show');
        }
    });

    monthSelect.addEventListener('change', async (e) => {
        const val = e.target.value;
        updateQuery({ date: val, page: 1 });

        // 如果选择了某个月份，需要确保那个年份的数据已加载
        if (val && val !== 'all') {
            const targetYear = val.substring(0, 4);
            if (!isYearLoaded(targetYear)) {
                loadingEl.classList.add('show');
                try {
                    await loadYearData(targetYear, currentRegion);
                    rebuildAllData();
                } catch (err) {
                    console.error(err);
                } finally {
                    loadingEl.classList.remove('show');
                }
            }
        }

        filterData(val, currentSearchQuery, 1);
    });

    // 搜索框获得焦点时，立即后台加载所有年份数据
    let searchPreloadStarted = false;
    searchInput.addEventListener('focus', () => {
        if (!searchPreloadStarted) {
            searchPreloadStarted = true;
            console.log('Search focus: preloading all years...');
            loadAllYearsProgressively();
        }
    });

    // 搜索输入框事件，带防抖1s
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (searchDebounceTimer) {
            clearTimeout(searchDebounceTimer);
        }
        searchInput.classList.add('searching');
        searchDebounceTimer = setTimeout(async () => {
            currentSearchQuery = query;
            updateQuery({ search: query || null, page: 1 });

            if (query) {
                // 搜索模式：后台逐步加载所有年份
                isSearchMode = true;
                await loadAllYearsProgressively();
            } else {
                isSearchMode = false;
            }

            filterData(monthSelect.value, query, 1);
            searchInput.classList.remove('searching');
        }, 1000);
    });

    closeLb.addEventListener('click', () => {
        closeLightbox();
        updateQuery({ photo: null });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === "Escape") {
            closeLightbox();
            updateQuery({ photo: null });
        }
    });

    window.addEventListener('popstate', () => {
        applyStateFromURL();
    });
}

// ============ 数据索引管理 ============

async function loadIndex() {
    let res = await fetch(`${ARCHIVE_CONFIG.cdnBase}data_index.json`);
    if (!res.ok) {
        res = await fetch(`${ARCHIVE_CONFIG.fallbackBase}data_index.json`);
    }
    dataIndex = await res.json();

    // 按年份降序排列
    yearOrder = Object.keys(dataIndex.years).sort((a, b) => b - a);
}

// 获取某年某区域的记录数
function getYearRegionCount(year, regionCode) {
    const yearInfo = dataIndex.years[year];
    if (!yearInfo || !yearInfo.regions) return 0;
    const effectiveRegion = getEffectiveRegion(year, regionCode);
    if (!effectiveRegion) return 0;
    return yearInfo.regions[effectiveRegion] || 0;
}

// 计算当前区域的总条目数
function computeTotalItemCount() {
    totalItemCount = 0;
    for (const y of yearOrder) {
        totalItemCount += getYearRegionCount(y, currentRegion);
    }
}

function computeYearOffsets() {
    // 按年份降序计算偏移量（最新年份在最前面），基于当前区域
    yearOffsets = {};
    let offset = 0;
    for (const y of yearOrder) {
        const count = getYearRegionCount(y, currentRegion);
        yearOffsets[y] = { start: offset, count };
        offset += count;
    }
    computeTotalItemCount();
}

// 获取某页对应的年份列表
function getYearsForPage(pageNum) {
    const start = (pageNum - 1) * ARCHIVE_CONFIG.itemsPerPage;
    const end = start + ARCHIVE_CONFIG.itemsPerPage;
    const years = new Set();

    for (const y of yearOrder) {
        const yStart = yearOffsets[y].start;
        const yEnd = yStart + yearOffsets[y].count;
        if (start < yEnd && end > yStart) {
            years.add(y);
        }
    }
    return [...years];
}

function isYearLoaded(year) {
    return yearCache[year] && yearCache[year][currentRegion];
}

function getEffectiveRegion(year, regionCode) {
    const yearInfo = dataIndex.years[year];
    if (!yearInfo || !yearInfo.regions) return null;

    // regions 现在是 { regionCode: count } 对象
    const availableRegions = Object.keys(yearInfo.regions);
    if (availableRegions.includes(regionCode)) {
        return regionCode;
    }
    // 如果该年没有所选区域，回退到 bing_en-US
    if (availableRegions.includes("bing_en-US")) {
        return "bing_en-US";
    }
    // 最后回退到该年的第一个可用区域
    return availableRegions[0] || null;
}

async function loadYearData(year, regionCode) {
    const effectiveRegion = getEffectiveRegion(year, regionCode);
    if (!effectiveRegion) return [];

    // 已在缓存中
    if (yearCache[year] && yearCache[year][regionCode]) {
        return yearCache[year][regionCode];
    }

    // 避免重复加载
    const loadKey = `${year}_${regionCode}`;
    if (loadingYears.has(loadKey)) return [];
    loadingYears.add(loadKey);

    try {
        let res = await fetch(`${ARCHIVE_CONFIG.cdnBase}${year}/${effectiveRegion}.json`);
        if (!res.ok) {
            res = await fetch(`${ARCHIVE_CONFIG.fallbackBase}${year}/${effectiveRegion}.json`);
        }
        let data = await res.json();

        // 去重
        const seen = new Set();
        data = data.filter(item => {
            if (seen.has(item.date)) return false;
            seen.add(item.date);
            return true;
        });

        if (!yearCache[year]) yearCache[year] = {};
        yearCache[year][regionCode] = data;

        // 更新索引中的实际 count（索引可能不精准）
        if (!dataIndex.years[year].regions) dataIndex.years[year].regions = {};
        dataIndex.years[year].regions[regionCode] = data.length;

        return data;
    } catch (err) {
        console.error(`Failed to load ${year}/${effectiveRegion}.json:`, err);
        if (!yearCache[year]) yearCache[year] = {};
        yearCache[year][regionCode] = [];
        return [];
    } finally {
        loadingYears.delete(loadKey);
    }
}

// 逐步加载所有年份（用于搜索）
async function loadAllYearsProgressively() {
    for (const y of yearOrder) {
        if (!isYearLoaded(y)) {
            await loadYearData(y, currentRegion);
            rebuildAllData();
            // 如果在搜索模式中，每加载一个年份就重新过滤
            if (isSearchMode && currentSearchQuery) {
                filterData(monthSelect.value, currentSearchQuery, currentPage);
            }
        }
    }
}

// 合并所有已加载年份的数据（按日期降序）
function rebuildAllData() {
    allData = [];
    for (const y of yearOrder) {
        if (yearCache[y] && yearCache[y][currentRegion]) {
            allData = allData.concat(yearCache[y][currentRegion]);
        }
    }
    // 确保按日期降序排列
    allData.sort((a, b) => b.date.localeCompare(a.date));
}

// ============ 状态管理 ============

async function applyStateFromURL() {
    const params = new URLSearchParams(window.location.search);

    const regionParam = params.get('country');
    if (regionParam && regionParam !== currentRegion) {
        regionSelect.value = regionParam;
        currentRegion = regionParam;
        yearCache = {};
        const currentYear = String(dataIndex.currentYear);
        await loadYearData(currentYear, regionParam);
        rebuildAllData();
        computeYearOffsets();
    }

    const dateParam = params.get('date') || 'all';
    monthSelect.value = dateParam;

    const searchParam = params.get('search') || '';
    searchInput.value = searchParam;
    currentSearchQuery = searchParam;

    if (searchParam) {
        isSearchMode = true;
        await loadAllYearsProgressively();
    }

    const pageParam = parseInt(params.get('page')) || 1;

    // filterData 内部会自动加载所需年份（虚拟分页模式）
    await filterData(dateParam, searchParam, pageParam);

    const photoParam = params.get('photo');
    if (photoParam) {
        // 查找照片时，可能需要加载对应年份
        let item = allData.find(i => i.date === photoParam);
        if (!item) {
            const targetYear = photoParam.substring(0, 4);
            if (!isYearLoaded(targetYear)) {
                await loadYearData(targetYear, currentRegion);
                rebuildAllData();
            }
            item = allData.find(i => i.date === photoParam);
        }
        if (item) openLightbox(item);
    } else {
        lightbox.classList.remove('show');
        lbImg.src = "";
    }
}

function updateQuery(updates) {
    const params = new URLSearchParams(window.location.search);

    for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === 'all') {
            if (key === 'date' && value === 'all') params.delete(key);
            else if (value === null) params.delete(key);
            else params.set(key, value);
        } else {
            params.set(key, value);
        }
    }

    if (parseInt(params.get('page')) === 1) params.delete('page');

    const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    history.replaceState(null, '', newUrl);
}

// ============ 核心函数 ============

function populateRegionSelect() {
    regionSelect.innerHTML = REGIONS.map(r => `<option value="${r.code}">${r.label}</option>`).join('');
}

function setupMobileSearch() {
    const searchGroup = searchInput.closest('.control-group');
    if (!searchGroup) return;

    searchGroup.classList.add('search-group');
    const searchIcon = searchGroup.querySelector('i');

    if (!searchIcon) return;

    searchIcon.addEventListener('click', (e) => {
        if (window.innerWidth <= 600) {
            e.stopPropagation();
            searchGroup.classList.add('active');
            setTimeout(() => searchInput.focus(), 100);
        }
    });

    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 600) {
            if (!searchGroup.contains(e.target)) {
                searchGroup.classList.remove('active');
            }
        }
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 600) {
            searchGroup.classList.remove('active');
        }
    });
}

const RESOLUTION_MAP = {
    thumb: '_1920x1080.jpg&w=557',
    medium: '_800x480.jpg',
    full: '_1920x1080.jpg',
    uhd: '_UHD.jpg',
    '2k': '_UHD.jpg&w=2560&qlt=90',
    wallpaper: '_1920x1200.jpg',
    mobile: '_1080x1920.jpg',
    default: '_1920x1080.jpg'
};

function getResUrl(item, type) {
    if (!item.urlbase) return item.url;
    const suffix = RESOLUTION_MAP[type] || RESOLUTION_MAP.default;
    return `${item.urlbase}${suffix}`;
}

function populateMonthDropdown() {
    const currentVal = monthSelect.value;
    monthSelect.innerHTML = '<option value="all">All Months</option>';

    // 从索引生成所有可能的月份（包括未加载年份）
    const months = new Set();

    // 从已加载数据中提取实际月份
    allData.forEach(item => {
        if (item.date && item.date.length >= 6) months.add(item.date.substring(0, 6));
    });

    // 从索引推断未加载年份的月份
    for (const y of yearOrder) {
        if (!isYearLoaded(y)) {
            // 只有该年份有当前区域（或回退区域）的数据时，才生成月份
            const yearInfo = dataIndex.years[y];
            const effectiveRegion = getEffectiveRegion(y, currentRegion);
            if (!effectiveRegion) continue;
            for (let m = 1; m <= 12; m++) {
                const monthStr = `${y}${String(m).padStart(2, '0')}`;
                months.add(monthStr);
            }
        }
    }

    Array.from(months).sort().reverse().forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = `${m.substring(0, 4)} ${m.substring(4, 6)}`;
        monthSelect.appendChild(opt);
    });
    if (currentVal) monthSelect.value = currentVal;
}

// ============ 数据过滤 & 分页 ============

async function filterData(monthVal, searchQuery, page) {
    currentPage = page || 1;

    // 虚拟分页模式：非搜索、非月份过滤时，确保目标页的年份已加载
    // 需要加载从最新年份到目标页所涉及的最早年份之间的所有年份，
    // 因为 allData 是连续排列的，不能有间隔
    const isVirtualMode = !isSearchMode && (!monthVal || monthVal === 'all') && !searchQuery;
    if (isVirtualMode) {
        const neededYears = getYearsForPage(currentPage);
        // 找到最早需要的年份
        const oldestNeeded = Math.min(...neededYears.map(Number));
        let needsRebuild = false;
        for (const y of yearOrder) {
            const yNum = Number(y);
            if (yNum < oldestNeeded) break; // 不需要更早的年份
            if (!isYearLoaded(y)) {
                loadingEl.classList.add('show');
                await loadYearData(y, currentRegion);
                needsRebuild = true;
            }
        }
        if (needsRebuild) {
            rebuildAllData();
            computeYearOffsets();
            loadingEl.classList.remove('show');
        }
    }

    let data = allData;
    if (monthVal && monthVal !== 'all') {
        data = data.filter(item => item.date.startsWith(monthVal));
    }

    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        data = data.filter(item => {
            const title = (item.copyrightKeyword || item.copyright || '').toLowerCase();
            const desc = (item.description || '').toLowerCase();
            const copyright = (item.copyright || '').toLowerCase();

            let urlKeyword = '';
            if (item.urlbase || item.url) {
                const urlStr = item.urlbase || item.url;
                const match = urlStr.match(/OHR\.([A-Za-z0-9]+)/);
                if (match && match[1]) {
                    urlKeyword = match[1].toLowerCase();
                }
            }

            return title.includes(query) ||
                desc.includes(query) ||
                copyright.includes(query) ||
                urlKeyword.includes(query);
        });
    }

    filteredData = data;
    renderGallery();
    renderPagination();
}

// ============ 渲染 ============

function renderGallery() {
    galleryGrid.innerHTML = '';

    const start = (currentPage - 1) * ARCHIVE_CONFIG.itemsPerPage;
    const end = start + ARCHIVE_CONFIG.itemsPerPage;
    const pageItems = filteredData.slice(start, end);

    if (pageItems.length === 0) {
        galleryGrid.innerHTML = '<p style="color:#888;">No data</p>';
        return;
    }

    pageItems.forEach((item, index) => {
        const card = document.createElement('div');
        const isFeatured = ARCHIVE_CONFIG.enableFeatured && (currentPage === 1 && index === 0);
        card.className = `card ${isFeatured ? 'featured' : ''}`;

        const imgUrl = isFeatured ? getResUrl(item, 'medium') : getResUrl(item, 'thumb');
        const dateStr = `${item.date.substring(0, 4)}-${item.date.substring(4, 6)}-${item.date.substring(6, 8)}`;
        const year = item.date.substring(0, 4);
        const title = item.copyrightKeyword || item.copyright?.split('(')[0]?.trim() || 'Bing Wallpaper';

        const yearBadge = `<span class="archive-year-badge">${year}</span>`;

        card.innerHTML = `
      ${yearBadge}
      <img data-src="${imgUrl}" alt="${title}" class="card-img">
      <div class="image-error">
        <i class="fa-solid fa-image"></i>
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
            updateQuery({ photo: item.date });
        });
        galleryGrid.appendChild(card);
    });
}

function renderPagination() {
    paginationEl.innerHTML = '';

    // 在非搜索、非月份过滤模式下，使用索引的总数计算页数
    let totalPages;
    if (!isSearchMode && (!monthSelect.value || monthSelect.value === 'all') && !currentSearchQuery) {
        totalPages = Math.ceil(totalItemCount / ARCHIVE_CONFIG.itemsPerPage);
    } else {
        totalPages = Math.ceil(filteredData.length / ARCHIVE_CONFIG.itemsPerPage);
    }

    if (totalPages <= 1) return;

    const addBtn = (p) => {
        const btn = document.createElement('button');
        btn.className = `page-btn ${p === currentPage ? 'active' : ''}`;
        btn.textContent = p;
        btn.onclick = async () => {
            currentPage = p;
            updateQuery({ page: p });

            // filterData 会自动加载所需年份
            await filterData(monthSelect.value, currentSearchQuery, p);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };
        paginationEl.appendChild(btn);
    };

    const addDots = () => {
        const span = document.createElement('span');
        span.className = 'page-dots';
        span.textContent = '...';
        paginationEl.appendChild(span);
    };

    addBtn(1);
    if (currentPage > 4) addDots();

    let start = Math.max(2, currentPage - 2);
    let end = Math.min(totalPages - 1, currentPage + 2);

    if (currentPage < 5) end = Math.min(totalPages - 1, 5);
    if (currentPage > totalPages - 4) start = Math.max(2, totalPages - 4);

    for (let i = start; i <= end; i++) addBtn(i);

    if (currentPage < totalPages - 3) addDots();
    if (totalPages > 1) addBtn(totalPages);
}

// ============ Lightbox ============

function openLightbox(item) {
    lightbox.classList.add('show');

    if (lbError) lbError.classList.remove('show');

    const isPortrait = window.innerHeight > window.innerWidth;
    const imgSrc = isPortrait ? getResUrl(item, 'mobile') : getResUrl(item, 'full');

    lbImg.src = imgSrc;
    lbImg.style.display = 'block';

    lbImg.onerror = () => {
        lbImg.style.display = 'none';
        if (lbError) lbError.classList.add('show');
    };

    lbImg.onload = () => {
        // OK
    };

    const dateStr = `${item.date.substring(0, 4)}-${item.date.substring(4, 6)}-${item.date.substring(6, 8)}`;
    lbTitle.textContent = item.copyrightKeyword || item.copyright?.split('(')[0]?.trim() || 'Bing Wallpaper';
    lbDate.textContent = dateStr;

    const copyrightText = item.copyright || 'No copyright information available';
    if (item.maplink) {
        const mapUrl = `https://www.bing.com/maps/search?q=${item.maplink}&style=h`;
        lbCopy.innerHTML = `${copyrightText} <a href="${mapUrl}" target="_blank" class="map-link" title="View on world map (approximate location)"><i class="fa-solid fa-location-dot"></i></a>`;
    } else {
        lbCopy.textContent = copyrightText;
    }
    lbDesc.textContent = item.description || "No description available";

    const setupBtn = (btn, type) => {
        if (!btn) return;
        let url = getResUrl(item, type);
        if (url.startsWith('/')) url = 'https://www.bing.com' + url;
        btn.href = url;
        btn.onclick = (e) => handleDownload(e, item, type);
    };

    setupBtn(btnUHD, 'uhd');
    setupBtn(btnHD, 'full');
    setupBtn(btn2K, '2k');
    setupBtn(btnWallpaper, 'wallpaper');
    setupBtn(btnMobile, 'mobile');
}

function closeLightbox() {
    lightbox.classList.remove('show');
    lbImg.src = "";
}

// ============ 下载 ============

function getDownloadFilename(item, type) {
    let name = "BingWallpaper";
    if (item.urlbase) {
        const match = item.urlbase.match(/OHR\.([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            name = match[1].replace(/\d+$/, '');
        }
    }

    const date = item.date;
    const suffixMap = {
        'uhd': 'UHD',
        'full': '1080p',
        '2k': '2K',
        'wallpaper': 'wallpaper',
        'mobile': 'mobile'
    };
    const suffix = suffixMap[type] || 'image';
    return `${name}_${date}_${suffix}.jpg`;
}

async function handleDownload(event, item, type) {
    event.preventDefault();
    const btn = event.currentTarget;

    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btn.style.pointerEvents = 'none';

    try {
        let url = getResUrl(item, type);
        if (url.startsWith('/')) {
            url = 'https://www.bing.com' + url;
        }

        const response = await fetch(url);

        if (response.status !== 200) {
            throw new Error(`HTTP Status ${response.status}`);
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const filename = getDownloadFilename(item, type);

        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();

        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);

    } catch (err) {
        alert(`下载失败: 图片无法访问 (${err.message})`);
    } finally {
        btn.innerHTML = originalContent;
        btn.style.pointerEvents = 'auto';
    }
}

// ============ 启动 ============

document.addEventListener('DOMContentLoaded', init);

moreBtnGroup.addEventListener('click', function (event) {
    event.stopPropagation();
    event.preventDefault();

    var isShowing = dropdownMenu.classList.contains('show');
    dropdownMenu.classList.toggle('show');

    if (!isShowing) {
        setTimeout(function () {
            dropdownMenu.style.visibility = 'visible';
            dropdownMenu.style.opacity = '1';
        }, 10);
    }
});

window.addEventListener('click', function (event) {
    if (dropdownMenu.classList.contains('show')) {
        dropdownMenu.classList.remove('show');
        setTimeout(function () {
            if (!dropdownMenu.classList.contains('show')) {
                dropdownMenu.style.visibility = 'hidden';
                dropdownMenu.style.opacity = '0';
            }
        }, 200);
    }
});

dropdownMenu.addEventListener('click', function (event) {
    event.stopPropagation();
});
