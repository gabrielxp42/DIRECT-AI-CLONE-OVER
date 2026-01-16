
// --- CALCULATOR SYSTEM ---

const Calculator = {
    mode: 'simple',
    rollWidth: 58,
    margin: 0.5,
    separation: 0.5,
    simpleItem: { width: 10, height: 10, quantity: 10 },
    multiItems: [
        { id: Date.now(), width: 10, height: 10, quantity: 10 }
    ],
    aiTips: [
        "Gere orçamentos sem precisar montar arquivo! ✨",
        "Quer saber quantas logos cabem no metro? 🧠",
        "Ajuste as margens para simular o sangramento real. 🎯",
    ],
    tipIndex: 0,

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.initTips();
        this.initMobileView();
        this.update();
    },

    cacheDOM() {
        this.modal = document.getElementById('calculatorModal');
        this.paper = document.getElementById('calcPaper');
        this.usableArea = document.getElementById('calcUsableArea');
        this.resTotalMeters = document.getElementById('resTotalMeters');
        this.resSecondaryLabel = document.getElementById('resSecondaryLabel');
        this.resSecondaryValue = document.getElementById('resSecondaryValue');
        this.rulerRollValue = document.getElementById('rulerRollValue');
        this.multiItemsList = document.getElementById('multiItemsList');
        this.errorAlert = document.getElementById('calcErrorAlert');
        this.tipText = document.getElementById('tipText');
        this.perfWarning = document.getElementById('perfWarning');

        // Inputs
        this.inputs = {
            rollWidth: document.getElementById('calcRollWidth'),
            margin: document.getElementById('calcMargin'),
            imgWidth: document.getElementById('calcImgWidth'),
            imgHeight: document.getElementById('calcImgHeight'),
            quantity: document.getElementById('calcQuantity'),
            separation: document.getElementById('calcSeparation')
        };
    },

    bindEvents() {
        // Modal toggles
        document.querySelectorAll('.open-calculator-modal').forEach(btn => {
            btn.addEventListener('click', () => this.openModal());
        });
        document.getElementById('closeCalculatorModal').addEventListener('click', () => this.closeModal());

        // Mode tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.currentTarget.dataset.mode;
                this.switchMode(mode);
            });
        });

        // Quick roll width buttons
        document.querySelectorAll('.q-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const val = parseFloat(e.currentTarget.dataset.value);
                this.inputs.rollWidth.value = val;
                document.querySelectorAll('.q-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.update();
            });
        });

        // Input listeners
        Object.values(this.inputs).forEach(input => {
            if (input) input.addEventListener('input', () => this.update());
        });

        // Multi-item add
        const addBtn = document.getElementById('addMultiItem');
        if (addBtn) addBtn.addEventListener('click', () => this.addMultiItem());

        // Hover effects - Link inputs to preview
        document.querySelectorAll('[data-hover]').forEach(el => {
            el.addEventListener('mouseenter', (e) => this.highlightPreview(e.currentTarget.dataset.hover, true));
            el.addEventListener('mouseleave', (e) => this.highlightPreview(e.currentTarget.dataset.hover, false));
        });

        // Custom numeric control buttons
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.ctrl-btn');
            if (!btn) return;

            const action = btn.dataset.action;
            const targetId = btn.dataset.target;
            const step = parseFloat(btn.dataset.step) || 1;

            let input;
            if (targetId) {
                input = document.getElementById(targetId);
            } else {
                // If no direct target, look for sibling input (for multi-items)
                input = btn.parentElement.querySelector('input');
            }

            if (input) {
                let val = parseFloat(input.value) || 0;
                if (action === 'plus') val += step;
                if (action === 'minus') val -= step;

                // Constraints
                const min = parseFloat(input.min);
                const max = parseFloat(input.max);
                if (!isNaN(min)) val = Math.max(min, val);
                if (!isNaN(max)) val = Math.min(max, val);

                input.value = val % 1 === 0 ? val : val.toFixed(1);
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
    },

    initTips() {
        setInterval(() => {
            this.tipIndex = (this.tipIndex + 1) % this.aiTips.length;
            if (this.tipText) {
                this.tipText.style.opacity = '0';
                setTimeout(() => {
                    this.tipText.innerText = this.aiTips[this.tipIndex];
                    this.tipText.style.opacity = '1';
                }, 300);
            }
        }, 5000);
    },

    openModal() {
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        this.update();
    },

    closeModal() {
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
    },

    switchMode(mode) {
        this.mode = mode;
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        document.getElementById('simpleModeFields').style.display = mode === 'simple' ? 'block' : 'none';
        document.getElementById('multiModeFields').style.display = mode === 'multi' ? 'block' : 'none';
        this.update();
    },

    initMobileView() {
        const viewBtns = document.querySelectorAll('.view-btn');
        if (!viewBtns.length) return;

        // Default to edit view
        document.body.classList.add('mobile-view-edit');
        document.body.classList.remove('mobile-view-preview');

        viewBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;

                // Toggle active class on buttons
                viewBtns.forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');

                // Toggle body classes
                if (view === 'edit') {
                    document.body.classList.add('mobile-view-edit');
                    document.body.classList.remove('mobile-view-preview');
                } else {
                    document.body.classList.remove('mobile-view-edit');
                    document.body.classList.add('mobile-view-preview');
                    // Force render update when switching to preview to ensure layout is correct
                    this.update();
                }
            });
        });

        // Reset to desktop view on resize
        window.addEventListener('resize', () => {
            this.teleportFooter();
            if (window.innerWidth > 992) {
                document.body.classList.remove('mobile-view-edit', 'mobile-view-preview');
            } else {
                // Restore previous state or default to edit
                if (!document.body.classList.contains('mobile-view-preview')) {
                    document.body.classList.add('mobile-view-edit');
                }
            }
        });

        // Initial check
        this.teleportFooter();
    },

    teleportFooter() {
        const footer = document.querySelector('.calc-results-footer');
        const modalContent = document.querySelector('.calc-modal-content');
        const calcLeft = document.querySelector('.calc-left');
        const isMobile = window.innerWidth <= 992;

        if (!footer || !modalContent || !calcLeft) return;

        if (isMobile) {
            // Move to modal content (main container)
            if (footer.parentElement !== modalContent) {
                modalContent.appendChild(footer);
            }
        } else {
            // Move back to calc-left (desktop location)
            if (footer.parentElement !== calcLeft) {
                calcLeft.appendChild(footer);
            }
        }
    },

    update() {
        if (this.updateTimeout) clearTimeout(this.updateTimeout);
        this.updateTimeout = setTimeout(() => {
            this.readState();
            const results = this.calculate();
            this.render(results);
            this.checkErrors();
        }, 150);
    },

    readState() {
        this.rollWidth = parseFloat(this.inputs.rollWidth.value) || 58;
        this.margin = parseFloat(this.inputs.margin.value) || 0;
        this.separation = parseFloat(this.inputs.separation.value) || 0;

        if (this.mode === 'simple') {
            this.simpleItem = {
                width: parseFloat(this.inputs.imgWidth.value) || 1,
                height: parseFloat(this.inputs.imgHeight.value) || 1,
                quantity: parseInt(this.inputs.quantity.value) || 1
            };
        }
    },

    calculate() {
        const usableWidth = this.rollWidth - (this.margin * 2);

        if (this.mode === 'simple') {
            const { width, height, quantity } = this.simpleItem;
            const totalImgWidth = width + this.separation;
            const imagesPerRow = Math.max(1, Math.floor((usableWidth + this.separation) / totalImgWidth));
            const totalRows = Math.ceil(quantity / imagesPerRow);

            const contentHeight = (totalRows * height) + (Math.max(0, totalRows - 1) * this.separation);
            const totalHeightCm = contentHeight + (this.margin * 2);

            const contentWidth = (imagesPerRow * width) + (Math.max(0, imagesPerRow - 1) * this.separation);
            const imagesPerMeter = (100 / (height + this.separation)) * imagesPerRow;

            return {
                mode: 'simple',
                totalMeters: totalHeightCm / 100,
                secondaryLabel: 'Logos por Metro',
                secondaryValue: `${Math.floor(imagesPerMeter)} un`,
                imagesPerRow,
                totalRows,
                contentWidth,
                contentHeight,
                totalHeightCm
            };
        } else {
            let renderedCount = 0;
            const previewLimit = 200;

            const itemsCalculated = this.multiItems.map(item => {
                const totalImgWidth = item.width + this.separation;
                const imagesPerRow = Math.max(1, Math.floor((usableWidth + this.separation) / totalImgWidth));
                const totalRows = Math.ceil(item.quantity / imagesPerRow);

                const contentHeight = (totalRows * item.height) + (Math.max(0, totalRows - 1) * this.separation);
                const heightWithGapCm = contentHeight + this.separation;

                const previewQty = Math.min(item.quantity, Math.max(0, previewLimit - renderedCount));
                renderedCount += previewQty;
                const previewRows = Math.ceil(previewQty / imagesPerRow);
                const previewContentHeight = previewQty > 0
                    ? (previewRows * item.height) + (Math.max(0, previewRows - 1) * this.separation)
                    : 0;

                return {
                    ...item,
                    imagesPerRow,
                    totalRows,
                    contentHeight,
                    heightWithGapCm,
                    previewQty,
                    previewContentHeight,
                    groupWidth: (imagesPerRow * item.width) + (Math.max(0, imagesPerRow - 1) * this.separation)
                };
            });

            const totalContentHeight = itemsCalculated.reduce((acc, item) => acc + item.heightWithGapCm, 0) - this.separation;
            const totalHeightCm = totalContentHeight + (this.margin * 2);

            return {
                mode: 'multi',
                totalMeters: Math.max(0, totalHeightCm / 100),
                secondaryLabel: 'Total de Itens',
                secondaryValue: `${this.multiItems.reduce((a, b) => a + b.quantity, 0)} un`,
                totalHeightCm,
                items: itemsCalculated,
                hasWarning: this.multiItems.reduce((a, b) => a + b.quantity, 0) > previewLimit
            };
        }
    },

    render(res) {
        // Update Results Cards
        this.resTotalMeters.innerText = res.totalMeters.toFixed(2) + 'm';
        this.resSecondaryLabel.innerText = res.secondaryLabel;
        this.resSecondaryValue.innerText = res.secondaryValue;
        this.rulerRollValue.innerText = this.rollWidth;

        // Update Gabi Summary
        const gabiText = document.getElementById('gabiSummaryText');
        if (gabiText) {
            if (res.mode === 'simple') {
                const usableWidth = this.rollWidth - (this.margin * 2);
                const efficiency = Math.round((res.contentWidth / usableWidth) * 100);
                gabiText.innerHTML = `Cabem <strong>${res.imagesPerRow} logos</strong> por linha. Sua produção terá <strong>${res.totalRows} linhas</strong> de imagens. Aproveitamento de <strong>${efficiency}%</strong> da largura útil.`;
            } else {
                const totalItems = this.multiItems.reduce((acc, i) => acc + i.quantity, 0);
                gabiText.innerHTML = `Otimizei <strong>${totalItems} itens</strong> diferentes no seu rolo de ${this.rollWidth}cm. A produção total ocupará <strong>${res.totalMeters.toFixed(2)}m</strong> com alta eficiência.`;
            }
        }

        // Paper Scaling - Proportional to real consumption
        const visualHeightCm = Math.max(5, res.totalHeightCm);

        // Safety: width is always 100% of the scroll container
        this.paper.style.width = '100%';

        // CSS aspect-ratio fails at extreme values (> 100). 
        // We use explicit height based on the physical rollWidth to maintain 1:1 scale
        const paperWidth = this.paper.offsetWidth || 500;
        const scaleFactor = paperWidth / this.rollWidth;
        const pixelHeight = visualHeightCm * scaleFactor;

        this.paper.style.height = `${pixelHeight}px`;
        this.paper.style.minHeight = `${pixelHeight}px`;
        this.paper.style.aspectRatio = 'auto'; // Reset aspect ratio

        // Margin Overlays - Proportional to paper dimensions
        const marginPct = (this.margin / this.rollWidth) * 100;
        const topMarginPct = (this.margin / visualHeightCm) * 100;

        document.getElementById('calcMarginLeft').style.width = marginPct + '%';
        document.getElementById('calcMarginRight').style.width = marginPct + '%';

        // Usable Area - Perfectly aligned with margins
        const usableWidthPct = 100 - (marginPct * 2);
        this.usableArea.style.left = marginPct + '%';
        this.usableArea.style.width = (100 - (marginPct * 2)) + '%'; // Recalculate usableWidthPct
        this.usableArea.style.top = topMarginPct + '%';
        this.usableArea.style.bottom = topMarginPct + '%';

        // Render Logos with 1:1 logic
        this.usableArea.innerHTML = '';
        const fragment = document.createDocumentFragment();

        if (res.mode === 'simple') {
            const previewLimit = 150;
            const displayQty = Math.min(this.simpleItem.quantity, previewLimit);
            this.perfWarning.style.display = this.simpleItem.quantity > previewLimit ? 'flex' : 'none';

            const grid = document.createElement('div');
            grid.style.display = 'grid';
            grid.style.width = `${(res.contentWidth / (this.rollWidth - (this.margin * 2))) * 100}%`;
            grid.style.margin = '0 auto';
            grid.style.gridTemplateColumns = `repeat(${res.imagesPerRow}, 1fr)`;
            grid.style.columnGap = `${(this.separation / res.contentWidth) * 100}%`;
            grid.style.rowGap = `${(this.separation / res.contentHeight) * 100}%`;

            for (let i = 0; i < displayQty; i++) {
                const item = document.createElement('div');
                item.className = 'logo-item';
                item.style.aspectRatio = `${this.simpleItem.width} / ${this.simpleItem.height}`;
                if (this.simpleItem.width > 3) {
                    item.innerHTML = `<span>${this.simpleItem.width}x${this.simpleItem.height}</span>`;
                }
                grid.appendChild(item);
            }
            this.usableArea.appendChild(grid);
        } else {
            this.perfWarning.style.display = res.hasWarning ? 'flex' : 'none';
            const usableAreaHeightCm = res.totalHeightCm - (this.margin * 2);

            res.items.forEach((item, idx) => {
                const blockWrap = document.createElement('div');
                blockWrap.style.width = `${(item.groupWidth / (this.rollWidth - (this.margin * 2))) * 100}%`;
                blockWrap.style.margin = '0 auto';
                blockWrap.style.marginBottom = `${(this.separation / (this.rollWidth - (this.margin * 2))) * 100}%`;

                const grid = document.createElement('div');
                grid.style.display = 'grid';
                grid.style.gridTemplateColumns = `repeat(${item.imagesPerRow}, 1fr)`;
                grid.style.columnGap = `${(this.separation / item.groupWidth) * 100}%`;
                grid.style.rowGap = `${(this.separation / item.contentHeight) * 100}%`;

                for (let i = 0; i < item.previewQty; i++) {
                    const el = document.createElement('div');
                    el.className = 'logo-item';
                    const colors = idx % 2 === 0 ? ['#facc15', '#eab308'] : ['#a855f7', '#9333ea'];
                    el.style.background = `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`;
                    el.style.aspectRatio = `${item.width} / ${item.height}`;
                    grid.appendChild(el);
                }
                blockWrap.appendChild(grid);
                fragment.appendChild(blockWrap);
            });
            this.usableArea.appendChild(fragment);
        }
    },

    checkErrors() {
        let hasError = false;
        if (this.mode === 'simple') {
            hasError = (this.simpleItem.width + (this.margin * 2)) > this.rollWidth;
        } else {
            hasError = this.multiItems.some(item => (item.width + (this.margin * 2)) > this.rollWidth);
        }
        this.errorAlert.style.display = hasError ? 'flex' : 'none';
    },

    addMultiItem() {
        this.multiItems.push({ id: Date.now(), width: 10, height: 10, quantity: 10 });
        this.renderMultiItemsList();
        this.update();
    },

    removeMultiItem(id) {
        if (this.multiItems.length > 1) {
            this.multiItems = this.multiItems.filter(item => item.id !== id);
            this.renderMultiItemsList();
            this.update();
        }
    },

    renderMultiItemsList() {
        this.multiItemsList.innerHTML = '';
        this.multiItems.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'multi-item-row';
            row.innerHTML = `
                <div class="item-badge">#${index + 1}</div>
                <button class="remove-item" onclick="Calculator.removeMultiItem(${item.id})">
                    <i data-lucide="trash-2"></i>
                </button>
                <div class="input-grid">
                    <div class="field">
                        <label>L x A (cm)</label>
                        <div style="display: flex; gap: 8px;">
                            <div class="num-input-wrap" style="flex: 1;">
                                <input type="number" value="${item.width}" oninput="Calculator.updateMultiItem(${item.id}, 'width', this.value)" min="1">
                            </div>
                            <div class="num-input-wrap" style="flex: 1;">
                                <input type="number" value="${item.height}" oninput="Calculator.updateMultiItem(${item.id}, 'height', this.value)" min="1">
                            </div>
                        </div>
                    </div>
                    <div class="field">
                        <label>Quantidade</label>
                        <div class="num-input-wrap">
                            <button class="ctrl-btn" data-action="minus"><i data-lucide="minus"></i></button>
                            <input type="number" value="${item.quantity}" oninput="Calculator.updateMultiItem(${item.id}, 'quantity', this.value)" min="1">
                            <button class="ctrl-btn" data-action="plus"><i data-lucide="plus"></i></button>
                        </div>
                    </div>
                </div>
            `;
            this.multiItemsList.appendChild(row);
        });
        if (window.lucide) lucide.createIcons();
    },

    updateMultiItem(id, field, value) {
        const item = this.multiItems.find(i => i.id === id);
        if (item) {
            item[field] = parseFloat(value) || 0;
            this.update();
        }
    },

    highlightPreview(field, active) {
        if (!active) {
            this.paper.classList.remove('highlight-margin', 'highlight-separation', 'highlight-imagesize', 'highlight-quantity');
            document.querySelectorAll('.margin-overlay').forEach(el => el.style.background = '');
            this.usableArea.style.background = '';
            return;
        }

        if (field === 'margin') {
            document.querySelectorAll('.margin-overlay').forEach(el => el.style.background = 'rgba(16, 185, 129, 0.4)');
        } else if (field === 'separation') {
            this.usableArea.style.background = 'rgba(168, 85, 247, 0.1)';
        } else if (field === 'imageSize') {
            this.usableArea.style.background = 'rgba(255, 242, 0, 0.05)';
        }
    }
};

// Initial scroll reveals
const revealElements = document.querySelectorAll('.feature-card, .hero-content, .hero-visual, .cta-card');
const revealOnScroll = () => {
    const triggerBottom = window.innerHeight * 0.8;
    revealElements.forEach(el => {
        const top = el.getBoundingClientRect().top;
        if (top < triggerBottom) el.classList.add('reveal-active');
    });
};

window.addEventListener('scroll', revealOnScroll);
window.addEventListener('load', () => {
    revealOnScroll();
    Calculator.init();
    if (window.lucide) lucide.createIcons();
});

console.log('🚀 Direct AI Landing Page Loaded Successfully.');
