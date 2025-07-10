document.addEventListener('DOMContentLoaded', () => {
    // アプリケーションを非同期で初期化
    initializeApp();
});

async function initializeApp() {
    try {
        // JSONファイルから検査項目の定義を読み込む
        const response = await fetch('test_items.json');
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const testItemsDefinition = await response.json();

        // これ以降のコードは、JSONの読み込みが成功した後に実行される
        setupApplication(testItemsDefinition);

    } catch (error) {
        console.error('検査項目の読み込みに失敗しました:', error);
        // エラーメッセージを画面に表示
        const itemsContainer = document.getElementById('test-items-container');
        if(itemsContainer) {
            itemsContainer.innerHTML = `<p style="color: red;">検査項目の定義ファイル(test_items.json)の読み込みに失敗しました。ファイルが同じフォルダに存在するか確認してください。</p>`;
        }
    }
}

function setupApplication(testItemsDefinition) {
    const form = document.getElementById('input-form');
    const itemsContainer = document.getElementById('test-items-container');
    const dataList = document.getElementById('data-list');
    const inputOrder = [];
    const categories = [...new Set(testItemsDefinition.map(item => item.category))];

    // フォームの動的生成
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
    
    document.querySelectorAll('.accordion-header').forEach(button => {
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

    // --- 入力支援機能 ---
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
                    document.getElementById('memo').focus();
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

    // --- データ管理機能 ---
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const data = {
            id: Date.now(),
            patientId: document.getElementById('patient-id').value,
            testDate: document.getElementById('test-date').value,
            memo: document.getElementById('memo').value,
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
        document.querySelectorAll('input.abnormal').forEach(el => el.classList.remove('abnormal'));
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
    
    // アプリケーションの初期描画
    document.getElementById('test-date').valueAsDate = new Date();
    renderDataList();
}