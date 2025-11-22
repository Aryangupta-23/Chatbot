let conversationId = null;

// DOM elements
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const addDocBtn = document.getElementById('addDocBtn');
const docModal = document.getElementById('docModal');
const docForm = document.getElementById('docForm');
const documentsList = document.getElementById('documentsList');
const closeModal = document.querySelector('.close');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadDocuments();
    
    // Send message on Enter key
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Send button click
    sendBtn.addEventListener('click', sendMessage);
    
    // Document modal
    addDocBtn.addEventListener('click', () => {
        docModal.style.display = 'block';
    });
    
    closeModal.addEventListener('click', () => {
        docModal.style.display = 'none';
        docForm.reset();
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === docModal) {
            docModal.style.display = 'none';
            docForm.reset();
        }
    });
    
    // Document form submit
    docForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await addDocument();
    });
    
    // Welcome message
    addMessage('assistant', 'Hello! I\'m your RAG-powered chatbot. I can answer questions based on the documents you add. How can I help you today?');
});

// Send message
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;
    
    // Add user message to chat
    addMessage('user', message);
    messageInput.value = '';
    
    // Disable input while processing
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<span class="loading"></span>';
    
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message,
                conversationId
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            conversationId = data.conversationId;
            
            // Add assistant response
            let responseText = data.response;
            if (data.relevantDocs && data.relevantDocs.length > 0) {
                responseText += '\n\n📚 Sources: ' + data.relevantDocs.map(doc => doc.title).join(', ');
            }
            addMessage('assistant', responseText);
        } else {
            addMessage('assistant', 'Sorry, I encountered an error: ' + data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        addMessage('assistant', 'Sorry, I encountered an error. Please check your API configuration.');
    } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = 'Send';
    }
}

// Add message to chat
function addMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = new Date().toLocaleTimeString();
    
    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(timeDiv);
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Load documents
async function loadDocuments() {
    try {
        const response = await fetch('/api/documents');
        const documents = await response.json();
        
        documentsList.innerHTML = '';
        
        if (documents.length === 0) {
            documentsList.innerHTML = '<p style="color: #999; font-size: 0.9em; text-align: center; padding: 20px;">No documents yet. Add one to get started!</p>';
            return;
        }
        
        documents.forEach(doc => {
            const docDiv = document.createElement('div');
            docDiv.className = 'document-item';
            docDiv.innerHTML = `
                <h4>${doc.title}</h4>
                <p>${new Date(doc.createdAt).toLocaleDateString()}</p>
            `;
            documentsList.appendChild(docDiv);
        });
    } catch (error) {
        console.error('Error loading documents:', error);
    }
}

// Add document
async function addDocument() {
    const title = document.getElementById('docTitle').value.trim();
    const text = document.getElementById('docText').value.trim();
    
    if (!text) {
        alert('Please enter document content');
        return;
    }
    
    try {
        const response = await fetch('/api/documents', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: title || 'Untitled',
                text
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            docModal.style.display = 'none';
            docForm.reset();
            loadDocuments();
            addMessage('assistant', 'Document added successfully! I can now use it to answer your questions.');
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        console.error('Error adding document:', error);
        alert('Failed to add document');
    }
}


