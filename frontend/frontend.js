let currentDocs = [];

// Gestion upload PDF
document.getElementById('pdfUpload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('pdf', file);

    try {
        const response = await fetch('http://localhost:3000/upload', {
            method: 'POST',
            body: formData
        });
        
        currentDocs = await response.json();
        addMessage(`Document "${file.name}" prêt pour analyse !`, 'bot');
    } catch (err) {
        console.error('Erreur upload:', err);
    }
});

// Envoi questions
async function sendMessage() {
    const input = document.getElementById('userInput');
    const question = input.value.trim();
    if (!question) return;

    addMessage(question, 'user');
    input.value = '';

    try {
        const response = await fetch('http://localhost:3000/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question })
        });

        const data = await response.json();
        addMessage(data.response, 'bot');
    } catch (err) {
        addMessage("Erreur de connexion au chatbot", 'bot');
    }
}

// Affichage messages
function addMessage(text, sender) {
    const chatBox = document.getElementById('chatBox');
    const messageDiv = document.createElement('div');
    
    messageDiv.className = `message ${sender}-message`;
    messageDiv.textContent = text;
    
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}