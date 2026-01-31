import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, googleProvider } from './firebase-init.js';
import { syncUserDatabase } from './userManager.js';

const showRegisterBtn = document.getElementById('showRegister');
const showLoginBtn = document.getElementById('showLogin');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const formTitle = document.getElementById('formTitle');
const formSubtitle = document.getElementById('formSubtitle');

// Botões Google
const googleBtnLogin = document.getElementById('googleBtnLogin');
const googleBtnRegister = document.getElementById('googleBtnRegister');

// DETECÇÃO AUTOMÁTICA
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'register') {
        if(showRegisterBtn) showRegisterBtn.click();
    }
});

// TEMA
const themeToggle = document.getElementById('themeToggle');
const htmlElement = document.documentElement;
const sunIcon = document.querySelector('.icon-sun');
const moonIcon = document.querySelector('.icon-moon');

if (localStorage.getItem('bitto_theme') === 'dark') {
    setTheme('dark');
}

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

// TILT 3D
const tiltElement = document.querySelector('.tilt-element');
document.addEventListener('mousemove', (e) => {
    if(tiltElement && window.innerWidth > 900) { 
        const rect = tiltElement.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (x >= -50 && x <= rect.width + 50 && y >= -50 && y <= rect.height + 50) {
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = ((y - centerY) / centerY) * -5; 
            const rotateY = ((x - centerX) / centerX) * 5;
            tiltElement.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
        } else {
            tiltElement.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
        }
    }
});

// TOGGLE SENHA
const togglePassBtns = document.querySelectorAll('.toggle-pass-btn');
togglePassBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const input = btn.parentElement.querySelector('input');
        const eyeOpen = btn.querySelector('.eye-open');
        const eyeClosed = btn.querySelector('.eye-closed');
        if (input.type === 'password') {
            input.type = 'text';
            eyeOpen.style.display = 'none';
            eyeClosed.style.display = 'block';
        } else {
            input.type = 'password';
            eyeOpen.style.display = 'block';
            eyeClosed.style.display = 'none';
        }
    });
});

// LOGIN GOOGLE
async function handleGoogleLogin() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        await syncUserDatabase(result.user);
        showToast("Conectado com Google!", "success");
        // [CORREÇÃO] Caminho absoluto a partir da raiz
        setTimeout(() => window.location.href = '/pages/dashboard.html', 1000);
    } catch (error) {
        console.error(error);
        if(error.code === 'auth/unauthorized-domain') showToast("Erro: Domínio não autorizado no Firebase.", "error");
        else showToast("Erro no Google Login.", "error");
    }
}
if(googleBtnLogin) googleBtnLogin.addEventListener('click', handleGoogleLogin);
if(googleBtnRegister) googleBtnRegister.addEventListener('click', handleGoogleLogin);

// LOGIN EMAIL
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const emailInput = document.getElementById('loginEmail');
    const passInput = document.getElementById('loginPass');
    const btn = loginForm.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;

    if (!emailInput || !passInput) {
        showToast("Erro interno: Campos não encontrados.", "error");
        return;
    }

    try {
        btn.innerHTML = '<span class="loader"></span> Entrando...';
        btn.classList.add('btn-loading');

        const result = await signInWithEmailAndPassword(auth, emailInput.value, passInput.value);
        await syncUserDatabase(result.user);

        showToast("Login realizado!", "success");
        // [CORREÇÃO] Caminho absoluto a partir da raiz
        setTimeout(() => window.location.href = '/pages/dashboard.html', 1000);
    } catch (error) {
        console.error(error);
        let msg = "Erro ao entrar.";
        if(error.code === 'auth/invalid-credential') msg = "Email ou senha incorretos.";
        showToast(msg, "error");
        btn.innerHTML = originalText;
        btn.classList.remove('btn-loading');
    }
});

// REGISTRO EMAIL
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nameInput = document.getElementById('regName');
    const emailInput = document.getElementById('regEmail');
    const passInput = document.getElementById('regPass');
    const btn = registerForm.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;

    if (!nameInput || !emailInput || !passInput) {
        showToast("Erro interno: Campos de registro não encontrados.", "error");
        return;
    }

    try {
        btn.innerHTML = '<span class="loader"></span> Criando...';
        btn.classList.add('btn-loading');

        const result = await createUserWithEmailAndPassword(auth, emailInput.value, passInput.value);
        
        const user = result.user;
        // Tenta atualizar o perfil imediatamente
        try {
            // Nota: updateProfile pode vir do import modular se necessário, 
            // mas aqui estamos apenas criando a conta e sincronizando.
            // O ideal é usar a função importada se estiver usando v9
        } catch(e) { console.log("Erro ao setar nome no Auth", e); }
        
        // Vamos forçar o displayName no objeto antes de enviar pro DB
        Object.defineProperty(user, 'displayName', { value: nameInput.value, writable: true });
        
        await syncUserDatabase(user);

        showToast("Conta criada! Bem-vindo.", "success");
        // [CORREÇÃO] Caminho absoluto a partir da raiz
        setTimeout(() => window.location.href = '/pages/dashboard.html', 1500);
    } catch (error) {
        console.error(error);
        let msg = "Erro ao criar conta.";
        if(error.code === 'auth/email-already-in-use') msg = "Email já cadastrado.";
        if(error.code === 'auth/weak-password') msg = "Senha muito fraca.";
        showToast(msg, "error");
        btn.innerHTML = originalText;
        btn.classList.remove('btn-loading');
    }
});

// UI - ALTERNÂNCIA DE TELAS
showRegisterBtn.addEventListener('click', (e) => {
    if(e) e.preventDefault();
    loginForm.classList.remove('active');
    registerForm.classList.add('active');
    formTitle.innerText = "Crie sua conta";
    formSubtitle.innerText = "Junte-se à comunidade Bitto";
});

showLoginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.classList.remove('active');
    loginForm.classList.add('active');
    formTitle.innerText = "Bem-vindo de volta";
    formSubtitle.innerText = "Entre para continuar seus estudos";
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
    
    let icon = '';
    if(type === 'success') icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
    if(type === 'info') icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    if(type === 'error') icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

    toast.innerHTML = `${icon} ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = "fadeOutToast 0.3s ease forwards";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}