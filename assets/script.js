// 配置对象 - 通过 data-mode 属性区分模式
const CONFIG = {
  normal: {
    cdnBase: "bing/",
    fallbackBase: "https://testingcf.jsdelivr.net/gh/zigou23/Bing-Daily-Wallpaper@main/bing/",
    itemsPerPage: 31,
    enableFeatured: true
  },
  archive: {
    cdnBase: "bing/old-2408/",
    fallbackBase: "https://testingcf.jsdelivr.net/gh/zigou23/Bing-Daily-Wallpaper@main/bing/old-2408/",
    itemsPerPage: 31,
    enableFeatured: false
  }
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
let config;
let allData = [];
let filteredData = [];
let currentPage = 1;
let currentRegion = "";
let currentSearchQuery = "";
let searchDebounceTimer = null;

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
        
        // 存档模式需要处理错误
        if (config === CONFIG.archive) {
          img.onerror = () => {
            img.classList.add('error');
            const errorPlaceholder = img.parentElement.querySelector('.image-error');
            if (errorPlaceholder) errorPlaceholder.classList.add('show');
          };
          
          // 检测占位图：Bing 的占位图通常是小尺寸正方形（如 80x80, 557x557）
          img.onload = () => {
            const isPlaceholder = (img.naturalWidth === img.naturalHeight) && 
                                  (img.naturalWidth <= 600);
            
            if (isPlaceholder) {
              img.classList.add('error');
              const errorPlaceholder = img.parentElement.querySelector('.image-error');
              if (errorPlaceholder) errorPlaceholder.classList.add('show');
            } else {
              img.classList.add('loaded');
            }
          };
        } else {
          img.onload = () => img.classList.add('loaded');
        }
        
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
  // 检测模式
  const mode = document.body.dataset.mode || 'normal';
  config = CONFIG[mode];
  
  populateRegionSelect();
  setupMobileSearch(); // 设置移动端搜索
  
  const params = new URLSearchParams(window.location.search);
  
  // 确定区域
  let defRegion = params.get('country');
  if (!defRegion) {
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
  
  // 验证区域
  if (![...regionSelect.options].some(o => o.value === defRegion)) {
    defRegion = "bing_ROW";
  }
  regionSelect.value = defRegion;
  currentRegion = defRegion;

  // 加载数据
  loadData(defRegion).then(() => {
    applyStateFromURL();
  });

  // 事件监听器
  regionSelect.addEventListener('change', (e) => {
    const newRegion = e.target.value;
    currentRegion = newRegion;
    const currentDate = monthSelect.value;
    updateQuery({ country: newRegion, page: 1, date: currentDate, photo: null });
    loadData(newRegion).then(() => {
      populateMonthDropdown();
      filterData(monthSelect.value, currentSearchQuery, 1);
    });
  });

  monthSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    updateQuery({ date: val, page: 1 });
    filterData(val, currentSearchQuery, 1);
  });

  // 单选1.搜索输入框事件，带防抖1s
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    searchInput.classList.add('searching');
    searchDebounceTimer = setTimeout(() => {
      currentSearchQuery = query;
      updateQuery({ search: query || null, page: 1 });
      filterData(monthSelect.value, query, 1);
      searchInput.classList.remove('searching');
    }, 1000);
  });

  // 单选2.移除 input 事件监听，改用 keydown 监听回车键
  // searchInput.addEventListener('keydown', (e) => {
  //   if (e.key === 'Enter') {
  //     const query = e.target.value.trim();
  //     currentSearchQuery = query;
  //     updateQuery({ search: query || null, page: 1 });
  //     filterData(monthSelect.value, query, 1);
  //     searchInput.blur(); // 收起手机键盘
  //   }
  // });

  closeLb.addEventListener('click', () => {
    closeLightbox();
    updateQuery({ photo: null });
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

// 状态管理
async function applyStateFromURL() {
  const params = new URLSearchParams(window.location.search);
  
  const regionParam = params.get('country');
  if (regionParam && regionParam !== currentRegion) {
    regionSelect.value = regionParam;
    currentRegion = regionParam;
    await loadData(regionParam);
  }

  const dateParam = params.get('date') || 'all';
  monthSelect.value = dateParam;
  
  const searchParam = params.get('search') || '';
  searchInput.value = searchParam;
  currentSearchQuery = searchParam;

  const pageParam = parseInt(params.get('page')) || 1;
  
  filterData(dateParam, searchParam, pageParam);

  const photoParam = params.get('photo');
  if (photoParam) {
    const item = allData.find(i => i.date === photoParam);
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
  // history.pushState(null, '', newUrl);
  // 使用 replaceState 避免过多历史记录
  history.replaceState(null, '', newUrl);
}

// 核心函数
function populateRegionSelect() {
  regionSelect.innerHTML = REGIONS.map(r => `<option value="${r.code}">${r.label}</option>`).join('');
}

// 移动端搜索框展开功能
function setupMobileSearch() {
  const searchGroup = searchInput.closest('.control-group');
  if (!searchGroup) return;
  
  searchGroup.classList.add('search-group');
  const searchIcon = searchGroup.querySelector('i');
  
  if (!searchIcon) return;
  
  // 点击图标展开搜索框
  searchIcon.addEventListener('click', (e) => {
    if (window.innerWidth <= 600) {
      e.stopPropagation();
      searchGroup.classList.add('active');
      setTimeout(() => searchInput.focus(), 100);
    }
  });
  
  // 点击外部区域关闭搜索框
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 600) {
      if (!searchGroup.contains(e.target)) {
        searchGroup.classList.remove('active');
      }
    }
  });
  
  // 监听窗口大小变化
  window.addEventListener('resize', () => {
    if (window.innerWidth > 600) {
      searchGroup.classList.remove('active');
    }
  });
}

