document.addEventListener('DOMContentLoaded', async () => {

    // ===== DOM要素の取得 =====
    const formElements = {
        name: document.getElementById('name'),
        age: document.getElementById('age'),
        genderGroup: document.getElementById('gender'),
        historyTags: document.getElementById('history-tags'),
        surgeryHistory: document.getElementById('surgery-history'),
        allergyTags: document.getElementById('allergy-tags'),
        otherAllergies: document.getElementById('other-allergies'),
        medSuggestionContainer: document.getElementById('med-suggestion-tags'),
        medListContainer: document.getElementById('medication-list'),
        addMedRowBtn: document.getElementById('add-med-row'),
        smokingStatusGroup: document.getElementById('smoking-status'),
        smokingDetailsContainer: document.getElementById('smoking-details'),
        drinkingStatusGroup: document.getElementById('drinking-status'),
        drinkingDetailsContainer: document.getElementById('drinking-details'),
        adlAssessmentContainer: document.getElementById('adl-assessment'),
        adlScoreDisplay: document.getElementById('adl-score'),
        outputMemo: document.getElementById('output-memo'),
        copyBtn: document.getElementById('copy-button')
    };

    // ===== データと定義 (ADLのみここに残す) =====
    const adlItems = [
        { label: '食事', points: [10, 5, 0], options: ['自立', '一部介助', '全介助'] },
        { label: '移乗', points: [15, 10, 5, 0], options: ['自立', '監視/助言', '一部介助', '全介助'] },
        { label: '整容', points: [5, 0], options: ['自立', '全介助'] },
        { label: 'トイレ動作', points: [10, 5, 0], options: ['自立', '一部介助', '全介助'] },
        { label: '入浴', points: [5, 0], options: ['自立', '全介助'] },
        { label: '歩行', points: [15, 10, 5, 0], options: ['45m以上自立', '45m以上要介助', '歩行不能だが車椅子自立', '全介助'] },
        { label: '階段昇降', points: [10, 5, 0], options: ['自立', '要介助', '不能'] },
        { label: '着替え', points: [10, 5, 0], options: ['自立', '一部介助', '全介助'] },
        { label: '排便管理', points: [10, 5, 0], options: ['失禁なし', '時々失禁', '失禁あり'] },
        { label: '排尿管理', points: [10, 5, 0], options: ['失禁なし', '時々失禁', '失禁あり'] },
    ];
    
    // 外部ファイルから読み込むデータを格納する変数
    let historyList = [];
    let medSuggestions = {};

    // ===== 初期化処理 =====
    async function initialize() {
        // 外部JSONファイルの読み込み
        try {
            const [historiesRes, medsRes] = await Promise.all([
                fetch('histories.json'),
                fetch('med_suggestions.json')
            ]);
            historyList = await historiesRes.json();
            medSuggestions = await medsRes.json();
        } catch (error) {
            console.error('設定ファイルの読み込みに失敗しました:', error);
            alert('設定ファイルの読み込みに失敗しました。');
            return;
        }

        // 既往歴タグの動的生成
        historyList.forEach(history => {
            const button = document.createElement('button');
            button.dataset.value = history;
            button.textContent = history;
            formElements.historyTags.appendChild(button);
        });

        // ADL評価項目の生成
        adlItems.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'adl-item';
            const label = document.createElement('label');
            label.textContent = item.label;
            const select = document.createElement('select');
            select.dataset.index = index;
            item.options.forEach((opt, optIndex) => {
                const option = document.createElement('option');
                option.value = item.points[optIndex];
                option.textContent = `${opt} (${option.value}点)`;
                select.appendChild(option);
            });
            div.appendChild(label);
            div.appendChild(select);
            formElements.adlAssessmentContainer.appendChild(div);
        });

        // イベントリスナーの設定
        document.querySelector('.container').addEventListener('input', updateOutput);
        document.querySelector('.container').addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON' && !e.target.id.includes('copy') && !e.target.id.includes('add')) {
                if(e.target.parentElement.classList.contains('button-group')) {
                    e.target.classList.toggle('active');
                }
                
                if(e.target.parentElement.id === 'med-suggestion-tags') {
                    toggleMedication(e.target.dataset.value);
                }

                if(e.target.parentElement.id === 'smoking-status') handleSmokingDetails(e.target);
                if(e.target.parentElement.id === 'drinking-status') handleDrinkingDetails(e.target);
                
                updateOutput();
            }
        });

        formElements.addMedRowBtn.addEventListener('click', () => addMedicationRow());
        formElements.medListContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-button')) {
                e.target.closest('.med-row').remove();
                updateOutput();
            }
        });
        formElements.copyBtn.addEventListener('click', copyToClipboard);

        updateOutput(); // 初期表示
    }

    // ===== 機能関数 (変更なし、ただしグローバルスコープのmedSuggestionsを参照するようになる) =====
    
    function getActiveButtonValues(groupElement) {
        return Array.from(groupElement.querySelectorAll('button.active')).map(btn => btn.dataset.value);
    }

    function toggleMedication(medName) {
        const existingMeds = Array.from(formElements.medListContainer.querySelectorAll('input[type="text"]')).map(input => input.value);
        if (existingMeds.includes(medName)) {
            formElements.medListContainer.querySelectorAll('.med-row').forEach(row => {
                if (row.querySelector('input[type="text"]').value === medName) {
                    row.remove();
                }
            });
        } else {
            addMedicationRow(medName);
        }
    }
    
    function addMedicationRow(name = '', usage = '') {
        const div = document.createElement('div');
        div.className = 'med-row';
        div.innerHTML = `
            <input type="text" class="med-name" placeholder="薬剤名" value="${name}">
            <input type="text" class="med-usage" placeholder="用法・用量" value="${usage}">
            <button class="delete-button">×</button>
        `;
        formElements.medListContainer.appendChild(div);
    }
    
    function handleSmokingDetails(targetButton) {
        const value = targetButton.dataset.value;
        if(value === 'なし' || targetButton.classList.contains('active')) {
             formElements.smokingDetailsContainer.innerHTML = '';
        } else {
            formElements.smokingDetailsContainer.innerHTML = `
                <input type="number" id="smoking-years" placeholder="年数"> 年間
                <input type="number" id="smoking-amount" placeholder="本数"> 本/日
            `;
        }
    }
    
    function handleDrinkingDetails(targetButton) {
        const value = targetButton.dataset.value;
         if(value === 'なし' || targetButton.classList.contains('active')) {
            formElements.drinkingDetailsContainer.innerHTML = '';
        } else {
            formElements.drinkingDetailsContainer.innerHTML = `
                <input type="text" id="drinking-type" placeholder="種類（ビール, 日本酒など）">
                <input type="text" id="drinking-amount" placeholder="量（350ml/日など）">
            `;
        }
    }

    function calculateAdlScore() {
        let total = 0;
        formElements.adlAssessmentContainer.querySelectorAll('select').forEach(select => {
            total += Number(select.value);
        });
        formElements.adlScoreDisplay.textContent = `ADL合計: ${total} / 100点`;
        return total;
    }

    function updateMedSuggestions(histories) {
        formElements.medSuggestionContainer.innerHTML = '';
        const suggestions = new Set();
        histories.forEach(history => {
            if(medSuggestions[history]) {
                medSuggestions[history].forEach(med => suggestions.add(med));
            }
        });
        
        suggestions.forEach(med => {
            const btn = document.createElement('button');
            btn.dataset.value = med;
            btn.textContent = med;
            formElements.medSuggestionContainer.appendChild(btn);
        });
    }

    function updateOutput() {
        const values = {
            name: formElements.name.value,
            age: formElements.age.value,
            gender: getActiveButtonValues(formElements.genderGroup).join(', '),
            histories: getActiveButtonValues(formElements.historyTags),
            surgery: formElements.surgeryHistory.value,
            allergies: getActiveButtonValues(formElements.allergyTags).join(', ') || '特になし',
            otherAllergies: formElements.otherAllergies.value,
            medications: Array.from(formElements.medListContainer.querySelectorAll('.med-row')).map(row => {
                const name = row.querySelector('.med-name').value;
                const usage = row.querySelector('.med-usage').value;
                return `${name} ${usage}`.trim();
            }).filter(med => med),
            smokingStatus: getActiveButtonValues(formElements.smokingStatusGroup).join(''),
            drinkingStatus: getActiveButtonValues(formElements.drinkingStatusGroup).join(''),
            adlScore: calculateAdlScore()
        };

        updateMedSuggestions(values.histories);

        let smokingText = values.smokingStatus;
        if (smokingText && smokingText !== 'なし') {
            const years = document.getElementById('smoking-years')?.value || '';
            const amount = document.getElementById('smoking-amount')?.value || '';
            smokingText += ` (${amount}本/日 x ${years}年)`;
        }
        
        let drinkingText = values.drinkingStatus;
        if (drinkingText && drinkingText !== 'なし') {
            const type = document.getElementById('drinking-type')?.value || '';
            const amount = document.getElementById('drinking-amount')?.value || '';
            drinkingText += ` (${type}を${amount})`;
        }

        const output = `
【患者情報】
氏名：${values.name || '未入力'} 様
年齢：${values.age || '未入力'} 歳
性別：${values.gender || '未選択'}

【既往歴】
・${values.histories.join('、') || '特記事項なし'}
${values.surgery ? '・手術歴/特記事項：' + values.surgery : ''}

【アレルギー】
・${values.allergies}
${values.otherAllergies ? '・その他：' + values.otherAllergies : ''}

【内服薬】
${values.medications.length > 0 ? values.medications.map(m => `・${m}`).join('\n') : '・なし'}

【生活歴】
喫煙：${smokingText || '未選択'}
飲酒：${drinkingText || '未選択'}

【ADL】
Barthel Index: ${values.adlScore}点
        `.trim();

        formElements.outputMemo.value = output;
    }

    function copyToClipboard() {
        if (!navigator.clipboard) {
            formElements.outputMemo.select();
            document.execCommand('copy');
        } else {
            navigator.clipboard.writeText(formElements.outputMemo.value).catch(err => {
                console.error('クリップボードへのコピーに失敗しました: ', err);
            });
        }
        formElements.copyBtn.textContent = 'コピーしました！';
        setTimeout(() => {
            formElements.copyBtn.textContent = 'クリップボードにコピー';
        }, 1500);
    }

    // アプリケーションの実行開始
    initialize();
});