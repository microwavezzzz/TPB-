// Searchable Dropdown Component with High Z-Index & Hover Elevation
window.SearchableDropdown = {
  create(config) {
    const container = document.getElementById(config.containerId);
    if (!container) return;

    const isCoffee = config.theme === 'coffee';
    const btnBg = isCoffee 
      ? 'dropdown-coffee-trigger' 
      : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white';

    container.innerHTML = `
      <div class="relative w-full min-w-[200px] max-w-[320px]" id="${config.containerId}_wrapper">
        <!-- Trigger Button -->
        <button type="button" id="${config.containerId}_btn" class="w-full px-3 py-2 text-xs sm:text-sm font-bold rounded-xl border flex items-center justify-between gap-2 shadow-sm transition-all text-left outline-none focus:ring-2 focus:ring-indigo-500 ${btnBg}">
          <span id="${config.containerId}_label" class="truncate">${config.defaultValue || config.placeholder}</span>
          <i class="fas fa-chevron-down text-xs opacity-60 transition-transform duration-200" id="${config.containerId}_arrow"></i>
        </button>

        <!-- Dropdown Menu Box (Fixed High Z-Index) -->
        <div id="${config.containerId}_menu" class="searchable-dropdown-menu absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 hidden transition-all max-h-[380px] flex flex-col">
          <!-- Search Input Inside Dropdown -->
          <div class="relative mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <i class="fas fa-search absolute left-2.5 top-2.5 text-slate-400 text-xs"></i>
            <input 
              type="text" 
              id="${config.containerId}_search" 
              placeholder="Ketik untuk mencari..." 
              class="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-transparent focus:border-indigo-500 outline-none"
              autocomplete="off"
            >
          </div>

          <!-- Options List (Scrollable) -->
          <div id="${config.containerId}_list" class="overflow-y-auto max-h-[280px] space-y-2 pr-1 custom-scrollbar">
            <!-- Rendered dynamically -->
          </div>
        </div>
      </div>
    `;

    const wrapper = document.getElementById(`${config.containerId}_wrapper`);
    const btn = document.getElementById(`${config.containerId}_btn`);
    const menu = document.getElementById(`${config.containerId}_menu`);
    const searchInput = document.getElementById(`${config.containerId}_search`);
    const listContainer = document.getElementById(`${config.containerId}_list`);
    const labelSpan = document.getElementById(`${config.containerId}_label`);
    const arrow = document.getElementById(`${config.containerId}_arrow`);

    let currentValue = config.defaultValue || '';

    const renderOptions = (filter = '') => {
      const q = filter.trim().toLowerCase();
      let html = '';
      let matchCount = 0;

      config.groups.forEach(group => {
        const filteredItems = group.items.filter(it => {
          return it.label.toLowerCase().includes(q) || (it.subtext && it.subtext.toLowerCase().includes(q)) || it.value.toLowerCase().includes(q);
        });

        if (filteredItems.length > 0) {
          html += `
            <div>
              <div class="px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                ${group.label}
              </div>
              <div class="space-y-0.5">
          `;

          filteredItems.forEach(it => {
            matchCount++;
            const isSelected = it.value === currentValue;
            const selectedStyle = isSelected 
              ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 font-bold' 
              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800';

            html += `
              <div 
                data-value="${it.value}" 
                class="dropdown-option px-2.5 py-1.5 rounded-lg text-xs cursor-pointer flex items-center justify-between transition-colors ${selectedStyle}"
              >
                <div class="truncate">
                  <span>${it.label}</span>
                  ${it.subtext ? `<span class="text-[10px] text-slate-400 ml-1.5">(${it.subtext})</span>` : ''}
                </div>
                ${isSelected ? '<i class="fas fa-check text-[11px] text-indigo-500"></i>' : ''}
              </div>
            `;
          });

          html += `</div></div>`;
        }
      });

      if (matchCount === 0) {
        html = '<div class="p-4 text-center text-xs text-slate-400 italic">Tidak ada opsi yang cocok</div>';
      }

      listContainer.innerHTML = html;

      listContainer.querySelectorAll('.dropdown-option').forEach(el => {
        el.addEventListener('click', () => {
          const val = el.getAttribute('data-value');
          currentValue = val;
          const found = config.groups.flatMap(g => g.items).find(i => i.value === val);
          labelSpan.textContent = found ? found.label : (val || config.placeholder);
          closeDropdown();
          if (config.onSelect) config.onSelect(val);
        });
      });
    };

    const openDropdown = () => {
      // Close other dropdowns
      document.querySelectorAll('.searchable-dropdown-menu').forEach(m => m.classList.add('hidden'));
      document.querySelectorAll('[id$="_arrow"]').forEach(a => a.classList.remove('rotate-180'));
      document.querySelectorAll('[id$="_wrapper"]').forEach(w => w.classList.remove('searchable-dropdown-active'));

      wrapper.classList.add('searchable-dropdown-active');
      menu.classList.remove('hidden');
      arrow.classList.add('rotate-180');
      searchInput.value = '';
      renderOptions('');

      menu.style.top = '';
      menu.style.bottom = '';
      menu.style.left = '';
      menu.style.right = '';
      menu.style.width = '';
      menu.classList.remove('mobile-dropdown-open');
      if (window.matchMedia('(max-width: 767px)').matches) {
        menu.classList.add('mobile-dropdown-open');
      }
      const menuRect = menu.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      const viewportPadding = 12;
      if (menuRect.bottom > window.innerHeight - viewportPadding && wrapperRect.top > menuRect.height + viewportPadding) {
        menu.style.top = 'auto';
        menu.style.bottom = 'calc(100% + 6px)';
      }

      setTimeout(() => searchInput.focus(), 50);
    };

    const closeDropdown = () => {
      wrapper.classList.remove('searchable-dropdown-active');
      menu.classList.add('hidden');
      arrow.classList.remove('rotate-180');
      menu.classList.remove('mobile-dropdown-open');
      menu.style.top = '';
      menu.style.bottom = '';
      menu.style.left = '';
      menu.style.right = '';
      menu.style.width = '';
    };

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (menu.classList.contains('hidden')) {
        openDropdown();
      } else {
        closeDropdown();
      }
    });

    searchInput.addEventListener('input', (e) => {
      renderOptions(e.target.value);
    });

    searchInput.addEventListener('click', (e) => e.stopPropagation());

    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) {
        closeDropdown();
      }
    });

    renderOptions('');

    return {
      setValue(val) {
        currentValue = val;
        const found = config.groups.flatMap(g => g.items).find(i => i.value === val);
        labelSpan.textContent = found ? found.label : (val || config.placeholder);
        renderOptions('');
      },
      getValue() {
        return currentValue;
      }
    };
  }
};