const RESOLUTION_MAP = {
  thumb:     '_1920x1080.jpg&w=557', //_800x480.jpg
  medium:    '_800x480.jpg', //_1366x768.jpg
  full:      '_1920x1080.jpg',
  uhd:       '_UHD.jpg',
  '2k':      '_UHD.jpg&w=2560&qlt=90',
  wallpaper: '_1920x1200.jpg',
  mobile:    '_1080x1920.jpg',
  // 定义默认后缀
  default:   '_1920x1080.jpg'
};
// 根据分辨率类型获取图片URL
function getResUrl(item, type) {
  if (!item.urlbase) return item.url;
  const suffix = RESOLUTION_MAP[type] || RESOLUTION_MAP.default;
  return `${item.urlbase}${suffix}`;
}

async function loadData(regionCode) {
  loadingEl.classList.add('show');
  try {
    let res = await fetch(`${config.cdnBase}${regionCode}.json`);
    if (!res.ok) {
      console.log('Local failed, trying CDN...');
      res = await fetch(`${config.fallbackBase}${regionCode}.json`);
    }
    allData = await res.json();
    
    // 去重
    const seen = new Set();
    allData = allData.filter(item => {
      if(seen.has(item.date)) return false;
      seen.add(item.date);
      return true;
    });

    populateMonthDropdown();
    
  } catch (err) {
    console.error(err);
    galleryGrid.innerHTML = '<h3 style="color:white;text-align:center;">Unable to load data</h3>';
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

function filterData(monthVal, searchQuery, page) {
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
      
      // 提取URL中的关键词
      // 例如: "https://www.bing.com/th?id=OHR.EverestGlow_EN-IN2485244668"
      // 提取 "EverestGlow" 部分
      let urlKeyword = '';
      if (item.urlbase || item.url) {
        const urlStr = item.urlbase || item.url;
        // 匹配 OHR. 后面到 _ 或 . 之前的部分
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
  currentPage = page || 1;
  renderGallery();
  renderPagination();
}

function renderGallery() {
  galleryGrid.innerHTML = '';
  
  const start = (currentPage - 1) * config.itemsPerPage;
  const end = start + config.itemsPerPage;
  const pageItems = filteredData.slice(start, end);

  if (pageItems.length === 0) {
    galleryGrid.innerHTML = '<p style="color:#888;">No data</p>';
    return;
  }

  pageItems.forEach((item, index) => {
    const card = document.createElement('div');
    const isFeatured = config.enableFeatured && (currentPage === 1 && index === 0);
    card.className = `card ${isFeatured ? 'featured' : ''}`;
    
    const imgUrl = isFeatured ? getResUrl(item, 'medium') : getResUrl(item, 'thumb');
    const dateStr = `${item.date.substring(0,4)}-${item.date.substring(4,6)}-${item.date.substring(6,8)}`;
    const year = item.date.substring(0,4);
    const title = item.copyrightKeyword || item.copyright?.split('(')[0]?.trim() || 'Bing Wallpaper';

    // 存档模式显示年份徽章和错误占位符
    const yearBadge = config === CONFIG.archive ? `<span class="archive-year-badge">${year}</span>` : '';
    const errorPlaceholder = config === CONFIG.archive ? `
      <div class="image-error">
        <i class="fa-solid fa-image-slash"></i>
        <div class="image-error-title">Image Unavailable</div>
        <div class="image-error-text">Historical image no longer accessible</div>
      </div>
    ` : '';

    card.innerHTML = `
      ${yearBadge}
      <img data-src="${imgUrl}" alt="${title}" class="card-img">
      ${errorPlaceholder}
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

function openLightbox(item) {
  lightbox.classList.add('show');
  
  if (lbError) lbError.classList.remove('show');
  
  const isPortrait = window.innerHeight > window.innerWidth;
  const imgSrc = isPortrait ? getResUrl(item, 'mobile') : getResUrl(item, 'full');
  
  lbImg.src = imgSrc;
  lbImg.style.display = 'block';

  // 存档模式处理图片错误
  if (config === CONFIG.archive && lbError) {
    lbImg.onerror = () => {
      lbImg.style.display = 'none';
      lbError.classList.add('show');
      btnUHD.disabled = true;
      btnHD.disabled = true;
      btnMobile.disabled = true;
    };

    lbImg.onload = () => {
      btnUHD.disabled = false;
      btnHD.disabled = false;
      btnMobile.disabled = false;
    };
  }

  const dateStr = `${item.date.substring(0,4)}-${item.date.substring(4,6)}-${item.date.substring(6,8)}`;
  lbTitle.textContent = item.copyrightKeyword || item.copyright?.split('(')[0]?.trim() || 'Bing Wallpaper';
  lbDate.textContent = dateStr;
  // 处理 copyright 和 maplink
  const copyrightText = item.copyright || 'No copyright information available';
  if (item.maplink) {
    // 提取 copyright 前半部分（ 之前的内容）
    // const locationName = copyrightText.split('(')[0].trim();
    // 将坐标中的逗号改为波浪号
    // const coordinates = item.maplink.replace(',', '~');
    // 构建地图链接
    // const mapUrl = `https://www.bing.com/maps/search?cp=${coordinates}&lvl=9.5&style=r&q=${encodeURIComponent(locationName)}`;
    const mapUrl = `https://www.bing.com/maps/search?q=${item.maplink}&style=h`;
    
    lbCopy.innerHTML = `${copyrightText} <a href="${mapUrl}" target="_blank" class="map-link" title="View on world map (approximate location)"><i class="fa-solid fa-location-dot"></i></a>`;
  } else {
    lbCopy.textContent = copyrightText;
  }
  lbDesc.textContent = item.description || "No description available";

  const setupBtn = (btn, type) => {
    if (!btn) return;
    
    // 保留 href 方便右键"复制链接"，但主要逻辑由 onclick 接管
    let url = getResUrl(item, type);
    if (url.startsWith('/')) url = 'https://www.bing.com' + url;
    btn.href = url;
    
    // 绑定点击事件
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

function renderPagination() {
  paginationEl.innerHTML = '';
  const totalPages = Math.ceil(filteredData.length / config.itemsPerPage);
  if (totalPages <= 1) return;

  const addBtn = (p) => {
    const btn = document.createElement('button');
    btn.className = `page-btn ${p === currentPage ? 'active' : ''}`;
    btn.textContent = p;
    btn.onclick = () => {
      currentPage = p;
      renderGallery();
      renderPagination();
      updateQuery({ page: p });
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

moreBtnGroup.addEventListener('click', function(event) {
  event.stopPropagation();
  event.preventDefault();
  
  // 切换显示状态
  var isShowing = dropdownMenu.classList.contains('show');
  dropdownMenu.classList.toggle('show');
  
  // 确保样式正确应用（兼容旧版浏览器）
  if (!isShowing) {
    setTimeout(function() {
      dropdownMenu.style.visibility = 'visible';
      dropdownMenu.style.opacity = '1';
    }, 10);
  }
});

window.addEventListener('click', function(event) {
  if (dropdownMenu.classList.contains('show')) {
    dropdownMenu.classList.remove('show');
    // 延迟隐藏以配合过渡动画
    setTimeout(function() {
      if (!dropdownMenu.classList.contains('show')) {
        dropdownMenu.style.visibility = 'hidden';
        dropdownMenu.style.opacity = '0';
      }
    }, 200);
  }
});

dropdownMenu.addEventListener('click', function(event) {
  event.stopPropagation();
});

function getDownloadFilename(item, type) {
  let name = "BingWallpaper";
  // 尝试从 urlbase 提取 ID 名称 (例如 OHR.CathedralValley_EN-US5270905846)
  if (item.urlbase) {
    const match = item.urlbase.match(/OHR\.([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      // 去掉末尾的数字，提取纯名称
      name = match[1].replace(/\d+$/, '');
    }
  }

  const date = item.date; // 例如 20251218
  
  // 映射分辨率后缀
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

// 2. 下载处理核心逻辑
async function handleDownload(event, item, type) {
  event.preventDefault(); // 阻止浏览器直接跳转
  const btn = event.currentTarget;
  
  // 简单的加载反馈
  const originalContent = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
  btn.style.pointerEvents = 'none';

  try {
    let url = getResUrl(item, type);
    // 确保是绝对路径 (如果 getResUrl 返回相对路径，且你需要使用 Bing 原链)
    if (url.startsWith('/')) {
        url = 'https://www.bing.com' + url;
    }

    // 发起请求检查状态
    // fetch 默认是 GET，也可以用 { method: 'HEAD' } 仅检查头部，
    // 但为了重命名我们需要文件内容，所以直接 GET，如果状态不对抛出错误。
    const response = await fetch(url);
    
    if (response.status !== 200) {
      throw new Error(`HTTP Status ${response.status}`);
    }

    // 获取 Blob 数据以重命名
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const filename = getDownloadFilename(item, type);

    // 创建临时链接触发下载弹窗
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // 清理
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);

  } catch (err) {
    // 错误弹窗
    alert(`下载失败: 图片无法访问 (${err.message})`);
  } finally {
    // 恢复按钮状态
    btn.innerHTML = originalContent;
    btn.style.pointerEvents = 'auto';
  }
}
