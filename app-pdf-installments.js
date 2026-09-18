import { App } from './firebase-context.js';

Object.assign(App, {
    getPdfInstallmentLabel(item) {
        if (item?.isRecurring) return 'Recorrente';
        const total = Number(item?.totalInstallments || 1);
        const number = Number(item?.installmentNumber || 1);
        return total > 1 ? `${number}/${total}` : 'Única';
    },

    async generateCardPDF() {
        const button = document.getElementById('btn-pdf');
        if (!button || !this.ui.selectedCard) return;
        const original = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Gerando';

        try {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF();
            const card = this.ui.selectedCard;

            let transactions = this.data.transactions.filter(item =>
                item.cardId === card.id && item.invoiceMonth === this.ui.selectedMonth
            );
            if (this.ui.filterCategory) {
                transactions = transactions.filter(item =>
                    (item.categoryName || 'Geral') === this.ui.filterCategory
                );
            }

            transactions.sort((a, b) =>
                (a.categoryName || '').localeCompare(b.categoryName || '') ||
                (a.description || '').localeCompare(b.description || '')
            );

            const total = transactions.reduce((sum, item) => sum + Number(item.amount || 0), 0);

            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(18);
            pdf.setTextColor(30, 64, 175);
            pdf.text(`Fatura - ${card.name}`, 14, 20);

            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(10);
            pdf.setTextColor(100, 116, 139);
            pdf.text(
                `Referência: ${this.formatMonthSmall(this.ui.selectedMonth)} | Vencimento: dia ${card.dueDate}`,
                14,
                28
            );

            const rows = transactions.map(item => [
                item.description || 'Gasto',
                item.categoryName || 'Geral',
                this.getPdfInstallmentLabel(item),
                this.formatMoney(item.amount)
            ]);

            if (!rows.length) {
                rows.push(['Nenhum lançamento', '-', '-', this.formatMoney(0)]);
            }

            pdf.autoTable({
                startY: 36,
                head: [['Descrição', 'Categoria', 'Parcela', 'Valor']],
                body: rows,
                theme: 'grid',
                headStyles: { fillColor: [30, 64, 175] },
                styles: { fontSize: 9 },
                columnStyles: {
                    2: { halign: 'center', cellWidth: 28 },
                    3: { halign: 'right', cellWidth: 32 }
                }
            });

            const finalY = pdf.lastAutoTable?.finalY || 45;
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(13);
            pdf.setTextColor(220, 38, 38);
            pdf.text(`TOTAL: ${this.formatMoney(total)}`, 14, finalY + 10);

            const safeCardName = String(card.name || 'Cartao').replace(/[^a-zA-Z0-9_-]+/g, '_');
            const fileName = `Fatura_${safeCardName}_${this.ui.selectedMonth}.pdf`;

            await this.shareOrDownloadPDF(
                pdf,
                fileName,
                `Fatura ${card.name}`,
                `Fatura de ${this.formatMonthSmall(this.ui.selectedMonth)}.`
            );
        } catch (error) {
            console.error(error);
            this.showToast('Erro ao gerar PDF.', 'error');
        } finally {
            button.innerHTML = original;
            button.disabled = false;
        }
    },

    async generateAccountsPDF() {
        const button = document.getElementById('btn-pdf');
        if (!button) return;
        const original = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Gerando';

        try {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF();
            const kind = this.ui.accountKind;
            const isPayable = kind === 'payable';
            const accounts = this.getVisibleAccountsForCurrentFilters();

            const total = accounts.reduce((sum, item) => sum + Number(item.amount || 0), 0);
            const settledTotal = accounts
                .filter(item => item.settled)
                .reduce((sum, item) => sum + Number(item.amount || 0), 0);

            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(18);
            pdf.setTextColor(
                isPayable ? 185 : 5,
                isPayable ? 28 : 150,
                isPayable ? 28 : 105
            );
            pdf.text(isPayable ? 'Contas a Pagar' : 'Contas a Receber', 14, 20);

            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(10);
            pdf.setTextColor(100, 116, 139);
            pdf.text(
                `Referência: ${this.formatMonthSmall(this.ui.selectedMonth)} | Período: ${this.getAccountPeriodLabel()}`,
                14,
                28
            );

            const rows = accounts.map(item => [
                item.description || 'Conta',
                this.formatDateBR(item.dueDate),
                item.categoryName || 'Geral',
                this.getPdfInstallmentLabel(item),
                item.settled
                    ? (isPayable ? 'Pago' : 'Recebido')
                    : (this.isOverdue(item.dueDate) ? 'Atrasado' : 'Pendente'),
                this.formatMoney(item.amount)
            ]);

            if (!rows.length) {
                rows.push(['Nenhuma conta', '-', '-', '-', '-', this.formatMoney(0)]);
            }

            pdf.autoTable({
                startY: 36,
                head: [['Descrição', 'Vencimento', 'Categoria', 'Parcela', 'Situação', 'Valor']],
                body: rows,
                theme: 'grid',
                headStyles: {
                    fillColor: isPayable ? [185, 28, 28] : [5, 150, 105]
                },
                styles: { fontSize: 8 },
                columnStyles: {
                    1: { cellWidth: 24 },
                    3: { halign: 'center', cellWidth: 20 },
                    4: { cellWidth: 24 },
                    5: { halign: 'right', cellWidth: 29 }
                }
            });

            const finalY = pdf.lastAutoTable?.finalY || 45;
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(11);
            pdf.setTextColor(51, 65, 85);
            pdf.text(`Total filtrado: ${this.formatMoney(total)}`, 14, finalY + 9);
            pdf.text(
                `${isPayable ? 'Pago' : 'Recebido'}: ${this.formatMoney(settledTotal)}`,
                14,
                finalY + 16
            );
            pdf.text(
                `Pendente: ${this.formatMoney(total - settledTotal)}`,
                14,
                finalY + 23
            );

            const periodSuffix = this.getAccountPeriodLabel().replace(/[^a-zA-Z0-9]+/g, '_');
            const fileName =
                `${isPayable ? 'Contas_a_Pagar' : 'Contas_a_Receber'}_${this.ui.selectedMonth}_${periodSuffix}.pdf`;

            await this.shareOrDownloadPDF(
                pdf,
                fileName,
                isPayable ? 'Contas a Pagar' : 'Contas a Receber',
                `Relatório de ${this.formatMonthSmall(this.ui.selectedMonth)} — ${this.getAccountPeriodLabel()}.`
            );
        } catch (error) {
            console.error(error);
            this.showToast('Erro ao gerar PDF.', 'error');
        } finally {
            button.innerHTML = original;
            button.disabled = false;
        }
    }
});
