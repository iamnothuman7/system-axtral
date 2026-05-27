// Core Controller - System Axtral Store Management System
// Migrated to Server-backed SQLite Secure Engine

document.addEventListener("DOMContentLoaded", () => {
  // --- APPLICATION STATE ---
  const state = {
    products: [],
    customers: [],
    sales: [],
    cart: [],
    currentTab: "dashboard",
    editingProductId: null,
    editingCustomerId: null,
    user: null,
    settings: {
      audio: true,
      lowStockAlert: true
    },
    storeInfo: {
      name: "",
      cnpj: "",
      address: "",
      phone: "",
      email: "",
      headerMsg: "",
      footerMsg: "Obrigado pela preferência!\nVolte sempre!"
    }
  };

  // --- INITIALIZATION ---
  async function init() {
    // Alerta de segurança caso o usuário abra o arquivo HTML diretamente no disco (file:///)
    if (window.location.protocol === 'file:') {
      alert("ATENÇÃO: O Axtral OS está sendo aberto diretamente a partir de um arquivo local (protocolo file:///).\n\nAs operações de banco de dados (exclusão, edição, adição de produtos, clientes e vendas) requerem a comunicação com o servidor de dados seguro.\n\nPor favor, certifique-se de iniciar o servidor executando o comando 'npm start' no terminal do projeto e acessar o endereço 'http://localhost:3000' no seu navegador para utilizar o sistema completo!");
    }

    setupClock();
    setupNavigation();
    setupEventListeners();
    setupAdminEventListeners();
    
    // Authenticate and load database synchronously
    await loadDatabase();
  }

  // --- DATABASE SYNC (API FETCH) ---
  async function loadDatabase() {
    try {
      // 1. Verify Authentication & Retrieve Profile
      const meResponse = await fetch('/api/auth/me');
      if (!meResponse.ok) {
        window.location.href = '/login.html';
        return;
      }
      const me = await meResponse.json();
      state.user = me;
      
      // Update active user credentials on Sidebar UI
      const nameDisplay = document.getElementById("user-name-display");
      const roleDisplay = document.getElementById("user-role-display");
      const avatarDisplay = document.getElementById("profile-avatar");
      if (nameDisplay) nameDisplay.textContent = me.storeName || me.name;
      if (roleDisplay) roleDisplay.textContent = me.role === 'superadmin' ? 'Master Admin' : 'Loja Oficial';
      if (avatarDisplay) avatarDisplay.textContent = (me.storeName || me.name).substring(0, 1).toUpperCase();
      
      // Show/hide Super Admin tab based on credentials
      const navAdmin = document.getElementById("nav-admin");
      if (me.role === 'superadmin') {
        if (navAdmin) navAdmin.style.display = "flex";
      } else {
        if (navAdmin) navAdmin.style.display = "none";
      }
      
      // Safety redirect if normal store tries to view admin tab
      if (state.currentTab === "admin" && me.role !== "superadmin") {
        switchTab("dashboard");
        return;
      }
      
      // 2. Load admin stats or tenant store details
      if (me.role === 'superadmin' && state.currentTab === 'admin') {
        await renderAdmin();
        return;
      }
      
      // Load tenant-isolated transactional data
      const [prodRes, custRes, salesRes, settingsRes] = await Promise.all([
        fetch('/api/products').then(res => res.json()),
        fetch('/api/customers').then(res => res.json()),
        fetch('/api/sales').then(res => res.json()),
        fetch('/api/settings').then(res => res.json())
      ]);
      
      state.products = prodRes;
      state.customers = custRes;
      state.sales = salesRes;
      state.settings = settingsRes.settings;
      state.storeInfo = settingsRes.storeInfo;
      
      // Populate checkboxes on Settings Panel
      const audioCheck = document.getElementById("setting-audio");
      const stockCheck = document.getElementById("setting-lowstock-alert");
      if (audioCheck) audioCheck.checked = state.settings.audio;
      if (stockCheck) stockCheck.checked = state.settings.lowStockAlert;
      
      populateStoreInfoFields();
      
      // Render layout components
      renderAll();
      checkLowStock();
      
    } catch (err) {
      console.error("Database connection failure:", err);
      showNotification("Erro de conexão com o banco de dados seguro.", "danger");
    }
  }

  function populateStoreInfoFields() {
    const fields = {
      "store-info-name": state.storeInfo.name,
      "store-info-cnpj": state.storeInfo.cnpj,
      "store-info-address": state.storeInfo.address,
      "store-info-phone": state.storeInfo.phone,
      "store-info-email": state.storeInfo.email,
      "store-info-header-msg": state.storeInfo.headerMsg,
      "store-info-footer-msg": state.storeInfo.footerMsg
    };
    for (const [id, value] of Object.entries(fields)) {
      const el = document.getElementById(id);
      if (el) el.value = value || "";
    }
  }

  // Scoped refreshing helpers
  async function refreshProducts() {
    try {
      state.products = await fetch('/api/products').then(res => res.json());
      renderTab("pos");
      renderTab("inventory");
      checkLowStock();
      renderDashboard();
    } catch (e) {
      console.error("Error refreshing products:", e);
    }
  }

  async function refreshCustomers() {
    try {
      state.customers = await fetch('/api/customers').then(res => res.json());
      renderTab("pos"); // Update POS dropdown selection
      renderTab("customers");
    } catch (e) {
      console.error("Error refreshing customers:", e);
    }
  }

  async function refreshSales() {
    try {
      state.sales = await fetch('/api/sales').then(res => res.json());
      renderTab("dashboard");
      renderTab("orders");
    } catch (e) {
      console.error("Error refreshing sales:", e);
    }
  }

  async function saveStoreInfoToServer() {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeInfo: state.storeInfo })
      });
      if (!res.ok) {
        showNotification("Erro ao persistir informações da loja.", "danger");
      }
    } catch (err) {
      showNotification("Sem comunicação com o servidor de dados.", "danger");
    }
  }

  async function saveSettingsToServer() {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: state.settings })
      });
      if (!res.ok) {
        showNotification("Erro ao persistir configurações do sistema.", "danger");
      }
    } catch (err) {
      showNotification("Sem comunicação com o servidor de dados.", "danger");
    }
  }

  function resetToFactorySettings() {
    showNotification("Função administrativa desativada por segurança.", "warning");
  }

  function clearDatabase() {
    showNotification("Função administrativa desativada por segurança.", "warning");
  }

  // --- INTERACTIVE CLOCK & TIMERS ---
  function setupClock() {
    const clockEl = document.getElementById("header-clock");
    const updateClock = () => {
      const now = new Date();
      if (clockEl) {
        clockEl.textContent = now.toLocaleTimeString("pt-BR", { hour12: false });
      }
    };
    updateClock();
    setInterval(updateClock, 1000);
  }

  // --- NAVIGATION TAB SWITCHING ---
  function setupNavigation() {
    const navLinks = document.querySelectorAll("#sidebar-nav .nav-link");
    navLinks.forEach(link => {
      link.addEventListener("click", () => {
        const tab = link.getAttribute("data-tab");
        switchTab(tab);
      });
    });
  }

  function switchTab(tabId) {
    state.currentTab = tabId;
    
    // Update nav links styling
    document.querySelectorAll("#sidebar-nav .nav-link").forEach(link => {
      if (link.getAttribute("data-tab") === tabId) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });

    // Update tab viewports styling
    document.querySelectorAll(".tab-pane").forEach(pane => {
      if (pane.getAttribute("id") === `pane-${tabId}`) {
        pane.classList.add("active");
      } else {
        pane.classList.remove("active");
      }
    });

    // Re-render the specific tab's contents
    renderTab(tabId);
  }

  // --- AUDIO SYNTH (BEEP FEEDBACK) ---
  function playCheckoutSound() {
    if (!state.settings.audio) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      // Note 1 (High crisp beep)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      gain1.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
      osc1.start();
      osc1.stop(audioCtx.currentTime + 0.12);
      
      // Note 2 (Even higher chime) after 0.08s
      setTimeout(() => {
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.frequency.setValueAtTime(1174.66, audioCtx.currentTime); // D6
        gain2.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
        osc2.start();
        osc2.stop(audioCtx.currentTime + 0.15);
      }, 80);

    } catch (e) {
      console.warn("AudioContext blocked or not supported by browser.", e);
    }
  }

  function playShortCartSound() {
    if (!state.settings.audio) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(600, audioCtx.currentTime); 
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.05);
    } catch(e){}
  }

  // --- REACTIVE RENDERING CONTROLLERS ---
  function renderAll() {
    renderTab("dashboard");
    renderTab("pos");
    renderTab("inventory");
    renderTab("orders");
    renderTab("customers");
  }

  function renderTab(tabId) {
    switch (tabId) {
      case "dashboard":
        renderDashboard();
        break;
      case "pos":
        renderPOS();
        break;
      case "inventory":
        renderInventory();
        break;
      case "orders":
        renderOrders();
        break;
      case "customers":
        renderCustomers();
        break;
      case "admin":
        renderAdmin();
        break;
    }
  }

  // --- 1. DASHBOARD PAGE CONTROLLER ---
  function renderDashboard() {
    const today = new Date().toISOString().split("T")[0];
    const todaySales = state.sales.filter(sale => sale.date.startsWith(today));
    
    const totalRev = todaySales.reduce((acc, curr) => acc + curr.total, 0);
    const countSales = todaySales.length;
    const avgTicket = countSales > 0 ? (totalRev / countSales) : 0;
    
    // Calculate critical levels
    const lowStockItems = state.products.filter(p => p.stock <= p.minStock);

    // Dom update
    document.getElementById("dashboard-total-revenue").textContent = formatCurrency(totalRev);
    document.getElementById("dashboard-sales-count").textContent = countSales;
    document.getElementById("dashboard-avg-ticket").textContent = formatCurrency(avgTicket);
    document.getElementById("dashboard-low-stock-count").textContent = lowStockItems.length;

    const stockTrendLabel = document.getElementById("stock-trend-label");
    if (stockTrendLabel) {
      if (lowStockItems.length > 0) {
        stockTrendLabel.textContent = "Alerta Crítico";
        stockTrendLabel.className = "metric-trend down";
      } else {
        stockTrendLabel.textContent = "Estável";
        stockTrendLabel.className = "metric-trend up";
      }
    }

    renderRecentActivities(lowStockItems);
    renderDashboardSVGChart();
  }

  function renderRecentActivities(lowStockItems) {
    const listContainer = document.getElementById("dashboard-recent-activities");
    if (!listContainer) return;
    
    let html = "";
    
    if (state.settings.lowStockAlert && lowStockItems.length > 0) {
      lowStockItems.slice(0, 2).forEach(item => {
        html += `
          <div class="activity-item stock">
            <div class="activity-details">
              <div class="activity-icon-container">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path></svg>
              </div>
              <div class="activity-text">
                <p>Estoque Crítico: ${item.name}</p>
                <span>Qtd atual: ${item.stock} / Mínimo: ${item.minStock}</span>
              </div>
            </div>
            <div class="activity-value" style="color: var(--danger);">Repor</div>
          </div>
        `;
      });
    }
    
    const recentSales = [...state.sales].reverse().slice(0, 3);
    if (recentSales.length > 0) {
      recentSales.forEach(sale => {
        const time = new Date(sale.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        html += `
          <div class="activity-item sale">
            <div class="activity-details">
              <div class="activity-icon-container">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
              </div>
              <div class="activity-text">
                <p>Venda Concluída ${sale.id}</p>
                <span>Cliente: ${sale.customerName || "Consumidor Geral"} • ${time}</span>
              </div>
            </div>
            <div class="activity-value" style="color: var(--success);">+ ${formatCurrency(sale.total)}</div>
          </div>
        `;
      });
    } else if (html === "") {
      html = `
        <div class="cart-empty-state" style="padding: 30px 0;">
          <p>Nenhuma atividade ou venda hoje.</p>
        </div>
      `;
    }
    
    listContainer.innerHTML = html;
  }

  function renderDashboardSVGChart() {
    const chartContainer = document.getElementById("dashboard-svg-chart");
    if (!chartContainer) return;
    
    const daysLabel = [];
    const salesTotal = [];
    
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      
      const day = d.getDate();
      const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      daysLabel.push(`${day} ${monthNames[d.getMonth()]}`);
      
      const dayRevenue = state.sales
        .filter(sale => sale.date.startsWith(dateStr))
        .reduce((sum, current) => sum + current.total, 0);
      salesTotal.push(dayRevenue);
    }
    
    const maxVal = Math.max(...salesTotal, 500); 
    
    const svgWidth = 600;
    const svgHeight = 220;
    const paddingLeft = 50;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;
    
    const graphWidth = svgWidth - paddingLeft - paddingRight;
    const graphHeight = svgHeight - paddingTop - paddingBottom;
    
    const points = salesTotal.map((val, idx) => {
      const x = paddingLeft + (idx * (graphWidth / (salesTotal.length - 1)));
      const y = paddingTop + graphHeight - (val / maxVal * graphHeight);
      return { x, y, value: val };
    });
    
    let linePath = `M ${points[0].x} ${points[0].y} `;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const cpX1 = prev.x + (points[i].x - prev.x) / 2;
      const cpY1 = prev.y;
      const cpX2 = prev.x + (points[i].x - prev.x) / 2;
      const cpY2 = points[i].y;
      linePath += `C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${points[i].x} ${points[i].y} `;
    }
    
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${paddingTop + graphHeight} L ${points[0].x} ${paddingTop + graphHeight} Z`;
    
    let gridlinesHtml = "";
    const gridTicksCount = 4;
    for (let i = 0; i <= gridTicksCount; i++) {
      const y = paddingTop + (i * (graphHeight / gridTicksCount));
      const valLabel = Math.round(maxVal - (i * (maxVal / gridTicksCount)));
      gridlinesHtml += `
        <line class="svg-grid-line" x1="${paddingLeft}" y1="${y}" x2="${svgWidth - paddingRight}" y2="${y}" />
        <text class="svg-chart-text" x="${paddingLeft - 10}" y="${y + 4}" text-anchor="end">${valLabel}</text>
      `;
    }
    
    let labelsHtml = "";
    points.forEach((pt, idx) => {
      labelsHtml += `
        <text class="svg-chart-text" x="${pt.x}" y="${svgHeight - 8}" text-anchor="middle">${daysLabel[idx]}</text>
        <circle class="svg-chart-dot" cx="${pt.x}" cy="${pt.y}" r="4" data-value="${pt.value}">
          <title>R$ ${pt.value.toFixed(2)}</title>
        </circle>
      `;
    });
    
    const svgCode = `
      <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="svg-chart-container">
        <defs>
          <linearGradient id="chart-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#7c3aed" />
            <stop offset="100%" stop-color="#c084fc" />
          </linearGradient>
          <linearGradient id="area-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#7c3aed" stop-opacity="0.4" />
            <stop offset="100%" stop-color="#050505" stop-opacity="0" />
          </linearGradient>
        </defs>
        
        ${gridlinesHtml}
        <path class="svg-chart-area" d="${areaPath}" />
        <path class="svg-chart-line" d="${linePath}" />
        ${labelsHtml}
      </svg>
    `;
    
    chartContainer.innerHTML = svgCode;
  }

  // --- 2. POINT OF SALE (POS) CONTROLLER ---
  let selectedPosCategory = "Todos";
  let posSearchQuery = "";

  function renderPOS() {
    renderPOSCategories();
    renderPOSProducts();
    renderPOSCart();
    renderPOSCustomerDropdown();
  }

  function renderPOSCategories() {
    const container = document.getElementById("pos-category-container");
    if (!container) return;
    
    const categories = ["Todos", ...new Set(state.products.map(p => p.category))];
    
    let html = "";
    categories.forEach(cat => {
      const activeClass = cat === selectedPosCategory ? "active" : "";
      html += `
        <button class="pos-category-btn ${activeClass}" data-category="${cat}">
          ${cat}
        </button>
      `;
    });
    
    container.innerHTML = html;
    
    container.querySelectorAll(".pos-category-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        selectedPosCategory = btn.getAttribute("data-category");
        renderPOSCategories();
        renderPOSProducts();
      });
    });
  }

  function renderPOSProducts() {
    const grid = document.getElementById("pos-products-grid");
    if (!grid) return;
    
    let filtered = state.products;
    
    if (selectedPosCategory !== "Todos") {
      filtered = filtered.filter(p => p.category === selectedPosCategory);
    }
    
    if (posSearchQuery.trim() !== "") {
      const q = posSearchQuery.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }
    
    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="cart-empty-state" style="grid-column: span 3; padding: 50px 0;">
          <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          <p>Nenhum produto cadastrado nesta categoria ou termo correspondente.</p>
        </div>
      `;
      return;
    }
    
    let html = "";
    filtered.forEach(prod => {
      let stockTag = `<div class="pos-product-stock-tag">${prod.stock} un</div>`;
      if (prod.stock === 0) {
        stockTag = `<div class="pos-product-stock-tag empty">Esgotado</div>`;
      } else if (prod.stock <= prod.minStock) {
        stockTag = `<div class="pos-product-stock-tag low">Baixo: ${prod.stock}</div>`;
      }
      
      html += `
        <div class="glass-card-interactive pos-product-card" id="pos-card-${prod.id}">
          <div class="pos-product-thumb" style="background: ${prod.color || 'var(--primary)'}">
            ${prod.name.substring(0, 2).toUpperCase()}
            ${stockTag}
          </div>
          <div class="pos-product-info">
            <h4>${prod.name}</h4>
            <div class="pos-product-sku">${prod.sku}</div>
          </div>
          <div class="pos-product-footer">
            <div class="pos-product-price">${formatCurrency(prod.price)}</div>
            <button class="btn-add-cart" data-id="${prod.id}" ${prod.stock === 0 ? "disabled style='opacity: 0.5; cursor: not-allowed;'" : ""}>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"></path></svg>
            </button>
          </div>
        </div>
      `;
    });
    
    grid.innerHTML = html;
    
    grid.querySelectorAll(".btn-add-cart").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        addToCart(id);
      });
    });
  }

  function renderPOSCustomerDropdown() {
    const dropdown = document.getElementById("pos-customer-select");
    if (!dropdown) return;
    
    dropdown.innerHTML = '<option value="">Consumidor Geral</option>';
    
    state.customers.forEach(cust => {
      const option = document.createElement("option");
      option.value = cust.id;
      option.textContent = `${cust.name} (${cust.tier})`;
      dropdown.appendChild(option);
    });
  }

  // --- CART CONTROLLER ---
  function addToCart(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product || product.stock === 0) return;
    
    const existing = state.cart.find(item => item.product.id === productId);
    
    if (existing) {
      if (existing.quantity >= product.stock) {
        showNotification("Quantidade indisponível em estoque!", "warning");
        return;
      }
      existing.quantity += 1;
    } else {
      state.cart.push({ product, quantity: 1 });
    }
    
    renderPOSCart();
    playShortCartSound();
  }

  function updateCartQty(productId, increment) {
    const cartItem = state.cart.find(item => item.product.id === productId);
    if (!cartItem) return;
    
    const originalProduct = state.products.find(p => p.id === productId);
    
    if (increment > 0) {
      if (cartItem.quantity >= originalProduct.stock) {
        showNotification("Indisponível em estoque!", "warning");
        return;
      }
      cartItem.quantity += 1;
    } else {
      cartItem.quantity -= 1;
      if (cartItem.quantity <= 0) {
        removeFromCart(productId);
        return;
      }
    }
    renderPOSCart();
  }

  function removeFromCart(productId) {
    state.cart = state.cart.filter(item => item.product.id !== productId);
    renderPOSCart();
  }

  function renderPOSCart() {
    const container = document.getElementById("pos-cart-items-container");
    if (!container) return;
    
    if (state.cart.length === 0) {
      container.innerHTML = `
        <div class="cart-empty-state">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
          <p>Seu carrinho está vazio.</p>
        </div>
      `;
      
      document.getElementById("pos-subtotal").textContent = formatCurrency(0);
      document.getElementById("pos-total").textContent = formatCurrency(0);
      return;
    }
    
    let html = "";
    let subtotal = 0;
    
    state.cart.forEach(item => {
      const totalItemPrice = item.product.price * item.quantity;
      subtotal += totalItemPrice;
      
      html += `
        <div class="cart-item">
          <div class="cart-item-details">
            <div class="cart-item-name">${item.product.name}</div>
            <div class="cart-item-price">${formatCurrency(item.product.price)}</div>
          </div>
          <div class="cart-item-controls">
            <button class="cart-qty-btn" onclick="window.updateCartQty('${item.product.id}', -1)">-</button>
            <span class="cart-item-qty">${item.quantity}</span>
            <button class="cart-qty-btn" onclick="window.updateCartQty('${item.product.id}', 1)">+</button>
          </div>
          <div class="cart-item-total">${formatCurrency(totalItemPrice)}</div>
          <button class="btn-remove-item" onclick="window.removeFromCart('${item.product.id}')" style="margin-left: 10px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      `;
    });
    
    container.innerHTML = html;
    
    const discountEl = document.getElementById("pos-discount-input");
    const discount = parseFloat(discountEl ? discountEl.value : 0) || 0;
    
    const finalTotal = Math.max(0, subtotal - discount);
    
    document.getElementById("pos-subtotal").textContent = formatCurrency(subtotal);
    document.getElementById("pos-total").textContent = formatCurrency(finalTotal);
  }

  window.updateCartQty = updateCartQty;
  window.removeFromCart = removeFromCart;

  // --- CHECKOUT TRANSACTION PROCESSOR ---
  async function processCheckout() {
    if (state.cart.length === 0) {
      showNotification("Adicione produtos ao carrinho antes de finalizar!", "warning");
      return;
    }
    
    const subtotal = state.cart.reduce((acc, curr) => acc + (curr.product.price * curr.quantity), 0);
    const discountEl = document.getElementById("pos-discount-input");
    const discount = parseFloat(discountEl ? discountEl.value : 0) || 0;
    const total = Math.max(0, subtotal - discount);
    
    const customerSelect = document.getElementById("pos-customer-select");
    const customerId = customerSelect ? customerSelect.value : "";
    const customer = state.customers.find(c => c.id === customerId);
    const customerName = customer ? customer.name : "Consumidor Geral";
    
    const paymentMethodEl = document.getElementById("pos-payment-select");
    const paymentMethod = paymentMethodEl ? paymentMethodEl.value : "PIX";
    
    // Safe inventory precheck
    let stockError = false;
    state.cart.forEach(cartItem => {
      const origProd = state.products.find(p => p.id === cartItem.product.id);
      if (!origProd || origProd.stock < cartItem.quantity) {
        showNotification(`Estoque insuficiente para o item: ${origProd ? origProd.name : 'Desconhecido'}!`, "danger");
        stockError = true;
      }
    });
    if (stockError) return;

    // Send payload to node:sqlite secure backend server
    const body = {
      products: state.cart.map(i => ({ productId: i.product.id, quantity: i.quantity, price: i.product.price })),
      subtotal,
      discount,
      total,
      paymentMethod,
      customerName
    };
    
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      
      if (res.ok) {
        playCheckoutSound();
        
        const newSale = {
          id: data.id,
          date: new Date().toISOString(),
          products: body.products,
          subtotal,
          discount,
          total,
          paymentMethod,
          customerName
        };
        
        renderReceiptModal(newSale);
        
        // Reset states
        state.cart = [];
        if (discountEl) discountEl.value = 0;
        if (customerSelect) customerSelect.value = "";
        
        // Fetch fresh synchronizations
        await Promise.all([
          refreshProducts(),
          refreshCustomers(),
          refreshSales()
        ]);
        
        showNotification(data.message || "Venda processada com sucesso!", "success");
      } else {
        showNotification(data.message || "Erro ao processar checkout no servidor.", "danger");
      }
    } catch (err) {
      showNotification("Sem comunicação com o servidor.", "danger");
    }
  }

  function renderReceiptModal(sale) {
    const receiptBox = document.getElementById("receipt-details-box");
    if (!receiptBox) return;
    
    const info = state.storeInfo;
    const formattedDate = new Date(sale.date).toLocaleDateString("pt-BR") + " " + new Date(sale.date).toLocaleTimeString("pt-BR");
    
    let itemsHtml = "";
    sale.products.forEach(p => {
      const prodDetails = state.products.find(item => item.id === p.productId) || { name: "Produto Excluído" };
      itemsHtml += `
        <div class="receipt-item-row">
          <span>${p.quantity}x ${prodDetails.name.substring(0, 22)}</span>
          <span>${formatCurrency(p.price * p.quantity)}</span>
        </div>
      `;
    });

    const storeName = info.name || "MINHA LOJA";
    const storeAddress = info.address ? `<div class="receipt-info">${info.address}</div>` : "";
    const storeCnpj = info.cnpj ? `<div class="receipt-info">CNPJ: ${info.cnpj}</div>` : "";
    const storePhone = info.phone ? `<div class="receipt-info">Tel: ${info.phone}</div>` : "";
    const storeEmail = info.email ? `<div class="receipt-info">${info.email}</div>` : "";
    const headerMsg = info.headerMsg ? `<div class="receipt-info" style="margin-top: 6px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">${info.headerMsg}</div>` : "";
    const footerMsg = info.footerMsg || "Obrigado pela preferência!\nVolte sempre!";
    
    receiptBox.innerHTML = `
      <div class="receipt-header">
        <div class="receipt-title">${storeName.toUpperCase()}</div>
        ${storeAddress}
        ${storeCnpj}
        ${storePhone}
        ${storeEmail}
        ${headerMsg}
        <div class="receipt-info" style="margin-top: 8px;">DATA: ${formattedDate}</div>
        <div class="receipt-info" style="font-weight: 700;">CUPOM: ${sale.id}</div>
      </div>
      
      <div class="receipt-info">CLIENTE: ${sale.customerName.toUpperCase()}</div>
      <div class="receipt-info">PGTO: ${sale.paymentMethod.toUpperCase()}</div>
      
      <div class="receipt-divider"></div>
      
      ${itemsHtml}
      
      <div class="receipt-divider"></div>
      
      <div class="receipt-summary-row">
        <span>SUBTOTAL</span>
        <span>${formatCurrency(sale.subtotal)}</span>
      </div>
      <div class="receipt-summary-row">
        <span>DESCONTO</span>
        <span>-${formatCurrency(sale.discount)}</span>
      </div>
      <div class="receipt-summary-row" style="font-size: 15px; margin-top: 6px;">
        <span>TOTAL PAGO</span>
        <span>${formatCurrency(sale.total)}</span>
      </div>
      
      <div class="receipt-divider"></div>
      <div class="receipt-footer">
        ${footerMsg.replace(/\n/g, '<br>')}
      </div>
    `;
    
    openModal("modal-receipt");
  }

  function printReceipt() {
    const receiptBox = document.getElementById("receipt-details-box");
    if (!receiptBox) return;
    const content = receiptBox.innerHTML;
    
    let iframe = document.getElementById("receipt-print-iframe");
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "receipt-print-iframe";
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";
      document.body.appendChild(iframe);
    }
    
    const doc = iframe.contentWindow.document || iframe.contentDocument;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Recibo - Axtral OS</title>
        <style>
          @page {
            margin: 0;
          }
          body {
            font-family: 'Courier New', Courier, monospace;
            color: #000;
            background: #fff;
            margin: 0;
            padding: 20px;
            width: 80mm; /* Standard thermal receipt width */
            box-sizing: border-box;
          }
          .receipt-header {
            text-align: center;
            border-bottom: 1px dashed #000;
            padding-bottom: 10px;
            margin-bottom: 10px;
          }
          .receipt-title {
            font-weight: bold;
            font-size: 15px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .receipt-info {
            font-size: 11px;
            margin-top: 3px;
            line-height: 1.3;
          }
          .receipt-divider {
            border-bottom: 1px dashed #000;
            margin: 10px 0;
          }
          .receipt-item-row {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            margin-bottom: 4px;
          }
          .receipt-summary-row {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            font-weight: bold;
            margin-bottom: 4px;
          }
          .receipt-footer {
            text-align: center;
            margin-top: 15px;
            font-size: 11px;
            line-height: 1.3;
            border-top: 1px dashed #000;
            padding-top: 10px;
          }
          @media print {
            body {
              padding: 4mm;
            }
          }
        </style>
      </head>
      <body>
        \${content}
        <script>
          window.onload = function() {
            window.focus();
            window.print();
          };
        </script>
      </body>
      </html>
    `);
    doc.close();
  }

  // --- 3. INVENTORY GESTAO DE ESTOQUE ---
  let inventorySearchQuery = "";
  let inventoryCategoryFilter = "all";
  let inventoryStockFilter = "all";

  function renderInventory() {
    const tableBody = document.getElementById("inventory-table-body");
    if (!tableBody) return;
    
    populateInventoryFilters();
    
    let filtered = state.products;
    
    if (inventorySearchQuery.trim() !== "") {
      const q = inventorySearchQuery.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }
    
    if (inventoryCategoryFilter !== "all") {
      filtered = filtered.filter(p => p.category === inventoryCategoryFilter);
    }
    
    if (inventoryStockFilter !== "all") {
      if (inventoryStockFilter === "normal") {
        filtered = filtered.filter(p => p.stock > p.minStock);
      } else if (inventoryStockFilter === "low") {
        filtered = filtered.filter(p => p.stock > 0 && p.stock <= p.minStock);
      } else if (inventoryStockFilter === "out") {
        filtered = filtered.filter(p => p.stock === 0);
      }
    }
    
    if (filtered.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 40px 0;">
            Nenhum produto encontrado correspondente aos filtros.
          </td>
        </tr>
      `;
      return;
    }
    
    let html = "";
    filtered.forEach(p => {
      let statusBadge = `<span class="badge-status instock">Normal</span>`;
      if (p.stock === 0) {
        statusBadge = `<span class="badge-status outofstock">Esgotado</span>`;
      } else if (p.stock <= p.minStock) {
        statusBadge = `<span class="badge-status lowstock">Baixo</span>`;
      }
      
      html += `
        <tr id="inventory-row-${p.id}">
          <td>
            <div class="table-product-cell">
              <div class="product-gradient-thumb" style="background: ${p.color || 'var(--primary)'}">
                ${p.name.substring(0, 2).toUpperCase()}
              </div>
              <div class="table-product-details">
                <span class="table-product-name">${p.name}</span>
                <span class="table-product-sku">${p.sku}</span>
              </div>
            </div>
          </td>
          <td>${p.category}</td>
          <td style="font-family: var(--font-secondary);">${formatCurrency(p.price)}</td>
          <td style="font-family: var(--font-secondary); color: var(--text-muted);">${formatCurrency(p.cost)}</td>
          <td style="font-family: var(--font-secondary); font-weight: 600;">${p.stock} un</td>
          <td>${statusBadge}</td>
          <td>
            <div class="table-actions-cell">
              <button class="btn-icon edit" onclick="window.openEditProductModal('${p.id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button class="btn-icon delete" onclick="window.deleteProduct('${p.id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    });
    
    tableBody.innerHTML = html;
  }

  function populateInventoryFilters() {
    const filter = document.getElementById("inventory-category-filter");
    if (!filter) return;
    
    const currentVal = filter.value;
    
    filter.innerHTML = '<option value="all">Todas Categorias</option>';
    const categories = [...new Set(state.products.map(p => p.category))];
    
    categories.forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      filter.appendChild(opt);
    });
    
    filter.value = currentVal;
  }

  window.openEditProductModal = openEditProductProductModal;
  window.deleteProduct = deleteProductItem;

  function openEditProductProductModal(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;
    
    state.editingProductId = productId;
    
    document.getElementById("modal-product-title").textContent = "Editar Produto";
    document.getElementById("form-product-id").value = product.id;
    document.getElementById("form-product-name").value = product.name;
    document.getElementById("form-product-sku").value = product.sku;
    document.getElementById("form-product-category").value = product.category;
    document.getElementById("form-product-price").value = product.price;
    document.getElementById("form-product-cost").value = product.cost;
    document.getElementById("form-product-stock").value = product.stock;
    document.getElementById("form-product-minstock").value = product.minStock;
    document.getElementById("form-product-color").value = product.color || "linear-gradient(135deg, #ec4899, #8b5cf6)";
    
    openModal("modal-product");
  }

  async function deleteProductItem(productId) {
    const prod = state.products.find(p => p.id === productId);
    if (!prod) return;
    
    if (confirm(`Deseja realmente remover o produto "${prod.name}" do estoque?`)) {
      try {
        const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
        let data = {};
        try {
          data = await res.json();
        } catch (jsonErr) {}
        
        if (res.ok) {
          showNotification(data.message || "Produto removido com sucesso!");
          await refreshProducts();
        } else {
          showNotification(data.message || "Erro ao remover produto.", "danger");
        }
      } catch (err) {
        showNotification("Erro de conexão com o servidor.", "danger");
      }
    }
  }

  async function handleProductFormSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById("form-product-id").value;
    const name = document.getElementById("form-product-name").value;
    const sku = document.getElementById("form-product-sku").value;
    const category = document.getElementById("form-product-category").value;
    const price = parseFloat(document.getElementById("form-product-price").value);
    const cost = parseFloat(document.getElementById("form-product-cost").value);
    const stock = parseInt(document.getElementById("form-product-stock").value, 10);
    const minStock = parseInt(document.getElementById("form-product-minstock").value, 10);
    const color = document.getElementById("form-product-color").value;
    
    const body = { name, sku, category, price, cost, stock, minStock, color };
    
    try {
      let res;
      if (id) {
        res = await fetch(`/api/products/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      } else {
        res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      }
      
      let data = {};
      try {
        data = await res.json();
      } catch (jsonErr) {}
      
      if (res.ok) {
        showNotification(data.message || (id ? "Produto atualizado!" : "Produto cadastrado!"));
        closeModal("modal-product");
        await refreshProducts();
      } else {
        showNotification(data.message || "Erro ao salvar produto.", "danger");
      }
    } catch (err) {
      showNotification("Erro de conexão com o servidor.", "danger");
    }
  }

  // --- 4. ORDERS SALES HISTORY ---
  let ordersSearchQuery = "";
  let ordersPaymentFilter = "all";

  function renderOrders() {
    const tableBody = document.getElementById("orders-table-body");
    if (!tableBody) return;
    
    let filtered = [...state.sales].reverse(); 
    
    if (ordersSearchQuery.trim() !== "") {
      const q = ordersSearchQuery.toLowerCase();
      filtered = filtered.filter(sale => sale.id.toLowerCase().includes(q) || sale.customerName.toLowerCase().includes(q));
    }
    
    if (ordersPaymentFilter !== "all") {
      filtered = filtered.filter(sale => sale.paymentMethod === ordersPaymentFilter);
    }
    
    if (filtered.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; color: var(--text-muted); padding: 40px 0;">
            Nenhuma venda registrada correspondente aos termos de busca.
          </td>
        </tr>
      `;
      return;
    }
    
    let html = "";
    filtered.forEach(sale => {
      const dateFormatted = new Date(sale.date).toLocaleDateString("pt-BR") + " " + new Date(sale.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const itemsCount = sale.products.reduce((acc, c) => acc + c.quantity, 0);
      
      html += `
        <tr>
          <td style="font-family: var(--font-secondary); font-weight: 700; color: var(--secondary);">${sale.id}</td>
          <td style="font-size: 13px;">${dateFormatted}</td>
          <td style="font-weight: 600;">${sale.customerName}</td>
          <td>${itemsCount} itens</td>
          <td style="font-family: var(--font-secondary); color: var(--text-muted);">${formatCurrency(sale.subtotal)}</td>
          <td style="font-family: var(--font-secondary); color: var(--danger);">${formatCurrency(sale.discount)}</td>
          <td style="font-family: var(--font-secondary); font-weight: 700;">${formatCurrency(sale.total)}</td>
          <td>
            <span style="font-size: 12px; padding: 4px 8px; border-radius: 4px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-light);">
              ${sale.paymentMethod}
            </span>
          </td>
          <td>
            <div class="table-actions-cell" style="justify-content: center;">
              <button class="btn-icon" onclick="window.viewOrderReceipt('${sale.id}')">
                <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    });
    
    tableBody.innerHTML = html;
  }

  window.viewOrderReceipt = viewOrderReceipt;

  function viewOrderReceipt(saleId) {
    const sale = state.sales.find(s => s.id === saleId);
    if (!sale) return;
    renderReceiptModal(sale);
  }

  // --- 5. CUSTOMERS DIRETO RIO ---
  let customersSearchQuery = "";

  function renderCustomers() {
    const tableBody = document.getElementById("customers-table-body");
    if (!tableBody) return;
    
    let filtered = state.customers;
    
    if (customersSearchQuery.trim() !== "") {
      const q = customersSearchQuery.toLowerCase();
      filtered = filtered.filter(c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone.includes(q));
    }
    
    if (filtered.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 40px 0;">
            Nenhum cliente cadastrado correspondente.
          </td>
        </tr>
      `;
      return;
    }
    
    let html = "";
    filtered.forEach(c => {
      let tierClass = "bronze";
      if (c.tier.toLowerCase() === "platinum") tierClass = "platinum";
      else if (c.tier.toLowerCase() === "gold") tierClass = "gold";
      else if (c.tier.toLowerCase() === "silver") tierClass = "silver";
      
      html += `
        <tr>
          <td style="font-weight: 600;">${c.name}</td>
          <td>${c.email}</td>
          <td style="font-family: var(--font-secondary);">${c.phone || "---"}</td>
          <td style="font-family: var(--font-secondary); font-weight: 700; color: var(--secondary);">${c.points} pts</td>
          <td style="font-family: var(--font-secondary); font-weight: 600;">${formatCurrency(c.totalSpent)}</td>
          <td>
            <span class="tier-tag ${tierClass}">${c.tier}</span>
          </td>
          <td>
            <div class="table-actions-cell">
              <button class="btn-icon edit" onclick="window.openEditCustomerModal('${c.id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button class="btn-icon delete" onclick="window.deleteCustomer('${c.id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    });
    
    tableBody.innerHTML = html;
  }

  window.openEditCustomerModal = openEditCustomerModal;
  window.deleteCustomer = deleteCustomer;

  function openEditCustomerModal(customerId) {
    const customer = state.customers.find(c => c.id === customerId);
    if (!customer) return;
    
    state.editingCustomerId = customerId;
    
    document.getElementById("modal-customer-title").textContent = "Editar Cliente";
    document.getElementById("form-customer-id").value = customer.id;
    document.getElementById("form-customer-name").value = customer.name;
    document.getElementById("form-customer-email").value = customer.email;
    document.getElementById("form-customer-phone").value = customer.phone || "";
    
    openModal("modal-customer");
  }

  async function deleteCustomer(customerId) {
    const cust = state.customers.find(c => c.id === customerId);
    if (!cust) return;
    
    if (confirm(`Deseja realmente remover o cliente "${cust.name}"?`)) {
      try {
        const res = await fetch(`/api/customers/${customerId}`, { method: 'DELETE' });
        let data = {};
        try {
          data = await res.json();
        } catch (jsonErr) {}
        
        if (res.ok) {
          showNotification(data.message || "Cliente removido com sucesso!");
          await refreshCustomers();
        } else {
          showNotification(data.message || "Erro ao remover cliente.", "danger");
        }
      } catch (err) {
        showNotification("Erro de conexão com o servidor.", "danger");
      }
    }
  }

  async function handleCustomerFormSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById("form-customer-id").value;
    const name = document.getElementById("form-customer-name").value;
    const email = document.getElementById("form-customer-email").value;
    const phone = document.getElementById("form-customer-phone").value;
    
    const body = { name, email, phone };
    
    try {
      let res;
      if (id) {
        res = await fetch(`/api/customers/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      } else {
        res = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      }
      
      let data = {};
      try {
        data = await res.json();
      } catch (jsonErr) {}
      
      if (res.ok) {
        showNotification(data.message || (id ? "Cliente atualizado!" : "Cliente cadastrado!"));
        closeModal("modal-customer");
        await refreshCustomers();
      } else {
        showNotification(data.message || "Erro ao salvar cliente.", "danger");
      }
    } catch (err) {
      showNotification("Erro de conexão com o servidor.", "danger");
    }
  }

  // --- LOW STOCK NOTIFIER SYSTEM ---
  function checkLowStock() {
    if (!state.settings.lowStockAlert) {
      const trigger = document.getElementById("notification-count");
      if (trigger) trigger.style.display = "none";
      return;
    }
    
    const lowStock = state.products.filter(p => p.stock <= p.minStock);
    const badge = document.getElementById("notification-count");
    if (badge) {
      if (lowStock.length > 0) {
        badge.textContent = lowStock.length;
        badge.style.display = "flex";
      } else {
        badge.style.display = "none";
      }
    }
  }

  const notifTrigger = document.getElementById("notification-trigger");
  if (notifTrigger) {
    notifTrigger.addEventListener("click", () => {
      const lowStock = state.products.filter(p => p.stock <= p.minStock);
      if (lowStock.length > 0) {
        let msg = `Alerta de Reposição! ${lowStock.length} produto(s) com estoque baixo:\n`;
        lowStock.forEach(p => {
          msg += `- ${p.name}: apenas ${p.stock} un (Mínimo: ${p.minStock})\n`;
        });
        alert(msg);
      } else {
        alert("Nenhum alerta de estoque crítico no momento!");
      }
    });
  }

  // --- 7. MASTER ADMIN PANEL CONTROLLER ---
  async function renderAdmin() {
    const tableBody = document.getElementById("admin-stores-table-body");
    if (!tableBody) return;

    try {
      // 1. Fetch statistics
      const statsRes = await fetch('/api/admin/stats');
      if (statsRes.ok) {
        const stats = await statsRes.json();
        document.getElementById("admin-total-stores").textContent = stats.totalStores;
        document.getElementById("admin-total-revenue").textContent = formatCurrency(stats.totalRevenue);
        document.getElementById("admin-total-sales").textContent = stats.totalSales;
        document.getElementById("admin-total-products").textContent = stats.totalProducts;
      }

      // 2. Fetch stores list
      const storesRes = await fetch('/api/admin/stores');
      if (storesRes.ok) {
        const stores = await storesRes.json();
        
        if (stores.length === 0) {
          tableBody.innerHTML = `
            <tr>
              <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 40px 0;">
                Nenhuma loja registrada no sistema.
              </td>
            </tr>
          `;
          return;
        }

        let html = "";
        stores.forEach(store => {
          const dateFormatted = new Date(store.created_at).toLocaleDateString("pt-BR") + " " + new Date(store.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          html += `
            <tr id="admin-store-row-${store.id}">
              <td style="font-family: var(--font-secondary); font-weight: 700; color: var(--secondary);">${store.id}</td>
              <td style="font-weight: 600;">${store.name}</td>
              <td>${store.email}</td>
              <td style="font-size: 13px;">${dateFormatted}</td>
              <td>
                <div class="table-actions-cell" style="justify-content: center;">
                  <button class="btn-icon delete" onclick="window.deleteStore('${store.id}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                </div>
              </td>
            </tr>
          `;
        });

        tableBody.innerHTML = html;
      }
    } catch (err) {
      console.error("Error loading master stats:", err);
      showNotification("Erro ao carregar dados do ecossistema.", "danger");
    }
  }

  window.deleteStore = deleteStore;

  async function deleteStore(storeId) {
    if (confirm(`ALERTA CRÍTICO: Tem certeza que deseja remover a loja "${storeId}" permanentemente? Todos os cadastros, produtos e vendas associados a esta loja serão apagados definitivamente do banco de dados.`)) {
      try {
        const res = await fetch(`/api/admin/stores/${storeId}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) {
          showNotification(data.message || "Loja removida com sucesso!");
          await renderAdmin();
        } else {
          showNotification(data.message || "Erro ao remover loja.", "danger");
        }
      } catch (err) {
        showNotification("Erro de conexão com o servidor.", "danger");
      }
    }
  }

  function setupAdminEventListeners() {
    const btnNewStore = document.getElementById("btn-new-store");
    if (btnNewStore) {
      btnNewStore.addEventListener("click", () => {
        document.getElementById("form-store").reset();
        openModal("modal-store");
      });
    }

    const storeCloseBtn = document.getElementById("modal-store-close-btn");
    if (storeCloseBtn) storeCloseBtn.addEventListener("click", () => closeModal("modal-store"));
    
    const storeCancelBtn = document.getElementById("modal-store-cancel-btn");
    if (storeCancelBtn) storeCancelBtn.addEventListener("click", () => closeModal("modal-store"));

    const formStore = document.getElementById("form-store");
    if (formStore) {
      formStore.addEventListener("submit", async (e) => {
        e.preventDefault();

        const id = document.getElementById("form-store-id").value.trim().toLowerCase();
        const name = document.getElementById("form-store-name").value.trim();
        const email = document.getElementById("form-store-email").value.trim();
        const password = document.getElementById("form-store-password").value;

        try {
          const res = await fetch('/api/admin/stores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, name, email, password })
          });

          const data = await res.json();
          if (res.ok) {
            showNotification(data.message || "Loja criada com sucesso!", "success");
            closeModal("modal-store");
            await renderAdmin();
          } else {
            showNotification(data.message || "Erro ao criar loja.", "danger");
          }
        } catch (err) {
          showNotification("Erro de conexão com o servidor.", "danger");
        }
      });
    }
  }

  // --- GLOBAL DOM EVENTS BINDINGS ---
  function setupEventListeners() {
    
    // Global search routing
    const globalSearch = document.getElementById("global-search-input");
    if (globalSearch) {
      globalSearch.addEventListener("input", (e) => {
        const query = e.target.value.trim();
        if (state.currentTab === "pos") {
          posSearchQuery = query;
          const posSearch = document.getElementById("pos-search-input");
          if (posSearch) posSearch.value = query;
          renderPOSProducts();
        } else if (state.currentTab === "inventory") {
          inventorySearchQuery = query;
          const invSearch = document.getElementById("inventory-search-input");
          if (invSearch) invSearch.value = query;
          renderInventory();
        } else if (state.currentTab === "orders") {
          ordersSearchQuery = query;
          const ordSearch = document.getElementById("orders-search-input");
          if (ordSearch) ordSearch.value = query;
          renderOrders();
        } else if (state.currentTab === "customers") {
          customersSearchQuery = query;
          const custSearch = document.getElementById("customers-search-input");
          if (custSearch) custSearch.value = query;
          renderCustomers();
        }
      });
    }

    const posSearchInput = document.getElementById("pos-search-input");
    if (posSearchInput) {
      posSearchInput.addEventListener("input", (e) => {
        posSearchQuery = e.target.value;
        renderPOSProducts();
      });
    }

    const posDiscountInput = document.getElementById("pos-discount-input");
    if (posDiscountInput) {
      posDiscountInput.addEventListener("input", () => {
        renderPOSCart();
      });
    }

    const posCheckoutBtn = document.getElementById("pos-checkout-btn");
    if (posCheckoutBtn) {
      posCheckoutBtn.addEventListener("click", () => {
        processCheckout();
      });
    }

    const posClearCart = document.getElementById("pos-clear-cart-btn");
    if (posClearCart) {
      posClearCart.addEventListener("click", () => {
        if (state.cart.length > 0 && confirm("Deseja limpar todo o carrinho?")) {
          state.cart = [];
          renderPOSCart();
        }
      });
    }

    const invSearchInput = document.getElementById("inventory-search-input");
    if (invSearchInput) {
      invSearchInput.addEventListener("input", (e) => {
        inventorySearchQuery = e.target.value;
        renderInventory();
      });
    }

    const invCatFilter = document.getElementById("inventory-category-filter");
    if (invCatFilter) {
      invCatFilter.addEventListener("change", (e) => {
        inventoryCategoryFilter = e.target.value;
        renderInventory();
      });
    }

    const invStockFilter = document.getElementById("inventory-stock-filter");
    if (invStockFilter) {
      invStockFilter.addEventListener("change", (e) => {
        inventoryStockFilter = e.target.value;
        renderInventory();
      });
    }

    const ordersSearch = document.getElementById("orders-search-input");
    if (ordersSearch) {
      ordersSearch.addEventListener("input", (e) => {
        ordersSearchQuery = e.target.value;
        renderOrders();
      });
    }

    const ordersPayFilter = document.getElementById("orders-payment-filter");
    if (ordersPayFilter) {
      ordersPayFilter.addEventListener("change", (e) => {
        ordersPaymentFilter = e.target.value;
        renderOrders();
      });
    }

    const custSearchInput = document.getElementById("customers-search-input");
    if (custSearchInput) {
      custSearchInput.addEventListener("input", (e) => {
        customersSearchQuery = e.target.value;
        renderCustomers();
      });
    }
    
    // Logout sidebar footer trigger
    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout) {
      btnLogout.addEventListener("click", async () => {
        if (confirm("Deseja realmente sair do sistema?")) {
          try {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/login.html';
          } catch (err) {
            window.location.href = '/login.html';
          }
        }
      });
    }

    // Modal creation hooks
    const btnNewProduct = document.getElementById("btn-new-product");
    if (btnNewProduct) {
      btnNewProduct.addEventListener("click", () => {
        state.editingProductId = null;
        document.getElementById("modal-product-title").textContent = "Cadastrar Novo Produto";
        document.getElementById("form-product").reset();
        document.getElementById("form-product-id").value = "";
        openModal("modal-product");
      });
    }

    const btnNewCustomer = document.getElementById("btn-new-customer");
    if (btnNewCustomer) {
      btnNewCustomer.addEventListener("click", () => {
        state.editingCustomerId = null;
        document.getElementById("modal-customer-title").textContent = "Cadastrar Novo Cliente";
        document.getElementById("form-customer").reset();
        document.getElementById("form-customer-id").value = "";
        openModal("modal-customer");
      });
    }

    // Closing modal buttons
    const prodClose = document.getElementById("modal-product-close-btn");
    if (prodClose) prodClose.addEventListener("click", () => closeModal("modal-product"));
    const prodCancel = document.getElementById("modal-product-cancel-btn");
    if (prodCancel) prodCancel.addEventListener("click", () => closeModal("modal-product"));

    const custClose = document.getElementById("modal-customer-close-btn");
    if (custClose) custClose.addEventListener("click", () => closeModal("modal-customer"));
    const custCancel = document.getElementById("modal-customer-cancel-btn");
    if (custCancel) custCancel.addEventListener("click", () => closeModal("modal-customer"));

    const receiptClose = document.getElementById("modal-receipt-close-btn");
    if (receiptClose) receiptClose.addEventListener("click", () => closeModal("modal-receipt"));
    const btnPrintReceipt = document.getElementById("btn-print-receipt");
    if (btnPrintReceipt) btnPrintReceipt.addEventListener("click", () => closeModal("modal-receipt"));
    const btnPrintReceiptPdf = document.getElementById("btn-print-receipt-pdf");
    if (btnPrintReceiptPdf) btnPrintReceiptPdf.addEventListener("click", printReceipt);

    const formProduct = document.getElementById("form-product");
    if (formProduct) formProduct.addEventListener("submit", handleProductFormSubmit);
    
    const formCustomer = document.getElementById("form-customer");
    if (formCustomer) formCustomer.addEventListener("submit", handleCustomerFormSubmit);

    // Block simulated database tools for Cloud SQLite mode
    const resetSettingsBtn = document.getElementById("btn-settings-reset");
    if (resetSettingsBtn) resetSettingsBtn.addEventListener("click", resetToFactorySettings);
    
    const clearSettingsBtn = document.getElementById("btn-settings-clear");
    if (clearSettingsBtn) clearSettingsBtn.addEventListener("click", clearDatabase);

    const settingAudio = document.getElementById("setting-audio");
    if (settingAudio) {
      settingAudio.addEventListener("change", async (e) => {
        state.settings.audio = e.target.checked;
        await saveSettingsToServer();
        showNotification("Preferencia de som atualizada!");
      });
    }

    const settingLowStock = document.getElementById("setting-lowstock-alert");
    if (settingLowStock) {
      settingLowStock.addEventListener("change", async (e) => {
        state.settings.lowStockAlert = e.target.checked;
        await saveSettingsToServer();
        checkLowStock();
        renderDashboard();
        showNotification("Preferencia de alertas de estoque atualizada!");
      });
    }

    // --- STORE INFO AUTO-SAVE ---
    let storeInfoSaveTimer = null;
    const saveIndicator = document.getElementById("store-info-save-indicator");
    
    const storeInfoFieldMap = {
      "store-info-name": "name",
      "store-info-cnpj": "cnpj",
      "store-info-address": "address",
      "store-info-phone": "phone",
      "store-info-email": "email",
      "store-info-header-msg": "headerMsg",
      "store-info-footer-msg": "footerMsg"
    };

    for (const [elementId, stateKey] of Object.entries(storeInfoFieldMap)) {
      const el = document.getElementById(elementId);
      if (el) {
        el.addEventListener("input", (e) => {
          state.storeInfo[stateKey] = e.target.value;
          
          if (saveIndicator) {
            saveIndicator.classList.remove("visible");
          }
          clearTimeout(storeInfoSaveTimer);
          storeInfoSaveTimer = setTimeout(async () => {
            await saveStoreInfoToServer();
            if (saveIndicator) {
              saveIndicator.classList.add("visible");
              setTimeout(() => saveIndicator.classList.remove("visible"), 2500);
            }
          }, 500);
        });
      }
    }
  }

  // --- FLOATING FEEDBACK NOTIFICATIONS SYSTEM ---
  function showNotification(text, type = "success") {
    const toast = document.createElement("div");
    toast.className = `glass-panel toast-notification ${type}`;
    toast.textContent = text;
    
    Object.assign(toast.style, {
      position: "fixed",
      bottom: "30px",
      right: "30px",
      padding: "16px 28px",
      borderRadius: "12px",
      fontSize: "14px",
      fontWeight: "600",
      zIndex: "10000",
      color: "#fff",
      boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
      transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
      transform: "translateY(50px) scale(0.9)",
      opacity: "0"
    });
    
    if (type === "success") {
      toast.style.borderColor = "var(--success)";
      toast.style.background = "rgba(16, 185, 129, 0.15)";
    } else if (type === "warning") {
      toast.style.borderColor = "var(--warning)";
      toast.style.background = "rgba(245, 158, 11, 0.15)";
    } else if (type === "danger") {
      toast.style.borderColor = "var(--danger)";
      toast.style.background = "rgba(239, 68, 68, 0.15)";
    }
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.transform = "translateY(0) scale(1)";
      toast.style.opacity = "1";
    }, 50);
    
    setTimeout(() => {
      toast.style.transform = "translateY(20px) scale(0.9)";
      toast.style.opacity = "0";
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3500);
  }

  // --- GENERAL ANIMATION HELPERS ---
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add("active");
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove("active");
  }

  function formatCurrency(val) {
    return (val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  // Launch controller entrypoint
  init();
});
