/* ARQUIVO: css/login.css */

:root {
    --bg-color: #FAFAFA;
    --text-main: #111111;
    --text-muted: #666666;
    --card-bg: #FFFFFF;
    --border-color: #E0E0E0;
    --input-bg: #F8F9FA;
    --primary-blue: #0035FF;
    --accent-green: #CCFF00;
    --font-display: 'Unbounded', sans-serif;
    --font-body: 'DM Sans', sans-serif;
    --radius-lg: 24px;
    --shadow-soft: 0 20px 40px rgba(0,0,0,0.06);
    --right-panel-bg: linear-gradient(135deg, #0035FF 0%, #0020A0 100%);
    --right-text: #FFFFFF;
}

[data-theme="dark"] {
    --bg-color: #050505;
    --text-main: #EDEDED;
    --text-muted: #AAAAAA;
    --card-bg: #111111;
    --border-color: #333333;
    --input-bg: #1A1A1A;
    --primary-blue: #3366FF;
    --right-panel-bg: linear-gradient(135deg, #111111 0%, #000000 100%);
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
    font-family: var(--font-body);
    color: var(--text-main);
    background-color: var(--bg-color);
    line-height: 1.5;
    min-height: 100vh;
    overflow-x: hidden; 
    transition: background-color 0.3s ease, color 0.3s ease;
}

/* --- ELEMENTOS GLOBAIS DE NAVEGAÇÃO --- */
.back-home {
    position: absolute;
    top: 25px;
    left: 25px;
    text-decoration: none;
    color: var(--text-main);
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.9rem;
    z-index: 100;
    transition: all 0.3s;
    padding: 8px 16px;
    border-radius: 50px;
    background: transparent;
}

.back-home:hover {
    background: rgba(0, 53, 255, 0.05);
    transform: translateX(-3px);
}

.auth-theme-toggle { 
    position: absolute; 
    top: 25px; 
    right: 25px; 
    z-index: 100; 
}

/* --- CRT & TILT --- */
.crt-overlay {
    display: none;
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%);
    background-size: 100% 4px;
    pointer-events: none; z-index: 9999; opacity: 0.4;
}
[data-theme="dark"] .crt-overlay { display: block; }

/* --- LAYOUT PRINCIPAL --- */
.auth-body {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    padding: 40px 20px;
    background-image: radial-gradient(circle at 50% 50%, rgba(0, 53, 255, 0.05) 0%, transparent 70%);
}

.auth-container {
    width: 100%;
    max-width: 1000px;
    z-index: 2;
}

.auth-card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-soft);
    display: flex;
    overflow: hidden;
    min-height: 620px;
    width: 100%;
}

/* --- COLUNA ESQUERDA --- */
.auth-left {
    flex: 1;
    padding: 3.5rem;
    display: flex;
    flex-direction: column;
    justify-content: center;
}

.logo-icon {
    width: 54px; height: 54px;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 14px;
    display: flex; justify-content: center; align-items: center;
    padding: 6px;
    margin: 0 auto 1.5rem auto;
}
.logo-icon img { width: 100%; height: 100%; object-fit: contain; }

.auth-header h2 {
    font-family: var(--font-display);
    font-size: 1.8rem;
    text-align: center;
    margin-bottom: 0.5rem;
}

.auth-header p { text-align: center; color: var(--text-muted); margin-bottom: 2rem; }

.auth-input {
    width: 100%;
    background: var(--input-bg);
    color: var(--text-main);
    border: 1px solid var(--border-color);
    padding: 1rem;
    border-radius: 12px;
    margin-bottom: 1rem;
    outline: none;
}

.btn-primary {
    background: var(--primary-blue);
    color: white;
    border: none;
    padding: 1rem;
    border-radius: 50px;
    font-weight: 700;
    cursor: pointer;
    width: 100%;
    box-shadow: 0 4px 15px rgba(0, 53, 255, 0.2);
}

.activation-box {
    margin-top: 20px;
    text-align: center;
    background: rgba(0, 53, 255, 0.04);
    padding: 12px;
    border-radius: 12px;
    border: 1px dashed var(--primary-blue);
}
.activation-box a { text-decoration: none; color: var(--text-main); font-size: 0.85rem; }
.activation-box strong { color: var(--primary-blue); }

.divider {
    margin: 1.5rem 0;
    text-align: center;
    border-bottom: 1px solid var(--border-color);
    line-height: 0.1em;
}
.divider span { background: var(--card-bg); padding: 0 10px; color: var(--text-muted); }

.full-social {
    width: 100%;
    padding: 0.9rem;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    cursor: pointer;
    font-weight: 600;
    display: flex; align-items: center; justify-content: center; gap: 10px;
    color: var(--text-main);
}

.auth-footer { text-align: center; margin-top: 1.5rem; font-size: 0.9rem; }
.auth-footer a { color: var(--primary-blue); font-weight: 700; text-decoration: none; }

/* --- COLUNA DIREITA --- */
.auth-right {
    flex: 1.1;
    background: var(--right-panel-bg);
    color: var(--right-text);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 3rem;
    text-align: center;
    position: relative;
}

.floating-mascot { width: 220px; animation: float 6s ease-in-out infinite; }
@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }

/* --- RESPONSIVIDADE --- */

@media (max-width: 899px) {
    .auth-body {
        padding-top: 100px; /* Espaço para a "barra" superior */
        align-items: flex-start;
    }

    .back-home {
        top: 20px;
        left: 20px;
        background: var(--card-bg); /* Transforma em um botão sólido */
        border: 1px solid var(--border-color);
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }

    .auth-theme-toggle {
        top: 20px;
        right: 20px;
    }

    .auth-card {
        flex-direction: column;
        min-height: auto;
    }

    .auth-right { display: none; }

    .auth-left {
        padding: 2.5rem 1.5rem;
    }

    .auth-header h2 { font-size: 1.5rem; }
}

@media (min-width: 900px) {
    body { overflow: hidden; }
}