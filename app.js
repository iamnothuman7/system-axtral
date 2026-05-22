// Core Controller - System Axtral Store Management System

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
    settings: {
      audio: true,
      lowStockAlert: true
    }
  };

  // --- INITIALIZATION ---
  function init() {
    loadDatabase();
    setupClock();
    setupNavigation();
    setupEventListeners();
    
    // Initial Render
    renderAll();
    
    // Check low stock notifications
    checkLowStock();
  }

  // --- DATABASE SYNC (localStorage) ---
  function loadDatabase() {
    const localProducts = localStorage.getItem("axtral_products");
    const localCustomers = localStorage.getItem("axtral_customers");
    const localSales = localStorage.getItem("axtral_sales");
    const localSettings = localStorage.getItem("axtral_settings");

    if (localProducts && localCustomers && localSales) {
      state.products = JSON.parse(localProducts);
      state.customers = JSON.parse(localCustomers);
      state.sales = JSON.parse(localSales);
    } else {
      // Seed with high-fidelity Mock Data if local is empty
      seedMockData();
    }

    if (localSettings) {
      state.settings = JSON.parse(localSettings);
      // Synchronize checkboxes in settings page
      const audioCheck = document.getElementById("setting-audio");
      const stockCheck = document.getElementById("setting-lowstock-alert");
      if (audioCheck) audioCheck.checked = state.settings.audio;
      if (stockCheck) stockCheck.checked = state.settings.lowStockAlert;
    }
  }

  function seedMockData() {
    state.products = [...window.AxtralMockData.products];
    state.customers = [...window.AxtralMockData.customers];
    state.sales = [...window.AxtralMockData.sales];
    saveDatabase();
  }

  function saveDatabase() {
    localStorage.setItem("axtral_products", JSON.stringify(state.products));
    localStorage.setItem("axtral_customers", JSON.stringify(state.customers));
    localStorage.setItem("axtral_sales", JSON.stringify(state.sales));
    localStorage.setItem("axtral_settings", JSON.stringify(state.settings));
  }

  function resetToFactorySettings() {
    if (confirm("Deseja realmente restaurar todos os dados originais? Suas vendas e cadastros recentes serão apagados.")) {
      seedMockData();
      state.cart = [];
      renderAll();
      showNotification("Banco de dados restaurado com sucesso!");
    }
  }

  function clearDatabase() {
    if (confirm("ALERTA CRÍTICO: Tem certeza que deseja esvaziar todo o banco de dados? Isso apagará todos os produtos, clientes e vendas definitivamente.")) {
      state.products = [];
      state.customers = [];
      state.sales = [];
      state.cart = [];
      saveDatabase();
      renderAll();
      showNotification("Todo o banco de dados foi esvaziado.", "danger");
    }
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
      console.warn("Navegador bloqueou reprodução de áudio ou AudioContext não é suportado.", e);
    }
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
    }
  }

  // --- 1. DASHBOARD PAGE CONTROLLER ---
  function renderDashboard() {
    // Calculando Métricas do Dia
    const today = new Date().toISOString().split("T")[0];
    const todaySales = state.sales.filter(sale => sale.date.startsWith(today));
    
    const totalRev = todaySales.reduce((acc, curr) => acc + curr.total, 0);
    const countSales = todaySales.length;
    const avgTicket = countSales > 0 ? (totalRev / countSales) : 0;
    
    // Low stock count
    const lowStockItems = state.products.filter(p => p.stock <= p.minStock);

    // Dom update
    document.getElementById("dashboard-total-revenue").textContent = formatCurrency(totalRev);
    document.getElementById("dashboard-sales-count").textContent = countSales;
    document.getElementById("dashboard-avg-ticket").textContent = formatCurrency(avgTicket);
    document.getElementById("dashboard-low-stock-count").textContent = lowStockItems.length;

    // Render low stock label details
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

    // Render activity list
    renderRecentActivities(lowStockItems);

    // Render gorgeous Custom SVG Chart
    renderDashboardSVGChart();
  }

  function renderRecentActivities(lowStockItems) {
    const listContainer = document.getElementById("dashboard-recent-activities");
    if (!listContainer) return;
    
    let html = "";
    
    // Add low stock alerts first (if enabled)
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
    
    // Add recent sales logs
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
    
    // Prepare sales for the last 7 days (including today)
    const daysLabel = [];
    const salesTotal = [];
    
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      
      // Label formatted like "22/May"
      const day = d.getDate();
      const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      daysLabel.push(`${day} ${monthNames[d.getMonth()]}`);
      
      // Calculate total sales for this day
      const dayRevenue = state.sales
        .filter(sale => sale.date.startsWith(dateStr))
        .reduce((sum, current) => sum + current.total, 0);
      salesTotal.push(dayRevenue);
    }
    
    // Find Max Value for scaling
    const maxVal = Math.max(...salesTotal, 500); // minimum scale peak of 500
    
    // Draw SVG elements
    const svgWidth = 600;
    const svgHeight = 220;
    const paddingLeft = 50;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;
    
    const graphWidth = svgWidth - paddingLeft - paddingRight;
    const graphHeight = svgHeight - paddingTop - paddingBottom;
    
    // Map points coordinates
    const points = salesTotal.map((val, idx) => {
      const x = paddingLeft + (idx * (graphWidth / (salesTotal.length - 1)));
      const y = paddingTop + graphHeight - (val / maxVal * graphHeight);
      return { x, y, value: val };
    });
    
    // Line path string
    let linePath = `M ${points[0].x} ${points[0].y} `;
    for (let i = 1; i < points.length; i++) {
      // Add dynamic Bezier curves for organic, premium feel
      const prev = points[i - 1];
      const cpX1 = prev.x + (points[i].x - prev.x) / 2;
      const cpY1 = prev.y;
      const cpX2 = prev.x + (points[i].x - prev.x) / 2;
      const cpY2 = points[i].y;
      linePath += `C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${points[i].x} ${points[i].y} `;
    }
    
    // Area path string (underneath the line)
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${paddingTop + graphHeight} L ${points[0].x} ${paddingTop + graphHeight} Z`;
    
    // Build Gridlines and axis
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
    
    // Horizontal axis labels
    let labelsHtml = "";
    points.forEach((pt, idx) => {
      labelsHtml += `
        <text class="svg-chart-text" x="${pt.x}" y="${svgHeight - 8}" text-anchor="middle">${daysLabel[idx]}</text>
        <circle class="svg-chart-dot" cx="${pt.x}" cy="${pt.y}" r="4" data-value="${pt.value}">
          <title>R$ ${pt.value.toFixed(2)}</title>
        </circle>
      `;
    });
    
    // Generate full SVG container
    const svgCode = `
      <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="svg-chart-container">
        <defs>
          <!-- Gorgeous neon glows gradients -->
          <linearGradient id="chart-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#8b5cf6" />
            <stop offset="100%" stop-color="#06b6d4" />
          </linearGradient>
          <linearGradient id="area-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.4" />
            <stop offset="100%" stop-color="#030014" stop-opacity="0" />
          </linearGradient>
        </defs>
        
        <!-- Y Gridlines & Y-Axis Labels -->
        ${gridlinesHtml}
        
        <!-- Glowing gradient area fill -->
        <path class="svg-chart-area" d="${areaPath}" />
        
        <!-- Main Line -->
        <path class="svg-chart-line" d="${linePath}" />
        
        <!-- Dots and X-Axis Labels -->
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
    
    // Get unique categories
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
    
    // Category click listeners
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
    
    // Filter Category
    if (selectedPosCategory !== "Todos") {
      filtered = filtered.filter(p => p.category === selectedPosCategory);
    }
    
    // Filter Search
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
      // Stock label indicators
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
    
    // Add to cart buttons listeners
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
    
    // Clear dynamic options (keep first one "Consumidor Geral")
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
    
    // Simple micro-beep trigger
    if (state.settings.audio) {
      playShortCartSound();
    }
  }

  function playShortCartSound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(600, audioCtx.currentTime); // Short quick sound
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.05);
    } catch(e){}
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
      
      // Update receipt amounts to zero
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
    
    // Calculate discounts & total payment
    const discountEl = document.getElementById("pos-discount-input");
    const discount = parseFloat(discountEl ? discountEl.value : 0) || 0;
    
    const finalTotal = Math.max(0, subtotal - discount);
    
    document.getElementById("pos-subtotal").textContent = formatCurrency(subtotal);
    document.getElementById("pos-total").textContent = formatCurrency(finalTotal);
  }

  // Bind cart helper functions globally so HTML onclick handlers can trigger them
  window.updateCartQty = updateCartQty;
  window.removeFromCart = removeFromCart;

  // --- CHECKOUT TRANSACTION PROCESSOR ---
  function processCheckout() {
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
    
    // 1. Double check and deduct stock
    let stockError = false;
    state.cart.forEach(cartItem => {
      const origProd = state.products.find(p => p.id === cartItem.product.id);
      if (origProd.stock < cartItem.quantity) {
        showNotification(`Estoque insuficiente para o item: ${origProd.name}!`, "danger");
        stockError = true;
      }
    });
    if (stockError) return;
    
    // Deduct stock levels in state
    state.cart.forEach(cartItem => {
      const origProd = state.products.find(p => p.id === cartItem.product.id);
      origProd.stock -= cartItem.quantity;
      origProd.sold += cartItem.quantity; // track item sales popularity
    });
    
    // 2. Add loyalty points to customers (1 point per R$ 10 spent)
    if (customer) {
      customer.totalSpent += total;
      customer.points += Math.floor(total / 10);
      
      // Update Customer tier automatically based on points
      if (customer.points >= 500) customer.tier = "Platinum";
      else if (customer.points >= 250) customer.tier = "Gold";
      else if (customer.points >= 100) customer.tier = "Silver";
    }
    
    // 3. Record sale transaction details
    const saleId = `VNDA-${1000 + state.sales.length + 1}`;
    const newSale = {
      id: saleId,
      date: new Date().toISOString(),
      products: state.cart.map(i => ({ productId: i.product.id, quantity: i.quantity, price: i.product.price })),
      subtotal: subtotal,
      discount: discount,
      total: total,
      paymentMethod: paymentMethod,
      customerName: customerName
    };
    
    state.sales.push(newSale);
    
    // 4. Save Database
    saveDatabase();
    
    // 5. Sound trigger
    playCheckoutSound();
    
    // 6. Display visual invoice receipt
    renderReceiptModal(newSale);
    
    // 7. Reset POS Cart elements
    state.cart = [];
    if (discountEl) discountEl.value = 0;
    if (customerSelect) customerSelect.value = "";
    
    // 8. Re-render Dashboard, Inventory, POS, etc.
    renderAll();
    checkLowStock();
    showNotification(`Venda concluída com sucesso! Recibo gerado.`, "success");
  }

  function renderReceiptModal(sale) {
    const receiptBox = document.getElementById("receipt-details-box");
    if (!receiptBox) return;
    
    const formattedDate = new Date(sale.date).toLocaleDateString("pt-BR") + " " + new Date(sale.date).toLocaleTimeString("pt-BR");
    
    let itemsHtml = "";
    sale.products.forEach(p => {
      const prodDetails = state.products.find(item => item.id === p.productId) || { name: "Produto Excluído" };
      itemsHtml += `
        <div class="receipt-item-row">
          <span>${p.quantity}x ${prodDetails.name.substring(0, 18)}</span>
          <span>${formatCurrency(p.price * p.quantity)}</span>
        </div>
      `;
    });
    
    receiptBox.innerHTML = `
      <div class="receipt-header">
        <div class="receipt-title">AXTRAL COMPUTADORES</div>
        <div class="receipt-info">Avenida Axtral, 777 • São Paulo, SP</div>
        <div class="receipt-info">CNPJ: 77.777.777/0001-77</div>
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
        Obrigado pela preferência!<br>
        Volte sempre!
      </div>
    `;
    
    // Open receipt modal
    openModal("modal-receipt");
  }

  // --- 3. INVENTORY GESTAO DE ESTOQUE ---
  let inventorySearchQuery = "";
  let inventoryCategoryFilter = "all";
  let inventoryStockFilter = "all";

  function renderInventory() {
    const tableBody = document.getElementById("inventory-table-body");
    if (!tableBody) return;
    
    // Populate Category filter dropdown if not populated yet
    populateInventoryFilters();
    
    let filtered = state.products;
    
    // Search Filter
    if (inventorySearchQuery.trim() !== "") {
      const q = inventorySearchQuery.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }
    
    // Category Filter
    if (inventoryCategoryFilter !== "all") {
      filtered = filtered.filter(p => p.category === inventoryCategoryFilter);
    }
    
    // Stock Level Filter
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
      // Stock Status badges
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
    
    // Save current selection value
    const currentVal = filter.value;
    
    // Clear and reload
    filter.innerHTML = '<option value="all">Todas Categorias</option>';
    const categories = [...new Set(state.products.map(p => p.category))];
    
    categories.forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      filter.appendChild(opt);
    });
    
    // Restore selection
    filter.value = currentVal;
  }

  // Bind inventory controls globally for quick triggers
  window.openEditProductModal = openEditProductProductModal;
  window.deleteProduct = deleteProductItem;

  function openEditProductProductModal(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;
    
    state.editingProductId = productId;
    
    // Populate form elements
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

  function deleteProductItem(productId) {
    const prod = state.products.find(p => p.id === productId);
    if (!prod) return;
    
    if (confirm(`Deseja realmente remover o produto "${prod.name}" do estoque?`)) {
      state.products = state.products.filter(p => p.id !== productId);
      saveDatabase();
      renderAll();
      checkLowStock();
      showNotification(`Produto "${prod.name}" foi removido do estoque.`, "warning");
    }
  }

  function handleProductFormSubmit(e) {
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
    
    if (id) {
      // Editing Mode
      const prod = state.products.find(p => p.id === id);
      if (prod) {
        prod.name = name;
        prod.sku = sku;
        prod.category = category;
        prod.price = price;
        prod.cost = cost;
        prod.stock = stock;
        prod.minStock = minStock;
        prod.color = color;
      }
      showNotification("Produto atualizado com sucesso!");
    } else {
      // Creating Mode
      const newProd = {
        id: `prod-${state.products.length + 10}`,
        name,
        sku,
        category,
        price,
        cost,
        stock,
        minStock,
        sold: 0,
        color
      };
      state.products.push(newProd);
      showNotification("Novo produto cadastrado!");
    }
    
    saveDatabase();
    closeModal("modal-product");
    renderAll();
    checkLowStock();
  }

  // --- 4. ORDERS SALES HISTORY ---
  let ordersSearchQuery = "";
  let ordersPaymentFilter = "all";

  function renderOrders() {
    const tableBody = document.getElementById("orders-table-body");
    if (!tableBody) return;
    
    let filtered = [...state.sales].reverse(); // newest sales first
    
    // Search code or customer
    if (ordersSearchQuery.trim() !== "") {
      const q = ordersSearchQuery.toLowerCase();
      filtered = filtered.filter(sale => sale.id.toLowerCase().includes(q) || sale.customerName.toLowerCase().includes(q));
    }
    
    // Payment Method filter
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

  // Bind view receipt globally
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
    
    // Search Customer details
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
      // Tier Badge
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

  // Bind customer actions globally
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
    document.getElementById("form-customer-phone").value = customer.phone;
    
    openModal("modal-customer");
  }

  function deleteCustomer(customerId) {
    const cust = state.customers.find(c => c.id === customerId);
    if (!cust) return;
    
    if (confirm(`Deseja realmente remover o cliente "${cust.name}"?`)) {
      state.customers = state.customers.filter(c => c.id !== customerId);
      saveDatabase();
      renderAll();
      showNotification(`Cliente "${cust.name}" foi removido do diretório.`, "warning");
    }
  }

  function handleCustomerFormSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById("form-customer-id").value;
    const name = document.getElementById("form-customer-name").value;
    const email = document.getElementById("form-customer-email").value;
    const phone = document.getElementById("form-customer-phone").value;
    
    if (id) {
      // Editing
      const cust = state.customers.find(c => c.id === id);
      if (cust) {
        cust.name = name;
        cust.email = email;
        cust.phone = phone;
      }
      showNotification("Cadastro do cliente atualizado!");
    } else {
      // Creating
      const newCust = {
        id: `cust-${state.customers.length + 10}`,
        name,
        email,
        phone,
        totalSpent: 0,
        points: 0,
        tier: "Bronze"
      };
      state.customers.push(newCust);
      showNotification("Novo cliente cadastrado com sucesso!");
    }
    
    saveDatabase();
    closeModal("modal-customer");
    renderAll();
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

  // Clicking notification trigger
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

  // --- GLOBAL DOM EVENTS BINDINGS ---
  function setupEventListeners() {
    
    // Search boxes
    const globalSearch = document.getElementById("global-search-input");
    if (globalSearch) {
      globalSearch.addEventListener("input", (e) => {
        const query = e.target.value.trim();
        // Redirect searches based on currently active screen
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

    // POS Specific Search
    const posSearchInput = document.getElementById("pos-search-input");
    if (posSearchInput) {
      posSearchInput.addEventListener("input", (e) => {
        posSearchQuery = e.target.value;
        renderPOSProducts();
      });
    }

    // POS Cart items discount recalculates total paying
    const posDiscountInput = document.getElementById("pos-discount-input");
    if (posDiscountInput) {
      posDiscountInput.addEventListener("input", () => {
        renderPOSCart();
      });
    }

    // POS Cart Checkout Button
    const posCheckoutBtn = document.getElementById("pos-checkout-btn");
    if (posCheckoutBtn) {
      posCheckoutBtn.addEventListener("click", () => {
        processCheckout();
      });
    }

    // POS Cart Clear Button
    const posClearCart = document.getElementById("pos-clear-cart-btn");
    if (posClearCart) {
      posClearCart.addEventListener("click", () => {
        if (state.cart.length > 0 && confirm("Deseja limpar todo o carrinho?")) {
          state.cart = [];
          renderPOSCart();
        }
      });
    }

    // Inventory Search
    const invSearchInput = document.getElementById("inventory-search-input");
    if (invSearchInput) {
      invSearchInput.addEventListener("input", (e) => {
        inventorySearchQuery = e.target.value;
        renderInventory();
      });
    }

    // Inventory Dropdown category filter
    const invCatFilter = document.getElementById("inventory-category-filter");
    if (invCatFilter) {
      invCatFilter.addEventListener("change", (e) => {
        inventoryCategoryFilter = e.target.value;
        renderInventory();
      });
    }

    // Inventory Dropdown stock levels filter
    const invStockFilter = document.getElementById("inventory-stock-filter");
    if (invStockFilter) {
      invStockFilter.addEventListener("change", (e) => {
        inventoryStockFilter = e.target.value;
        renderInventory();
      });
    }

    // Orders Search
    const ordersSearch = document.getElementById("orders-search-input");
    if (ordersSearch) {
      ordersSearch.addEventListener("input", (e) => {
        ordersSearchQuery = e.target.value;
        renderOrders();
      });
    }

    // Orders payment method filter dropdown
    const ordersPayFilter = document.getElementById("orders-payment-filter");
    if (ordersPayFilter) {
      ordersPayFilter.addEventListener("change", (e) => {
        ordersPaymentFilter = e.target.value;
        renderOrders();
      });
    }

    // Customers Search
    const custSearchInput = document.getElementById("customers-search-input");
    if (custSearchInput) {
      custSearchInput.addEventListener("input", (e) => {
        customersSearchQuery = e.target.value;
        renderCustomers();
      });
    }

    // --- MODALS TOGGLERS ---
    
    // New Product modal opener
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

    // New Customer modal opener
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

    // Product Modal Closes handlers
    const prodClose = document.getElementById("modal-product-close-btn");
    if (prodClose) prodClose.addEventListener("click", () => closeModal("modal-product"));
    const prodCancel = document.getElementById("modal-product-cancel-btn");
    if (prodCancel) prodCancel.addEventListener("click", () => closeModal("modal-product"));

    // Customer Modal Closes handlers
    const custClose = document.getElementById("modal-customer-close-btn");
    if (custClose) custClose.addEventListener("click", () => closeModal("modal-customer"));
    const custCancel = document.getElementById("modal-customer-cancel-btn");
    if (custCancel) custCancel.addEventListener("click", () => closeModal("modal-customer"));

    // Receipt Close handler
    const receiptClose = document.getElementById("modal-receipt-close-btn");
    if (receiptClose) receiptClose.addEventListener("click", () => closeModal("modal-receipt"));
    const btnPrintReceipt = document.getElementById("btn-print-receipt");
    if (btnPrintReceipt) btnPrintReceipt.addEventListener("click", () => closeModal("modal-receipt"));

    // Form Submissions
    const formProduct = document.getElementById("form-product");
    if (formProduct) formProduct.addEventListener("submit", handleProductFormSubmit);
    
    const formCustomer = document.getElementById("form-customer");
    if (formCustomer) formCustomer.addEventListener("submit", handleCustomerFormSubmit);

    // Settings adjustments
    const resetSettingsBtn = document.getElementById("btn-settings-reset");
    if (resetSettingsBtn) resetSettingsBtn.addEventListener("click", resetToFactorySettings);
    
    const clearSettingsBtn = document.getElementById("btn-settings-clear");
    if (clearSettingsBtn) clearSettingsBtn.addEventListener("click", clearDatabase);

    const settingAudio = document.getElementById("setting-audio");
    if (settingAudio) {
      settingAudio.addEventListener("change", (e) => {
        state.settings.audio = e.target.checked;
        saveDatabase();
        showNotification("Preferencia de som atualizada!");
      });
    }

    const settingLowStock = document.getElementById("setting-lowstock-alert");
    if (settingLowStock) {
      settingLowStock.addEventListener("change", (e) => {
        state.settings.lowStockAlert = e.target.checked;
        saveDatabase();
        checkLowStock();
        renderDashboard();
        showNotification("Preferencia de alertas de estoque atualizada!");
      });
    }
  }

  // --- FLOATING FEEDBACK NOTIFICATIONS SYSTEM ---
  function showNotification(text, type = "success") {
    // Create element on the fly
    const toast = document.createElement("div");
    toast.className = `glass-panel toast-notification ${type}`;
    toast.textContent = text;
    
    // Core toast floating design rules
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
    
    // Animate in
    setTimeout(() => {
      toast.style.transform = "translateY(0) scale(1)";
      toast.style.opacity = "1";
    }, 50);
    
    // Remove after 3.5s
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
    return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  // Run initial setup
  init();
});
