document.addEventListener('DOMContentLoaded', () => {
    const chatContainer = document.getElementById('chatContainer');
    const chatWindow = document.getElementById('chatWindow');
    const userInput = document.getElementById('userInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const voiceInputBtn = document.getElementById('voiceInputBtn');
    const chatIconButton = document.getElementById('chatIconButton');
    const closeChatButton = document.getElementById('closeChatButton');
    const promptContainer = document.getElementById('promptContainer');

    if (!chatContainer || !chatWindow || !chatIconButton || !closeChatButton || !promptContainer) {
        alert('Error: Chat elements not found. Check IDs in HTML.');
        return;
    }

    // Load saved chat history
    // loadChatHistory();

    function addMessage(message, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = sender === 'user' ? 'user-message' : 'bot-message';
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        messageDiv.innerHTML = `<strong>${sender === 'user' ? 'You' : 'Bot'}:</strong> ${message} <span class="timestamp">${time}</span>`;
        chatWindow.appendChild(messageDiv);
        chatWindow.scrollTop = chatWindow.scrollHeight;
        saveChatHistory();
    }

    function showLoadingIndicator() {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-indicator';
        loadingDiv.innerHTML = '<span></span><span></span><span></span>';
        chatWindow.appendChild(loadingDiv);
        chatWindow.scrollTop = chatWindow.scrollHeight;
        return loadingDiv;
    }

    function removeLoadingIndicator(loadingDiv) {
        if (loadingDiv && loadingDiv.parentNode) {
            loadingDiv.parentNode.removeChild(loadingDiv);
        }
    }

    function addButtons(buttons) {
        const buttonDiv = document.createElement('div');
        buttonDiv.className = 'button-container';
        buttons.forEach(button => {
            const btn = document.createElement('button');
            btn.className = 'chat-button';
            btn.textContent = button.title;
            btn.addEventListener('click', () => {
                addMessage(button.title, 'user');
                sendMessage(button.payload, false);
            });
            buttonDiv.appendChild(btn);
        });
        chatWindow.appendChild(buttonDiv);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    async function sendMessage(message, displayAsUserMessage = true, retries = 3, delay = 1000) {
        if (message.trim() === '') return;
        if (displayAsUserMessage) addMessage(message, 'user');

        const loadingDiv = showLoadingIndicator();

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const response = await fetch('http://localhost:5005/webhooks/rest/webhook', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sender: 'user123', message })
                });

                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

                const data = await response.json();
                removeLoadingIndicator(loadingDiv);

                data.forEach(msg => {
                    if (msg.text) {
                        addMessage(msg.text, 'bot');
                        if (msg.text.includes("Please select a valid option (1-8)")) {
                            showPrompts();
                        }
                    }
                    if (msg.buttons) {
                        addButtons(msg.buttons);
                    }
                });

                userInput.value = '';
                promptContainer.style.display = 'none';
                return;

            } catch (error) {
                if (attempt < retries) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2;
                } else {
                    removeLoadingIndicator(loadingDiv);
                    addMessage(`Error: Could not connect to the bot. (${error.message})`, 'bot');
                    userInput.value = '';
                }
            }
        }
    }

    function showPrompts() {
        promptContainer.style.display = 'flex';
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    function detectSentiment(message) {
        const frustrationKeywords = ['help', 'confused', 'stuck', 'not working'];
        return frustrationKeywords.some(keyword => message.toLowerCase().includes(keyword));
    }

    chatIconButton.addEventListener('click', () => {
        chatContainer.classList.add('open');
        chatIconButton.style.opacity = '0';
        chatIconButton.style.pointerEvents = 'none';
        closeChatButton.style.opacity = '1';
        closeChatButton.style.pointerEvents = 'all';
        userInput.focus();
        if (!chatWindow.hasChildNodes()) {
            sendMessage('/greet', false);
            showPrompts();
        }
    });

    closeChatButton.addEventListener('click', () => {
        chatContainer.classList.remove('open');
        chatIconButton.style.opacity = '1';
        chatIconButton.style.pointerEvents = 'all';
        closeChatButton.style.opacity = '0';
        closeChatButton.style.pointerEvents = 'none';
    });

    sendMessageBtn.addEventListener('click', () => {
        const message = userInput.value.trim();
        if (message) {
            if (detectSentiment(message)) {
                addMessage('Seems like you might need extra help! Try these options or type "support" for human assistance.', 'bot');
                showPrompts();
            } else {
                sendMessage(message);
            }
        }
    });

    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const message = userInput.value.trim();
            if (message) {
                if (detectSentiment(message)) {
                    addMessage('Seems like you might need extra help! Try these options or type "support" for human assistance.', 'bot');
                    showPrompts();
                } else {
                    sendMessage(message);
                }
            }
        }
    });

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        voiceInputBtn.addEventListener('click', () => {
            recognition.start();
            voiceInputBtn.style.color = '#dc3545';
        });

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            userInput.value = transcript;
            voiceInputBtn.style.color = '#1a73e8';
            sendMessage(transcript);
        };

        recognition.onerror = () => {
            voiceInputBtn.style.color = '#1a73e8';
            addMessage('Sorry, voice input failed. Please try typing.', 'bot');
        };

        recognition.onend = () => {
            voiceInputBtn.style.color = '#1a73e8';
        };
    } else {
        voiceInputBtn.style.display = 'none';
    }

    promptContainer.querySelectorAll('.prompt-button').forEach(button => {
        button.addEventListener('click', () => {
            const message = button.getAttribute('data-message');
            sendMessage(message);
        });
    });

    let inactivityTimeout;
    userInput.addEventListener('input', () => {
        clearTimeout(inactivityTimeout);
        inactivityTimeout = setTimeout(() => {
            if (chatContainer.classList.contains('open') && promptContainer.style.display === 'none') {
                showPrompts();
            }
        }, 5000);
    });

    function saveChatHistory() {
        localStorage.setItem('chatHistory', chatWindow.innerHTML);
    }

    // function loadChatHistory() {
    //     const history = localStorage.getItem('chatHistory');
    //     if (history) {
    //         chatWindow.innerHTML = history;
    //         chatWindow.scrollTop = chatWindow.scrollHeight;
    //     }
    // }

    closeChatButton.style.opacity = '0';
    closeChatButton.style.pointerEvents = 'none';
});
