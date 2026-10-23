(function () {
    const ACTIVE_SESSION_KEY = 'ss-arena-active-session';
    const SCREEN_IDS = [
        'welcomeScreen', 'startScreen',
        'quizScreen', 'resultScreen', 'teamworkWelcomeScreen',
        'knowledgeReviewScreen', 'teamworkSummaryScreen'
    ];
    const SOLO_QUESTION_TIME_MS = 60000;
    const TEAM_QUESTION_TIME_MS = 60000;

    let run = readStoredValue(ACTIVE_SESSION_KEY, null);
    let currentDeadline = 0;
    let lastPersistAt = 0;
    let latestResult = null;
    let reviewReturnScreen = 'resultScreen';
    let selectedReviewQuestionIndex = 0;
    let reviewStatusFilter = 'all';
    let teamworkReviewStatusFilter = 'all';
    let teamworkReviewCategory = 'all';
    let teamworkReviewModalIndex = null;
    let teamworkReviewModalOpener = null;
    let teamworkReviewBodyOverflow = '';
    let teamworkPresentationFinishing = false;
    let gameMode = 'solo';
    let finalizing = false;
    let selectedSoloOptionIndex = null;
    const mascotMessages = [
        'อ่านคำถามให้ดี ๆ นะ คุณทำได้!',
        'ตั้งใจอีกนิด นักสำรวจความรู้!',
        'ทุกคำถามพาคุณเก่งขึ้นอีกขั้น!',
        'หายใจลึก ๆ แล้วเลือกคำตอบที่ใช่!'
    ];
    if (run && run.mode === 'solo' && run.status !== 'completed') {
        run.remainingTimeMs = Math.max(0, Number(run.remainingTimeMs) || 0);
        if (run.status === 'playing' && Number.isFinite(run.deadlineAt)) {
            run.remainingTimeMs = Math.max(0, run.deadlineAt - Date.now());
        } else {
            run.status = 'playing';
            run.deadlineAt = Date.now() + run.remainingTimeMs;
        }
        saveRun();
    } else if (run && run.status === 'playing') {
        run.remainingTimeMs = Math.max(0, Number(run.remainingTimeMs) || 0);
        run.status = 'paused';
        saveRun();
    }

    function readStoredValue(key, fallback) {
        try {
            const value = localStorage.getItem(key);
            return value === null ? fallback : JSON.parse(value);
        } catch (error) {
            console.error(`Could not read local game data (${key}).`, error);
            window.setTimeout(() => showToast('อ่านข้อมูลเกมที่บันทึกไว้ไม่สำเร็จ', 'danger'), 0);
            return fallback;
        }
    }

    function writeStoredValue(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error(`Could not save local game data (${key}).`, error);
            showToast('บันทึกข้อมูลในเบราว์เซอร์ไม่สำเร็จ กรุณาตรวจสอบพื้นที่จัดเก็บ', 'danger');
            return false;
        }
    }

    function makeId() {
        return typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    function clearRemovedLocalData() {
        try {
            localStorage.removeItem('ss-arena-browser-profile');
            localStorage.removeItem('ss-arena-solo-history');
            localStorage.removeItem('ss_quiz_leaderboard_top3');
        } catch (error) {
            console.error('Could not remove deprecated profile and result data.', error);
            showToast('ล้างข้อมูลโปรไฟล์และผลการเล่นเก่าไม่สำเร็จ', 'danger');
        }
    }

    clearRemovedLocalData();

    function saveRun() {
        if (!run) return false;
        return writeStoredValue(ACTIVE_SESSION_KEY, run);
    }

    function removeSavedRun() {
        try {
            localStorage.removeItem(ACTIVE_SESSION_KEY);
        } catch (error) {
            console.error('Could not remove completed local game session.', error);
            showToast('ล้างสถานะเซสชันในเบราว์เซอร์ไม่สำเร็จ', 'danger');
        }

        clearRemovedLocalData();
    }

    function showScreen(id) {
        SCREEN_IDS.forEach(screenId => {
            const screen = document.getElementById(screenId);
            if (screen) screen.classList.toggle('hidden', screenId !== id);
        });
        document.getElementById('introExperience').classList.add('hidden');
        const gameMain = document.getElementById('gameMain');
        gameMain.classList.remove('hidden');
        const entry = ['welcomeScreen', 'startScreen', 'teamworkWelcomeScreen'].includes(id);
        gameMain.classList.toggle('is-entry-screen', entry);
        gameMain.classList.toggle('review-active', id === 'knowledgeReviewScreen');
        gameMain.classList.toggle('teamwork-welcome-active', id === 'teamworkWelcomeScreen');
        document.body.classList.toggle('entry-screen-active', entry);
        document.body.classList.toggle('game-screen-active', !entry);
        gameMain.classList.toggle('teamwork-active', id === 'quizScreen' && run && run.mode === 'teamwork');
        gameMain.classList.toggle('solo-quiz-active', id === 'quizScreen' && run && run.mode === 'solo');
        const quizScreen = document.getElementById('quizScreen');
        quizScreen.classList.toggle('solo-mode', id === 'quizScreen' && run && run.mode === 'solo');
        quizScreen.classList.toggle('teamwork-mode', id === 'quizScreen' && run && run.mode === 'teamwork');
        if (id === 'resultScreen' || id === 'knowledgeReviewScreen') window.scrollTo(0, 0);
    }

    function renderSoloProgress() {
        if (!run || run.mode !== 'solo') return;
        const container = document.getElementById('quizProgressDots');
        container.replaceChildren();
        quizData.forEach((question, index) => {
            const dot = document.createElement('span');
            const answer = run.answers.find(item => item.questionIndex === index);
            let status = 'ยังไม่ได้ตอบ';
            if (answer) {
                if (answer.isTimeout) {
                    dot.classList.add('is-timeout');
                    status = 'หมดเวลา';
                } else if (answer.isCorrect) {
                    dot.classList.add('is-correct');
                    status = 'ตอบถูก';
                } else {
                    dot.classList.add('is-wrong');
                    status = 'ตอบผิด';
                }
            }
            if (index === run.currentQuestionIndex) {
                dot.classList.add('is-current');
                status = `ข้อปัจจุบัน, ${status}`;
            }
            dot.classList.add('quiz-progress-dot');
            dot.setAttribute('role', 'listitem');
            dot.setAttribute('aria-label', `ข้อ ${index + 1}: ${status}`);
            dot.title = `ข้อ ${index + 1}: ${status}`;
            container.appendChild(dot);
        });
    }

    function updateSoloStats() {
        if (!run || run.mode !== 'solo') return;
        const answers = run.answers;
        const correct = answers.filter(answer => answer.isCorrect).length;
        const incorrect = answers.filter(answer => !answer.isCorrect && !answer.isTimeout).length;
        const missed = answers.filter(answer => answer.isTimeout).length;
        const attempted = correct + incorrect;
        const activeElapsed = run.status === 'playing' && canAnswer ? questionElapsedMs() : 0;
        const elapsedSeconds = Math.floor((run.totalTimeMs + activeElapsed) / 1000);
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        document.getElementById('soloElapsedStat').textContent =
            `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        document.getElementById('soloScoreStat').textContent = `${correct} / ${quizData.length}`;
        document.getElementById('soloCorrectStat').textContent = String(correct);
        document.getElementById('soloWrongStat').textContent = String(incorrect);
        document.getElementById('soloMissedStat').textContent = `หมดเวลา ${missed}`;
        document.getElementById('soloAccuracyStat').textContent =
            `${attempted ? Math.round((correct / attempted) * 100) : 0}%`;
    }

    function selectSoloOption(selectedIndex) {
        if (!run || run.mode !== 'solo' || run.status !== 'playing' || !canAnswer) return;
        const buttons = document.querySelectorAll('#optionsGrid .option-btn');
        if (!buttons[selectedIndex] || buttons[selectedIndex].disabled) return;
        selectedSoloOptionIndex = selectedIndex;
        buttons.forEach((button, index) => {
            const selected = index === selectedIndex;
            button.classList.toggle('is-selected', selected);
            button.setAttribute('aria-pressed', String(selected));
            const icon = button.querySelector('.check-icon');
            icon.className = `${selected ? 'fas fa-circle-check' : 'far fa-circle'} check-icon`;
        });
        document.getElementById('confirmSoloAnswerButton').disabled = false;
    }

    function confirmSoloAnswer() {
        if (!run || run.mode !== 'solo' || run.status !== 'playing' || !canAnswer) return;
        if (selectedSoloOptionIndex === null) {
            showToast('เลือกคำตอบก่อนยืนยันนะ', 'warning');
            return;
        }
        document.getElementById('confirmSoloAnswerButton').disabled = true;
        selectOption(selectedSoloOptionIndex);
    }

    function showModeSelection() {
        clearInterval(timer);
        timer = null;
        isGameplayMusicMode = false;
        applyAudioVolume();
        document.getElementById('gameMain').classList.add('hidden');
        document.getElementById('introExperience').classList.remove('hidden');
        document.getElementById('introClosedStage').classList.add('hidden');
        document.getElementById('soloQrStage').classList.add('hidden');
        document.getElementById('introOpenStage').classList.remove('hidden');
        document.body.classList.add('entry-screen-active');
        document.body.classList.remove('game-screen-active');
        document.getElementById('soloModeButton').focus();
    }

    function returnToIntro() {
        clearInterval(timer);
        timer = null;
        document.getElementById('gameMain').classList.add('hidden');
        document.getElementById('introExperience').classList.remove('hidden');
        document.getElementById('introClosedStage').classList.add('hidden');
        document.getElementById('soloQrStage').classList.add('hidden');
        document.getElementById('introOpenStage').classList.remove('hidden');
        document.body.classList.add('entry-screen-active');
        document.body.classList.remove('game-screen-active');
        document.getElementById('soloModeButton').focus();
    }

    function showSoloQr() {
        gameMode = 'solo';
        document.getElementById('gameMain').classList.add('hidden');
        document.getElementById('introExperience').classList.remove('hidden');
        document.getElementById('introOpenStage').classList.add('hidden');
        document.getElementById('soloQrStage').classList.remove('hidden');
        document.body.classList.add('entry-screen-active');
        document.body.classList.remove('game-screen-active');
        document.getElementById('soloQrNextButton').focus();
    }

    function showTeamworkWelcome() {
        gameMode = 'teamwork';
        document.getElementById('teamworkQuestionCount').textContent = `${quizData.length} คำถาม`;
        document.getElementById('teamworkQuestionTime').textContent =
            `ข้อละ ${TEAM_QUESTION_TIME_MS / 1000} วินาที`;
        document.getElementById('introExperience').classList.add('hidden');
        showScreen('teamworkWelcomeScreen');
        document.getElementById('teamworkWelcomeTitle').focus();
    }

    function returnToQrScreen() {
        showModeSelection();
    }

    function showNameScreen() {
        gameMode = 'solo';
        document.getElementById('introExperience').classList.add('hidden');
        showScreen('startScreen');
        if (run && run.mode === 'solo' && run.status !== 'completed') {
            document.getElementById('playerNameInput').value = run.playerName || '';
        }
        document.getElementById('playerNameInput').focus();
    }

    function returnToNameScreen() {
        if (!run || run.mode !== 'solo') return;
        clearInterval(timer);
        timer = null;
        stopCountdown();
        removeSavedRun();
        run = null;
        latestResult = null;
        isGameplayMusicMode = false;
        applyAudioVolume();
        showNameScreen();
        showToast('กรอกชื่อแล้วเริ่มเกมใหม่ได้เลย', 'info');
    }

    function showWelcomeScreen() {
        showSoloQr();
    }

    function startGame() {
        const input = document.getElementById('playerNameInput');
        const name = input.value.trim().replace(/\s+/g, ' ');
        if (name.length > 40) {
            showToast('ชื่อผู้เล่นต้องมีความยาวไม่เกิน 40 ตัวอักษร', 'warning');
            input.focus();
            return;
        }
        run = createRun('solo', name);
        selectedReviewQuestionIndex = 0;
        reviewStatusFilter = 'all';
        gameMode = 'solo';
        beginSoloGame();
    }

    function createRun(mode, name) {
        return {
            id: makeId(),
            mode,
            status: 'paused',
            playerName: name || '',
            currentQuestionIndex: 0,
            answers: [],
            totalTimeMs: 0,
            remainingTimeMs: mode === 'solo' ? SOLO_QUESTION_TIME_MS : TEAM_QUESTION_TIME_MS,
            deadlineAt: null,
            startedAt: new Date().toISOString(),
            completedAt: null,
            revealed: false
        };
    }

    function beginSoloGame() {
        const name = document.getElementById('playerNameInput').value.trim().replace(/\s+/g, ' ');
        if (!run || run.mode !== 'solo') run = createRun('solo', name);
        else run.playerName = name;
        run.status = 'playing';
        playerName = name || 'ผู้เล่น';
        isGameplayMusicMode = true;
        applyAudioVolume();
        startBackgroundMusic();
        document.getElementById('gameMain').classList.remove('is-entry-screen');
        document.body.classList.remove('entry-screen-active');
        document.getElementById('playerDisplay').textContent = name ? `ผู้เล่น: ${name}` : 'ผู้เล่น';
        showScreen('quizScreen');
        loadQuestion();
    }

    function startTeamworkGame() {
        if (run && run.mode === 'teamwork' && run.status === 'paused') {
            const revealed = run.revealed;
            run.status = 'playing';
            run.revealed = false;
            gameMode = 'teamwork';
            isGameplayMusicMode = true;
            applyAudioVolume();
            startBackgroundMusic();
            document.getElementById('playerDisplay').textContent = 'ผู้ดำเนินกิจกรรมควบคุมเกม';
            showScreen('quizScreen');
            loadQuestion();
            if (revealed) revealTeamAnswer();
            return;
        }
        run = createRun('teamwork', '');
        run.status = 'playing';
        gameMode = 'teamwork';
        isGameplayMusicMode = true;
        applyAudioVolume();
        startBackgroundMusic();
        document.getElementById('playerDisplay').textContent = 'ผู้ดำเนินกิจกรรมควบคุมเกม';
        showScreen('quizScreen');
        loadQuestion();
    }

    function questionLimit() {
        return run.mode === 'teamwork' ? TEAM_QUESTION_TIME_MS : SOLO_QUESTION_TIME_MS;
    }

    function loadQuestion() {
        if (!run || run.status !== 'playing') return;
        clearInterval(timer);
        timer = null;
        canAnswer = true;
        selectedSoloOptionIndex = null;
        currentQuestionIndex = run.currentQuestionIndex;
        score = run.mode === 'solo' ? run.answers.filter(answer => answer.isCorrect).length : 0;
        correctCount = score;
        wrongCount = run.answers.filter(answer => !answer.isCorrect).length;
        timeLeft = Math.ceil(run.remainingTimeMs / 1000);
        streak = 0;
        const question = quizData[currentQuestionIndex];
        document.getElementById('questionNum').textContent = `ข้อ ${currentQuestionIndex + 1} / ${quizData.length}`;
        const progressPercent = ((currentQuestionIndex + 1) / quizData.length) * 100;
        document.getElementById('quizProgressFill').style.width = `${progressPercent}%`;
        document.getElementById('quizProgressTrack').setAttribute('aria-valuemax', String(quizData.length));
        document.getElementById('quizProgressTrack').setAttribute('aria-valuenow', String(currentQuestionIndex + 1));
        document.getElementById('quizTermTitle').textContent = question.term || `คำถามข้อที่ ${currentQuestionIndex + 1}`;
        document.getElementById('questionText').textContent = `คำศัพท์ข้อที่ ${currentQuestionIndex + 1} คืออะไร?`;
        const hintCard = document.querySelector('#quizScreen .quiz-hint-card');
        hintCard.classList.toggle('hidden', !question.hint);
        document.getElementById('hintText').textContent = question.hint || '';
        document.getElementById('quizMascotBubble').textContent =
            mascotMessages[Math.floor(Math.random() * mascotMessages.length)];
        const keyboardHelpText = document.getElementById('keyboardHelpText');
        keyboardHelpText.textContent = run.mode === 'teamwork'
            ? 'ให้แต่ละกลุ่มปรึกษากันแล้วเลือกคำตอบ กด Spacebar เพื่อไปข้อถัดไปหลังแสดงเฉลย'
            : 'เลือกคำตอบหรือกดปุ่ม 1–4 แล้วกด Enter เพื่อยืนยัน';
        keyboardHelpText.classList.remove('hidden');
        document.getElementById('pauseTeamworkButton').classList.toggle('hidden', run.mode !== 'teamwork');
        document.getElementById('soloBackToNameButton').classList.toggle('hidden', run.mode !== 'solo');
        document.getElementById('nextTeamQuestionButton').classList.add('hidden');
        document.getElementById('confirmSoloAnswerButton').disabled = true;
        document.getElementById('optionsGrid').replaceChildren();

        question.options.forEach((option, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.disabled = false;
            button.setAttribute('aria-pressed', 'false');
            button.className = `option-btn btn-vibrant w-full text-left p-4 rounded-2xl border-2 transition-all font-medium text-sm sm:text-base flex items-center justify-between ${[
                'bg-purple-600/20 hover:bg-purple-600/30 border-purple-500/50 text-purple-200',
                'bg-blue-600/20 hover:bg-blue-600/30 border-blue-500/50 text-blue-200',
                'bg-amber-600/20 hover:bg-amber-600/30 border-amber-500/50 text-amber-200',
                'bg-pink-600/20 hover:bg-pink-600/30 border-pink-500/50 text-pink-200'
            ][index % 4]}`;
            button.setAttribute('aria-keyshortcuts', String(index + 1));
            button.setAttribute('aria-label', `คำตอบ ${index + 1}: ${option}`);
            const letter = document.createElement('span');
            letter.className = 'option-letter';
            letter.setAttribute('aria-hidden', 'true');
            letter.textContent = String.fromCharCode(65 + index);
            const label = document.createElement('span');
            label.className = 'option-label';
            label.textContent = option;
            const icon = document.createElement('i');
            icon.className = 'far fa-circle text-slate-400 check-icon';
            icon.setAttribute('aria-hidden', 'true');
            button.append(letter, label, icon);
            button.addEventListener('mouseenter', playHoverSound);
            if (run.mode === 'solo') button.addEventListener('click', () => selectSoloOption(index));
            else button.addEventListener('click', () => selectTeamOption(index));
            document.getElementById('optionsGrid').appendChild(button);
        });

        document.getElementById('confirmSoloAnswerButton').classList.toggle('hidden', run.mode !== 'solo');
        if (run.mode === 'teamwork') {
            renderTeamworkControls();
        } else {
            document.getElementById('gameMain').classList.remove('teamwork-active');
            renderSoloProgress();
        }
        updateSoloStats();
        updateTimerDisplay();
        saveRun(true);
        startCountdown();
    }

    function startCountdown() {
        clearInterval(timer);
        if (!run || run.status !== 'playing' || run.revealed) return;
        run.deadlineAt = Date.now() + Math.max(0, run.remainingTimeMs);
        saveRun();
        currentDeadline = performance.now() + Math.max(0, run.remainingTimeMs);
        lastPersistAt = performance.now();
        timer = window.setInterval(() => {
            run.remainingTimeMs = Math.max(0, Math.min(currentDeadline - performance.now(), run.deadlineAt - Date.now()));
            timeLeft = Math.ceil(run.remainingTimeMs / 1000);
            updateTimerDisplay();
            if (performance.now() - lastPersistAt >= 1000) {
                lastPersistAt = performance.now();
                saveRun(true);
            }
            if (run.remainingTimeMs <= 0) {
                clearInterval(timer);
                timer = null;
                handleTimeout();
            }
        }, 100);
    }

    function stopCountdown() {
        if (run && run.status === 'playing' && currentDeadline) {
            run.remainingTimeMs = Math.max(0, Math.min(currentDeadline - performance.now(), run.deadlineAt - Date.now()));
        }
        if (run) run.deadlineAt = null;
        clearInterval(timer);
        timer = null;
        currentDeadline = 0;
        timeLeft = Math.ceil(run ? run.remainingTimeMs / 1000 : 0);
        updateTimerDisplay();
    }

    function updateTimerDisplay() {
        const timerText = document.getElementById('timerText');
        const timerContainer = document.getElementById('timerContainer');
        if (!timerText || !timerContainer) return;
        timerText.textContent = String(Math.max(0, timeLeft));
        updateSoloStats();
        if (timeLeft <= 5) {
            timerContainer.classList.add('time-warning', 'border-rose-500');
            timerText.className = 'font-outfit font-bold text-xl text-rose-500';
        } else {
            timerContainer.classList.remove('time-warning', 'border-rose-500');
            timerText.className = 'font-outfit font-bold text-xl text-yellow-400';
        }
    }

    function questionElapsedMs() {
        return Math.max(0, Math.round(questionLimit() - run.remainingTimeMs));
    }

    function selectOption(selectedIndex) {
        if (!run || run.mode !== 'solo' || run.status !== 'playing' || !canAnswer) return;
        canAnswer = false;
        document.getElementById('confirmSoloAnswerButton').disabled = true;
        stopCountdown();
        const question = quizData[run.currentQuestionIndex];
        const isCorrect = selectedIndex === question.correct;
        run.answers.push({
            questionIndex: run.currentQuestionIndex,
            selectedIndex,
            correctIndex: question.correct,
            isCorrect,
            isTimeout: false,
            timeTakenMs: questionElapsedMs()
        });
        run.totalTimeMs += questionElapsedMs();
        run.remainingTimeMs = 0;
        score = run.answers.filter(answer => answer.isCorrect).length;
        correctCount = score;
        wrongCount = run.answers.length - score;
        userAnswers = run.answers;
        paintAnswer(selectedIndex, question.correct);
        renderSoloProgress();
        updateSoloStats();
        if (isCorrect) playCorrectSound();
        else playWrongSound();
        saveRun(true);
        window.setTimeout(nextQuestion, 1200);
    }

    function selectTeamOption(selectedIndex) {
        if (!run || run.mode !== 'teamwork' || run.status !== 'playing' || !canAnswer) return;
        canAnswer = false;
        stopCountdown();
        const questionIndex = run.currentQuestionIndex;
        const correctIndex = quizData[questionIndex].correct;
        const isCorrect = selectedIndex === correctIndex;
        if (!Array.isArray(run.answers)) run.answers = [];
        run.answers.push({
            questionIndex,
            selectedIndex,
            correctIndex,
            isCorrect,
            isTimeout: false,
            timeTakenMs: questionElapsedMs()
        });
        run.revealed = true;
        run.status = 'paused';
        paintAnswer(selectedIndex, correctIndex);
        renderTeamworkControls();
        saveRun(true);
        if (isCorrect) {
            playCorrectSound();
            showToast('ตอบถูกต้อง!', 'success');
        } else {
            playWrongSound();
            showToast(`คำตอบที่ถูกต้องคือ ${quizData[run.currentQuestionIndex].options[correctIndex]}`, 'warning');
        }
    }

    function paintAnswer(selectedIndex, correctIndex) {
        const buttons = document.querySelectorAll('#optionsGrid .option-btn');
        buttons.forEach((button, index) => {
            button.disabled = true;
            button.setAttribute('aria-pressed', String(index === selectedIndex));
            if (index === correctIndex) {
                button.className = 'option-btn btn-vibrant w-full text-left p-4 rounded-2xl border-2 flex items-center justify-between bg-emerald-600/30 border-emerald-500 text-emerald-200 font-bold is-correct-answer';
                button.querySelector('.check-icon').className = 'fas fa-check-circle text-emerald-400 check-icon';
            } else if (index === selectedIndex) {
                button.className = 'option-btn btn-vibrant w-full text-left p-4 rounded-2xl border-2 flex items-center justify-between bg-rose-600/30 border-rose-500 text-rose-200 is-wrong-answer';
                button.querySelector('.check-icon').className = 'fas fa-times-circle text-rose-400 check-icon';
            }
        });
    }

    function handleTimeout() {
        if (!run || run.status !== 'playing') return;
        if (run.mode === 'teamwork') {
            revealTeamAnswer(true);
            return;
        }
        if (!canAnswer) return;
        canAnswer = false;
        document.getElementById('confirmSoloAnswerButton').disabled = true;
        const question = quizData[run.currentQuestionIndex];
        const timeTakenMs = questionLimit();
        run.answers.push({
            questionIndex: run.currentQuestionIndex,
            selectedIndex: null,
            correctIndex: question.correct,
            isCorrect: false,
            isTimeout: true,
            timeTakenMs
        });
        run.totalTimeMs += timeTakenMs;
        run.remainingTimeMs = 0;
        score = run.answers.filter(answer => answer.isCorrect).length;
        correctCount = score;
        wrongCount = run.answers.length - score;
        userAnswers = run.answers;
        paintAnswer(-1, question.correct);
        renderSoloProgress();
        updateSoloStats();
        saveRun(true);
        showToast('หมดเวลา — บันทึกข้อนี้เป็นไม่ได้ตอบ', 'warning');
        window.setTimeout(nextQuestion, 1200);
    }

    function nextQuestion() {
        if (!run || run.status !== 'playing' || run.mode !== 'solo') return;
        run.currentQuestionIndex += 1;
        currentQuestionIndex = run.currentQuestionIndex;
        if (currentQuestionIndex >= quizData.length) {
            completeSoloRun();
            return;
        }
        run.remainingTimeMs = SOLO_QUESTION_TIME_MS;
        canAnswer = true;
        loadQuestion();
    }

    function toggleTeamworkPause() {
        if (!run || run.mode !== 'teamwork') return;
        if (run.status === 'playing') {
            stopCountdown();
            run.status = 'paused';
            saveRun(true);
            renderTeamworkControls();
        } else if (run.status === 'paused' && !run.revealed) {
            run.status = 'playing';
            saveRun(true);
            startCountdown();
            renderTeamworkControls();
        }
    }

    function toggleTeamworkFullscreen() {
        if (!document.fullscreenEnabled) {
            showToast('เบราว์เซอร์นี้ไม่รองรับโหมดเต็มหน้าจอ', 'warning');
            return;
        }
        const action = document.fullscreenElement
            ? document.exitFullscreen()
            : document.getElementById('gameMain').requestFullscreen();
        action.catch(error => {
            console.error('Could not change fullscreen mode.', error);
            showToast('เปลี่ยนโหมดเต็มหน้าจอไม่สำเร็จ', 'danger');
        });
    }

    function renderTeamworkControls() {
        const nextButton = document.getElementById('nextTeamQuestionButton');
        nextButton.classList.toggle('hidden', !run.revealed);
        nextButton.setAttribute('aria-keyshortcuts', 'Space');
        const pauseButton = document.getElementById('pauseTeamworkButton');
        pauseButton.classList.toggle('hidden', run.revealed);
        pauseButton.innerHTML = run.status === 'paused'
            ? '<i class="fas fa-play" aria-hidden="true"></i> เริ่มเวลาต่อ'
            : '<i class="fas fa-pause" aria-hidden="true"></i> หยุดเวลา';
    }

    function revealTeamAnswer(fromTimeout) {
        if (!run || run.mode !== 'teamwork' || run.revealed) return;
        stopCountdown();
        if (fromTimeout) {
            if (!Array.isArray(run.answers)) run.answers = [];
            run.answers.push({
                questionIndex: run.currentQuestionIndex,
                selectedIndex: null,
                correctIndex: quizData[run.currentQuestionIndex].correct,
                isCorrect: false,
                isTimeout: true,
                timeTakenMs: questionLimit()
            });
        }
        run.revealed = true;
        run.status = 'paused';
        const correctIndex = quizData[run.currentQuestionIndex].correct;
        paintAnswer(-1, correctIndex);
        document.getElementById('nextTeamQuestionButton').classList.remove('hidden');
        renderTeamworkControls();
        saveRun(true);
        if (fromTimeout) showToast('หมดเวลา — เฉลยแสดงแล้ว', 'warning');
    }

    function advanceTeamQuestion() {
        if (!run || run.mode !== 'teamwork' || !run.revealed) return;
        run.currentQuestionIndex += 1;
        currentQuestionIndex = run.currentQuestionIndex;
        if (currentQuestionIndex >= quizData.length) {
            completeTeamworkRun();
            return;
        }
        run.remainingTimeMs = TEAM_QUESTION_TIME_MS;
        run.revealed = false;
        run.status = 'playing';
        loadQuestion();
    }

    function pauseAnyTimer() {
        if (!run || run.mode !== 'teamwork') return;
        stopCountdown();
        run.status = 'paused';
        saveRun(true);
    }

    function formatTotalTime(milliseconds) {
        const ms = Math.max(0, Math.floor(milliseconds));
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor(ms / 1000) % 60;
        const millis = ms % 1000;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
    }

    function completeSoloRun() {
        if (finalizing || !run || run.mode !== 'solo') return;
        finalizing = true;
        clearInterval(timer);
        timer = null;
        run.status = 'completed';
        run.completedAt = new Date().toISOString();
        run.totalTimeMs = run.answers.reduce((total, answer) => total + answer.timeTakenMs, 0);
        run.score = run.answers.filter(answer => answer.isCorrect).length;
        latestResult = JSON.parse(JSON.stringify(run));
        userAnswers = run.answers;
        playerName = run.playerName;
        currentQuestionIndex = quizData.length;
        selectedReviewQuestionIndex = 0;
        reviewStatusFilter = 'all';
        removeSavedRun();
        run = null;
        finalizing = false;
        isGameplayMusicMode = false;
        applyAudioVolume();
        playVictorySound();
        triggerConfetti();
        reviewReturnScreen = 'resultScreen';
        renderKnowledgeReview();
        showScreen('knowledgeReviewScreen');
        document.getElementById('knowledgeReviewTitle').focus();
    }

    function completeTeamworkRun() {
        if (!run || run.mode !== 'teamwork') return;
        clearInterval(timer);
        timer = null;
        run.status = 'completed';
        run.completedAt = new Date().toISOString();
        latestResult = JSON.parse(JSON.stringify(run));
        removeSavedRun();
        run = latestResult;
        isGameplayMusicMode = false;
        applyAudioVolume();
        playVictorySound();
        triggerConfetti();
        reviewReturnScreen = 'teamworkSummaryScreen';
        renderKnowledgeReview();
        showScreen('knowledgeReviewScreen');
        document.getElementById('teamworkKnowledgeReviewTitle').focus();
    }

    function renderKnowledgeReview() {
        const isSoloReview = latestResult && latestResult.mode === 'solo';
        document.getElementById('knowledgeReviewScreen').setAttribute(
            'aria-labelledby',
            isSoloReview ? 'knowledgeReviewTitle' : 'teamworkKnowledgeReviewTitle'
        );
        document.getElementById('soloReviewBoard').classList.toggle('hidden', !isSoloReview);
        document.getElementById('teamworkReviewContent').classList.toggle('hidden', isSoloReview);
        if (isSoloReview) {
            renderSoloReviewBoard();
            return;
        }
        renderTeamworkReview();
    }

    function teamworkReviewAnswerFor(index) {
        if (!latestResult || latestResult.mode !== 'teamwork' || !Array.isArray(latestResult.answers)) return null;
        return latestResult.answers.find(answer => answer.questionIndex === index) || null;
    }

    function teamworkReviewAnswerStatus(answer) {
        if (!answer || answer.isTimeout || !Number.isInteger(answer.selectedIndex)) return 'unanswered';
        return answer.isCorrect ? 'correct' : 'wrong';
    }

    function teamworkReviewStatusLabel(status) {
        return status === 'correct' ? 'ตอบถูก' : status === 'wrong' ? 'ตอบผิด' : 'ไม่ได้ตอบ';
    }

    function teamworkReviewCategoryFor(question) {
        return typeof question.category === 'string' && question.category.trim()
            ? question.category.trim()
            : 'ไม่ระบุหมวดหมู่';
    }

    function filteredTeamworkReviewIndexes() {
        return quizData
            .map((_, index) => index)
            .filter(index => {
                const question = quizData[index];
                const statusMatches = teamworkReviewStatusFilter === 'all' ||
                    teamworkReviewAnswerStatus(teamworkReviewAnswerFor(index)) === teamworkReviewStatusFilter;
                const categoryMatches = teamworkReviewCategory === 'all' ||
                    teamworkReviewCategoryFor(question) === teamworkReviewCategory;
                return statusMatches && categoryMatches;
            });
    }

    function renderTeamworkReview() {
        if (!latestResult || latestResult.mode !== 'teamwork') return;
        teamworkPresentationFinishing = false;
        document.getElementById('teamworkReviewContinueButton').disabled = false;

        const counts = { all: quizData.length, correct: 0, wrong: 0, unanswered: 0 };
        quizData.forEach((_, index) => {
            counts[teamworkReviewAnswerStatus(teamworkReviewAnswerFor(index))] += 1;
        });
        document.getElementById('teamworkReviewTotal').textContent = String(counts.all);
        document.getElementById('teamworkReviewCorrect').textContent = String(counts.correct);
        document.getElementById('teamworkReviewWrong').textContent = String(counts.wrong);
        document.getElementById('teamworkReviewAllCount').textContent = `(${counts.all})`;
        document.getElementById('teamworkReviewCorrectCount').textContent = `(${counts.correct})`;
        document.getElementById('teamworkReviewWrongCount').textContent = `(${counts.wrong})`;
        document.getElementById('teamworkReviewUnansweredCount').textContent = `(${counts.unanswered})`;
        document.querySelectorAll('[data-teamwork-review-filter]').forEach(button => {
            button.setAttribute('aria-pressed', String(button.dataset.teamworkReviewFilter === teamworkReviewStatusFilter));
        });

        const categorySelect = document.getElementById('teamworkReviewCategory');
        const categoryCounts = new Map();
        quizData.forEach(question => {
            const category = teamworkReviewCategoryFor(question);
            categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
        });
        categorySelect.replaceChildren(new Option('ทุกหมวดหมู่', 'all'));
        categoryCounts.forEach((count, category) => {
            const option = new Option(`${category} (${count})`, category);
            categorySelect.appendChild(option);
        });
        if (![...categoryCounts.keys(), 'all'].includes(teamworkReviewCategory)) teamworkReviewCategory = 'all';
        categorySelect.value = teamworkReviewCategory;

        const grid = document.getElementById('teamworkReviewGrid');
        grid.replaceChildren();
        const visibleIndexes = filteredTeamworkReviewIndexes();
        if (!visibleIndexes.length) {
            const empty = document.createElement('p');
            empty.className = 'teamwork-review-empty';
            empty.textContent = 'ไม่มีคำถามที่ตรงกับตัวกรองนี้';
            grid.appendChild(empty);
            return;
        }

        visibleIndexes.forEach(index => {
            const question = quizData[index];
            const status = teamworkReviewAnswerStatus(teamworkReviewAnswerFor(index));
            const card = document.createElement('button');
            card.type = 'button';
            card.className = `teamwork-review-card is-${status}`;
            card.setAttribute('aria-label', `ดูรายละเอียดข้อ ${index + 1}: ${question.term}, ${teamworkReviewStatusLabel(status)}`);

            const top = document.createElement('span');
            top.className = 'teamwork-review-card-top';
            const number = document.createElement('span');
            number.className = 'teamwork-review-number';
            number.textContent = `ข้อ ${index + 1}`;
            const badge = document.createElement('span');
            badge.className = `teamwork-review-status is-${status}`;
            const statusIcon = document.createElement('i');
            statusIcon.className = status === 'correct'
                ? 'fas fa-circle-check'
                : status === 'wrong'
                    ? 'fas fa-circle-xmark'
                    : 'far fa-circle';
            statusIcon.setAttribute('aria-hidden', 'true');
            badge.append(statusIcon, document.createTextNode(teamworkReviewStatusLabel(status)));
            top.append(number, badge);

            const heading = document.createElement('span');
            heading.className = 'teamwork-review-card-title';
            heading.textContent = question.term;
            const category = document.createElement('span');
            category.className = 'teamwork-review-category-label';
            category.textContent = `หมวดหมู่: ${teamworkReviewCategoryFor(question)}`;
            const excerpt = document.createElement('span');
            excerpt.className = 'teamwork-review-excerpt';
            const hint = typeof question.hint === 'string' ? question.hint.trim() : '';
            excerpt.textContent = hint || 'ไม่มีคำใบ้หรือคำอธิบายเพิ่มเติมในชุดคำถามนี้';
            const action = document.createElement('span');
            action.className = 'teamwork-review-card-action';
            const actionIcon = document.createElement('i');
            actionIcon.className = 'fas fa-book-open';
            actionIcon.setAttribute('aria-hidden', 'true');
            const actionText = document.createElement('span');
            actionText.textContent = 'ดูรายละเอียด';
            action.append(actionIcon, actionText);
            card.append(top, heading, category, excerpt, action);
            card.addEventListener('click', () => openTeamworkReviewModal(index, card));
            grid.appendChild(card);
        });
    }

    function renderTeamworkReviewModal() {
        const index = teamworkReviewModalIndex;
        if (!Number.isInteger(index) || !quizData[index]) return;
        const question = quizData[index];
        const answer = teamworkReviewAnswerFor(index);
        const selectedIndex = answer && Number.isInteger(answer.selectedIndex)
            ? answer.selectedIndex
            : null;
        const status = teamworkReviewAnswerStatus(answer);
        const prompt = typeof question.prompt === 'string' && question.prompt.trim()
            ? question.prompt
            : `คำศัพท์ข้อที่ ${index + 1} คืออะไร?`;
        const correctAnswer = Array.isArray(question.options) && Number.isInteger(question.correct)
            ? question.options[question.correct]
            : null;
        const selectedAnswer = selectedIndex !== null && Array.isArray(question.options)
            ? question.options[selectedIndex]
            : null;
        const explanation = typeof question.explanation === 'string' && question.explanation.trim()
            ? question.explanation.trim()
            : typeof question.hint === 'string' && question.hint.trim()
                ? question.hint.trim()
                : '';

        document.getElementById('teamworkReviewModalTitle').textContent = `ข้อ ${index + 1}: ${question.term}`;
        document.getElementById('teamworkReviewModalMeta').textContent =
            `${teamworkReviewCategoryFor(question)} · ${teamworkReviewStatusLabel(status)}`;
        document.getElementById('teamworkReviewModalQuestion').textContent = prompt;
        document.getElementById('teamworkReviewModalAnswer').textContent =
            typeof correctAnswer === 'string' ? correctAnswer : 'ยังไม่มีข้อมูลคำตอบที่ถูกต้อง';
        document.getElementById('teamworkReviewModalSelected').textContent =
            typeof selectedAnswer === 'string'
                ? `${selectedAnswer} — ${teamworkReviewStatusLabel(status)}`
                : answer && answer.isTimeout
                    ? 'ไม่ได้เลือกคำตอบ (หมดเวลา)'
                    : 'ไม่มีข้อมูลคำตอบที่ทีมเลือก';
        document.getElementById('teamworkReviewModalExplanation').textContent =
            explanation || 'ไม่มีข้อมูลคำอธิบายเพิ่มเติมในชุดคำถามนี้';

        const visibleIndexes = filteredTeamworkReviewIndexes();
        const position = visibleIndexes.indexOf(index);
        document.getElementById('teamworkReviewModalPrevious').disabled = position <= 0;
        document.getElementById('teamworkReviewModalNext').disabled =
            position < 0 || position >= visibleIndexes.length - 1;
    }

    function openTeamworkReviewModal(index, opener) {
        teamworkReviewModalIndex = index;
        teamworkReviewModalOpener = opener;
        teamworkReviewBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        renderTeamworkReviewModal();
        document.getElementById('teamworkReviewModalOverlay').hidden = false;
        document.getElementById('teamworkReviewModalClose').focus();
    }

    function closeTeamworkReviewModal() {
        const overlay = document.getElementById('teamworkReviewModalOverlay');
        if (overlay.hidden) return;
        overlay.hidden = true;
        document.body.style.overflow = teamworkReviewBodyOverflow;
        teamworkReviewModalIndex = null;
        const focusTarget = teamworkReviewModalOpener;
        teamworkReviewModalOpener = null;
        if (focusTarget && focusTarget.isConnected) focusTarget.focus();
    }

    function navigateTeamworkReviewModal(direction) {
        const visibleIndexes = filteredTeamworkReviewIndexes();
        const currentPosition = visibleIndexes.indexOf(teamworkReviewModalIndex);
        const targetPosition = currentPosition + direction;
        if (currentPosition < 0 || targetPosition < 0 || targetPosition >= visibleIndexes.length) return;
        teamworkReviewModalIndex = visibleIndexes[targetPosition];
        renderTeamworkReviewModal();
        document.getElementById('teamworkReviewModal').focus();
    }

    function handleTeamworkReviewModalKeydown(event) {
        const overlay = document.getElementById('teamworkReviewModalOverlay');
        if (overlay.hidden) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            closeTeamworkReviewModal();
            return;
        }
        if (event.key !== 'Tab') return;
        const modal = document.getElementById('teamworkReviewModal');
        const focusable = [...modal.querySelectorAll('button:not(:disabled)')];
        if (!focusable.length) {
            event.preventDefault();
            modal.focus();
            return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    function finishTeamworkPresentation() {
        if (teamworkPresentationFinishing || !latestResult || latestResult.mode !== 'teamwork') return;
        teamworkPresentationFinishing = true;
        document.getElementById('teamworkReviewContinueButton').disabled = true;
        showTeamworkSummary();
    }

    function reviewAnswerFor(index) {
        return latestResult && latestResult.mode === 'solo'
            ? latestResult.answers.find(answer => answer.questionIndex === index) || null
            : null;
    }

    function reviewAnswerStatus(answer) {
        if (!answer || answer.isTimeout || !Number.isInteger(answer.selectedIndex)) return 'unanswered';
        return answer.isCorrect ? 'correct' : 'wrong';
    }

    function reviewStatusLabel(status) {
        return status === 'correct' ? 'ตอบถูก' : status === 'wrong' ? 'ตอบผิด' : 'ยังไม่ได้ตอบ';
    }

    function filteredReviewIndexes() {
        return quizData
            .map((_, index) => index)
            .filter(index => reviewStatusFilter === 'all' || reviewAnswerStatus(reviewAnswerFor(index)) === reviewStatusFilter);
    }

    function renderSoloReviewBoard() {
        const result = latestResult;
        if (!result || result.mode !== 'solo') return;
        const counts = { all: quizData.length, correct: 0, wrong: 0, unanswered: 0 };
        quizData.forEach((_, index) => {
            counts[reviewAnswerStatus(reviewAnswerFor(index))] += 1;
        });
        document.getElementById('knowledgeReviewTitle').textContent = `ทบทวนความรู้ทั้ง ${quizData.length} ข้อ`;
        document.getElementById('reviewQuestionCount').textContent = `${quizData.length} ข้อ`;
        document.getElementById('reviewAllCount').textContent = `(${counts.all})`;
        document.getElementById('reviewCorrectCount').textContent = `(${counts.correct})`;
        document.getElementById('reviewWrongCount').textContent = `(${counts.wrong})`;
        document.getElementById('reviewUnansweredCount').textContent = `(${counts.unanswered})`;
        document.querySelectorAll('[data-review-filter]').forEach(button => {
            button.setAttribute('aria-pressed', String(button.dataset.reviewFilter === reviewStatusFilter));
        });

        const visibleIndexes = filteredReviewIndexes();
        if (!visibleIndexes.includes(selectedReviewQuestionIndex)) {
            selectedReviewQuestionIndex = visibleIndexes.length ? visibleIndexes[0] : null;
        }
        renderReviewNavigator(visibleIndexes);
        renderReviewQuestion(visibleIndexes);
    }

    function renderReviewNavigator(visibleIndexes) {
        const list = document.getElementById('reviewQuestionList');
        list.replaceChildren();
        if (!visibleIndexes.length) {
            const empty = document.createElement('p');
            empty.className = 'review-sidebar-empty';
            empty.textContent = 'ไม่มีข้อสอบในสถานะนี้';
            list.appendChild(empty);
            return;
        }

        visibleIndexes.forEach(index => {
            const question = quizData[index];
            const status = reviewAnswerStatus(reviewAnswerFor(index));
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'review-question-item';
            button.setAttribute('aria-current', String(index === selectedReviewQuestionIndex));
            button.setAttribute('aria-label', `ข้อ ${index + 1}: ${question.term}, ${reviewStatusLabel(status)}`);
            button.title = `ข้อ ${index + 1}: ${question.term}`;
            const number = document.createElement('span');
            number.className = 'review-question-number';
            number.textContent = String(index + 1);
            const term = document.createElement('span');
            term.className = 'review-question-term';
            term.textContent = question.term;
            const icon = document.createElement('i');
            icon.className = `review-question-status ${status === 'correct' ? 'is-correct fas fa-circle-check' : status === 'wrong' ? 'is-wrong fas fa-circle-xmark' : 'is-unanswered far fa-circle'}`;
            icon.setAttribute('aria-hidden', 'true');
            button.append(number, term, icon);
            button.addEventListener('click', () => {
                selectedReviewQuestionIndex = index;
                renderSoloReviewBoard();
                document.querySelector(`.review-question-item[aria-current="true"]`)?.focus();
            });
            list.appendChild(button);
        });
    }

    function renderReviewQuestion(visibleIndexes) {
        const details = document.getElementById('reviewQuestionDetails');
        const empty = document.getElementById('reviewNoQuestions');
        const hasSelection = selectedReviewQuestionIndex !== null;
        details.classList.toggle('hidden', !hasSelection);
        empty.classList.toggle('hidden', hasSelection);
        if (!hasSelection) return;

        const index = selectedReviewQuestionIndex;
        const question = quizData[index];
        const answer = reviewAnswerFor(index);
        const status = reviewAnswerStatus(answer);
        const visiblePosition = visibleIndexes.indexOf(index);
        const previousDisabled = visiblePosition <= 0;
        const nextDisabled = visiblePosition < 0 || visiblePosition >= visibleIndexes.length - 1;
        document.getElementById('reviewQuestionPosition').textContent = `ข้อที่ ${index + 1} จาก ${quizData.length}`;
        const statusBadge = document.getElementById('reviewStatusBadge');
        statusBadge.className = `review-status-badge is-${status}`;
        statusBadge.replaceChildren();
        const badgeIcon = document.createElement('i');
        badgeIcon.className = status === 'correct'
            ? 'fas fa-circle-check'
            : status === 'wrong'
                ? 'fas fa-circle-xmark'
                : 'far fa-circle';
        badgeIcon.setAttribute('aria-hidden', 'true');
        statusBadge.append(badgeIcon, document.createTextNode(reviewStatusLabel(status)));
        document.getElementById('reviewAnswerTime').textContent = answer && Number.isFinite(answer.timeTakenMs)
            ? `เวลาในการตอบ ${formatTotalTime(answer.timeTakenMs)}`
            : answer
                ? 'ไม่มีข้อมูลเวลาในการตอบ'
            : 'ยังไม่มีเวลาในการตอบ';
        document.querySelector('#reviewTermHeading span').textContent = question.term;
        document.getElementById('reviewPrompt').textContent = `คำศัพท์ข้อที่ ${index + 1} คืออะไร?`;

        const options = document.getElementById('reviewOptionList');
        options.replaceChildren();
        question.options.forEach((option, optionIndex) => {
            const isCorrect = Number.isInteger(question.correct) && optionIndex === question.correct;
            const isSelectedWrong = answer && !answer.isTimeout && answer.selectedIndex === optionIndex && !answer.isCorrect;
            const row = document.createElement('div');
            row.className = `review-option-row${isCorrect ? ' is-correct' : isSelectedWrong ? ' is-selected-wrong' : ''}`;
            const letter = document.createElement('span');
            letter.className = 'review-option-letter';
            letter.textContent = String.fromCharCode(65 + optionIndex);
            const text = document.createElement('span');
            text.className = 'review-option-text';
            text.textContent = option;
            const icon = document.createElement('i');
            icon.className = `review-option-icon fas ${isCorrect ? 'fa-check' : isSelectedWrong ? 'fa-xmark' : ''}`;
            icon.setAttribute('aria-hidden', 'true');
            row.append(letter, text, icon);
            options.appendChild(row);
        });

        const correctAnswer = Number.isInteger(question.correct) ? question.options[question.correct] : null;
        const correctAnswerElement = document.getElementById('reviewCorrectAnswer');
        correctAnswerElement.replaceChildren();
        if (typeof correctAnswer === 'string' && correctAnswer.trim()) {
            const icon = document.createElement('i');
            icon.className = 'fas fa-circle-check';
            icon.setAttribute('aria-hidden', 'true');
            correctAnswerElement.append(icon, document.createTextNode(correctAnswer));
        } else {
            correctAnswerElement.textContent = 'ยังไม่มีข้อมูลคำตอบที่ถูกต้อง';
        }
        const explanationCard = document.getElementById('reviewExplanationCard');
        const explanation = typeof question.hint === 'string' ? question.hint.trim() : '';
        explanationCard.classList.toggle('hidden', !explanation);
        document.getElementById('reviewExplanation').textContent = explanation;

        document.getElementById('reviewPreviousButton').disabled = previousDisabled;
        document.getElementById('reviewPreviousFooterButton').disabled = previousDisabled;
        document.getElementById('reviewNextButton').disabled = nextDisabled;
        document.getElementById('reviewNextFooterButton').disabled = nextDisabled;
    }

    function navigateReviewQuestion(direction) {
        const visibleIndexes = filteredReviewIndexes();
        const currentPosition = visibleIndexes.indexOf(selectedReviewQuestionIndex);
        if (currentPosition < 0) return;
        const targetPosition = currentPosition + direction;
        if (targetPosition < 0 || targetPosition >= visibleIndexes.length) return;
        selectedReviewQuestionIndex = visibleIndexes[targetPosition];
        renderSoloReviewBoard();
    }

    function setReviewFilter(filter) {
        if (!['all', 'correct', 'wrong', 'unanswered'].includes(filter)) return;
        reviewStatusFilter = filter;
        const visibleIndexes = filteredReviewIndexes();
        selectedReviewQuestionIndex = visibleIndexes.length ? visibleIndexes[0] : null;
        renderSoloReviewBoard();
        document.querySelector(`[data-review-filter="${filter}"]`)?.focus();
    }

    function openKnowledgeReview() {
        if (!latestResult && run && run.status === 'completed') latestResult = run;
        if (!latestResult) {
            showToast('ยังไม่มีรอบที่เล่นจบให้ทบทวน', 'warning');
            return;
        }
        reviewReturnScreen = latestResult.mode === 'teamwork' ? 'teamworkSummaryScreen' : 'resultScreen';
        renderKnowledgeReview();
        document.getElementById('teamworkReviewContinueButton').classList.toggle('hidden', latestResult.mode !== 'teamwork');
        showScreen('knowledgeReviewScreen');
        document.getElementById(latestResult.mode === 'teamwork' ? 'teamworkKnowledgeReviewTitle' : 'knowledgeReviewTitle').focus();
    }

    function returnFromKnowledgeReview() {
        if (reviewReturnScreen === 'teamworkSummaryScreen') showTeamworkSummary();
        else showSoloSummary();
    }

    function renderSoloReportDetails(result) {
        const categories = [
            { name: 'สวัสดิการและคุณภาพชีวิต', start: 0, end: 5 },
            { name: 'การพัฒนาและความยั่งยืน', start: 5, end: 7 },
            { name: 'สังคมและชุมชน', start: 7, end: 10 }
        ];
        const answersByQuestion = new Map(
            result.answers.map(answer => [answer.questionIndex, answer])
        );
        const questionGrid = document.getElementById('reportQuestionGrid');
        questionGrid.replaceChildren();

        quizData.forEach((question, index) => {
            const answer = answersByQuestion.get(index);
            const chip = document.createElement('div');
            const status = !answer
                ? 'ยังไม่มีข้อมูล'
                : answer.isTimeout
                    ? 'หมดเวลา ไม่ได้ตอบ'
                    : answer.isCorrect
                        ? 'ตอบถูก'
                        : 'ตอบผิด';
            chip.className = `report-question-chip ${answer
                ? answer.isTimeout ? 'is-timeout' : answer.isCorrect ? 'is-correct' : 'is-wrong'
                : 'is-timeout'}`;
            chip.title = `ข้อ ${index + 1}: ${question.term} — ${status}`;
            chip.setAttribute('aria-label', chip.title);
            const number = document.createElement('span');
            number.textContent = String(index + 1);
            const icon = document.createElement('i');
            icon.className = `fas ${answer
                ? answer.isTimeout ? 'fa-hourglass-end' : answer.isCorrect ? 'fa-check' : 'fa-times'
                : 'fa-minus'}`;
            icon.setAttribute('aria-hidden', 'true');
            chip.append(number, icon);
            questionGrid.appendChild(chip);
        });

        const categoryResults = categories.map(category => {
            const categoryAnswers = result.answers.filter(answer =>
                answer.questionIndex >= category.start && answer.questionIndex < category.end
            );
            const count = category.end - category.start;
            const correct = categoryAnswers.filter(answer => answer.isCorrect).length;
            return { ...category, count, correct, accuracy: Math.round(correct / count * 100) };
        });
        const categoryList = document.getElementById('reportCategoryList');
        categoryList.replaceChildren();
        categoryResults.forEach(category => {
            const row = document.createElement('div');
            row.className = 'report-category-row';
            const name = document.createElement('span');
            name.className = 'report-category-name';
            name.textContent = category.name;
            const track = document.createElement('div');
            track.className = 'report-category-track';
            track.setAttribute('role', 'progressbar');
            track.setAttribute('aria-label', category.name);
            track.setAttribute('aria-valuemin', '0');
            track.setAttribute('aria-valuemax', '100');
            track.setAttribute('aria-valuenow', String(category.accuracy));
            const progress = document.createElement('div');
            progress.className = 'report-category-progress';
            progress.style.width = `${category.accuracy}%`;
            track.appendChild(progress);
            const score = document.createElement('span');
            score.className = 'report-category-score';
            score.textContent = `${category.correct}/${category.count}`;
            row.append(name, track, score);
            categoryList.appendChild(row);
        });

        const strongest = categoryResults.reduce((best, category) =>
            category.accuracy > best.accuracy ? category : best
        );
        const weakest = categoryResults.reduce((lowest, category) =>
            category.accuracy < lowest.accuracy ? category : lowest
        );
        const strengths = document.getElementById('reportStrengthsList');
        strengths.replaceChildren();
        const strengthItem = document.createElement('li');
        const strengthIcon = document.createElement('i');
        strengthIcon.className = 'fas fa-check-circle';
        strengthIcon.setAttribute('aria-hidden', 'true');
        const strengthText = document.createElement('span');
        strengthText.textContent = strongest.correct > 0
            ? `ทำได้ดีที่สุดในหมวด${strongest.name} ตอบถูก ${strongest.correct} จาก ${strongest.count} ข้อ`
            : 'ลองทบทวนคำตอบที่ถูกต้องจากข้อมูลความรู้ เพื่อค้นหาจุดที่ทำได้ดีในครั้งถัดไป';
        strengthItem.append(strengthIcon, strengthText);
        strengths.appendChild(strengthItem);

        const improvements = document.getElementById('reportImproveList');
        improvements.replaceChildren();
        const improvementItem = document.createElement('li');
        const improvementIcon = document.createElement('i');
        improvementIcon.className = 'fas fa-book-open';
        improvementIcon.setAttribute('aria-hidden', 'true');
        const improvementText = document.createElement('span');
        improvementText.textContent = weakest.correct < weakest.count
            ? `ลองทบทวนหมวด${weakest.name} ซึ่งตอบถูก ${weakest.correct} จาก ${weakest.count} ข้อ`
            : 'ตอบถูกครบทุกหมวดแล้ว ลองเล่นอีกครั้งเพื่อทบทวนและรักษาความแม่นยำ';
        improvementItem.append(improvementIcon, improvementText);
        improvements.appendChild(improvementItem);
    }

    function displaySoloSummary() {
        if (!latestResult || latestResult.mode !== 'solo') return;
        const result = latestResult;
        const correct = result.answers.filter(answer => answer.isCorrect).length;
        const answered = result.answers.filter(answer => !answer.isTimeout).length;
        const incorrect = result.answers.filter(answer => !answer.isCorrect && !answer.isTimeout).length;
        const timedOut = result.answers.filter(answer => answer.isTimeout).length;
        const accuracy = Math.round(correct / quizData.length * 100);
        document.getElementById('summaryPlayerName').textContent = result.playerName
            ? `รายงานผลของคุณ ${result.playerName}`
            : 'รายงานผลการเล่นของคุณ';
        document.getElementById('scoreStat').textContent = `${correct} / ${quizData.length}`;
        document.getElementById('correctStat').textContent = String(correct);
        document.getElementById('wrongStat').textContent = String(incorrect);
        document.getElementById('timeoutStat').textContent = String(timedOut);
        document.getElementById('reportAnsweredValue').textContent = `${answered} / ${quizData.length}`;
        document.getElementById('reportTimeValue').textContent = formatTotalTime(result.totalTimeMs);
        document.getElementById('accuracyPercentText').textContent = `${accuracy}%`;
        document.getElementById('accuracyProgressBar').style.width = `${accuracy}%`;
        document.getElementById('accuracyPercentText').style.color = '#70509b';
        document.getElementById('accuracyProgressBar').style.background =
            'linear-gradient(90deg, #8f6bb8, #c09bd1 58%, #e3c284)';
        document.querySelector('#resultScreen .report-stat-track').setAttribute('aria-valuenow', String(accuracy));
        document.getElementById('soloResultTime').textContent = `เวลารวม: ${formatTotalTime(result.totalTimeMs)}`;
        renderSoloReportDetails(result);
        document.getElementById('soloSummaryActions').classList.remove('hidden');
        document.getElementById('reviewToggleButton').classList.add('hidden');
        document.getElementById('reviewAnswersContainer').classList.add('hidden');
        document.querySelector('#resultScreen > .flex.flex-col')?.classList.add('hidden');
        showScreen('resultScreen');
    }

    function showSoloSummary() {
        displaySoloSummary();
    }

    function showTeamworkSummary() {
        if (!latestResult || latestResult.mode !== 'teamwork') return;
        document.getElementById('teamworkSummaryTitle').textContent = 'จบการนำเสนอ Teamwork';
        document.getElementById('soloSummaryActions').classList.add('hidden');
        showScreen('teamworkSummaryScreen');
    }

    function restartQuiz() {
        clearInterval(timer);
        timer = null;
        finalizing = false;
        if (latestResult && latestResult.mode === 'teamwork') {
            run = createRun('teamwork', '');
            latestResult = null;
            run.status = 'playing';
            gameMode = 'teamwork';
            isGameplayMusicMode = true;
            applyAudioVolume();
            startBackgroundMusic();
            document.getElementById('playerDisplay').textContent = 'ผู้ดำเนินกิจกรรมควบคุมเกม';
            showScreen('quizScreen');
            loadQuestion();
            return;
        }
        const name = latestResult && latestResult.playerName
            ? latestResult.playerName
            : document.getElementById('playerNameInput').value.trim();
        latestResult = null;
        run = createRun('solo', name);
        gameMode = 'solo';
        run.status = 'playing';
        showScreen('quizScreen');
        loadQuestion();
    }

    function goHome() {
        if (run && run.status !== 'completed') {
            pauseAnyTimer();
        }
        isGameplayMusicMode = false;
        applyAudioVolume();
        showModeSelection();
    }

    function returnTeamworkToMenu() {
        if (!run || run.mode !== 'teamwork') return;
        stopCountdown();
        run = null;
        removeSavedRun();
        if (document.fullscreenElement === document.getElementById('gameMain')) {
            toggleTeamworkFullscreen();
        }
        showModeSelection();
    }

    window.enterWelcomeScreen = showModeSelection;
    window.returnToQrScreen = returnToQrScreen;
    window.returnToIntro = returnToIntro;
    window.showModeSelection = showModeSelection;
    window.showTeamworkWelcome = showTeamworkWelcome;
    window.showNameScreen = showNameScreen;
    window.returnToNameScreen = returnToNameScreen;
    window.showWelcomeScreen = showWelcomeScreen;
    window.startGame = startGame;
    window.beginSoloGame = beginSoloGame;
    window.startTeamworkGame = startTeamworkGame;
    window.loadQuestion = loadQuestion;
    window.updateTimerDisplay = updateTimerDisplay;
    window.selectOption = selectOption;
    window.confirmSoloAnswer = confirmSoloAnswer;
    window.handleTimeout = handleTimeout;
    window.nextQuestion = nextQuestion;
    window.toggleTeamworkPause = toggleTeamworkPause;
    window.toggleTeamworkFullscreen = toggleTeamworkFullscreen;
    window.revealTeamAnswer = revealTeamAnswer;
    window.advanceTeamQuestion = advanceTeamQuestion;
    window.showResults = displaySoloSummary;
    window.openKnowledgeReview = openKnowledgeReview;
    window.returnFromKnowledgeReview = returnFromKnowledgeReview;
    window.showSoloSummary = showSoloSummary;
    window.showTeamworkSummary = showTeamworkSummary;
    window.restartQuiz = restartQuiz;
    window.goHome = goHome;
    window.returnTeamworkToMenu = returnTeamworkToMenu;

    document.getElementById('soloModeButton').addEventListener('click', () => {
        playClickSound();
        showSoloQr();
    });
    document.getElementById('teamworkModeButton').addEventListener('click', () => {
        playClickSound();
        showTeamworkWelcome();
    });
    document.getElementById('soloQrBackButton').addEventListener('click', () => {
        playClickSound();
        showModeSelection();
    });
    document.getElementById('soloQrNextButton').addEventListener('click', () => {
        playClickSound();
        showNameScreen();
    });
    document.getElementById('soloQrImageButton').addEventListener('click', openQrModal);
    document.getElementById('reviewPreviousButton').addEventListener('click', () => navigateReviewQuestion(-1));
    document.getElementById('reviewPreviousFooterButton').addEventListener('click', () => navigateReviewQuestion(-1));
    document.getElementById('reviewNextButton').addEventListener('click', () => navigateReviewQuestion(1));
    document.getElementById('reviewNextFooterButton').addEventListener('click', () => navigateReviewQuestion(1));
    document.querySelectorAll('[data-review-filter]').forEach(button => {
        button.addEventListener('click', () => setReviewFilter(button.dataset.reviewFilter));
    });
    document.querySelectorAll('[data-teamwork-review-filter]').forEach(button => {
        button.addEventListener('click', () => {
            teamworkReviewStatusFilter = button.dataset.teamworkReviewFilter;
            renderTeamworkReview();
            document.querySelector(`[data-teamwork-review-filter="${teamworkReviewStatusFilter}"]`)?.focus();
        });
    });
    document.getElementById('teamworkReviewCategory').addEventListener('change', event => {
        teamworkReviewCategory = event.target.value;
        renderTeamworkReview();
    });
    document.getElementById('teamworkReviewBackButton').addEventListener('click', showModeSelection);
    document.getElementById('teamworkReviewContinueButton').addEventListener('click', finishTeamworkPresentation);
    document.getElementById('teamworkReviewModalClose').addEventListener('click', closeTeamworkReviewModal);
    document.getElementById('teamworkReviewModalOverlay').addEventListener('click', event => {
        if (event.target === event.currentTarget) closeTeamworkReviewModal();
    });
    document.getElementById('teamworkReviewModalPrevious').addEventListener('click', () => navigateTeamworkReviewModal(-1));
    document.getElementById('teamworkReviewModalNext').addEventListener('click', () => navigateTeamworkReviewModal(1));
    document.addEventListener('keydown', handleTeamworkReviewModalKeydown);
    document.getElementById('playerNameInput').addEventListener('keydown', event => {
        if (event.key === 'Enter') startGame();
    });
    document.addEventListener('keydown', event => {
        const quizScreen = document.getElementById('quizScreen');
        if (quizScreen.classList.contains('hidden')) return;
        if (event.code === 'Space' && run?.mode === 'teamwork' && run.revealed &&
            !event.repeat && !event.ctrlKey && !event.altKey && !event.metaKey &&
            !event.target.matches('input,textarea,select,[contenteditable="true"]')) {
            event.preventDefault();
            advanceTeamQuestion();
            return;
        }
        if (/^[1-4]$/.test(event.key) && !event.target.matches('input,textarea,select,[contenteditable="true"]')) {
            const button = document.querySelectorAll('#optionsGrid .option-btn')[Number(event.key) - 1];
            if (button && !button.disabled) button.click();
            return;
        }
        if (event.key === 'Enter' && quizScreen.classList.contains('solo-mode') &&
            !event.target.closest('#confirmSoloAnswerButton') &&
            !event.target.matches('input,textarea,select,[contenteditable="true"]') &&
            selectedSoloOptionIndex !== null) {
            event.preventDefault();
            confirmSoloAnswer();
        }
    });
    if (run && run.mode === 'solo' && run.status === 'playing') {
        gameMode = 'solo';
        showScreen('quizScreen');
        loadQuestion();
    }
})();
