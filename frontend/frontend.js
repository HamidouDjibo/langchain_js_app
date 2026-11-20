const API_BASE_URL = 'http://localhost:3000';

let isProcessing = false;
let currentMode = 'Général';

// Éléments du DOM
const chatBox = document.getElementById('chatBox');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const pdfUpload = document.getElementById('pdfUpload');
const dropZone = document.getElementById('dropZone');
const activeDocCard = document.getElementById('activeDocCard');
const docNameEl = document.getElementById('docName');
const docChunksEl = document.getElementById('docChunks');
const resetBtn = document.getElementById('resetBtn');
const clearChatBtn = document.getElementById('clearChatBtn');
const modeBadge = document.getElementById('modeBadge');
const modeText = document.getElementById('modeText');
const modeDescription = document.getElementById('modeDescription');

// Initialisation au chargement
window.addEventListener('DOMContentLoaded', () => {
    renderWelcomeMessage();
});

function renderWelcomeMessage() {
    addMessage(
        "Bonjour ! Je suis **Hermes**, votre assistant IA exécuté localement.\n\n" +
        "• Posez-moi directement vos questions en **Mode Général**.\n" +
        "• Ou importez un **document PDF** dans le panneau de gauche pour interroger son contenu en **Mode RAG**.",
        'bot',
        { mode: 'Général' }
    );
}

// Mise à jour visuelle du mode dans la barre latérale
function updateModeUI(mode, fileInfo = null) {
    currentMode = mode;

    if (mode === 'RAG' && fileInfo) {
        modeBadge.className = 'mode-badge mode-rag';
        modeText.textContent = 'Mode RAG Actif';
        modeDescription.textContent = 'Les réponses s’appuient sur les passages extraits de votre document PDF.';

        docNameEl.textContent = fileInfo.fileName;
        docNameEl.title = fileInfo.fileName;
        docChunksEl.textContent = `${fileInfo.pages} segments vectorisés`;
        activeDocCard.classList.remove('hidden');
    } else {
        modeBadge.className = 'mode-badge mode-general';
        modeText.textContent = 'Mode Général';
        modeDescription.textContent = 'Conversation libre avec le modèle local sans contexte documentaire.';
        activeDocCard.classList.add('hidden');
    }
}

// Gestion de l'upload de fichier (clic ou drag & drop)
async function handleFileUpload(file) {
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        addMessage('❌ Format invalide : veuillez sélectionner un fichier **PDF**.', 'bot');
        return;
    }

    if (isProcessing) return;
    setLoadingState(true);

    const typingId = showTypingIndicator(`Analyse et vectorisation de "${file.name}"...`);

    try {
        const formData = new FormData();
        formData.append('pdf', file);

        const response = await fetch(`${API_BASE_URL}/upload`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        removeTypingIndicator(typingId);

        if (response.ok && result.success) {
            updateModeUI('RAG', {
                fileName: result.fileName || file.name,
                pages: result.pages
            });

            addMessage(
                `✅ Document **${result.fileName || file.name}** indexé avec succès (**${result.pages} segments** générés via \`nomic-embed-text\`).\n\nVous pouvez maintenant poser vos questions sur son contenu.`,
                'bot',
                { mode: 'RAG' }
            );
        } else {
            addMessage(`❌ Échec du traitement du PDF : ${result.error || 'Erreur inconnue'}`, 'bot');
        }
    } catch (err) {
        removeTypingIndicator(typingId);
        addMessage(`🚨 Erreur réseau lors de l'envoi : ${err.message}`, 'bot');
    } finally {
        setLoadingState(false);
        pdfUpload.value = '';
    }
}

pdfUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleFileUpload(file);
    }
});

// Support du Glisser-Déposer (Drag & Drop)
['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
    });
});

dropZone.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) {
        handleFileUpload(file);
    }
});

