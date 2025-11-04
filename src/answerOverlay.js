let answerMap = {}

// Define a function to check if the question has already been answered
function hasAnsweredQuestion(question) {
    return answerMap.hasOwnProperty(question);
}

// Define a function to store the answers in the map
function storeAnswers(question, answers) {
    if (!hasAnsweredQuestion(question)) {
        chrome.storage.local.get('responseMap', (result) => {
            const tempAnswerMap = result.responseMap || {};
            tempAnswerMap[question] = answers;
            chrome.storage.local.set({ responseMap: tempAnswerMap }, () => {
              console.log('Data updated in local storage:', tempAnswerMap);
              answerMap = tempAnswerMap; // Update the answerMap in the content script
            });
        });
    }
}

function highlightAnswers(question) {
    let correctAnswers = answerMap[question];
    displayText(correctAnswers)

    let responseElements = document.getElementsByClassName("air-item-container")[0].getElementsByClassName("choice-row");

    for (const element of responseElements) {
        if (correctAnswers.includes(element.textContent) && element.style.backgroundColor != "lightgreen") {
            element.style.backgroundColor = "#C6F6C6";
            element.style.border = "1px solid black";
            element.style.borderRadius = "10px";
        }
    }
    return;
}


function displayText (ans) {
    let check = document.getElementById("smartbooksolver-note");
    if (check) {
        return;
    }
    console.log("H: Displaying answer:", ans)
	var div = document.createElement('div');
    div.innerHTML = `<div><p style="font-weight: bold; margin-left: 1rem;">Answer</p></div><div style="margin-left: 1rem;"><p style="color: black;">${ans.join('<br>')}</p></div>`;
	div.id = 'smartbooksolver-note';
	div.style.color = 'lightgray';
	div.style.borderRadius = '10px';
	div.style.border = '2px solid black';
	div.style.textAlign = 'left';
	let container = document.querySelectorAll('.responses-container');
	if(container.length === 0) {
		container = document.querySelectorAll('.dlc_question');
		if(container.length === 0) {
			console.log("H: No container");
			return;
		}
	}
	container[0].appendChild(div);
}

// Define a function to get the answer elements and store the answers
function highlighter() {
    // check if answer stored
    let questionElement = document.getElementsByClassName("prompt");
    let question = ""
    if (questionElement.length > 0) {
        const paragraphElement = questionElement[0].querySelector('p');
        // Filter out the nested <span> elements and retrieve only text nodes
        const textNodes = [...paragraphElement.childNodes].filter(node => node.nodeType === Node.TEXT_NODE);
        question = textNodes.map(node => node.textContent).join('_____');
        if (hasAnsweredQuestion(question) && document.getElementsByClassName("answer-container").length == 0) {
            highlightAnswers(question);
            return;
        }
    }
    // if not, store answers
    let answerContainer = document.getElementsByClassName("answer-container");
    if (answerContainer.length == 0) {
        // store answer for drag and drop
        let answerElements = document.getElementsByClassName("correct-answers");
        let answers = [];
        if (answerElements.length != 0) {
            for (let x = 0; x < answerElements.length; x++) {
                answers.push(answerElements[x].getElementsByClassName("correct-answer")[0].textContent.replace(/,/g, '').split(" ")[0]);            }
            storeAnswers(question, answers)
            return;
        }
        // currently solving it:
        displayText(["We are currently testing many new features. Enabling the bot may fetch the correct answers on the first try.", "You can view stored answers in the flashcard tab in the extension popup. Good luck on your assignment and please leave us feedback :)"])
        return;
    }

    // answer container exists -> store the answers
    let answers = [];
    // get the question name

    // get the answer elements
    let answerElements = document.getElementsByClassName("answer-container")[0].getElementsByClassName("choiceText rs_preserve");
    if (answerElements.length == 0) {
      answerElements = document.getElementsByClassName("answer-container");
    }
    for (let i = 0; i < answerElements.length; i++) {
      answers.push(answerElements[i].textContent);
    }
    storeAnswers(question, answers)
}

// Check page every .6 sec
setInterval(highlighter, 600);