document.addEventListener('DOMContentLoaded', () => {

    // ===== Global App Navigation =====
    const navContainer = document.getElementById('app-nav');
    const contentContainers = document.querySelectorAll('.app-content');
    const navButtons = document.querySelectorAll('.nav-button');

    // Initialize all apps
    const appInitializers = {
        app1: initializeChartSupportApp,
        app2: initializeDiagnosisSupportApp,
        app3: initializeBloodTestApp
    };

    const initializedApps = new Set();

    function switchApp(targetId) {
        contentContainers.forEach(container => {
            container.classList.remove('active');
        });
        navButtons.forEach(button => {
            button.classList.remove('active');
        });

        document.getElementById(targetId).classList.add('active');
        document.querySelector(`.nav-button[data-target="${targetId}"]`).classList.add('active');

        // Initialize the app only on its first load
        if (!initializedApps.has(targetId)) {
            appInitializers[targetId]();
            initializedApps.add(targetId);
        }
    }

    navContainer.addEventListener('click', (e) => {
        if (e.target.matches('.nav-button')) {
            const targetId = e.target.dataset.target;
            switchApp(targetId);
        }
    });

    // Initialize the first app by default
    switchApp('app1');


    // ===== App 1: カルテ記載支援 =====
    function initializeChartSupportApp() {
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
            copyBtn: document.getElementById('copy-button-app1')
        };

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
        
        let historyList = [];
        let medSuggestions = {};

        async function initialize() {
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

            historyList.forEach(history => {
                const button = document.createElement('button');
                button.dataset.value = history;
                button.textContent = history;
                formElements.historyTags.appendChild(button);
            });

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

            document.querySelector('#app1 .container-app1').addEventListener('input', updateOutput);
            document.querySelector('#app1 .container-app1').addEventListener('click', (e) => {
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
            updateOutput();
        }

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

        initialize();
    }


    // ===== App 2: 症候鑑別支援 =====
    function initializeDiagnosisSupportApp() {
        const symptomSelect = document.getElementById('symptom-select');
        const resultsContainer = document.getElementById('results-container');
        const selectedKeywordsContainer = document.getElementById('selected-keywords-tags');
        const copyTextArea = document.getElementById('copy-textarea');
        const copyButton = document.getElementById('copy-button-app2');

        let medicalData = [];
        let keywordsForDetection = [];
        let selectionOrder = [];
        let lastSelectedSet = new Set();
        let pinnedItems = new Map();
        let selectedKeywords = new Set();
        let recordedDiagnoses = new Map();

        async function loadDataAndInitialize() {
            try {
                const [medicalResponse, keywordsResponse] = await Promise.all([
                    fetch('medicalData.json'),
                    fetch('symptomKeywords.json')
                ]);
                medicalData = await medicalResponse.json();
                keywordsForDetection = await keywordsResponse.json();
                initialize();
            } catch (error) {
                console.error('データの読み込みに失敗しました:', error);
                resultsContainer.innerHTML = '<p style="color: red;">アプリケーションデータの読み込みに失敗しました。</p>';
            }
        }

        function initialize() {
            populateSymptomDropdown();
            symptomSelect.addEventListener('change', handleSymptomSelectionChange);
            selectedKeywordsContainer.addEventListener('click', handleTagClick);
            resultsContainer.addEventListener('click', handleCardClick);
            copyButton.addEventListener('click', handleCopyButtonClick);
            render();
        }

        function handleSymptomSelectionChange() {
            const currentSelectedSet = new Set(Array.from(symptomSelect.selectedOptions).map(opt => opt.value));
            selectionOrder = selectionOrder.filter(symptom => currentSelectedSet.has(symptom));
            currentSelectedSet.forEach(symptom => {
                if (!lastSelectedSet.has(symptom)) {
                    selectionOrder.push(symptom);
                }
            });
            lastSelectedSet = currentSelectedSet;
            render();
        }

        function populateSymptomDropdown() {
            // Avoid re-populating if already done
            if(symptomSelect.options.length > 0) return;
            
            const symptoms = medicalData.map(item => item.symptom);
            const uniqueSymptoms = [...new Set(symptoms)];
            uniqueSymptoms.forEach(symptom => {
                const option = document.createElement('option');
                option.value = symptom;
                option.textContent = symptom;
                symptomSelect.appendChild(option);
            });
        }

        function render() {
            renderResults();
            renderSelectedKeywordTags();
            updateCopyTextArea();
        }

        function renderResults() {
            resultsContainer.innerHTML = '';
            if (selectionOrder.length === 0) {
                resultsContainer.innerHTML = '<p>症候を選択すると、ここに関連する鑑別疾患が表示されます。</p>';
                return;
            }

            selectionOrder.forEach((symptomName, index) => {
                const symptomData = medicalData.find(d => d.symptom === symptomName);
                if (!symptomData) return;

                const groupDiv = document.createElement('div');
                groupDiv.className = 'symptom-group';
                groupDiv.dataset.symptomName = symptomName;
                if (index === 0) {
                    groupDiv.classList.add('primary');
                }

                const title = document.createElement('h2');
                title.textContent = `${symptomName} の鑑別疾患`;
                if (index === 0) {
                    const badge = document.createElement('span');
                    badge.className = 'primary-badge';
                    badge.textContent = '主訴';
                    title.appendChild(badge);
                }
                groupDiv.appendChild(title);
                
                const pinnedSet = pinnedItems.get(symptomName) || new Set();
                const sortedDiagnoses = [...symptomData.differential_diagnoses].sort((a, b) => {
                    const aIsPinned = pinnedSet.has(a.name);
                    const bIsPinned = pinnedSet.has(b.name);
                    if (aIsPinned && !bIsPinned) return -1;
                    if (!aIsPinned && bIsPinned) return 1;
                    return 0;
                });

                if (sortedDiagnoses.length === 0) {
                    groupDiv.appendChild(document.createElement('p')).textContent = 'この症候に関連する鑑別疾患は見つかりませんでした。';
                } else {
                    sortedDiagnoses.forEach(disease => {
                        const card = createDiseaseCard(disease, symptomName);
                        groupDiv.appendChild(card);
                    });
                }
                resultsContainer.appendChild(groupDiv);
            });
        }

        function createDiseaseCard(disease, symptomName) {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'disease-card';
            const isPinned = pinnedItems.get(symptomName)?.has(disease.name);
            if (isPinned) cardDiv.classList.add('pinned');

            const cardHeader = document.createElement('div');
            cardHeader.className = 'disease-card-header';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'diagnosis-checkbox';
            checkbox.dataset.diseaseName = disease.name;
            checkbox.checked = recordedDiagnoses.get(symptomName)?.has(disease.name) || false;
            cardHeader.appendChild(checkbox);

            const diseaseNameEl = document.createElement('h3');
            diseaseNameEl.textContent = disease.name;
            cardHeader.appendChild(diseaseNameEl);

            const pinButton = document.createElement('button');
            pinButton.className = 'pin-button';
            pinButton.textContent = '📌';
            pinButton.dataset.diseaseName = disease.name;
            pinButton.title = '最上位に固定/解除';
            if (isPinned) pinButton.classList.add('pinned');
            cardHeader.appendChild(pinButton);
            cardDiv.appendChild(cardHeader);

            const interviewTitle = document.createElement('h4');
            interviewTitle.textContent = '医療面接のポイント';
            cardDiv.appendChild(interviewTitle);
            disease.interview_points.forEach(point => cardDiv.appendChild(document.createElement('p')).innerHTML = highlightKeywords(point));

            const examTitle = document.createElement('h4');
            examTitle.textContent = '身体診察のポイント';
            cardDiv.appendChild(examTitle);
            disease.physical_exam_points.forEach(point => cardDiv.appendChild(document.createElement('p')).innerHTML = highlightKeywords(point));

            return cardDiv;
        }

        function highlightKeywords(text) {
            if (!Array.isArray(keywordsForDetection)) return text;
            let highlightedText = text;
            keywordsForDetection.forEach(keyword => {
                if (!keyword?.trim()) return;
                const isHighlighted = selectedKeywords.has(keyword) ? 'highlighted' : '';
                try {
                    const regex = new RegExp(keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
                    highlightedText = highlightedText.replace(regex, match => {
                        if (highlightedText.includes(`<span class="clickable-keyword`)) {
                            const tempText = highlightedText.substring(0, highlightedText.indexOf(match));
                            if ((tempText.match(/<span/g) || []).length > (tempText.match(/<\/span>/g) || []).length) return match;
                        }
                        return `<span class="clickable-keyword ${isHighlighted}" data-keyword="${match}">${match}</span>`;
                    });
                } catch (e) { console.error("Invalid regex pattern for keyword:", keyword); }
            });
            return highlightedText;
        }
        
        function handleCardClick(event) {
            const keywordTarget = event.target.closest('.clickable-keyword');
            const pinTarget = event.target.closest('.pin-button');
            const checkboxTarget = event.target.closest('.diagnosis-checkbox');

            if (keywordTarget) handleKeywordClick(keywordTarget);
            else if (pinTarget) handlePinClick(pinTarget);
            else if (checkboxTarget) handleDiagnosisRecord(checkboxTarget);
        }

        function handleDiagnosisRecord(target) {
            const diseaseName = target.dataset.diseaseName;
            const symptomName = target.closest('.symptom-group').dataset.symptomName;
            if (!recordedDiagnoses.has(symptomName)) {
                recordedDiagnoses.set(symptomName, new Set());
            }
            const recordedSet = recordedDiagnoses.get(symptomName);
            if (target.checked) {
                recordedSet.add(diseaseName);
            } else {
                recordedSet.delete(diseaseName);
            }
            updateCopyTextArea();
        }

        function handleKeywordClick(target) {
            const keyword = target.dataset.keyword;
            if (selectedKeywords.has(keyword)) {
                selectedKeywords.delete(keyword);
            } else {
                selectedKeywords.add(keyword);
            }
            render();
        }
        
        function handlePinClick(target) {
            const diseaseName = target.dataset.diseaseName;
            const symptomName = target.closest('.symptom-group').dataset.symptomName;
            if (!pinnedItems.has(symptomName)) {
                pinnedItems.set(symptomName, new Set());
            }
            const pinnedSet = pinnedItems.get(symptomName);
            if (pinnedSet.has(diseaseName)) {
                pinnedSet.delete(diseaseName);
            } else {
                pinnedSet.add(diseaseName);
            }
            render();
        }
        
        function handleTagClick(event) {
            const target = event.target.closest('.keyword-tag');
            if (target) {
                const keyword = target.dataset.keyword;
                if (keyword && selectedKeywords.has(keyword)) {
                    selectedKeywords.delete(keyword);
                    render();
                }
            }
        }
        
        function handleCopyButtonClick() {
            if (!copyTextArea.value) return;
            navigator.clipboard.writeText(copyTextArea.value).then(() => {
                const originalText = copyButton.textContent;
                copyButton.textContent = 'コピーしました！';
                setTimeout(() => {
                    copyButton.textContent = originalText;
                }, 2000);
            }).catch(err => {
                console.error('クリップボードへのコピーに失敗しました: ', err);
                alert('コピーに失敗しました。');
            });
        }

        function renderSelectedKeywordTags() {
            selectedKeywordsContainer.innerHTML = '';
            if (selectedKeywords.size === 0) {
                selectedKeywordsContainer.innerHTML = '<span>なし</span>';
                return;
            }
            selectedKeywords.forEach(keyword => {
                const tag = document.createElement('span');
                tag.className = 'keyword-tag';
                tag.textContent = keyword;
                tag.dataset.keyword = keyword;
                tag.title = 'クリックして選択解除';
                tag.appendChild(document.createElement('span')).className = 'remove-tag';
                selectedKeywordsContainer.appendChild(tag);
            });
        }

        function updateCopyTextArea() {
            let text = '';
            if (selectionOrder.length > 0) {
                text += '■ 症候\n';
                text += `主訴: ${selectionOrder[0]}\n`;
                if (selectionOrder.length > 1) {
                    text += `その他: ${selectionOrder.slice(1).join(', ')}\n`;
                }
                text += '\n';
            }
            if (recordedDiagnoses.size > 0) {
                let hasRecorded = false;
                let diagnosisText = '■ 鑑別疾患\n';
                recordedDiagnoses.forEach((diseases, symptom) => {
                    if (diseases.size > 0) {
                        hasRecorded = true;
                        diagnosisText += `# ${symptom}\n`;
                        diseases.forEach(disease => {
                            diagnosisText += `- ${disease}\n`;
                        });
                    }
                });
                if(hasRecorded) text += diagnosisText + '\n';
            }
            if (selectedKeywords.size > 0) {
                text += '■ 選択キーワード (身体所見など)\n';
                selectedKeywords.forEach(keyword => {
                    text += `- ${keyword}\n`;
                });
                text += '\n';
            }
            copyTextArea.value = text.trim();
        }
        loadDataAndInitialize();
    }


    // ===== App 3: 採血結果入力 =====
    function initializeBloodTestApp() {
        async function initializeApp() {
            try {
                const response = await fetch('test_items.json');
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                const testItemsDefinition = await response.json();
                setupApplication(testItemsDefinition);
            } catch (error) {
                console.error('検査項目の読み込みに失敗しました:', error);
                const itemsContainer = document.getElementById('test-items-container');
                if(itemsContainer) {
                    itemsContainer.innerHTML = `<p style="color: red;">検査項目の定義ファイル(test_items.json)の読み込みに失敗しました。</p>`;
                }
            }
        }

        function setupApplication(testItemsDefinition) {
            const form = document.querySelector('#app3 #input-form');
            const itemsContainer = document.getElementById('test-items-container');
            const dataList = document.getElementById('data-list');
            const inputOrder = [];
            const categories = [...new Set(testItemsDefinition.map(item => item.category))];

            categories.forEach(category => {
                const categoryItems = testItemsDefinition.filter(item => item.category === category);
                const isAlwaysVisible = ['血算', '生化学', '電解質'].includes(category);
                const header = document.createElement(isAlwaysVisible ? 'h2' : 'button');
                header.textContent = category;
                if (!isAlwaysVisible) {
                    header.className = 'accordion-header';
                    header.type = 'button';
                }
                itemsContainer.appendChild(header);

                const content = document.createElement('div');
                content.className = isAlwaysVisible ? '' : 'accordion-content';
                itemsContainer.appendChild(content);

                const grid = document.createElement('div');
                grid.className = 'category-grid';
                content.appendChild(grid);
                
                if (category === '電解質') {
                    const alwaysVisibleGrid = document.createElement('div');
                    alwaysVisibleGrid.className = 'category-grid';
                    content.appendChild(alwaysVisibleGrid);

                    const accordionHeader = document.createElement('button');
                    accordionHeader.type = 'button';
                    accordionHeader.className = 'accordion-header';
                    accordionHeader.textContent = 'その他 (Ca, P, Mg)';
                    accordionHeader.style.marginTop = '10px';
                    content.appendChild(accordionHeader);
                    
                    const accordionContent = document.createElement('div');
                    accordionContent.className = 'accordion-content';
                    content.appendChild(accordionContent);
                    
                    const collapsibleGrid = document.createElement('div');
                    collapsibleGrid.className = 'category-grid';
                    accordionContent.appendChild(collapsibleGrid);

                    categoryItems.forEach(item => {
                        const targetGrid = item.alwaysVisible ? alwaysVisibleGrid : collapsibleGrid;
                        createInputItem(item, targetGrid);
                    });
                } else {
                    categoryItems.forEach(item => createInputItem(item, grid));
                }
            });
            
            function createInputItem(item, parentElement) {
                const group = document.createElement('div');
                group.className = 'item-group';
                const label = document.createElement('label');
                label.htmlFor = item.id;
                label.textContent = `${item.name} (${item.unit})`;
                group.appendChild(label);
                const input = document.createElement('input');
                input.type = 'number';
                input.id = item.id;
                input.step = item.step;
                input.dataset.itemId = item.id;
                group.appendChild(input);
                const refValue = document.createElement('div');
                refValue.className = 'reference-value';
                refValue.textContent = `基準値: ${item.min} - ${item.max}`;
                group.appendChild(refValue);
                parentElement.appendChild(group);
                inputOrder.push(input);
            }
            
            itemsContainer.querySelectorAll('.accordion-header').forEach(button => {
                button.addEventListener('click', () => {
                    button.classList.toggle('active');
                    const content = button.nextElementSibling;
                    if (content.style.maxHeight) {
                        content.style.maxHeight = null;
                    } else {
                        content.style.maxHeight = content.scrollHeight + "px";
                    }
                });
            });

            form.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const target = e.target;
                    if (target.tagName === 'INPUT') {
                        e.preventDefault();
                        const currentIndex = inputOrder.findIndex(input => input.id === target.id);
                        const nextInput = inputOrder[currentIndex + 1];
                        if (nextInput) {
                            nextInput.focus();
                        } else {
                            document.querySelector('#app3 #memo').focus();
                        }
                    }
                }
            });

            itemsContainer.addEventListener('keydown', handleArrowKeys);
            itemsContainer.addEventListener('focusin', handleFocus);
            itemsContainer.addEventListener('input', handleInput);

            function handleArrowKeys(e) {
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    const input = e.target;
                    if (input.type === 'number') {
                        e.preventDefault();
                        const item = findItemById(input.dataset.itemId);
                        if (!item) return;
                        let value = parseFloat(input.value) || 0;
                        value += (e.key === 'ArrowUp' ? item.step : -item.step);
                        input.value = parseFloat(value.toFixed(10));
                        checkAbnormality(input, item);
                    }
                }
            }

            function handleFocus(e) {
                const input = e.target;
                if (input.type === 'number' && !input.value) {
                    const item = findItemById(input.dataset.itemId);
                    if (item) {
                        input.value = item.max; 
                        checkAbnormality(input, item);
                    }
                }
            }
            
            function handleInput(e) {
                const input = e.target;
                 if (input.type === 'number') {
                    const item = findItemById(input.dataset.itemId);
                    if(item) checkAbnormality(input, item);
                 }
            }

            function findItemById(id) {
                return testItemsDefinition.find(item => item.id === id);
            }

            function checkAbnormality(input, item) {
                const value = parseFloat(input.value);
                if (isNaN(value)) {
                    input.classList.remove('abnormal');
                    return;
                }
                if (value < item.min || value > item.max) {
                    input.classList.add('abnormal');
                } else {
                    input.classList.remove('abnormal');
                }
            }

            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const data = {
                    id: Date.now(),
                    patientId: document.querySelector('#app3 #patient-id').value,
                    testDate: document.querySelector('#app3 #test-date').value,
                    memo: document.querySelector('#app3 #memo').value,
                    results: {}
                };
                testItemsDefinition.forEach(item => {
                    const input = document.getElementById(item.id);
                    if(input.value !== '') {
                        data.results[item.id] = input.value;
                    }
                });
                const savedData = getSavedData();
                savedData.push(data);
                localStorage.setItem('bloodTestData', JSON.stringify(savedData));
                renderDataList();
                form.reset();
                document.querySelectorAll('#app3 input.abnormal').forEach(el => el.classList.remove('abnormal'));
            });

            function getSavedData() {
                return JSON.parse(localStorage.getItem('bloodTestData')) || [];
            }

            function renderDataList() {
                dataList.innerHTML = '';
                const savedData = getSavedData();
                savedData.sort((a, b) => new Date(b.testDate) - new Date(a.testDate));
                savedData.forEach(data => {
                    const record = document.createElement('div');
                    record.className = 'data-record';
                    let resultsHtml = '';
                    categories.forEach(category => {
                        const categoryItems = testItemsDefinition.filter(item => item.category === category);
                        const resultsInCategory = categoryItems
                            .map(item => data.results[item.id] ? `<li>${item.name}: ${data.results[item.id]}</li>` : '')
                            .join('');

                        if (resultsInCategory) {
                            resultsHtml += `<div><strong>${category}</strong><ul>${resultsInCategory}</ul></div>`;
                        }
                    });

                    record.innerHTML = `
                        <button class="delete-button" data-id="${data.id}">&times;</button>
                        <h3>患者ID: ${data.patientId} | 検査日: ${data.testDate}</h3>
                        <div class="data-record-grid">${resultsHtml}</div>
                        ${data.memo ? `<p><strong>メモ:</strong> ${data.memo}</p>` : ''}
                    `;
                    dataList.appendChild(record);
                });
            }

            dataList.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-button')) {
                    if (confirm('このデータを削除してもよろしいですか？')) {
                        const idToDelete = Number(e.target.dataset.id);
                        let savedData = getSavedData();
                        savedData = savedData.filter(data => data.id !== idToDelete);
                        localStorage.setItem('bloodTestData', JSON.stringify(savedData));
                        renderDataList();
                    }
                }
            });
            
            document.querySelector('#app3 #test-date').valueAsDate = new Date();
            renderDataList();
        }

        initializeApp();
    }
});