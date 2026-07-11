import { App } from './firebase-context.js';

Object.assign(App, {
    currentYearMonth() {
        return this.toYearMonth(new Date());
    },

    toYearMonth(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    },

    addMonthsToYearMonth(yearMonth, offset) {
        const [year, month] = yearMonth.split('-').map(Number);
        return this.toYearMonth(new Date(year, month - 1 + offset, 1));
    },

    addMonthsToDate(dateString, offset) {
        const [year, month, day] = dateString.split('-').map(Number);
        const targetMonth = new Date(year, month - 1 + offset, 1);
        const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
        const safeDay = Math.min(day, lastDay);
        return `${targetMonth.getFullYear()}-${String(targetMonth.getMonth() + 1).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
    },

    isValidDateString(value) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
        const [year, month, day] = value.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
    },

    isOverdue(dateString) {
        if (!this.isValidDateString(dateString)) return false;
        const [year, month, day] = dateString.split('-').map(Number);
        const due = new Date(year, month - 1, day, 23, 59, 59, 999);
        return due < new Date();
    },

    selectTargets(groupedItems, current, scope, dateField) {
        const sorted = [...groupedItems].sort((a, b) => String(a[dateField] || '').localeCompare(String(b[dateField] || '')) || Number(a.installmentNumber || 0) - Number(b.installmentNumber || 0));
        const currentKey = String(current[dateField] || '');
        if (scope === 'single') return [current];
        if (scope === 'forward') return sorted.filter(item => String(item[dateField] || '') >= currentKey);
        if (scope === 'backward') return sorted.filter(item => String(item[dateField] || '') <= currentKey);
        return sorted;
    },

    renderMonthFilter(label = 'Mês') {
        return `<div class="flex items-center bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-11"><button type="button" onclick="App.changeMonth(-1)" class="w-10 h-full text-slate-500 hover:text-blue-600 hover:bg-slate-50"><i class="fa-solid fa-chevron-left text-sm"></i></button><div class="relative w-40 h-full flex flex-col items-center justify-center hover:bg-slate-50"><input type="month" value="${this.escapeAttr(this.ui.selectedMonth || this.currentYearMonth())}" onchange="App.selectSpecificMonth(this.value)" class="native-picker"><span class="text-[9px] text-slate-400 font-black uppercase leading-none">${this.escapeHtml(label)}</span><strong class="text-sm text-blue-700 leading-tight">${this.formatMonthSmall(this.ui.selectedMonth || this.currentYearMonth())}</strong></div><button type="button" onclick="App.changeMonth(1)" class="w-10 h-full text-slate-500 hover:text-blue-600 hover:bg-slate-50"><i class="fa-solid fa-chevron-right text-sm"></i></button></div>`;
    },

    triggerFade() {
        const container = document.getElementById('app-container');
        if (!container) return;
        container.classList.remove('fade-in');
        void container.offsetWidth;
        container.classList.add('fade-in');
    },

    formatMoney(value) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
    },

    formatMonthSmall(yearMonth) {
        if (!yearMonth) return '';
        const [year, month] = yearMonth.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        const monthName = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
        return `${monthName} / ${year}`;
    },

    formatDateBR(dateString) {
        if (!this.isValidDateString(dateString)) return 'Data inválida';
        const [year, month, day] = dateString.split('-').map(Number);
        return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
    },

    formatDateTimeBR(value) {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    },

    applyCurrencyMask(input) {
        const digits = input.value.replace(/\D/g, '');
        if (!digits) {
            input.value = '';
            return;
        }
        input.value = this.formatMoney(Number(digits) / 100);
    },

    unmaskCurrency(value) {
        if (!value) return 0;
        return Number(value.replace(/[^0-9,-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
    },

    applyPhoneMask(input) {
        let value = input.value.replace(/\D/g, '').slice(0, 11);
        if (value.length > 10) value = value.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
        else if (value.length > 6) value = value.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
        else if (value.length > 2) value = value.replace(/^(\d{2})(\d+)/, '($1) $2');
        else if (value.length) value = value.replace(/^(\d{0,2})/, '($1');
        input.value = value;
    },

    escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[character]));
    },

    escapeAttr(value) {
        return this.escapeHtml(value).replace(/'/g, '&#39;');
    },

    escapeJs(value) {
        return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, ' ');
    },

    toInlineJson(value) {
        return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
    },
});
