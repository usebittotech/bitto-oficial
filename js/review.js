import { auth, onAuthStateChanged } from './firebase-init.js';
import { checkUsageLimit, incrementUsage } from './userManager.js';

const themeToggle = document.getElementById('themeToggle');
const generateBtn = document.getElementById('generateBtn');
const topicInput = document.getElementById('topicInput');
const contentInput = document.getElementById('contentInput');
const reviewOutput = document.getElementById('reviewOutput');
const emptyState = document.getElementById('emptyState');
const outputActions = document.getElementById('outputActions');
const copyBtn = document.getElementById('copyBtn');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
const reviewTitle = document.getElementById('reviewTitle');
const statusText = document.getElementById('statusText');

let currentUser = null;

// --- AUTH ---
onAuthStateChanged(auth, (user) => {
    if (user) currentUser = user;
    else window.location.href = 'login.html';
});

// --- EVENTO DE GERAR ---
if(generateBtn) {
    generateBtn.addEventListener('click', async () => {
        const topic = topicInput ? topicInput.value : "";
        const content = contentInput ? contentInput.value : "";

        if (!content.trim() && !topic.trim()) {
            showToast('Cole um texto ou defina um tema!', 'error');
            return;
        }

        if(!currentUser) return;

        // 1. LIMIT CHECK (Plano)
        const canUse = await checkUsageLimit(currentUser.uid, 'review');
        if (!canUse) {
            showToast('🔒 Limite mensal atingido (3/3).', 'error');
            return;
        }

        // UI Loading
        const originalText = generateBtn.innerHTML;
        generateBtn.innerHTML = '<span class="loader"></span> BITTO PROCESSANDO...';
        generateBtn.classList.add('btn-loading');
        generateBtn.disabled = true;
        if(statusText) {
            statusText.style.display = 'block';
            statusText.innerText = "Gerando síntese técnica...";
        }

        try {
            const prompt = `
                BITTO AI - Modo Professor Técnico.
                Tema: "${topic}". Conteúdo: "${content}".
                Gere: 1. Resumo Teórico (Conceitos, Aplicação). 2. Simulado (15 questões variadas). 3. Gabarito.
                Formato: Markdown bonito. Idioma: PT-BR.
            `;

            const response = await fetch('../api/generate', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "gemini-2.5-flash-lite",
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            if (!response.ok) throw new Error("Erro no Servidor");

            const data = await response.json();
            const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!aiResponse) throw new Error("A IA não gerou resposta.");

            // Render Markdown
            if (typeof marked !== 'undefined') {
                reviewOutput.innerHTML = marked.parse(aiResponse);
            } else {
                reviewOutput.innerHTML = `<pre style="white-space: pre-wrap;">${aiResponse}</pre>`;
            }
            
            // 2. INCREMENT LIMIT (Plano)
            await incrementUsage(currentUser.uid, 'review');
            
            // --- 3. XP E ESTATÍSTICAS (NOVO) ---
            if(window.recordActivity) window.recordActivity('review', 1);
            if(window.awardXP) window.awardXP(20, 'Resumo IA');

            // UI Sucesso
            if(emptyState) emptyState.style.display = 'none';
            reviewOutput.style.display = 'block';
            if(outputActions) outputActions.style.display = 'flex';
            if(topic && reviewTitle) reviewTitle.innerText = `Revisão: ${topic}`;
            showToast('Revisão gerada com sucesso!', 'success');

        } catch (error) {
            console.error(error);
            showToast('Erro ao gerar.', 'error');
            statusText.innerText = "Erro na conexão.";
        } finally {
            generateBtn.innerHTML = originalText;
            generateBtn.classList.remove('btn-loading');
            generateBtn.disabled = false;
            if(statusText) setTimeout(() => statusText.style.display = 'none', 5000);
        }
    });
}

