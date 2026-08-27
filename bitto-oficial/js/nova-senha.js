import { auth } from './firebase-init.js';
import { confirmPasswordReset, verifyPasswordResetCode } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const newPasswordForm = document.getElementById('newPasswordForm');

// 1. Pega o código da URL (o Firebase manda algo como: nova-senha.html?oobCode=XYZ...)
const urlParams = new URLSearchParams(window.location.search);
const actionCode = urlParams.get('oobCode');

// Se não tiver código, o usuário entrou na página por engano
if (!actionCode) {
    showToast("Erro: Link inválido ou expirado.", "error");
    setTimeout(() => window.location.href = 'login.html', 3000);
}

// 2. Verifica se o código é válido assim que carrega (Opcional, mas boa prática)
verifyPasswordResetCode(auth, actionCode).then((email) => {
    // Código válido! O email do usuário é: email
    console.log("Redefinindo senha para:", email);
}).catch((error) => {
    showToast("Link expirado ou já utilizado.", "error");
    setTimeout(() => window.location.href = 'login.html', 3000);
});

// 3. Salvar a nova senha
newPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPass = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmPassword').value;
    const btn = newPasswordForm.querySelector('button[type="submit"]');

    if (newPass.length < 6) {
        showToast("A senha deve ter no mínimo 6 caracteres.", "error");
        return;
    }

    if (newPass !== confirmPass) {
        showToast("As senhas não coincidem.", "error");
        return;
    }

    try {
        btn.innerHTML = '<span class="loader"></span> Salvando...';
        btn.disabled = true;

        // A MÁGICA ACONTECE AQUI
        await confirmPasswordReset(auth, actionCode, newPass);

        showToast("Senha alterada com sucesso! 🎉", "success");
        
        // Redireciona para login
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2500);

    } catch (error) {
        console.error(error);
        showToast("Erro ao redefinir senha: " + error.message, "error");
        btn.innerHTML = "TENTAR NOVAMENTE";
        btn.disabled = false;
    }
});

// --- FUNÇÕES UTILITÁRIAS (TOAST E TOGGLE PASS) ---
// (Copie as mesmas funções showToast e togglePass do seu login.js para manter o padrão)

// Toggle Pass
document.querySelectorAll('.toggle-pass-btn').forEach(btn => {
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