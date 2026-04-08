const API_URL = 'https://YOUR_FUNCTION_APP.azurewebsites.net/api/generate';

const generateForm = document.getElementById('generateForm');
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const overallGoalKeywordsInput = document.getElementById('overallGoalKeywords');
const personalGoalKeywordsInput = document.getElementById('personalGoalKeywords');
const reflectionKeywordsInput = document.getElementById('reflectionKeywords');
const behaviorMemoInput = document.getElementById('behaviorMemo');
const generateBtn = document.getElementById('generateBtn');
const errorMsg = document.getElementById('errorMsg');

const resultOverallGoal = document.getElementById('resultOverallGoal');
const resultPersonalGoal = document.getElementById('resultPersonalGoal');
const resultReflection = document.getElementById('resultReflection');
const resultFiveMinEarly = document.getElementById('resultFiveMinEarly');
const resultGreeting = document.getElementById('resultGreeting');
const resultListening = document.getElementById('resultListening');
const resultConcentration = document.getElementById('resultConcentration');
const copyBtn = document.getElementById('copyBtn');
const retryBtn = document.getElementById('retryBtn');

const defaultCopyButtonText = copyBtn.textContent;

let currentResult = null;
let copyButtonTimerId = null;

function showError(message) {
  errorMsg.textContent = message;
  errorMsg.style.display = 'block';
}

function hideError() {
  errorMsg.textContent = '';
  errorMsg.style.display = 'none';
}

function setStepState(showResult) {
  step1.style.display = showResult ? 'none' : 'block';
  step2.style.display = showResult ? 'block' : 'none';
}

function normalizeResult(data) {
  const reflection = Array.isArray(data?.reflection)
    ? data.reflection.slice(0, 6).map((line) => (typeof line === 'string' ? line : ''))
    : [];

  while (reflection.length < 6) {
    reflection.push('');
  }

  const behaviors =
    data && typeof data.behaviors === 'object' && data.behaviors !== null
      ? data.behaviors
      : {};

  return {
    overallGoal: typeof data?.overallGoal === 'string' ? data.overallGoal : '',
    personalGoal: typeof data?.personalGoal === 'string' ? data.personalGoal : '',
    reflection,
    behaviors: {
      fiveMinEarly:
        typeof behaviors.fiveMinEarly === 'string' ? behaviors.fiveMinEarly : '',
      greeting: typeof behaviors.greeting === 'string' ? behaviors.greeting : '',
      listening: typeof behaviors.listening === 'string' ? behaviors.listening : '',
      concentration:
        typeof behaviors.concentration === 'string' ? behaviors.concentration : '',
    },
  };
}

function renderResult(data) {
  resultOverallGoal.textContent = data.overallGoal;
  resultPersonalGoal.textContent = data.personalGoal;
  resultFiveMinEarly.textContent = data.behaviors.fiveMinEarly;
  resultGreeting.textContent = data.behaviors.greeting;
  resultListening.textContent = data.behaviors.listening;
  resultConcentration.textContent = data.behaviors.concentration;

  resultReflection.replaceChildren();

  data.reflection.forEach((line) => {
    const item = document.createElement('li');
    item.textContent = line;
    resultReflection.appendChild(item);
  });
}

function buildCopyText(data) {
  return [
    `【全体目標】${data.overallGoal}`,
    `【個人目標】${data.personalGoal}`,
    '【振り返り】',
    `1. ${data.reflection[0]}`,
    `2. ${data.reflection[1]}`,
    `3. ${data.reflection[2]}`,
    `4. ${data.reflection[3]}`,
    `5. ${data.reflection[4]}`,
    `6. ${data.reflection[5]}`,
    '【行動項目】',
    `5分前行動: ${data.behaviors.fiveMinEarly}`,
    `挨拶は元気よく: ${data.behaviors.greeting}`,
    `話を聞く姿勢を正す: ${data.behaviors.listening}`,
    `集中力を高めてやる: ${data.behaviors.concentration}`,
  ].join('\n');
}

async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const temporaryTextarea = document.createElement('textarea');
  temporaryTextarea.value = text;
  temporaryTextarea.setAttribute('readonly', '');
  temporaryTextarea.style.position = 'absolute';
  temporaryTextarea.style.left = '-9999px';
  document.body.appendChild(temporaryTextarea);
  temporaryTextarea.select();

  const copied = document.execCommand('copy');
  document.body.removeChild(temporaryTextarea);

  if (!copied) {
    throw new Error('コピーに失敗しました。');
  }
}

function flashCopyButtonText() {
  window.clearTimeout(copyButtonTimerId);
  copyBtn.textContent = 'コピーしました！';
  copyButtonTimerId = window.setTimeout(() => {
    copyBtn.textContent = defaultCopyButtonText;
  }, 1600);
}

async function handleGenerate(event) {
  event.preventDefault();

  const overallGoalKeywords = overallGoalKeywordsInput.value.trim();
  const personalGoalKeywords = personalGoalKeywordsInput.value.trim();
  const reflectionKeywords = reflectionKeywordsInput.value.trim();
  const behaviorMemo = behaviorMemoInput.value.trim();

  if (!overallGoalKeywords || !personalGoalKeywords || !reflectionKeywords) {
    window.alert('必須項目を入力してください。');
    return;
  }

  hideError();
  generateBtn.disabled = true;
  generateBtn.textContent = '生成中...';

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        overallGoalKeywords,
        personalGoalKeywords,
        reflectionKeywords,
        behaviorMemo,
      }),
    });

    let data;

    try {
      data = await response.json();
    } catch (parseError) {
      throw new Error('サーバーから不正なレスポンスが返されました。');
    }

    if (!response.ok) {
      throw new Error(
        typeof data?.error === 'string' ? data.error : '生成に失敗しました。'
      );
    }

    currentResult = normalizeResult(data);
    renderResult(currentResult);
    setStepState(true);
  } catch (error) {
    showError(error instanceof Error ? error.message : '生成に失敗しました。');
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = '生成する';
  }
}

async function handleCopy() {
  if (!currentResult) {
    return;
  }

  try {
    await copyToClipboard(buildCopyText(currentResult));
    flashCopyButtonText();
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'コピーに失敗しました。');
  }
}

function handleRetry() {
  window.clearTimeout(copyButtonTimerId);
  copyBtn.textContent = defaultCopyButtonText;
  setStepState(false);
  hideError();
}

generateForm.addEventListener('submit', handleGenerate);
copyBtn.addEventListener('click', handleCopy);
retryBtn.addEventListener('click', handleRetry);