// --- UTILS ---
if(downloadPdfBtn) {
    downloadPdfBtn.addEventListener('click', () => {
        const jsPDFLib = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
        if (!jsPDFLib) { alert("Erro: Lib jsPDF não carregada."); return; }

        const doc = new jsPDFLib({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        const source = document.getElementById('reviewOutput');

        const pageW  = doc.internal.pageSize.getWidth();
        const pageH  = doc.internal.pageSize.getHeight();
        const margin = 15;
        const maxW   = pageW - margin * 2;
        let y        = margin;

        function addPage() { doc.addPage(); y = margin; }
        function checkY(needed) { if (y + needed > pageH - margin) addPage(); }

        function processNode(node) {
            if (node.nodeType === Node.TEXT_NODE) return;
            const tag = node.tagName ? node.tagName.toLowerCase() : '';
            const text = (node.innerText || node.textContent || '').trim();

            if (!text && tag !== 'hr') return;

            if (tag === 'h1') {
                checkY(14);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(16);
                doc.setTextColor(17, 17, 17);
                const lines = doc.splitTextToSize(text, maxW);
                doc.text(lines, margin, y);
                y += lines.length * 8 + 5;

            } else if (tag === 'h2') {
                checkY(14);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(13);
                doc.setTextColor(0, 53, 255);
                const lines = doc.splitTextToSize(text, maxW);
                doc.text(lines, margin, y);
                y += lines.length * 7 + 2;
                doc.setDrawColor(170, 201, 0);
                doc.setLineWidth(0.5);
                doc.line(margin, y, margin + maxW, y);
                y += 5;

            } else if (tag === 'h3') {
                checkY(10);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(11);
                doc.setTextColor(17, 17, 17);
                const lines = doc.splitTextToSize(text, maxW);
                doc.text(lines, margin, y);
                y += lines.length * 6 + 4;

            } else if (tag === 'p') {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(30, 30, 30);
                const lines = doc.splitTextToSize(text, maxW);
                checkY(lines.length * 5.5);
                doc.text(lines, margin, y);
                y += lines.length * 5.5 + 4;

            } else if (tag === 'li') {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(30, 30, 30);
                const lines = doc.splitTextToSize('• ' + text, maxW - 6);
                checkY(lines.length * 5.5);
                doc.text(lines, margin + 5, y);
                y += lines.length * 5.5 + 2;

            } else if (tag === 'blockquote') {
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(10);
                doc.setTextColor(100, 100, 100);
                const lines = doc.splitTextToSize(text, maxW - 10);
                const blockH = lines.length * 5.5 + 6;
                checkY(blockH);
                doc.setFillColor(249, 255, 224);
                doc.rect(margin, y - 4, maxW, blockH, 'F');
                doc.setDrawColor(170, 201, 0);
                doc.setLineWidth(1.5);
                doc.line(margin, y - 4, margin, y - 4 + blockH);
                doc.text(lines, margin + 6, y);
                y += blockH + 3;

            } else if (tag === 'hr') {
                checkY(6);
                doc.setDrawColor(200, 200, 200);
                doc.setLineWidth(0.3);
                doc.line(margin, y, margin + maxW, y);
                y += 6;

            } else if (['ul', 'ol', 'div', 'section', 'article'].includes(tag)) {
                node.childNodes.forEach(child => processNode(child));

            } else if (!['strong', 'b', 'em', 'i', 'span', 'a', 'code'].includes(tag)) {
                node.childNodes.forEach(child => processNode(child));
            }
        }

        // Cabeçalho do PDF
        const topic = document.getElementById('reviewTitle')?.innerText || 'Revisão Bitto';
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.setTextColor(0, 53, 255);
        const titleLines = doc.splitTextToSize(topic, maxW);
        doc.text(titleLines, margin, y);
        y += titleLines.length * 10 + 2;
        doc.setDrawColor(204, 255, 0);
        doc.setLineWidth(1.5);
        doc.line(margin, y, margin + maxW, y);
        y += 8;

        // Processa conteúdo
        source.childNodes.forEach(node => processNode(node));

        doc.save('Bitto_Resumo.pdf');
    });
}

if(copyBtn) {
    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(reviewOutput.innerText)
            .then(() => showToast('Copiado!', 'success'));
    });
}

if(themeToggle) {
    themeToggle.addEventListener('click', () => {
        const html = document.documentElement;
        if (html.getAttribute('data-theme') === 'dark') html.setAttribute('data-theme', 'light');
        else html.setAttribute('data-theme', 'dark');
    });
}

function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if(!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${type==='success'?'✅':'⚠️'}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => { toast.remove() }, 3500);
}
