let isProcessing = false;
let currentMode = "Général";

// Initialisation
window.addEventListener('DOMContentLoaded', () => {
    addMessage("👋 Bonjour ! Je suis Hermes, votre assistant IA local.", 'bot');
    addMessage("⚙️ Mode actuel: Général - Posez-moi n'importe quelle question", 'bot');
    addMessage("📁 Vous pouvez charger un PDF pour passer en mode RAG", 'bot');
    
    document.getElementById('resetBtn').style.display = 'none';
});

// Gestion upload PDF
document.getElementById('pdfUpload').addEventListener('change', async (e) => {
    if (isProcessing) return;
    isProcessing = true;
    
    const file = e.target.files[0];
    if (!file) return;

    addMessage(`📤 Chargement de "${file.name}" en cours...`, 'bot');
    
    try {
        const formData = new FormData();
        formData.append('pdf', file);

        const response = await fetch('http://localhost:3000/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        
        if (result.success) {
            currentMode = "RAG";
            document.getElementById('resetBtn').style.display = 'block';
            addMessage(`✅ Document prêt ! (${result.pages} pages analysées)`, 'bot');
            addMessage(`⚙️ Mode activé: RAG - Je peux maintenant répondre en fonction de ce document`, 'bot');
        } else {
            addMessage(`❌ Erreur lors du chargement: ${result.error || 'Erreur inconnue'}`, 'bot');
        }

    } catch (err) {
        addMessage(`🚨 Erreur réseau: ${err.message}`, 'bot');
    }
    
    isProcessing = false;
    e.target.value = '';
});

// Gestion réinitialisation
document.getElementById('resetBtn').addEventListener('click', async () => {
    if (isProcessing) return;
    isProcessing = true;
    
    try {
        addMessage("⏳ Suppression du document en cours...", 'bot');
        
        const response = await fetch('http://localhost:3000/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deleteFiles: true })
        });

        const result = await response.json();
        
        if (result.success) {
            currentMode = "Général";
            document.getElementById('resetBtn').style.display = 'none';
            addMessage(`✅ ${result.message}`, 'bot');
            addMessage(`⚙️ Mode activé: Général - Je peux maintenant répondre à vos questions générales`, 'bot');
        } else {
            addMessage(`❌ Erreur lors de la réinitialisation: ${result.error}`, 'bot');
        }

    } catch (err) {
        addMessage(`🚨 Erreur réseau: ${err.message}`, 'bot');
    }
    
    isProcessing = false;
});

// Envoi de questions
async function sendMessage() {
    const input = document.getElementById('userInput');
    const question = input.value.trim();
    if (!question || isProcessing) return;

    isProcessing = true;
    input.value = '';
    addMessage(question, 'user');

    try {
        const response = await fetch('http://localhost:3000/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question })
        });

        const data = await response.json();
        
        let responseText = data.response;
        let footer = `\n\n⚙️ Mode: ${data.mode}`;
        
        if (data.mode === "RAG" && data.sources?.length > 0) {
            footer += ` | 🔎 Sources: ${data.sources.join(', ')}`;
        }
        
        addMessage(responseText + footer, 'bot');
        currentMode = data.mode;

    } catch (err) {
        addMessage("⚠️ Impossible de contacter le serveur - Vérifiez votre connexion", 'bot');
    }
    
    isProcessing = false;
}

// Ajout de messages dans le chat
function addMessage(text, sender) {
    const chatBox = document.getElementById('chatBox');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    // Détection des informations système
    if (text.includes('⚙️') || text.includes('🔎') || text.includes('✅') || text.includes('❌')) {
        const parts = text.split('\n\n');
        messageDiv.innerHTML = `
            <div class="message-content">${parts[0]}</div>
            <div class="message-footer">${parts.slice(1).join('<br>')}</div>
        `;
    } else {
        messageDiv.innerHTML = `<div class="message-content">${text}</div>`;
    }
    
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}