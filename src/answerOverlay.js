let answerMap = {};
let highlighterIntervalId = null;

function hasAnsweredQuestion(question) {
    return Object.prototype.hasOwnProperty.call(answerMap, question);
}

function storeAnswers(question, answers) {
    if (!question || !answers.length) return;
    if (!hasAnsweredQuestion(question)) {
        chrome.runtime.sendMessage({
            action: "updateMapData",
            data: { question, answers }
        });
        answerMap[question] = answers;
    }
}

function highlightAnswers(question) {
    let correctAnswers = answerMap[question];
    displayText(correctAnswers);

    let container = document.getElementsByClassName("air-item-container")[0];
    if (!container) return;

    let responseElements = container.getElementsByClassName("choice-row");

    for (const element of responseElements) {
        if (correctAnswers.includes(element.textContent) && element.getAttribute("data-sb-highlighted") !== "true") {
            element.style.backgroundColor = "#C6F6C6";
            element.style.border = "1px solid black";
            element.style.borderRadius = "10px";
            element.setAttribute("data-sb-highlighted", "true");
        }
    }
}

function displayText(ans) {
    let check = document.getElementById("smartbooksolver-note");
    if (check) {
        return;
    }
    console.log("H: Displaying answer:", ans);

    var div = document.createElement('div');

    var headerDiv = document.createElement('div');
    var headerP = document.createElement('p');
    headerP.style.fontWeight = 'bold';
    headerP.style.marginLeft = '1rem';
    headerP.textContent = 'Answer';
    headerDiv.appendChild(headerP);
    div.appendChild(headerDiv);

    var bodyDiv = document.createElement('div');
    bodyDiv.style.marginLeft = '1rem';
    for (var i = 0; i < ans.length; i++) {
        var ansP = document.createElement('p');
        ansP.style.color = 'black';
        ansP.textContent = ans[i];
        bodyDiv.appendChild(ansP);
    }
    div.appendChild(bodyDiv);

    div.id = 'smartbooksolver-note';
    div.style.color = 'lightgray';
    div.style.borderRadius = '10px';
    div.style.border = '2px solid black';
    div.style.textAlign = 'left';
    let containerEl = document.querySelectorAll('.responses-container');
    if (containerEl.length === 0) {
        containerEl = document.querySelectorAll('.dlc_question');
        if (containerEl.length === 0) {
            console.log("H: No container");
            return;
        }
    }
    containerEl[0].appendChild(div);
}

function highlighter() {
    let questionElement = document.getElementsByClassName("prompt");
    let question = "";
    if (questionElement.length > 0) {
        const paragraphElement = questionElement[0].querySelector('p');
        if (!paragraphElement) return;
        const textNodes = [...paragraphElement.childNodes].filter(node => node.nodeType === Node.TEXT_NODE);
        question = textNodes.map(node => node.textContent).join('_____');
        if (hasAnsweredQuestion(question) && document.getElementsByClassName("answer-container").length == 0) {
            highlightAnswers(question);
            return;
        }
    }
    let answerContainer = document.getElementsByClassName("answer-container");
    if (answerContainer.length == 0) {
        let answerElements = document.getElementsByClassName("correct-answers");
        let answers = [];
        if (answerElements.length != 0) {
            for (let x = 0; x < answerElements.length; x++) {
                const el = answerElements[x].getElementsByClassName("correct-answer")[0];
                if (el) {
                    // Preserve full answer text, just trim whitespace
                    const text = el.textContent.trim();
                    if (text) {
                        answers.push(text);
                    }
                }
            }
            storeAnswers(question, answers);
            return;
        }
        displayText(["We are currently testing many new features. Enabling the bot may fetch the correct answers on the first try.", "You can view stored answers in the flashcard tab in the extension popup. Good luck on your assignment and please leave us feedback :)"]);
        return;
    }

    let answers = [];
    let answerElements = document.getElementsByClassName("answer-container")[0].getElementsByClassName("choiceText rs_preserve");
    if (answerElements.length == 0) {
        answerElements = document.getElementsByClassName("answer-container");
    }
    for (let i = 0; i < answerElements.length; i++) {
        answers.push(answerElements[i].textContent);
    }
    storeAnswers(question, answers);
}

function startHighlighter() {
    if (highlighterIntervalId !== null) return;
    highlighterIntervalId = setInterval(highlighter, 600);
}

function stopHighlighter() {
    if (highlighterIntervalId !== null) {
        clearInterval(highlighterIntervalId);
        highlighterIntervalId = null;
    }
}

chrome.storage.local.get("isBotEnabled", (result) => {
    if (result.isBotEnabled === true) {
        startHighlighter();
    }
});

chrome.storage.onChanged.addListener((changes) => {
    if (changes.isBotEnabled) {
        if (changes.isBotEnabled.newValue === true) {
            startHighlighter();
        } else {
            stopHighlighter();
        }
    }
});
