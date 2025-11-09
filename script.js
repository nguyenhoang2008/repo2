// Biến toàn cục
let currentPage = 1;
let userName = "";
let selectedSubject = null;
let questions = [];
let currentQuestionIndex = 0;
let userAnswers = [];
let finalAnswers = [];
let results = [];
let shuffleQuestions = false;
let shuffleAnswers = false;
let quizData = {};
let fileList = [];

// Biến cho cài đặt môn học
let subjectSettings = {};
let currentSettingsSubject = null;

// Constants cho các loại câu hỏi
const QUESTION_TYPES = {
    MULTIPLE_CHOICE: 'multiple_choice',
    SHORT_ANSWER: 'short_answer',
    TRUE_FALSE_SET: 'true_false_set'
};

// Khởi tạo ứng dụng
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Ứng dụng đang khởi động...');
    try {
        await loadConfig();
        loadUserData();
        await loadAllQuizData();
        initializeSubjects();
        setupEventListeners();
        setupModal();
        console.log('✅ Ứng dụng khởi động thành công!');
    } catch (error) {
        console.error('❌ Lỗi khởi động ứng dụng:', error);
        alert('Có lỗi xảy ra khi khởi động ứng dụng. Vui lòng tải lại trang.');
    }
});

// Tải cấu hình
async function loadConfig() {
    try {
        console.log('⚙️ Đang tải config.json...');
        const response = await fetch('config.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const config = await response.json();
        
        fileList = config.files || [];
        
        console.log('✅ Config loaded:', config);
        console.log('📋 File list:', fileList);
        
    } catch (error) {
        console.error('❌ Lỗi tải config:', error);
        fileList = [];
    }
}

// Tải dữ liệu người dùng từ localStorage
function loadUserData() {
    console.log('👤 Đang tải user data từ localStorage...');
    
    // User name
    const savedName = localStorage.getItem('quizUserName');
    if (savedName) {
        document.getElementById('userName').value = savedName;
    }
    
    // Cài đặt xáo trộn
    shuffleQuestions = localStorage.getItem('quizShuffleQuestions') === 'true';
    shuffleAnswers = localStorage.getItem('quizShuffleAnswers') === 'true';
    
    // Cài đặt môn học
    const savedSettings = localStorage.getItem('quizSubjectSettings');
    if (savedSettings) {
        subjectSettings = JSON.parse(savedSettings);
    }
    
    // Áp dụng lên giao diện
    document.getElementById('shuffleQuestions').checked = shuffleQuestions;
    document.getElementById('shuffleAnswers').checked = shuffleAnswers;
    
    console.log('✅ User settings loaded:', { shuffleQuestions, shuffleAnswers });
}

// Tải TẤT CẢ file JSON từ danh sách trong config
async function loadAllQuizData() {
    console.log('📁 Bắt đầu tải file từ config...');
    
    if (fileList.length === 0) {
        console.log('❌ Không có file nào trong config');
        alert('❌ Không có file dữ liệu! Vui lòng kiểm tra config.json');
        return;
    }
    
    let loadedCount = 0;
    
    console.log(`🔍 Đang tải ${fileList.length} file...`);
    
    for (const fileName of fileList) {
        try {
            console.log(`📥 Đang tải: data/${fileName}`);
            const response = await fetch(`data/${fileName}`);
            
            if (!response.ok) {
                console.log(`❌ Không tìm thấy: ${fileName}`);
                continue;
            }
            
            const data = await response.json();
            
            if (!data.Mon || !data.QA) {
                console.log(`❌ Cấu trúc file ${fileName} không đúng`);
                continue;
            }
            
            if (!Array.isArray(data.QA) || data.QA.length === 0) {
                console.log(`❌ File ${fileName} không có câu hỏi`);
                continue;
            }
            
            // Chuẩn hóa dữ liệu
            const normalizedQA = data.QA.map(normalizeQuestionData);
            
            const key = fileName.replace('.json', '');
            quizData[key] = {
                ...data,
                QA: normalizedQA
            };
            
            loadedCount++;
            console.log(`✅ Đã tải: ${fileName} (${normalizedQA.length} câu) - ${data.Mon}`);
            
        } catch (error) {
            console.error(`❌ Lỗi khi tải ${fileName}:`, error);
        }
    }
    
    console.log(`📊 Kết quả: Đã tải ${loadedCount}/${fileList.length} files`);
    console.log('🎯 Các môn đã tải:', Object.keys(quizData));
    
    if (loadedCount === 0) {
        alert('❌ Không tải được file dữ liệu nào! Vui lòng kiểm tra file trong thư mục data/');
    }
}

// Chuẩn hóa dữ liệu câu hỏi
function normalizeQuestionData(rawQuestion) {
    const normalized = { ...rawQuestion };
    
    // Chuẩn hóa tên field từ JSON mới
    if (normalized.correct !== undefined) {
        if (normalized.type === QUESTION_TYPES.MULTIPLE_CHOICE || !normalized.type) {
            normalized.True = normalized.correct;
        } else if (normalized.type === QUESTION_TYPES.SHORT_ANSWER) {
            normalized.correctAnswer = normalized.correct;
        }
        // True/False Set giữ nguyên structure
    }
    
    // Đảm bảo có ID
    if (!normalized.id) {
        normalized.id = `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    return normalized;
}

// Khởi tạo danh sách môn học (BẢN FIX ỔN ĐỊNH)
function initializeSubjects() {
    console.log('📚 [Init] Đang khởi tạo danh sách môn học...');
    const subjectList = document.getElementById('subjectList');
    subjectList.innerHTML = '';

    const subjectKeys = Object.keys(quizData);
    console.log('📋 Số môn học tìm thấy:', subjectKeys.length);

    if (subjectKeys.length === 0) {
        subjectList.innerHTML =
            '<div style="text-align:center; color:var(--error); padding:20px;">❌ Không có dữ liệu môn học. Vui lòng kiểm tra file JSON trong thư mục data/</div>';
        return;
    }

    // Sắp xếp tên môn theo bảng chữ cái
    const sortedSubjects = subjectKeys.sort((a, b) =>
        quizData[a].Mon.localeCompare(quizData[b].Mon)
    );

    sortedSubjects.forEach(subjectId => {
        const subject = quizData[subjectId];
        console.log(`➕ Thêm môn: ${subject.Mon} (${subject.QA.length} câu)`);

        // Tạo phần tử môn học
        const subjectItem = document.createElement('div');
        subjectItem.className = 'compact-subject-item';
        subjectItem.innerHTML = `
            <div class="subject-select-area" data-subject="${subjectId}">
                <div class="subject-info">
                    <span class="subject-name">${subject.Mon}</span>
                    <span class="subject-count">${subject.QA.length} câu</span>
                </div>
            </div>
            <div class="subject-settings-area">
                <button class="subject-settings-btn" data-subject="${subjectId}" title="Cài đặt môn học">⚙️</button>
            </div>
        `;

        // === VÙNG CHỌN MÔN HỌC ===
        const selectArea = subjectItem.querySelector('.subject-select-area');
        selectArea.style.pointerEvents = 'auto';
        selectArea.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation(); // Ngăn chồng sự kiện
            console.log(`🎯 [Chọn môn] ${subject.Mon} (${subjectId})`);

            // Bỏ chọn các môn khác
            document.querySelectorAll('.compact-subject-item').forEach(item =>
                item.classList.remove('selected')
            );
            // Đánh dấu môn hiện tại
            subjectItem.classList.add('selected');
            selectedSubject = subjectId;

            // Lưu lựa chọn để khi F5 vẫn giữ
            localStorage.setItem('selectedSubject', subjectId);
        });

        // === NÚT CÀI ĐẶT ⚙️ ===
        const settingsBtn = subjectItem.querySelector('.subject-settings-btn');
        settingsBtn.style.pointerEvents = 'auto';
        settingsBtn.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation(); // Ngăn click lan sang vùng chọn môn
            console.log(`⚙️ [Cài đặt] Mở cài đặt cho: ${subject.Mon}`);
            try {
                openSubjectSettings(subjectId);
            } catch (err) {
                console.error('❌ Lỗi khi mở modal cài đặt:', err);
                alert('Có lỗi khi mở phần cài đặt môn học này. Vui lòng kiểm tra console.');
            }
        });

        subjectList.appendChild(subjectItem);
    });

    // === Khôi phục lựa chọn môn học trước đó (nếu có) ===
    const savedSubject = localStorage.getItem('selectedSubject');
    if (savedSubject && quizData[savedSubject]) {
        const selectedEl = document.querySelector(`[data-subject="${savedSubject}"]`);
        if (selectedEl) {
            selectedEl.closest('.compact-subject-item').classList.add('selected');
            selectedSubject = savedSubject;
            console.log(`🔁 [Khôi phục] Môn đã chọn trước đó: ${quizData[savedSubject].Mon}`);
        }
    }

    console.log('✅ [Init] Hoàn tất khởi tạo danh sách môn học!');
}

// Thiết lập modal
function setupModal() {
    console.log('🪟 Đang thiết lập modal...');
    
    // Modal chi tiết câu hỏi
    const modal = document.getElementById('questionDetailModal');
    const closeBtn = document.querySelector('.close-modal');
    
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
    });
    
    // Modal cài đặt môn học
    const settingsModal = document.getElementById('subjectSettingsModal');
    const settingsCloseBtn = settingsModal.querySelector('.close-modal');
    
    settingsCloseBtn.addEventListener('click', () => {
        settingsModal.style.display = 'none';
        document.body.classList.remove('modal-open');
    });
    
    // Xử lý khi mở modal
    const openModalHandler = (modal) => {
        document.body.classList.add('modal-open');
        // Đảm bảo modal hiển thị đúng
        setTimeout(() => {
            modal.style.display = 'block';
        }, 50);
    };
    
    // Override hàm openSubjectSettings để thêm class modal-open
    const originalOpenSubjectSettings = openSubjectSettings;
    openSubjectSettings = function(subjectId) {
        originalOpenSubjectSettings(subjectId);
        document.body.classList.add('modal-open');
    };
    
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
        }
        if (event.target === settingsModal) {
            settingsModal.style.display = 'none';
            document.body.classList.remove('modal-open');
        }
    });
    
    // Xử lý responsive cho modal
    window.addEventListener('resize', () => {
        if (settingsModal.style.display === 'block') {
            // Force re-render khi thay đổi kích thước màn hình
            renderQuestionLists(currentSettingsSubject);
        }
    });
}

// Mở modal cài đặt môn học
function openSubjectSettings(subjectId) {
    console.log(`⚙️ Mở cài đặt cho môn: ${subjectId}`);
    currentSettingsSubject = subjectId;
    const subject = quizData[subjectId];
    
    // Cập nhật tiêu đề
    document.getElementById('settingsSubjectTitle').textContent = 
        `Cài đặt câu hỏi - ${subject.Mon}`;
    
    // Khởi tạo cài đặt nếu chưa có
    if (!subjectSettings[subjectId]) {
        initializeSubjectSettings(subjectId);
    }
    
    // Hiển thị danh sách câu hỏi
    renderQuestionLists(subjectId);
    
    // Hiển thị modal
    document.getElementById('subjectSettingsModal').style.display = 'block';
}

// Khởi tạo cài đặt mặc định (chọn tất cả)
function initializeSubjectSettings(subjectId) {
    const subject = quizData[subjectId];
    subjectSettings[subjectId] = {
        multiple_choice: subject.QA.filter(q => 
            q.type === QUESTION_TYPES.MULTIPLE_CHOICE || !q.type
        ).map(q => q.id),
        short_answer: subject.QA.filter(q => 
            q.type === QUESTION_TYPES.SHORT_ANSWER
        ).map(q => q.id),
        true_false_set: subject.QA.filter(q => 
            q.type === QUESTION_TYPES.TRUE_FALSE_SET
        ).map(q => q.id)
    };
}

// Render danh sách câu hỏi - ĐÃ SỬA LỖI
function renderQuestionLists(subjectId) {
    const subject = quizData[subjectId];
    const settings = subjectSettings[subjectId];
    
    // Render từng loại câu hỏi
    renderQuestionTypeList('multiple_choice', subject.QA, settings, 'multipleChoiceList');
    renderQuestionTypeList('short_answer', subject.QA, settings, 'shortAnswerList');
    renderQuestionTypeList('true_false_set', subject.QA, settings, 'trueFalseList');
}

// Render danh sách theo loại câu hỏi - ĐÃ SỬA LỖI
function renderQuestionTypeList(type, questions, settings, containerId) {
    const container = document.getElementById(containerId);
    
    // Lọc câu hỏi theo loại
    const filteredQuestions = questions.filter(q => {
        if (type === 'multiple_choice') {
            return q.type === QUESTION_TYPES.MULTIPLE_CHOICE || !q.type;
        }
        return q.type === type;
    });
    
    if (filteredQuestions.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:10px;">
            Không có câu hỏi nào
        </div>`;
        return;
    }
    
    container.innerHTML = filteredQuestions.map(question => {
        const isSelected = settings[type].includes(question.id);
        const shortText = question.Q.length > 100 ? 
            question.Q.substring(0, 100) + '...' : question.Q;
        
        return `
            <div class="question-item ${isSelected ? 'selected' : ''}">
                <input type="checkbox" 
                       ${isSelected ? 'checked' : ''}
                       onchange="toggleQuestion('${type}', '${question.id}')">
                <div class="question-content">
                    ${shortText}
                </div>
            </div>
        `;
    }).join('');
}

// Toggle chọn câu hỏi - ĐÃ SỬA LỖI
function toggleQuestion(type, questionId) {
    const settings = subjectSettings[currentSettingsSubject];
    const index = settings[type].indexOf(questionId);
    
    if (index > -1) {
        // Bỏ chọn
        settings[type].splice(index, 1);
    } else {
        // Chọn
        settings[type].push(questionId);
    }
    
    // Cập nhật giao diện
    renderQuestionLists(currentSettingsSubject);
}

// Chọn tất cả câu hỏi
function selectAllQuestions() {
    const subject = quizData[currentSettingsSubject];
    const settings = subjectSettings[currentSettingsSubject];
    
    settings.multiple_choice = subject.QA.filter(q => 
        q.type === QUESTION_TYPES.MULTIPLE_CHOICE || !q.type
    ).map(q => q.id);
    
    settings.short_answer = subject.QA.filter(q => 
        q.type === QUESTION_TYPES.SHORT_ANSWER
    ).map(q => q.id);
    
    settings.true_false_set = subject.QA.filter(q => 
        q.type === QUESTION_TYPES.TRUE_FALSE_SET
    ).map(q => q.id);
    
    renderQuestionLists(currentSettingsSubject);
}

// Bỏ chọn tất cả
function deselectAllQuestions() {
    const settings = subjectSettings[currentSettingsSubject];
    settings.multiple_choice = [];
    settings.short_answer = [];
    settings.true_false_set = [];
    renderQuestionLists(currentSettingsSubject);
}

// Toggle theo từng loại - ĐÃ SỬA LỖI
function toggleAllMultipleChoice() {
    const subject = quizData[currentSettingsSubject];
    const settings = subjectSettings[currentSettingsSubject];
    const multipleChoiceQuestions = subject.QA.filter(q => 
        q.type === QUESTION_TYPES.MULTIPLE_CHOICE || !q.type
    ).map(q => q.id);
    
    if (settings.multiple_choice.length === multipleChoiceQuestions.length) {
        settings.multiple_choice = [];
    } else {
        settings.multiple_choice = multipleChoiceQuestions;
    }
    
    renderQuestionLists(currentSettingsSubject);
}

function toggleAllShortAnswer() {
    const subject = quizData[currentSettingsSubject];
    const settings = subjectSettings[currentSettingsSubject];
    const shortAnswerQuestions = subject.QA.filter(q => 
        q.type === QUESTION_TYPES.SHORT_ANSWER
    ).map(q => q.id);
    
    if (settings.short_answer.length === shortAnswerQuestions.length) {
        settings.short_answer = [];
    } else {
        settings.short_answer = shortAnswerQuestions;
    }
    
    renderQuestionLists(currentSettingsSubject);
}

function toggleAllTrueFalse() {
    const subject = quizData[currentSettingsSubject];
    const settings = subjectSettings[currentSettingsSubject];
    const trueFalseQuestions = subject.QA.filter(q => 
        q.type === QUESTION_TYPES.TRUE_FALSE_SET
    ).map(q => q.id);
    
    if (settings.true_false_set.length === trueFalseQuestions.length) {
        settings.true_false_set = [];
    } else {
        settings.true_false_set = trueFalseQuestions;
    }
    
    renderQuestionLists(currentSettingsSubject);
}

// Lưu cài đặt
function saveSubjectSettings() {
    // Lưu vào localStorage
    localStorage.setItem('quizSubjectSettings', JSON.stringify(subjectSettings));
    console.log('💾 Đã lưu cài đặt môn học:', subjectSettings[currentSettingsSubject]);
    closeSubjectSettings();
}

// Đóng modal
function closeSubjectSettings() {
    document.getElementById('subjectSettingsModal').style.display = 'none';
    document.body.classList.remove('modal-open');
    currentSettingsSubject = null;
}

// Thiết lập các sự kiện
function setupEventListeners() {
    console.log('🎮 Đang thiết lập event listeners...');
    
    // Navigation events
    document.getElementById('startBtn').addEventListener('click', startQuiz);
    document.getElementById('prevBtn').addEventListener('click', prevQuestion);
    document.getElementById('nextBtn').addEventListener('click', nextQuestion);
    document.getElementById('checkBtn').addEventListener('click', checkAnswer);
    document.getElementById('restartBtn').addEventListener('click', restartQuiz);
    document.getElementById('newQuizBtn').addEventListener('click', newQuiz);
    
    // Mobile navigation events
    document.getElementById('mobilePrevBtn').addEventListener('click', prevQuestion);
    document.getElementById('mobileNextBtn').addEventListener('click', nextQuestion);
    document.getElementById('mobileCheckBtn').addEventListener('click', checkAnswer);
    
    // Settings events
    document.getElementById('shuffleQuestions').addEventListener('change', function() {
        shuffleQuestions = this.checked;
        localStorage.setItem('quizShuffleQuestions', shuffleQuestions);
        console.log('🔄 Shuffle questions:', shuffleQuestions);
    });
    
    document.getElementById('shuffleAnswers').addEventListener('change', function() {
        shuffleAnswers = this.checked;
        localStorage.setItem('quizShuffleAnswers', shuffleAnswers);
        console.log('🔄 Shuffle answers:', shuffleAnswers);
    });
}

// Bắt đầu bài kiểm tra
function startQuiz() {
    console.log('🎯 Bắt đầu bài kiểm tra...');
    userName = document.getElementById('userName').value.trim();
    if (!userName) {
        alert('Vui lòng nhập tên của bạn!');
        return;
    }
    
    if (!selectedSubject) {
        alert('Vui lòng chọn một môn học!');
        return;
    }
    
    console.log(`👤 User: ${userName}, Môn: ${selectedSubject}`);
    console.log(`⚙️ Settings: shuffleQ=${shuffleQuestions}, shuffleA=${shuffleAnswers}`);
    
    localStorage.setItem('quizUserName', userName);
    loadQuestions();
    showPage(2);
}

// Tải câu hỏi với cài đặt đã chọn
function loadQuestions() {
    console.log(`📖 Đang tải câu hỏi cho môn: ${selectedSubject}`);
    const subjectData = quizData[selectedSubject];
    const settings = subjectSettings[selectedSubject];
    
    if (!settings) {
        // Nếu chưa có cài đặt, khởi tạo mặc định (chọn tất cả)
        initializeSubjectSettings(selectedSubject);
    }
    
    // Lọc câu hỏi theo cài đặt
    let selectedQuestions = subjectData.QA.filter(question => {
        const settings = subjectSettings[selectedSubject];
        if (question.type === QUESTION_TYPES.MULTIPLE_CHOICE || !question.type) {
            return settings.multiple_choice.includes(question.id);
        } else if (question.type === QUESTION_TYPES.SHORT_ANSWER) {
            return settings.short_answer.includes(question.id);
        } else if (question.type === QUESTION_TYPES.TRUE_FALSE_SET) {
            return settings.true_false_set.includes(question.id);
        }
        return false;
    });
    
    console.log(`✅ Đã chọn ${selectedQuestions.length} câu hỏi từ cài đặt`);
    
    // Áp dụng xáo trộn câu hỏi
    if (shuffleQuestions) {
        console.log('🔀 Đang xáo trộn thứ tự câu hỏi...');
        shuffleArray(selectedQuestions);
    }
    
    // Tạo bản sao của câu hỏi và lưu dữ liệu gốc
    questions = selectedQuestions.map(q => ({
        ...q,
        originalQ: q.Q,
        originalA: q.A,
        originalB: q.B,
        originalC: q.C,
        originalD: q.D,
        originalTrue: q.True
    }));
    
    userAnswers = new Array(questions.length).fill(null);
    finalAnswers = new Array(questions.length).fill(null);
    results = new Array(questions.length).fill(null);
    
    currentQuestionIndex = 0;
    console.log(`✅ Đã tải ${questions.length} câu hỏi`);
    displayQuestion();
}

// Hiển thị câu hỏi hiện tại
function displayQuestion() {
    console.log(`📝 Đang hiển thị câu ${currentQuestionIndex + 1}/${questions.length}`);
    const question = questions[currentQuestionIndex];
    
    document.getElementById('quizTitle').textContent = quizData[selectedSubject].Mon;
    document.getElementById('questionCounter').textContent = `Câu ${currentQuestionIndex + 1}/${questions.length}`;
    
    // Hiển thị câu hỏi (hỗ trợ MathJax)
    const questionElement = document.getElementById('questionText');
    questionElement.innerHTML = question.Q;
    
    // Render MathJax nếu có
    if (window.MathJax) {
        setTimeout(() => {
            MathJax.typesetPromise([questionElement]).catch(err => {
                console.log('MathJax typeset error:', err);
            });
        }, 100);
    }
    
    displayOptions(question);
    updateNavigationButtons();
    
    // Reset màu status và options-section
    document.getElementById('status').textContent = '🤔 Đang làm...';
    document.getElementById('status').className = 'status';
    const optionsSection = document.querySelector('.options-section');
    optionsSection.classList.remove('correct', 'incorrect');
}

// Hiển thị các lựa chọn (xử lý cả 3 loại câu hỏi)
function displayOptions(question) {
    const optionsContainer = document.getElementById('optionsContainer');
    optionsContainer.innerHTML = '';
    
    // Xác định loại câu hỏi (mặc định là multiple choice nếu không có type)
    const questionType = question.type || QUESTION_TYPES.MULTIPLE_CHOICE;
    
    switch(questionType) {
        case QUESTION_TYPES.SHORT_ANSWER:
            displayShortAnswerQuestion(question, optionsContainer);
            break;
            
        case QUESTION_TYPES.TRUE_FALSE_SET:
            displayTrueFalseQuestion(question, optionsContainer);
            break;
            
        default:
            displayMultipleChoiceQuestion(question, optionsContainer);
    }
    
    updateNavigationButtons();
}

// Hiển thị câu hỏi Multiple Choice
function displayMultipleChoiceQuestion(question, container) {
    let options = [
        { key: 'A', text: question.A },
        { key: 'B', text: question.B },
        { key: 'C', text: question.C },
        { key: 'D', text: question.D }
    ];
    
    let currentCorrectAnswer = question.originalTrue;
    
    if (shuffleAnswers) {
        console.log('🔀 Đang xáo trộn đáp án...');
        
        const answers = [question.A, question.B, question.C, question.D];
        shuffleArray(answers);
        
        options = [
            { key: 'A', text: answers[0] },
            { key: 'B', text: answers[1] },
            { key: 'C', text: answers[2] },
            { key: 'D', text: answers[3] }
        ];
        
        const originalOptions = { 
            A: question.originalA, 
            B: question.originalB, 
            C: question.originalC, 
            D: question.originalD 
        };
        
        for (let i = 0; i < options.length; i++) {
            if (options[i].text === originalOptions[question.originalTrue]) {
                currentCorrectAnswer = options[i].key;
                break;
            }
        }
        
        question.A = answers[0];
        question.B = answers[1];
        question.C = answers[2];
        question.D = answers[3];
        question.True = currentCorrectAnswer;
    } else {
        question.A = question.originalA;
        question.B = question.originalB;
        question.C = question.originalC;
        question.D = question.originalD;
        question.True = question.originalTrue;
    }
    
    options.forEach(option => {
        const optionElement = document.createElement('div');
        optionElement.className = 'option';
        
        if (userAnswers[currentQuestionIndex] === option.key) {
            optionElement.classList.add('selected');
        }
        
        optionElement.innerHTML = `
            <span class="option-letter">${option.key}.</span>
            <span class="option-text">${option.text}</span>
        `;
        
        optionElement.dataset.option = option.key;
        optionElement.addEventListener('click', () => selectOption(option.key));
        container.appendChild(optionElement);
    });
    
    // Render MathJax cho các đáp án
    if (window.MathJax) {
        setTimeout(() => {
            const optionTexts = container.querySelectorAll('.option-text');
            MathJax.typesetPromise(Array.from(optionTexts)).catch(err => {
                console.log('MathJax typeset error for options:', err);
            });
        }, 200);
    }
}

// Hiển thị câu hỏi trả lời ngắn
function displayShortAnswerQuestion(question, container) {
    container.innerHTML = `
        <div class="short-answer-section">
            <div class="input-group">
                <label for="shortAnswerInput">Nhập câu trả lời của bạn:</label>
                <input type="text" id="shortAnswerInput" placeholder="Nhập đáp án..." 
                       oninput="handleShortAnswerInput(this.value)">
            </div>
            <div class="answer-hint">
                <small>💡 Nhập câu trả lời và nhấn "Kiểm tra" để kiểm tra kết quả</small>
            </div>
        </div>
    `;
    
    if (userAnswers[currentQuestionIndex]) {
        document.getElementById('shortAnswerInput').value = userAnswers[currentQuestionIndex];
    }
}

// Hiển thị câu hỏi dạng True/False Set (HỖ TRỢ MATHJAX)
function displayTrueFalseQuestion(question, container) {
    container.innerHTML = `
        <div class="true-false-set">
            <div class="sub-questions">
                ${question.questions.map((subQ, index) => `
                    <div class="sub-question" data-index="${index}">
                        <div class="sub-question-content">
                            <div class="sub-question-text">
                                <span class="sub-question-number">${index + 1}.</span>
                                ${subQ.text}
                            </div>
                        </div>
                        <div class="true-false-buttons">
                            <button type="button" class="tf-btn correct" 
                                    onclick="selectTrueFalse(${index}, true)"
                                    title="Chọn Đúng">
                                ✅
                            </button>
                            <button type="button" class="tf-btn incorrect"
                                    onclick="selectTrueFalse(${index}, false)"
                                    title="Chọn Sai">
                                ❌
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="tf-hint">
                <small>💡 Câu hỏi này chỉ được tính điểm khi <strong>cả 4 câu</strong> đều trả lời đúng</small>
            </div>
        </div>
    `;

    // Cập nhật trạng thái selected cho các nút
    updateTrueFalseButtons();
    
    // Render MathJax cho các câu hỏi True/False
    if (window.MathJax) {
        setTimeout(() => {
            const subQuestionTexts = container.querySelectorAll('.sub-question-text');
            MathJax.typesetPromise(Array.from(subQuestionTexts)).catch(err => {
                console.log('MathJax typeset error for true/false:', err);
            });
        }, 200);
    }
}

// Xử lý input cho Short Answer
function handleShortAnswerInput(value) {
    userAnswers[currentQuestionIndex] = value.trim();
    updateNavigationButtons();
}

// Chọn Đúng/Sai cho True/False Set
function selectTrueFalse(subIndex, value) {
    if (!userAnswers[currentQuestionIndex]) {
        userAnswers[currentQuestionIndex] = new Array(4).fill(null);
    }
    userAnswers[currentQuestionIndex][subIndex] = value;
    updateTrueFalseButtons();
    updateNavigationButtons();
}

// Cập nhật giao diện nút True/False
function updateTrueFalseButtons() {
    const userAnswer = userAnswers[currentQuestionIndex];
    if (!userAnswer) return;

    document.querySelectorAll('.sub-question').forEach((subQuestion, index) => {
        const selectedValue = userAnswer[index];
        const correctBtn = subQuestion.querySelector('.tf-btn.correct');
        const incorrectBtn = subQuestion.querySelector('.tf-btn.incorrect');

        // Reset all buttons
        correctBtn.classList.remove('selected');
        incorrectBtn.classList.remove('selected');

        // Set selected button
        if (selectedValue === true) {
            correctBtn.classList.add('selected');
        } else if (selectedValue === false) {
            incorrectBtn.classList.add('selected');
        }
    });
}

// Chọn một lựa chọn (cho Multiple Choice)
function selectOption(option) {
    console.log(`🎯 Đã chọn đáp án: ${option}`);
    document.querySelectorAll('.option').forEach(opt => {
        opt.classList.remove('selected');
    });
    
    document.querySelector(`.option[data-option="${option}"]`).classList.add('selected');
    userAnswers[currentQuestionIndex] = option;
    updateNavigationButtons();
}

// Cập nhật trạng thái các nút điều hướng
function updateNavigationButtons() {
    const isFirstQuestion = currentQuestionIndex === 0;
    const isLastQuestion = currentQuestionIndex === questions.length - 1;
    const questionType = questions[currentQuestionIndex].type || QUESTION_TYPES.MULTIPLE_CHOICE;
    
    let hasAnswer = false;
    switch(questionType) {
        case QUESTION_TYPES.MULTIPLE_CHOICE:
            hasAnswer = userAnswers[currentQuestionIndex] !== null;
            break;
        case QUESTION_TYPES.SHORT_ANSWER:
            hasAnswer = userAnswers[currentQuestionIndex] !== null && userAnswers[currentQuestionIndex].trim() !== '';
            break;
        case QUESTION_TYPES.TRUE_FALSE_SET:
            hasAnswer = userAnswers[currentQuestionIndex] && 
                        userAnswers[currentQuestionIndex].every(answer => answer !== null);
            break;
    }

    // Desktop navigation
    document.getElementById('prevBtn').disabled = isFirstQuestion;
    document.getElementById('nextBtn').disabled = false;
    document.getElementById('nextBtn').innerHTML = isLastQuestion ? 
        '<span>Kết thúc 🏁</span>' : 
        '<span>Tiếp theo ▶</span>';
    document.getElementById('checkBtn').disabled = !hasAnswer;

    // Mobile navigation
    document.getElementById('mobilePrevBtn').disabled = isFirstQuestion;
    document.getElementById('mobileNextBtn').disabled = false;
    document.getElementById('mobileNextBtn').innerHTML = isLastQuestion ? 
        '<span class="mobile-nav-icon">🏁</span><span>Kết thúc</span>' : 
        '<span class="mobile-nav-icon">▶</span><span>Tiếp</span>';
    document.getElementById('mobileCheckBtn').disabled = !hasAnswer;
}

// Chuyển đến câu hỏi trước
function prevQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        displayQuestion();
    }
}

// Chuyển đến câu hỏi tiếp theo
function nextQuestion() {
    if (currentQuestionIndex < questions.length - 1) {
        currentQuestionIndex++;
        displayQuestion();
    } else {
        showResults();
    }
}

// Kiểm tra câu trả lời (CHO CẢ 3 LOẠI CÂU HỎI)
function checkAnswer() {
    const questionType = questions[currentQuestionIndex].type || QUESTION_TYPES.MULTIPLE_CHOICE;
    let hasAnswer = false;
    let userAnswer = userAnswers[currentQuestionIndex];

    // Kiểm tra xem đã có câu trả lời chưa
    switch(questionType) {
        case QUESTION_TYPES.MULTIPLE_CHOICE:
            hasAnswer = userAnswer !== null;
            break;
        case QUESTION_TYPES.SHORT_ANSWER:
            hasAnswer = userAnswer !== null && userAnswer.trim() !== '';
            break;
        case QUESTION_TYPES.TRUE_FALSE_SET:
            hasAnswer = userAnswer && userAnswer.every(answer => answer !== null);
            break;
    }

    if (!hasAnswer) {
        alert('Vui lòng trả lời câu hỏi trước khi kiểm tra!');
        return;
    }

    const question = questions[currentQuestionIndex];
    let isCorrect = false;

    // Kiểm tra đúng/sai
    switch(questionType) {
        case QUESTION_TYPES.MULTIPLE_CHOICE:
            isCorrect = userAnswer === question.True;
            break;
        case QUESTION_TYPES.SHORT_ANSWER:
            isCorrect = userAnswer.toString().trim().toLowerCase() === question.correctAnswer.toString().toLowerCase();
            break;
        case QUESTION_TYPES.TRUE_FALSE_SET:
            isCorrect = userAnswer.every((answer, index) => answer === question.questions[index].correct);
            break;
    }

    console.log(`✅ Kiểm tra: Kết quả: ${isCorrect ? 'ĐÚNG' : 'SAI'}`);

    if (finalAnswers[currentQuestionIndex] === null) {
        finalAnswers[currentQuestionIndex] = userAnswer;
        results[currentQuestionIndex] = isCorrect;
    }

    const statusElement = document.getElementById('status');
    const optionsSection = document.querySelector('.options-section');
    
    // Xóa class cũ
    optionsSection.classList.remove('correct', 'incorrect');
    
    // Thêm class mới dựa trên kết quả
    if (isCorrect) {
        statusElement.textContent = '✅ Đúng! Chúc mừng!';
        statusElement.className = 'status correct';
        optionsSection.classList.add('correct');
    } else {
        statusElement.textContent = '❌ Sai! Hãy thử lại!';
        statusElement.className = 'status incorrect';
        optionsSection.classList.add('incorrect');
    }

    updateNavigationButtons();
}

// Hiển thị kết quả
function showResults() {
    console.log('🏁 Đang tính toán kết quả...');
    const correctCount = results.filter(result => result === true).length;
    const totalQuestions = questions.length;
    const score = (correctCount / totalQuestions * 10).toFixed(1);
    
    console.log(`📊 Kết quả: ${correctCount}/${totalQuestions} câu đúng, Điểm: ${score}`);
    
    document.getElementById('scoreText').textContent = `${correctCount}/${totalQuestions}`;
    document.getElementById('pointText').textContent = score;
    
    const resultDetails = document.getElementById('resultDetails');
    resultDetails.innerHTML = '';
    
    questions.forEach((question, index) => {
        const resultItem = document.createElement('div');
        const isCorrect = results[index];
        resultItem.className = `result-item ${isCorrect ? 'correct' : 'incorrect'}`;
        
        const userAnswer = finalAnswers[index];
        let userAnswerText = 'Không trả lời';
        let correctAnswerText = '';
        
        const questionType = question.type || QUESTION_TYPES.MULTIPLE_CHOICE;
        
        switch(questionType) {
            case QUESTION_TYPES.MULTIPLE_CHOICE:
                userAnswerText = userAnswer || 'Không chọn';
                correctAnswerText = question.True;
                break;
            case QUESTION_TYPES.SHORT_ANSWER:
                userAnswerText = userAnswer || 'Không trả lời';
                correctAnswerText = question.correctAnswer;
                break;
            case QUESTION_TYPES.TRUE_FALSE_SET:
                const allCorrect = userAnswer && userAnswer.every((ans, i) => ans === question.questions[i].correct);
                userAnswerText = allCorrect ? 'TẤT CẢ ĐÚNG' : 'CÓ CÂU SAI';
                correctAnswerText = 'TẤT CẢ ĐÚNG';
                break;
        }
        
        resultItem.innerHTML = `
            <p><strong>Câu ${index + 1}:</strong> ${question.Q}</p>
            <div class="result-summary">
                <div>
                    <p>Đáp án bạn chọn: <strong>${userAnswerText}</strong> ${isCorrect ? '✅' : '❌'}</p>
                    <p>Đáp án đúng: <strong>${correctAnswerText}</strong></p>
                </div>
                <div class="result-actions">
                    <button class="view-detail-btn" onclick="showQuestionDetail(${index})">
                        📖 Xem chi tiết
                    </button>
                </div>
            </div>
        `;
        
        resultItem.addEventListener('click', (e) => {
            if (!e.target.classList.contains('view-detail-btn')) {
                showQuestionDetail(index);
            }
        });
        
        resultDetails.appendChild(resultItem);
    });
    
    showPage(3);
}

// Hiển thị modal chi tiết câu hỏi
function showQuestionDetail(questionIndex) {
    console.log(`🔍 Đang mở modal chi tiết câu ${questionIndex + 1}`);
    const question = questions[questionIndex];
    const userAnswer = finalAnswers[questionIndex];
    const questionType = question.type || QUESTION_TYPES.MULTIPLE_CHOICE;
    
    document.getElementById('detailQuestionText').textContent = question.Q;
    
    // Ẩn tất cả các phần trước
    document.querySelectorAll('.detail-options, .detail-short-answer, .detail-true-false').forEach(el => {
        el.style.display = 'none';
    });
    
    switch(questionType) {
        case QUESTION_TYPES.SHORT_ANSWER:
            showShortAnswerDetail(question, userAnswer);
            break;
        case QUESTION_TYPES.TRUE_FALSE_SET:
            showTrueFalseDetail(question, userAnswer);
            break;
        default:
            showMultipleChoiceDetail(question, userAnswer);
    }
    
    document.getElementById('questionDetailModal').style.display = 'block';
}

// Hiển thị chi tiết Multiple Choice
function showMultipleChoiceDetail(question, userAnswer) {
    document.querySelector('.detail-options').style.display = 'block';
    
    document.getElementById('detailOptionA').innerHTML = question.A;
    document.getElementById('detailOptionB').innerHTML = question.B;
    document.getElementById('detailOptionC').innerHTML = question.C;
    document.getElementById('detailOptionD').innerHTML = question.D;
    
    // Reset tất cả các option
    document.querySelectorAll('.detail-option').forEach(option => {
        option.classList.remove('user-selected', 'correct-answer');
    });
    
    // Highlight đáp án người dùng chọn
    if (userAnswer) {
        const userSelectedOption = document.querySelector(`.detail-option[data-option="${userAnswer}"]`);
        if (userSelectedOption) {
            userSelectedOption.classList.add('user-selected');
        }
    }
    
    // Highlight đáp án đúng
    const correctOption = document.querySelector(`.detail-option[data-option="${question.True}"]`);
    if (correctOption) {
        correctOption.classList.add('correct-answer');
    }
    
    document.getElementById('detailUserChoice').textContent = userAnswer || 'Không chọn';
    document.getElementById('detailCorrectAnswer').textContent = question.True;
    
    // Render MathJax cho modal
    if (window.MathJax) {
        setTimeout(() => {
            MathJax.typesetPromise([document.querySelector('.detail-options')]).catch(err => {
                console.log('MathJax typeset error for modal:', err);
            });
        }, 300);
    }
}

// Hiển thị chi tiết Short Answer
function showShortAnswerDetail(question, userAnswer) {
    const correctAnswer = question.correctAnswer;
    const isCorrect = userAnswer && userAnswer.toString().trim().toLowerCase() === correctAnswer.toString().toLowerCase();
    
    document.querySelector('.detail-short-answer').style.display = 'block';
    document.querySelector('.detail-short-answer').innerHTML = `
        <div class="detail-answer-input ${isCorrect ? 'correct' : 'incorrect'}">
            <strong>Đáp án của bạn:</strong> ${userAnswer || 'Không trả lời'}
        </div>
        <div class="detail-answer-input correct">
            <strong>Đáp án đúng:</strong> ${correctAnswer}
        </div>
    `;
    
    document.getElementById('detailUserChoice').textContent = userAnswer || 'Không trả lời';
    document.getElementById('detailCorrectAnswer').textContent = correctAnswer;
}

// Hiển thị chi tiết True/False Set
function showTrueFalseDetail(question, userAnswer) {
    document.querySelector('.detail-true-false').style.display = 'block';
    
    let html = '<div class="detail-sub-questions">';
    let allCorrect = true;
    
    question.questions.forEach((subQ, index) => {
        const userSubAnswer = userAnswer && userAnswer[index];
        const isSubCorrect = userSubAnswer === subQ.correct;
        if (!isSubCorrect) allCorrect = false;
        
        html += `
            <div class="detail-sub-question ${isSubCorrect ? 'correct' : 'incorrect'}">
                <div class="detail-sub-question-text">
                    <strong>${index + 1}.</strong> ${subQ.text}
                </div>
                <div class="detail-sub-question-answer">
                    <span>Bạn chọn: <strong>${userSubAnswer ? 'Đúng' : 'Sai'}</strong></span>
                    <span>Đáp án: <strong>${subQ.correct ? 'Đúng' : 'Sai'}</strong></span>
                    <span class="sub-question-result ${isSubCorrect ? 'correct' : 'incorrect'}">
                        ${isSubCorrect ? '✅ ĐÚNG' : '❌ SAI'}
                    </span>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    document.querySelector('.detail-true-false').innerHTML = html;
    
    document.getElementById('detailUserChoice').textContent = allCorrect ? 'TẤT CẢ ĐÚNG' : 'CÓ CÂU SAI';
    document.getElementById('detailCorrectAnswer').textContent = 'TẤT CẢ ĐÚNG';
}

// Làm lại bài kiểm tra
function restartQuiz() {
    console.log('🔄 Làm lại bài kiểm tra...');
    currentQuestionIndex = 0;
    userAnswers.fill(null);
    finalAnswers.fill(null);
    results.fill(null);
    loadQuestions();
    showPage(2);
}

// Chọn bài kiểm tra mới
function newQuiz() {
    console.log('📝 Chọn bài kiểm tra mới...');
    showPage(1);
}

// Hiển thị trang cụ thể
function showPage(pageNumber) {
    console.log(`📄 Chuyển trang: ${pageNumber}`);
    currentPage = pageNumber;

    // Ẩn tất cả trang
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
        page.style.display = 'none';
    });

    // Hiện đúng trang
    const activePage = document.getElementById(`page${pageNumber}`);
    activePage.classList.add('active');
    activePage.style.display = 'block';

    // Cuộn lên đầu trang (ngăn kéo dài do sticky hoặc layout)
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Hàm xáo trộn mảng
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}