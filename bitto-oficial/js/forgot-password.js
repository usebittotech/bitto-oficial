import { auth } from './firebase-init.js';
// Importação direta do CDN para garantir compatibilidade
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const resetForm = document.getElementById('resetForm');
const themeToggle = document.getElementById('themeToggle');
const pageTitle = document.getElementById('pageTitle');
const pageSubtitle = document.getElementById('pageSubtitle');
const submitBtn = document.getElementById('submitBtn');
const tabBtns = document.querySelectorAll('.tab-btn');
const emailInput = document.getElementById('resetEmail');

// Estado inicial
let currentMode = 'forgot';

// --- ATIVAÇÃO AUTOMÁTICA PELA URL (O SEGREDO ESTÁ AQUI) ---
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'activate') {
        const activateBtn = document.querySelector('.tab-btn[data-mode="activate"]');
        if (activateBtn) activateBtn.click();
    }
});

// --- CONTROLE DAS ABAS ---
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Atualiza classe active
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Atualiza modo e interface
        currentMode = btn.dataset.mode;
        updateUI();
    });
});

function updateUI() {
    if (currentMode === 'activate') {
        pageTitle.innerText = "Primeiro Acesso";
        pageSubtitle.innerText = "Defina sua senha para acessar o plano.";
        submitBtn.innerText = "ENVIAR LINK DE ATIVAÇÃO";
        emailInput.placeholder = "E-mail usado na compra";
        emailInput.focus();
    } else {
        pageTitle.innerText = "Recuperar Senha";
        pageSubtitle.innerText = "Vamos enviar um link para você.";
        submitBtn.innerText = "ENVIAR LINK DE RECUPERAÇÃO";
        emailInput.placeholder = "seu@email.com";
    }
}

// --- TEMA ---
const htmlElement = document.documentElement;
const sunIcon = document.querySelector('.icon-sun');
const moonIcon = document.querySelector('.icon-moon');

if (localStorage.getItem('bitto_theme') === 'dark') setTheme('dark');

function setTheme(theme) {
    if (theme === 'dark') {
        htmlElement.setAttribute('data-theme', 'dark');
        if(sunIcon) sunIcon.style.display = 'none';
        if(moonIcon) moonIcon.style.display = 'block';
        localStorage.setItem('bitto_theme', 'dark');
    } else {
        htmlElement.setAttribute('data-theme', 'light');
        if(sunIcon) sunIcon.style.display = 'block';
        if(moonIcon) moonIcon.style.display = 'none';
        localStorage.setItem('bitto_theme', 'light');
    }
}

if(themeToggle) {
    themeToggle.addEventListener('click', () => {
        const current = htmlElement.getAttribute('data-theme');
        setTheme(current === 'dark' ? 'light' : 'dark');
    });
}

// --- ENVIO DO FORMULÁRIO ---
resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const originalText = submitBtn.innerHTML;

    if(!email) {
        showToast("Digite seu e-mail.", "error");
        return;
    }

    try {
        submitBtn.innerHTML = '<span class="loader"></span> Processando...';
        submitBtn.classList.add('btn-loading');

        // Envia o email (funciona tanto para recuperação quanto ativação)
        await sendPasswordResetEmail(auth, email);

        if (currentMode === 'activate') {
            showToast("Link enviado! Verifique seu e-mail para criar a senha.", "success");
        } else {
            showToast("E-mail de recuperação enviado!", "success");
        }
        
        resetForm.reset();
        
        // Redireciona após 5s
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 5000);

    } catch (error) {
        console.error(error);
        let msg = "Erro ao enviar e-mail.";
        
        // Mensagens personalizadas por erro
        if(error.code === 'auth/user-not-found') {
            msg = currentMode === 'activate' 
                ? "E-mail não encontrado. Verifique o e-mail da compra." 
                : "E-mail não cadastrado.";
        }
        if(error.code === 'auth/invalid-email') msg = "E-mail inválido.";
        
        showToast(msg, "error");
        
        submitBtn.innerHTML = originalText;
        submitBtn.classList.remove('btn-loading');
    }
});

function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if(!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let icon = type==='success'?'✅':'⚠️';
    if(type==='error') icon='❌';
    toast.innerHTML = `<span>${icon}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => { toast.remove() }, 3500);
}