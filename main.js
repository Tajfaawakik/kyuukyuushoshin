document.addEventListener('DOMContentLoaded', () => {
    // =================================================================================
    // グローバル変数とアプリケーションの状態管理
    // =================================================================================
    let patients = [];
    let activePatientId = null;
    let appData = {}; // 外部JSONデータを保持

    // DOM要素のキャッシュ
    const patientListEl = document.getElementById('patient-list');
    const newPatientBtn = document.getElementById('new-patient-btn');
    const currentPatientNameEl = document.getElementById('current-patient-name');
    const appNav = document.getElementById('app-nav');
    const appContents = document.querySelectorAll('.app-content');
    const chartAppEl = document.getElementById('app-chart');

    // =================================================================================
    // データモデルと永続化
    // =================================================================================
    const createNewPatient = () => ({
        id: `pid_${Date.now()}`,
        name: "新規患者",
        createdAt: new Date().toISOString(),
        chartData: {
            vitals: {},
            consciousness: {},
            physical: {},
            social: {},
            opqrst: {}
        },
        examData: {
            abcde: {}
        },
        diagnosisData: {
            selectionOrder: [],
            recordedDiagnoses: {}, // { symptomName: [disease1, disease2] }
            selectedKeywords: []
        },
        labData: [] // [{type, date, results}]
    });

    const loadPatients = () => {
        const data = localStorage.getItem('kyukyuShinryoAppPatients');
        patients = data ? JSON.parse(data) : [];
    };

    const savePatients = () => {
        localStorage.setItem('kyukyuShinryoAppPatients', JSON.stringify(patients));
    };
    
    const getActivePatient = () => {
        return patients.find(p => p.id === activePatientId);
    }

    // =================================================================================
    // 初期化処理
    // =================================================================================
    const initializeApp = async () => {
        // 外部JSONデータの読み込み
        try {
            const [histories, medSugs, medicalData, symptomKeywords, testItems] = await Promise.all([
                fetch('histories.json').then(res => res.json()),
                fetch('med_suggestions.json').then(res => res.json()),
                fetch('medicalData.json').then(res => res.json()),
                fetch('symptomKeywords.json').then(res => res.json()),
                fetch('test_items.json').then(res => res.json())
            ]);
            appData = { histories, medSugs, medicalData, symptomKeywords, testItems };
        } catch (error) {
            console.error("Failed to load initial data:", error);
            alert("アプリケーションデータの読み込みに失敗しました。");
            return;
        }

        // 患者データのロードと表示
        loadPatients();
        renderPatientList();
        if (patients.length > 0) {
            setActivePatient(patients[0].id);
        } else {
            showEmptyState();
        }

        // イベントリスナーの設定
        newPatientBtn.addEventListener('click', handleNewPatient);
        patientListEl.addEventListener('click', handlePatientSelect);
        appNav.addEventListener('click', handleNavClick);
        
        // 各機能モジュールの初期化
        initializeChartApp();
        initializeExamApp();
        initializeDiagnosisApp();
        initializeLabApp();
    };

    // =================================================================================
    // 患者管理
    // =================================================================================
    const renderPatientList = () => {
        patientListEl.innerHTML = '';
        patients.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        patients.forEach(p => {
            const div = document.createElement('div');
            div.className = `patient-item ${p.id === activePatientId ? 'active' : ''}`;
            div.textContent = p.name || '名称未設定';
            div.dataset.id = p.id;
            patientListEl.appendChild(div);
        });
    };
    
    const setActivePatient = (id) => {
        activePatientId = id;
        const patient = getActivePatient();
        if (patient) {
            currentPatientNameEl.textContent = `編集中: ${patient.name || '名称未設定'}`;
            loadPatientDataIntoUI();
            renderPatientList();
            document.querySelector('.main-content').style.display = 'flex';
        }
    };
    
    const showEmptyState = () => {
        currentPatientNameEl.textContent = '患者を作成または選択してください';
        document.querySelector('.main-content').style.display = 'none';
    }
    
    const handleNewPatient = () => {
        const newPatient = createNewPatient();
        patients.push(newPatient);
        savePatients();
        setActivePatient(newPatient.id);
    };
    
    const handlePatientSelect = (e) => {
        if(e.target.classList.contains('patient-item')) {
            setActivePatient(e.target.dataset.id);
        }
    };
    
    const loadPatientDataIntoUI = () => {
        const patient = getActivePatient();
        if(!patient) return;
        
        // Chart App Data
        const chartData = patient.chartData || {};
        chartAppEl.querySelectorAll('[data-key]').forEach(el => {
            const keyPath = el.dataset.key;
            const keys = keyPath.split('.');
            let value = keys.reduce((obj, key) => (obj && obj[key] !== 'undefined') ? obj[key] : undefined, chartData);
            if (value === undefined) value = '';

            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.value = value;
            } else if (el.classList.contains('button-group')) {
                const values = Array.isArray(value) ? value : [value];
                el.querySelectorAll('button').forEach(btn => {
                    btn.classList.toggle('active', values.includes(btn.dataset.value));
                });
            }
        });

        // Exam App Data
        const examData = patient.examData || {};
        document.getElementById('app-exam').querySelectorAll('[data-key]').forEach(el => {
            const keyPath = el.dataset.key;
            const keys = keyPath.split('.');
            let value = keys.reduce((obj, key) => (obj && obj[key] !== 'undefined') ? obj[key] : undefined, examData);
            if(value !== undefined) el.value = value;
        });
        
        // Diagnosis App
        loadDiagnosisData();

        // Lab App
        renderLabHistory();
    };

    // =================================================================================
    // ナビゲーション
    // =================================================================================
    const handleNavClick = (e) => {
        if (e.target.matches('.nav-button')) {
            const targetId = e.target.dataset.target;
            appNav.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            appContents.forEach(content => {
                content.classList.toggle('active', content.id === targetId);
            });
        }
    };

    // =================================================================================
    // 自動保存ロジック
    // =================================================================================
    const debounce = (func, delay) => {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    };

    const handleAutoSave = (e) => {
        const patient = getActivePatient();
        if (!patient || !e.target.dataset.key) return;

        const keyPath = e.target.dataset.key;
        const keys = keyPath.split('.');
        let current = patient.chartData;

        // Ensure nested objects exist
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) current[keys[i]] = {};
            current = current[keys[i]];
        }

        let value;
        if (e.target.parentElement.classList.contains('button-group')) {
             const activeButtons = e.target.parentElement.querySelectorAll('button.active');
             value = Array.from(activeButtons).map(btn => btn.dataset.value);
             // If only one value possible, don't use array
             if (['gender', 'social.smoking', 'social.drinking', 'triage'].includes(keyPath)) {
                 value = value[0] || '';
             }
        } else {
            value = e.target.value;
        }

        current[keys[keys.length - 1]] = value;
        
        // Update patient name in list if changed
        if (keyPath === 'name') {
            renderPatientList();
            currentPatientNameEl.textContent = `編集中: ${value || '名称未設定'}`;
        }
        
        savePatients();
    };

    // =================================================================================
    // カルテ記載支援 (App 1)
    // =================================================================================
    function initializeChartApp() {
        // ADL項目の生成
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
        const adlContainer = document.getElementById('adl-assessment');
        adlItems.forEach((item, index) => {
             const div = document.createElement('div');
             div.innerHTML = `<label>${item.label}</label><select data-key="adl.${item.label}"></select>`;
             const select = div.querySelector('select');
             item.options.forEach((opt, optIndex) => {
                 select.innerHTML += `<option value="${item.points[optIndex]}">${opt} (${item.points[optIndex]}点)</option>`;
             });
             adlContainer.appendChild(div);
        });

        // 既往歴タグの生成
        const historyTagsContainer = document.getElementById('history-tags');
        appData.histories.forEach(history => {
            historyTagsContainer.innerHTML += `<button data-value="${history}">${history}</button>`;
        });

        chartAppEl.addEventListener('input', debounce(handleAutoSave, 500));
        chartAppEl.addEventListener('click', e => {
            if(e.target.tagName === 'BUTTON' && e.target.parentElement.classList.contains('button-group')) {
                // シングルセレクトの制御
                if(['gender', 'triage'].includes(e.target.parentElement.dataset.key)) {
                    e.target.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                }
                e.target.classList.toggle('active');
                handleAutoSave(e); // 即時保存
            }
        });
        
        // TODO: 内服薬管理ロジック
        
        document.getElementById('copy-chart-btn').addEventListener('click', generateAndCopyChart);
    }
    
    function generateAndCopyChart() {
        const patient = getActivePatient();
        if(!patient) return;

        const chart = patient.chartData || {};
        const exam = patient.examData || {};
        const diag = patient.diagnosisData || {};
        const labs = patient.labData || [];
        
        const adlScore = Object.values(chart.adl || {}).reduce((sum, val) => sum + Number(val), 0);

        let output = `
## S) 主観的情報
- ID: ${chart.id || ''}
- 氏名: ${chart.name || ''}様 (${chart.age || ''}歳, ${chart.gender || ''})
- 主訴: ${chart.cc || ''}
- 現病歴: ${chart.pi || ''}
  - Onset: ${chart.opqrst?.onset || ''}
  - P/P: ${chart.opqrst?.pp || ''}
  - Quality: ${chart.opqrst?.quality || ''}
  - Region/Radiation: ${chart.opqrst?.rr || ''}
  - Severity: ${chart.opqrst?.severity || ''}
  - Time: ${chart.opqrst?.time || ''}
- 既往歴: ${(chart.pmh || []).join(', ')}. ${chart.pmh_text || ''}
- 内服薬: (記載)
- アレルギー: ${(chart.allergies || []).join(', ')}. ${chart.allergies_text || ''}
- 生活歴: 職業(${chart.social?.occupation}), 運動(${chart.social?.exercise}), 喫煙(${chart.social?.smoking}), 飲酒(${chart.social?.drinking})
- 家族歴: ${chart.family_history || ''}

## O) 客観的情報
- Vital: BT ${chart.vitals?.bt}℃, HR ${chart.vitals?.hr}, BP ${chart.vitals?.bp_s}/${chart.vitals?.bp_d}, RR ${chart.vitals?.rr}, SpO2 ${chart.vitals?.spo2}%
- 意識: JCS ${chart.consciousness?.jcs}, GCS ${chart.consciousness?.gcs}
- 身体: ${chart.physical?.height}cm, ${chart.physical?.weight}kg
- ADL: ${adlScore}点
- ABCDE: A(${exam.abcde?.a}), B(${exam.abcde?.b}), C(${exam.abcde?.c}), D(${exam.abcde?.d}), E(${exam.abcde?.e})
- H-t-T: 頭頸部(${exam.head}), 胸部(${exam.chest}), 腹部(${exam.abdomen}), 四肢(${exam.extremities})

## A) 評価
- トリアージ: ${chart.triage || ''}
- 鑑別疾患: ${(diag.recordedDiagnoses ? Object.entries(diag.recordedDiagnoses).map(([s, d]) => `#${s}\n- ${d.join('\n- ')}`).join('\n') : '')}

## P) 計画
- 治療: ${chart.plan?.treatment || ''}
- 検査: ${chart.plan?.tests || ''}
        `.trim();
        
        const outputEl = document.getElementById('final-chart-output');
        outputEl.value = output;
        navigator.clipboard.writeText(output).then(() => alert('カルテをコピーしました'));
    }

    // =================================================================================
    // 身体所見 (App 2)
    // =================================================================================
    function initializeExamApp() {
        document.getElementById('app-exam').addEventListener('input', debounce(e => {
            const patient = getActivePatient();
            if (!patient || !e.target.dataset.key) return;
            const keyPath = e.target.dataset.key;
            const keys = keyPath.split('.');
            let current = patient.examData;
            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]]) current[keys[i]] = {};
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = e.target.value;
            savePatients();
        }, 500));
    }


    // =================================================================================
    // 症候鑑別 (App 3)
    // =================================================================================
    function initializeDiagnosisApp() {
        const symptomSelect = document.getElementById('symptom-select');
        const resultsContainer = document.getElementById('results-container');
        
        appData.medicalData.forEach(item => {
             symptomSelect.innerHTML += `<option value="${item.symptom}">${item.symptom}</option>`;
        });

        symptomSelect.addEventListener('change', () => {
            const patient = getActivePatient();
            if (!patient) return;
            patient.diagnosisData.selectionOrder = Array.from(symptomSelect.selectedOptions).map(opt => opt.value);
            renderDiagnosisResults();
            savePatients();
        });
        
        resultsContainer.addEventListener('click', e => {
            if (e.target.type === 'checkbox') {
                const diseaseName = e.target.dataset.diseaseName;
                const symptomName = e.target.closest('.symptom-group').dataset.symptomName;
                const patient = getActivePatient();
                if (!patient.diagnosisData.recordedDiagnoses) patient.diagnosisData.recordedDiagnoses = {};
                if (!patient.diagnosisData.recordedDiagnoses[symptomName]) patient.diagnosisData.recordedDiagnoses[symptomName] = [];
                
                const list = patient.diagnosisData.recordedDiagnoses[symptomName];
                if (e.target.checked) {
                    if (!list.includes(diseaseName)) list.push(diseaseName);
                } else {
                    const index = list.indexOf(diseaseName);
                    if (index > -1) list.splice(index, 1);
                }
                savePatients();
            }
        });
    }
    
    const loadDiagnosisData = () => {
        const patient = getActivePatient();
        if(!patient || !patient.diagnosisData) return;
        const diagData = patient.diagnosisData;
        const symptomSelect = document.getElementById('symptom-select');
        Array.from(symptomSelect.options).forEach(opt => {
            opt.selected = (diagData.selectionOrder || []).includes(opt.value);
        });
        renderDiagnosisResults();
    }
    
    const renderDiagnosisResults = () => {
        const patient = getActivePatient();
        if(!patient) return;
        const { selectionOrder = [], recordedDiagnoses = {} } = patient.diagnosisData;
        const container = document.getElementById('results-container');
        container.innerHTML = '';
        
        selectionOrder.forEach(symptomName => {
            const symptomData = appData.medicalData.find(d => d.symptom === symptomName);
            if (!symptomData) return;

            const groupDiv = document.createElement('div');
            groupDiv.className = 'symptom-group';
            groupDiv.dataset.symptomName = symptomName;
            groupDiv.innerHTML = `<h3>${symptomName}の鑑別疾患</h3>`;
            
            symptomData.differential_diagnoses.forEach(disease => {
                const isChecked = recordedDiagnoses[symptomName]?.includes(disease.name) || false;
                const card = document.createElement('div');
                card.className = 'disease-card';
                card.innerHTML = `
                    <div class="disease-card-header">
                        <input type="checkbox" data-disease-name="${disease.name}" ${isChecked ? 'checked' : ''}>
                        <h4>${disease.name}</h4>
                    </div>
                    <p><b>問診:</b> ${disease.interview_points.join(', ')}</p>
                    <p><b>診察:</b> ${disease.physical_exam_points.join(', ')}</p>
                `;
                groupDiv.appendChild(card);
            });
            container.appendChild(groupDiv);
        });
    }

    // =================================================================================
    // 検査結果 (App 4)
    // =================================================================================
    function initializeLabApp() {
        const itemsContainer = document.getElementById('test-items-container');
        const categories = [...new Set(appData.testItems.map(item => item.category))];

        categories.forEach(category => {
            const categoryItems = appData.testItems.filter(item => item.category === category);
            let gridHtml = `<fieldset><legend>${category}</legend><div class="category-grid">`;
            categoryItems.forEach(item => {
                gridHtml += `
                    <div class="item-group">
                        <label for="lab-${item.id}">${item.name} (${item.unit})</label>
                        <input type="number" id="lab-${item.id}" step="${item.step}" data-item-id="${item.id}">
                        <div class="reference-value">基準値: ${item.min} - ${item.max}</div>
                    </div>
                `;
            });
            gridHtml += `</div></fieldset>`;
            itemsContainer.innerHTML += gridHtml;
        });

        document.getElementById('lab-nav').addEventListener('click', e => {
            if(e.target.matches('.lab-nav-button')) {
                document.querySelector('.lab-nav-button.active').classList.remove('active');
                e.target.classList.add('active');
                document.querySelectorAll('.lab-content').forEach(c => c.classList.remove('active'));
                document.getElementById(e.target.dataset.target).classList.add('active');
            }
        });
        
        document.getElementById('save-lab-btn').addEventListener('click', () => {
             const patient = getActivePatient();
             if(!patient) return;
             
             const activeTab = document.querySelector('.lab-nav-button.active').dataset.target;
             const labResult = {
                 id: `lab_${Date.now()}`,
                 date: document.getElementById('lab-date').value || new Date().toISOString().split('T')[0],
                 type: document.querySelector(`.lab-nav-button.active`).textContent,
                 results: {}
             };

             if(activeTab === 'lab-blood') {
                 itemsContainer.querySelectorAll('input[type="number"]').forEach(input => {
                     if(input.value) {
                         labResult.results[input.dataset.itemId] = input.value;
                     }
                 });
             } else {
                 labResult.results.findings = document.querySelector(`#${activeTab} textarea`).value;
             }
             
             patient.labData.push(labResult);
             savePatients();
             renderLabHistory();
             // フォームをリセット
             document.querySelector(`#${activeTab}`).querySelectorAll('input, textarea').forEach(el => el.value = '');
        });
    }
    
    const renderLabHistory = () => {
        const patient = getActivePatient();
        const container = document.getElementById('lab-history-list');
        container.innerHTML = '';
        if(!patient || !patient.labData) return;
        
        patient.labData.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(lab => {
            const item = document.createElement('div');
            item.className = 'lab-history-item';
            let resultsText = '';
            if(lab.type === '採血') {
                resultsText = Object.entries(lab.results).map(([key, val]) => `${key}: ${val}`).join(', ');
            } else {
                resultsText = lab.results.findings;
            }
            item.innerHTML = `<h4>${lab.date} - ${lab.type}</h4><p>${resultsText}</p>`;
            container.appendChild(item);
        });
    }

    // =================================================================================
    // アプリケーション起動
    // =================================================================================
    initializeApp();
});