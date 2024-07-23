function debugLog(message) {
    console.log(message);
    document.getElementById('debug-info').innerHTML += `<p>${message}</p>`;
}

function toggleDebugInfo() {
    const debugInfo = document.getElementById('debug-info');
    debugInfo.style.display = debugInfo.style.display === 'none' ? 'block' : 'none';
}

function formatCode(code) {
    return hljs.highlightAuto(code).value;
}

function sendMessage() {
    debugLog("sendMessage function called");
    const userInput = document.getElementById('user-input');
    const chatMessages = document.getElementById('chat-messages');
    const message = userInput.value;
    if (message.trim() === '') return;

    chatMessages.innerHTML += `
        <div class="message user-message">
            <strong>You:</strong>
            ${message}
        </div>`;
    userInput.value = '';
    chatMessages.scrollTop = chatMessages.scrollHeight;

    debugLog("Sending AJAX request");
    $.ajax({
        url: '/api/ask',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ query: message }),
        success: function(response) {
            debugLog("Received response from server");
            console.log("Raw API Response:", response);
            const formattedResponse = response.answer.replace(/<pre><code class="language-q">([\s\S]*?)<\/code><\/pre>/g, function(match, p1) {
                return `<div class="code-block"><pre><code class="language-q">${p1}</code></pre></div>`;
            });
            chatMessages.innerHTML += `
                <div class="message ai-message">
                    <strong>AI:</strong>
                    ${formattedResponse}
                </div>`;
            chatMessages.scrollTop = chatMessages.scrollHeight;
            hljs.highlightAll();
        },
        error: function(jqXHR, textStatus, errorThrown) {
            debugLog(`Error: ${textStatus}, ${errorThrown}`);
            console.error("AJAX Error:", jqXHR.responseText);
            chatMessages.innerHTML += `
                <div class="message ai-message">
                    <strong>AI:</strong>
                    Sorry, I encountered an error while processing your request.
                </div>`;
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    });
}

const chatMessages = document.getElementById('chat-messages');
const observer = new MutationObserver(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
});
observer.observe(chatMessages, { childList: true });

function formatResponse(response) {
    const paragraphs = response.split('\n\n');
    return paragraphs.map(p => `<p>${p}</p>`).join('');
}

const container = document.getElementById('container');
let draggedTab = null;
let draggedWindow = null;
let currentWindow = null;

function setActiveTab(tab) {
    const window = tab.closest('.window');
    window.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    window.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    window.querySelector(`#${tab.dataset.panel}`).classList.add('active');
}

function showNewTabModal(window) {
    currentWindow = window;
    document.getElementById('newTabModal').style.display = 'block';
}

function createNewTab(panelType) {
    const newTab = document.createElement('div');
    newTab.className = 'tab';
    newTab.draggable = true;
    newTab.dataset.panel = `${panelType}-${Date.now()}`;
    newTab.innerHTML = `${panelType}<span class="tab-close">×</span>`;
    
    currentWindow.querySelector('.tab-bar').insertBefore(newTab, currentWindow.querySelector('.new-tab-button'));
    
    const newPanel = document.createElement('div');
    newPanel.className = 'panel';
    newPanel.id = newTab.dataset.panel;
    newPanel.innerHTML = document.getElementById(panelType).innerHTML;
    currentWindow.querySelector('.content-area').appendChild(newPanel);
    
    setActiveTab(newTab);
    document.getElementById('newTabModal').style.display = 'none';
}

function splitWindow() {
    if (container.children.length < 2) {
        const existingWindow = container.firstElementChild;
        const newWindow = existingWindow.cloneNode(true);
        
        newWindow.querySelector('.tab-bar').innerHTML = `
            <button class="new-tab-button" onclick="showNewTabModal(this.closest('.window'))">+</button>
            <button class="new-window-button" onclick="splitWindow()">◫</button>
        `;
        newWindow.querySelector('.content-area').innerHTML = '';

        container.appendChild(newWindow);
        setupWindowListeners(newWindow);

        existingWindow.style.width = '50%';
        newWindow.style.width = '50%';
    }
}