// Réinitialisation du vector store
resetBtn.addEventListener('click', async () => {
    if (isProcessing) return;
    setLoadingState(true);

    try {
        const response = await fetch(`${API_BASE_URL}/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deleteFiles: true })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            updateModeUI('Général');
            addMessage('🗑️ Document retiré de la mémoire. Retour au **Mode Général**.', 'bot', { mode: 'Général' });
        } else {
            addMessage(`❌ Erreur lors de la réinitialisation : ${result.error || 'Erreur inconnue'}`, 'bot');
        }
    } catch (err) {
        addMessage(`🚨 Erreur réseau : ${err.message}`, 'bot');
    } finally {
        setLoadingState(false);
    }
});

// Envoi d'une question au backend
async function sendMessage(customText = null) {
    const question = (customText ?? userInput.value).trim();
    if (!question || isProcessing) return;

    setLoadingState(true);
    if (!customText) {
        userInput.value = '';
        userInput.style.height = 'auto';
    }

    addMessage(question, 'user');
    const typingId = showTypingIndicator();

    try {
        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question })
        });

        const data = await response.json();
        removeTypingIndicator(typingId);

        if (response.ok && data.response) {
            addMessage(data.response, 'bot', {
                mode: data.mode,
                sources: data.sources || []
            });
        } else {
            addMessage(`❌ ${data.error || 'Le modèle n’a pas pu générer de réponse.'}`, 'bot');
        }
    } catch (err) {
        removeTypingIndicator(typingId);
        addMessage('⚠️ Impossible de joindre le serveur backend (`http://localhost:3000`). Vérifiez qu’il est démarré.', 'bot');
    } finally {
        setLoadingState(false);
        userInput.focus();
    }
}

// Gestion du clavier : Entrée envoie, Maj+Entrée saute une ligne
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Auto-ajustement de la hauteur du champ texte
userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = `${Math.min(userInput.scrollHeight, 140)}px`;
});

sendBtn.addEventListener('click', () => sendMessage());

// Boutons de suggestions rapides
document.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        const prompt = chip.getAttribute('data-prompt');
        if (prompt) sendMessage(prompt);
    });
});

// Effacer l'affichage du chat
clearChatBtn.addEventListener('click', () => {
    chatBox.innerHTML = '';
    renderWelcomeMessage();
});

// Verrouillage propre pendant les requêtes
function setLoadingState(loading) {
    isProcessing = loading;
    sendBtn.disabled = loading;
}

// Nettoie le chemin complet Windows/Unix renvoyé par le backend (ex: "G:\...\174912_rapport.pdf" -> "rapport.pdf")
function formatSourceName(rawSource) {
    if (!rawSource) return 'Document';
    const fileName = rawSource.split(/[/\\]/).pop();
    return fileName.replace(/^\d+_/, '');
}

// Échappement HTML pour sécuriser l'affichage + mise en forme légère du texte LLM
function formatMessageContent(text) {
    const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    return escaped
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
}

// Ajout d'une bulle de message dans le fil
function addMessage(text, sender, meta = {}) {
    const row = document.createElement('div');
    row.className = `message-row ${sender}`;

    const avatar = document.createElement('div');
    avatar.className = `avatar ${sender}`;
    avatar.textContent = sender === 'bot' ? '🦉' : 'Vous';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    const content = document.createElement('div');
    content.className = 'message-content';
    content.innerHTML = formatMessageContent(text);
    bubble.appendChild(content);

    // Pied de message pour les réponses du bot (Mode + Sources nettoyées)
    if (sender === 'bot' && (meta.mode || (meta.sources && meta.sources.length > 0))) {
        const footer = document.createElement('div');
        footer.className = 'message-footer';

        if (meta.mode) {
            const modeTag = document.createElement('span');
            modeTag.className = 'mode-pill';
            modeTag.textContent = `⚙️ ${meta.mode}`;
            footer.appendChild(modeTag);
        }

        if (meta.sources && meta.sources.length > 0) {
            meta.sources.forEach(src => {
                const pill = document.createElement('span');
                pill.className = 'source-pill';
                pill.textContent = `📄 ${formatSourceName(src)}`;
                footer.appendChild(pill);
            });
        }

        bubble.appendChild(footer);
    }

    row.appendChild(avatar);
    row.appendChild(bubble);
    chatBox.appendChild(row);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Indicateur de chargement animé
function showTypingIndicator(statusText = null) {
    const id = `typing-${Date.now()}`;
    const row = document.createElement('div');
    row.className = 'message-row bot';
    row.id = id;

    const avatar = document.createElement('div');
    avatar.className = 'avatar bot';
    avatar.textContent = '🦉';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerHTML = statusText
        ? `<div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:6px;">${statusText}</div><div class="typing-dots"><span></span><span></span><span></span></div>`
        : `<div class="typing-dots"><span></span><span></span><span></span></div>`;

    row.appendChild(avatar);
    row.appendChild(bubble);
    chatBox.appendChild(row);
    chatBox.scrollTop = chatBox.scrollHeight;
    return id;
}

function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}