function setupWindowListeners(window) {
    const tabBar = window.querySelector('.tab-bar');

    tabBar.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab')) {
            setActiveTab(e.target);
        } else if (e.target.classList.contains('tab-close')) {
            closeTab(e.target.closest('.tab'));
        }
    });

    tabBar.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('tab')) {
            draggedTab = e.target;
            draggedWindow = window;
            e.dataTransfer.setData('text/plain', e.target.dataset.panel);
        }
    });

    tabBar.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    tabBar.addEventListener('drop', (e) => {
        e.preventDefault();
        if (draggedTab) {
            const targetWindow = e.target.closest('.window');
            const targetTabBar = targetWindow.querySelector('.tab-bar');
            if (e.target.classList.contains('tab')) {
                const targetRect = e.target.getBoundingClientRect();
                const targetMiddle = targetRect.left + targetRect.width / 2;
                if (e.clientX < targetMiddle) {
                    targetTabBar.insertBefore(draggedTab, e.target);
                } else {
                    targetTabBar.insertBefore(draggedTab, e.target.nextSibling);
                }
            } else {
                targetTabBar.insertBefore(draggedTab, targetTabBar.querySelector('.new-tab-button'));
            }
            movePanel(draggedTab, targetWindow);
            draggedTab = null;
            draggedWindow = null;
        }
    });
}

function movePanel(tab, targetWindow) {
    const panel = draggedWindow.querySelector(`#${tab.dataset.panel}`);
    targetWindow.querySelector('.content-area').appendChild(panel);
}

function closeTab(tab) {
    const window = tab.closest('.window');
    const panel = window.querySelector(`#${tab.dataset.panel}`);
    tab.remove();
    panel.remove();

    if (window.querySelectorAll('.tab').length === 0 && container.children.length > 1) {
        window.remove();
        container.firstElementChild.style.width = '100%';
    } else if (window.querySelectorAll('.tab').length > 0) {
        setActiveTab(window.querySelector('.tab'));
    }
}

let currentChallenge = 0;
let challengeData;

window.submitSolution = function() {
    const solution = document.getElementById('solution').value;
    const correctSolution = challengeData.topics[currentChallenge].exercise.solution.join('\n');
    const challengeOutput = document.getElementById('challenge-output');
    if (solution.trim() === correctSolution.trim()) {
        challengeOutput.textContent = "Correct! Well done!";
    } else {
        challengeOutput.textContent = "Incorrect. Try again!";
    }
}

function loadChallenges() {
    fetch('/static/challenges.json')
        .then(response => response.json())
        .then(data => {
            challengeData = data;
            const challengesPanel = document.getElementById('challenges');
            const challengeTitle = document.getElementById('challenge-title');

            const prevButton = document.createElement('button');
            prevButton.textContent = 'Previous Challenge';
            const nextButton = document.createElement('button');
            nextButton.textContent = 'Next Challenge';

            function displayChallenge(index) {
                const challenge = challengeData.topics[index];
                challengeTitle.textContent = challenge.topic;
                challengesPanel.innerHTML = `
                    <h3>${challenge.topic}</h3>
                    <p>${challenge.description}</p>
                    <h4>Example:</h4>
                    <pre class="code-block"><code>${challenge.example.code.join('\n')}</code></pre>
                    <p>${challenge.example.explanation}</p>
                    <h4>Exercise:</h4>
                    <p>${challenge.exercise.prompt}</p>
                    <textarea id="solution" rows="5" cols="50"></textarea>
                    <button id="submitButton">Submit Solution</button>
                    <h4>Feedback:</h4>
                    <pre id="challenge-output"></pre>
                `;

                document.getElementById('submitButton').addEventListener('click', submitSolution);

                prevButton.style.display = index > 0 ? 'inline-block' : 'none';
                nextButton.style.display = index < challengeData.topics.length - 1 ? 'inline-block' : 'none';

                challengesPanel.appendChild(prevButton);
                challengesPanel.appendChild(nextButton);
            }

            prevButton.onclick = () => {
                if (currentChallenge > 0) {
                    currentChallenge--;
                    displayChallenge(currentChallenge);
                }
            };

            nextButton.onclick = () => {
                if (currentChallenge < challengeData.topics.length - 1) {
                    currentChallenge++;
                    displayChallenge(currentChallenge);
                }
            };

            displayChallenge(currentChallenge);
        })
        .catch(error => console.error('Error loading challenges:', error));
}

function initializeApp() {
    debugLog("Initializing application");
    document.getElementById('user-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    setupWindowListeners(document.getElementById('main-window'));
    loadChallenges();

    debugLog("Application initialized successfully");
}

document.addEventListener('DOMContentLoaded', initializeApp);

debugLog("JavaScript initialization complete");