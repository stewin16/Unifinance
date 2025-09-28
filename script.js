document.addEventListener('DOMContentLoaded', () => {
    
    // FIREBASE AND API CONFIGURATION

    const firebaseConfig = {
        apiKey: "AIzaSyB0GDEB2gMdM7ILtUdVmOOIIdn1oCiY68I",
        authDomain: "taxwiseapp-fd1ee.firebaseapp.com",
        projectId: "taxwiseapp-fd1ee",
        storageBucket: "taxwiseapp-fd1ee.appspot.com",
        messagingSenderId: "522348901127",
        appId: "1:522348901127:web:13a751f669aa38714ccba2",
        measurementId: "G-HC42XP2H11"
    };

    
    const GEMINI_API_KEY = "AIzaSyBkv1dXN3-JALMDtEPiyEp4-tEkQx6-ogQ";

    
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();

    
    const landingPage = document.getElementById('landing-page');
    const authModal = document.getElementById('auth-modal');
    const appContainer = document.getElementById('app-container');
    const loginView = document.getElementById('login-view');
    const signupView = document.getElementById('signup-view');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const loginError = document.getElementById('login-error');
    const signupError = document.getElementById('signup-error');
    const logoutButton = document.getElementById('logout-button');
    const getStartedButton = document.getElementById('get-started-button');
    const loginNavButton = document.getElementById('login-nav-button');
    const closeModalButton = document.getElementById('close-modal-button');
    const showSignupLink = document.getElementById('show-signup-link');
    const showLoginLink = document.getElementById('show-login-link');
    const welcomeUsername = document.getElementById('welcome-username');
    const profileUsername = document.getElementById('profile-username');
    const profileEmail = document.getElementById('profile-email');
    const profileMemberSince = document.getElementById('profile-member-since');
    const aiChatButton = document.getElementById('ai-chat-button');
    const aiChatModal = document.getElementById('ai-chat-modal');
    const closeChatButton = document.getElementById('close-chat-button');
    const chatMessages = document.getElementById('chat-messages');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatPrompts = document.getElementById('chat-prompts');
    
    const pages = {
        dashboard: document.getElementById('page-dashboard'),
        optimizer: document.getElementById('page-optimizer'),
        cibil: document.getElementById('page-cibil'),
        reports: document.getElementById('page-reports'),
        profile: document.getElementById('page-profile'),
    };
    const navLinks = {
        dashboard: document.getElementById('nav-dashboard'),
        optimizer: document.getElementById('nav-optimizer'),
        cibil: document.getElementById('nav-cibil'),
        reports: document.getElementById('nav-reports'),
        profile: document.getElementById('nav-profile'),
    };
    let analysisData = null;
    let spendingChart = null;
    let currentUser = null;

    
    // AUTHENTICATION & PAGE VISIBILITY
    
    const showAuthModal = () => authModal.classList.remove('hidden');
    const hideAuthModal = () => authModal.classList.add('hidden');
    
    const showAppPage = () => {
        hideAuthModal();
        landingPage.style.display = 'none';
        appContainer.classList.remove('hidden');
    };

    const showLandingPage = () => {
        appContainer.classList.add('hidden');
        landingPage.style.display = 'block';
        hideAuthModal();
        navigate('dashboard');
        resetUI();
    };
    
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                welcomeUsername.textContent = userData.username;
                profileUsername.textContent = userData.username;
                profileEmail.textContent = user.email;
                if (user.metadata.creationTime) {
                    profileMemberSince.textContent = new Date(user.metadata.creationTime).toLocaleDateString('en-IN', { month: 'long', year: 'numeric'});
                }
                if(userData.lastAnalysis) {
                    analysisData = userData.lastAnalysis;
                    updateAllUI(analysisData);
                }
            }
            showAppPage();
        } else {
            currentUser = null;
            showLandingPage();
        }
    });

    getStartedButton.addEventListener('click', showAuthModal);
    loginNavButton.addEventListener('click', showAuthModal);
    closeModalButton.addEventListener('click', hideAuthModal);
    authModal.addEventListener('click', (e) => {
        if(e.target === authModal) hideAuthModal();
    });
    showSignupLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginView.classList.add('hidden');
        signupView.classList.remove('hidden');
    });
    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        signupView.classList.add('hidden');
        loginView.classList.remove('hidden');
    });

    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = e.target.username.value;
        const email = e.target.email.value;
        const password = e.target.password.value;
        signupError.classList.add('hidden');
        auth.createUserWithEmailAndPassword(email, password)
            .then(userCredential => {
                return db.collection('users').doc(userCredential.user.uid).set({
                    username: username,
                    email: email
                });
            })
            .catch(error => {
                signupError.textContent = error.message;
                signupError.classList.remove('hidden');
            });
    });

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = e.target.email.value;
        const password = e.target.password.value;
        loginError.classList.add('hidden');
        auth.signInWithEmailAndPassword(email, password)
            .catch(error => {
                loginError.textContent = error.message;
                loginError.classList.remove('hidden');
            });
    });

    logoutButton.addEventListener('click', (e) => {
        e.preventDefault();
        auth.signOut();
    });

    
    // AI CHAT (WITH DUAL API FALLBACK)
    
    const toggleChat = () => {
        aiChatModal.classList.toggle('hidden');
        if (!aiChatModal.classList.contains('hidden') && chatMessages.children.length === 0) {
            addMessageToChat("Hello! I'm the UniFinance AI Assistant. How can I help?", 'ai');
        }
    };
    aiChatButton.addEventListener('click', toggleChat);
    closeChatButton.addEventListener('click', toggleChat);

    const addMessageToChat = (message, sender) => {
        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${sender === 'user' ? 'user-message' : 'ai-message'}`;
        messageElement.textContent = message;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userInput = chatInput.value.trim();
        if (!userInput || !currentUser) return;
        
        addMessageToChat(userInput, 'user');
        chatInput.value = '';
        chatPrompts.classList.add('hidden');

        const thinkingElement = document.createElement('div');
        thinkingElement.className = 'chat-message ai-message';
        thinkingElement.innerHTML = '<span>Thinking...</span>';
        chatMessages.appendChild(thinkingElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        try {
            
            const idToken = await currentUser.getIdToken();
            const response = await fetch('https://taxwise-api-unique.onrender.com/chat', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({ message: userInput }),
            });
            if (!response.ok) throw new Error('Backend API failed');
            const data = await response.json();
            thinkingElement.remove();
            addMessageToChat(data.reply, 'ai');
        } catch (backendError) {
            console.warn("Backend chat failed:", backendError.message, "Trying frontend fallback.");
            try {
            
                const directResponse = await getGeminiResponseDirectly(userInput);
                thinkingElement.remove();
                addMessageToChat(directResponse, 'ai');
            } catch (frontendError) {
                console.error("Frontend chat fallback also failed:", frontendError.message);
                
                thinkingElement.remove();
                const hardcodedResponse = getHardcodedResponse(userInput);
                addMessageToChat(hardcodedResponse, 'ai');
            }
        }
    });
    
    const getGeminiResponseDirectly = async (prompt) => {
         const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
        
         if (!GEMINI_API_KEY || GEMINI_API_KEY.includes("AIzaSyANibPszZ6TF0dV1srzLLM0ClhTjQd04W4")) {
             throw new Error("Frontend API Key not configured.");
         }

         const payload = {
             contents: [{
                 parts: [{
                     text: `You are a helpful financial assistant for users in India. Keep answers concise. Question: "${prompt}"`
                 }]
             }]
         };

         const response = await fetch(API_URL, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(payload),
         });

         if (!response.ok) {
             const errorBody = await response.text();
             throw new Error(`API Error: ${response.statusText} - ${errorBody}`);
         }

         const data = await response.json();
         const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
         
         if (!text) {
             throw new Error("Invalid response format from AI.");
         }
         return text;
    };

    const getHardcodedResponse = (prompt) => {
        const p = prompt.toLowerCase();
        if (p.includes('cibil')) return "To improve CIBIL score: pay bills on time, keep credit utilization below 30%, and have a mix of credit types.";
        if (p.includes('tax')) return "Old Tax Regime allows deductions (80C). New Regime has lower slab rates but fewer deductions. The better option depends on your investments.";
        if (p.includes('80c')) return "Section 80C allows reducing taxable income up to ₹1,50,000 via investments in PPF, ELSS, life insurance, etc.";
        return "Sorry, I'm having trouble connecting to live AI services. I can answer basic questions about CIBIL, tax regimes, and 80C.";
    };
    
    chatPrompts.addEventListener('click', (e) => {
        if(e.target.tagName === 'BUTTON') {
            chatInput.value = e.target.textContent;
            chatForm.requestSubmit();
        }
    });

    
    // FILE UPLOAD (SECURE)
    
    document.getElementById('upload-button').addEventListener('click', () => document.getElementById('file-upload').click());
    document.getElementById('file-upload').addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleFileUpload(e.target.files);
    });

    async function handleFileUpload(files) {
        if (!currentUser) {
            alert("Please log in to upload files.");
            return;
        }
        const statusDiv = document.getElementById('upload-status');
        const formData = new FormData();
        for (const file of files) {
            formData.append('statements', file);
        }
        statusDiv.innerHTML = `<div class="flex items-center text-amber-400">Processing...</div>`;
        try {
            const idToken = await currentUser.getIdToken();
            const response = await fetch('https://taxwise-api-unique.onrender.com/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${idToken}` },
                body: formData,
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to process file');
            }
            analysisData = await response.json();
            await db.collection('users').doc(currentUser.uid).update({
                lastAnalysis: analysisData
            });
            statusDiv.innerHTML = `<div class="text-green-400 font-semibold">Analysis complete!</div>`;
            updateAllUI(analysisData);
        } catch (error) {
            statusDiv.innerHTML = `<div class="text-red-500 font-semibold">Error: ${error.message}</div>`;
        }
    }
    
    
    function updateAllUI(data) {
        updateDashboard(data.dashboard_data);
        updateTaxOptimizer(data.tax_analysis);
        updateCibilAdvisor(data.cibil_analysis);
        document.getElementById('download-pdf-button').disabled = false;
        document.getElementById('pdf-note').textContent = "Your financial summary is ready for download.";
    }

    function resetUI() {
        document.getElementById('tax-liability').textContent = '0';
        document.getElementById('cibil-score').textContent = '0';
        document.getElementById('investments-80c').textContent = '0';
        document.getElementById('recent-transactions').innerHTML = '<p class="text-main-subheader text-center pt-10">Upload documents to see transactions.</p>';
        if (spendingChart) {
            spendingChart.destroy();
            spendingChart = null;
        }
        document.getElementById('download-pdf-button').disabled = true;
        analysisData = null;
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN').format(Math.round(amount));
    }
    
    function navigate(page) {
        Object.values(pages).forEach(p => p.classList.add('hidden'));
        Object.values(navLinks).forEach(l => l.classList.remove('active'));
        pages[page].classList.remove('hidden');
        navLinks[page].classList.add('active');
    }

    Object.keys(navLinks).forEach(key => {
        navLinks[key].addEventListener('click', (e) => {
            e.preventDefault();
            navigate(key);
        });
    });

    function updateDashboard(data) {
        const taxRegime = analysisData.tax_analysis.recommended_regime.toUpperCase();
        document.getElementById('tax-liability').textContent = formatCurrency(analysisData.tax_analysis[`${taxRegime.toLowerCase()}_regime`].tax_payable);
        document.getElementById('tax-regime-label').textContent = `Regime: ${taxRegime}`;
        document.getElementById('cibil-score').textContent = analysisData.cibil_analysis.score;
        document.getElementById('cibil-status').textContent = 'Analysis complete';
        document.getElementById('investments-80c').textContent = formatCurrency(data.investments_80c);
        const transactionsContainer = document.getElementById('recent-transactions');
        transactionsContainer.innerHTML = '';
        data.transactions.forEach(tx => {
            const amount = tx.credit > 0 ? `+ ₹ ${formatCurrency(tx.credit)}` : `- ₹ ${formatCurrency(tx.debit)}`;
            const amountColor = tx.credit > 0 ? 'text-green-400' : 'text-red-400';
            const date = tx.date || 'N/A';
            transactionsContainer.innerHTML += `<div class="flex justify-between items-center py-1.5 border-b border-gray-700/50"><div><p class="font-medium text-main-header">${tx.description || 'N/A'}</p><p class="text-sm text-main-subheader">${date}</p></div><p class="font-semibold ${amountColor}">${amount}</p></div>`;
        });
        renderSpendingChart(data.spending_breakdown);
        renderInvestmentOpportunities(data.investments_80c);
    }

    function renderInvestmentOpportunities(investments80c) {
        const container = document.getElementById('investment-opportunities');
        const remaining80c = 150000 - investments80c;
        let content = `<h3 class="text-lg font-semibold text-main-header mb-4">Investment Opportunities</h3>`;
        if (remaining80c > 0) {
            content += `<div class="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg"><p class="font-semibold text-amber-300">Maximize Your 80C Savings!</p><p class="text-amber-400 mt-1">You can still invest <span class="font-bold">₹ ${formatCurrency(remaining80c)}</span> in options like PPF, ELSS, or NPS to save more tax.</p></div>`;
        } else {
            content += `<div class="p-4 bg-green-500/10 border border-green-500/20 rounded-lg"><p class="font-semibold text-green-300">Congratulations!</p><p class="text-green-400 mt-1">You have maximized your tax savings under Section 80C.</p></div>`;
        }
        container.innerHTML = content;
    }

    function updateTaxOptimizer(data) {
        const container = document.getElementById('tax-optimizer-content');
        const isOldRecommended = data.recommended_regime === 'old';
        const recommendationsHTML = data.recommendations?.length ? data.recommendations.map(rec => `<li>${rec}</li>`).join('') : '<li>No specific tax recommendations.</li>';
        container.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 gap-6"><div class="card p-6 border-2 ${isOldRecommended ? 'border-green-400' : 'border-transparent'}"><div class="flex justify-between items-center"><h3 class="text-xl font-bold text-main-header">Old Regime</h3>${isOldRecommended ? '<span class="bg-green-400 text-slate-900 text-xs font-bold px-3 py-1 rounded-full">RECOMMENDED</span>' : ''}</div><div class="mt-4 space-y-2"><p class="text-main-subheader">Taxable Income: <span class="font-semibold text-main-header">₹ ${formatCurrency(data.old_regime.taxable_income)}</span></p><p class="text-main-header font-bold text-2xl">Tax Payable: <span class="text-green-400">₹ ${formatCurrency(data.old_regime.tax_payable)}</span></p></div></div><div class="card p-6 border-2 ${!isOldRecommended ? 'border-green-400' : 'border-transparent'}"><div class="flex justify-between items-center"><h3 class="text-xl font-bold text-main-header">New Regime</h3>${!isOldRecommended ? '<span class="bg-green-400 text-slate-900 text-xs font-bold px-3 py-1 rounded-full">RECOMMENDED</span>' : ''}</div><div class="mt-4 space-y-2"><p class="text-main-subheader">Taxable Income: <span class="font-semibold text-main-header">₹ ${formatCurrency(data.new_regime.taxable_income)}</span></p><p class="text-main-header font-bold text-2xl">Tax Payable: <span class="text-green-400">₹ ${formatCurrency(data.new_regime.tax_payable)}</span></p></div></div></div><div class="card p-6 mt-6"><h3 class="text-lg font-semibold text-main-header flex items-center"><svg class="h-6 w-6 mr-2 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>AI Recommendations</h3><ul class="list-disc list-inside mt-3 text-main-subheader space-y-2">${recommendationsHTML}</ul></div>`;
    }

    function updateCibilAdvisor(data) {
        const container = document.getElementById('cibil-advisor-content');
        const recommendationsHTML = data.recommendations?.length ? data.recommendations.map(rec => `<li>${rec}</li>`).join('') : '<li>No recommendations.</li>';
        container.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 gap-6"><div class="card p-6"><h3 class="text-xl font-bold text-main-header">Your CIBIL Score: <span class="text-green-400">${data.score}</span></h3><p class="text-main-subheader mt-1">Estimate based on your financial data.</p><div class="grid grid-cols-2 gap-4 mt-6 text-center"><div><h4 class="font-semibold text-main-subheader">Payment History</h4><p class="text-2xl font-bold text-green-400 mt-2">100%</p></div><div><h4 class="font-semibold text-main-subheader">Credit Utilization</h4><p class="text-2xl font-bold text-amber-400 mt-2" id="cibil-utilization-display">${(data.factors.credit_utilization * 100).toFixed(0)}%</p></div></div></div><div class="card p-6"><h3 class="text-lg font-semibold text-main-header">What-If Scenario</h3><p class="text-sm text-main-subheader mt-1">See how your CIBIL score could change.</p><div class="mt-4"><label for="utilization-slider" class="block mb-2 text-sm font-medium text-main-header">Adjust Credit Utilization (<span id="slider-value-display"></span>%)</label><input id="utilization-slider" type="range" min="1" max="100" value="${(data.factors.credit_utilization * 100).toFixed(0)}" class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"><p class="text-center mt-3 text-lg text-main-subheader">Simulated Score: <span id="simulated-cibil-score" class="font-bold text-green-400"></span></p></div></div></div><div class="card p-6 mt-6"><h3 class="text-lg font-semibold text-main-header flex items-center"><svg class="h-6 w-6 mr-2 text-green-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5 2a3 3 0 00-3 3v1.432l.21.018a22.99 22.99 0 0115.58 0l.21-.018V5a3 3 0 00-3-3H5zm12 5.432l-.21.018a22.99 22.99 0 01-15.58 0L3 7.432V15a3 3 0 003 3h12a3 3 0 003-3V7.432zM14 12a1 1 0 11-2 0 1 1 0 012 0z" clip-rule="evenodd" /></svg>How to Improve Your Score</h3><ul class="list-disc list-inside mt-3 text-main-subheader space-y-2">${recommendationsHTML}</ul></div>`;
        setupCibilSimulator();
    }
    
    function setupCibilSimulator() {
        const slider = document.getElementById('utilization-slider');
        if (!slider) return;
        const sliderValueDisplay = document.getElementById('slider-value-display');
        const simulatedScoreDisplay = document.getElementById('simulated-cibil-score');
        
        const estimateScore = (utilization) => {
            let score = 750;
            if (utilization > 90) score -= 100; else if (utilization > 70) score -= 75;
            else if (utilization > 50) score -= 50; else if (utilization > 30) score -= 25;
            else score += 20;
            return Math.max(Math.min(score, 900), 300);
        };

        const updateSimulation = () => {
            sliderValueDisplay.textContent = slider.value;
            simulatedScoreDisplay.textContent = estimateScore(slider.value);
        };
        slider.addEventListener('input', updateSimulation);
        updateSimulation();
    }

    function renderSpendingChart(spendingData) {
        const ctx = document.getElementById('spending-chart').getContext('2d');
        const consolidatedData = Object.entries(spendingData).reduce((acc, [cat, amt]) => {
            if (!cat.toLowerCase().includes('income')) acc[cat] = (acc[cat] || 0) + amt;
            return acc;
        }, {});
        
        if (spendingChart) spendingChart.destroy();
        Chart.defaults.color = '#9ca3af';
        spendingChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(consolidatedData),
                datasets: [{
                    data: Object.values(consolidatedData),
                    backgroundColor: ['#10b981', '#f59e0b', '#3b82f6', '#6366f1', '#ec4899', '#f97316', '#06b6d4'],
                    borderColor: '#0f172a', borderWidth: 4
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } } } }
        });
    }


    // =============================================================================
    // PDF GENERATION LOGIC
    // =============================================================================
    document.getElementById('download-pdf-button').addEventListener('click', downloadPDF);

    async function downloadPDF() {
        if (!analysisData) {
            alert('Please process your financial documents first.');
            return;
        }

        const pdfButton = document.getElementById('download-pdf-button');
        pdfButton.disabled = true;
        pdfButton.innerHTML = `<span>Generating PDF...</span>`;

        if (spendingChart) {
            spendingChart.options.animation.duration = 0;
            spendingChart.update();
        }

        const { jsPDF } = window.jspdf;
        const reportContainer = document.createElement('div');
        reportContainer.style.position = 'absolute';
        reportContainer.style.left = '-9999px';
        reportContainer.style.width = '210mm';
        reportContainer.innerHTML = generateReportHTML(analysisData);
        document.body.appendChild(reportContainer);
        
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
            const canvas = await html2canvas(reportContainer, {
                scale: 2,
                useCORS: true,
                width: reportContainer.scrollWidth,
                height: reportContainer.scrollHeight
            });

            const imgData = canvas.toDataURL('image/png');
            const doc = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = doc.internal.pageSize.getWidth();
            const pdfHeight = doc.internal.pageSize.getHeight();
            
            const imgProps = doc.getImageProperties(imgData);
            const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
            
            let heightLeft = imgHeight;
            let position = 0;

            doc.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                doc.addPage();
                doc.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;
            }
            
            doc.save(`UniFinance_Financial_Summary_${new Date().toLocaleDateString('en-IN')}.pdf`);

        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("Sorry, there was an error creating the PDF. Please try again.");
        } finally {
            document.body.removeChild(reportContainer);
            if (spendingChart) {
                spendingChart.options.animation.duration = 1000;
                spendingChart.update();
            }
            pdfButton.disabled = false;
            pdfButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                <span>Download PDF Summary</span>
            `;
        }
    }
    
    function generateReportHTML(data) {
        const today = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
        let chartImageSrc = '';
        if (spendingChart) {
             chartImageSrc = spendingChart.toBase64Image();
        }

        const taxRecsHTML = data.tax_analysis.recommendations.map(rec => `<li>${rec}</li>`).join('');
        const cibilRecsHTML = data.cibil_analysis.recommendations.map(rec => `<li>${rec}</li>`).join('');

        return `
            <style>
                body { font-family: 'Inter', sans-serif; color: #1f2937; -webkit-font-smoothing: antialiased; }
                .report-wrapper { padding: 20px; background-color: white; width: 100%; box-sizing: border-box; }
                .header { background-color: #1e293b; color: white; padding: 16px; text-align: center; border-radius: 8px; }
                .header h1 { font-size: 28px; font-weight: bold; margin: 0; }
                .header p { margin: 4px 0 0 0; font-size: 14px; }
                .section { clear: both; page-break-inside: avoid; margin-top: 25px; } 
                .section-title { font-size: 20px; font-weight: bold; color: #1e293b; border-bottom: 2px solid #10b981; padding-bottom: 8px; margin-bottom: 16px;}
                .table { width: 100%; border-collapse: collapse; }
                .table th, .table td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; font-size: 14px; }
                .table th { background-color: #f1f5f9; font-weight: 600; }
                .highlight { background-color: #d1fae5; font-weight: bold; }
                .chart-container { text-align: center; margin-top: 20px; page-break-inside: avoid; }
                .chart-container img { max-width: 80%; height: auto; margin: 0 auto; display: block; }
                .recommendation-box { background-color: #f8fafc; padding: 16px; margin-top: 16px; border-left: 4px solid #10b981; border-radius: 4px; }
                .recommendation-box h3 { font-size: 16px; font-weight: bold; color: #1e293b; margin:0 0 10px 0; }
                ul { list-style-position: inside; margin: 0; padding-left: 5px; }
                li { margin-bottom: 8px; font-size: 14px; }
            </style>
            <div class="report-wrapper">
                <div class="header">
                    <h1>UniFinance Financial Summary</h1>
                    <p>Report Generated on: ${today}</p>
                </div>
                <div class="section">
                    <h2 class="section-title">Dashboard Overview</h2>
                    <table class="table">
                        <tr><th style="width: 50%;">Projected Tax Liability (${data.tax_analysis.recommended_regime.toUpperCase()} Regime)</th><td>INR ${formatCurrency(data.tax_analysis[`${data.tax_analysis.recommended_regime.toLowerCase()}_regime`].tax_payable)}</td></tr>
                        <tr><th>Estimated CIBIL Score</th><td>${data.cibil_analysis.score}</td></tr>
                        <tr><th>Total 80C Investments</th><td>INR ${formatCurrency(data.dashboard_data.investments_80c)}</td></tr>
                        <tr><th>Total Annual Income</th><td>INR ${formatCurrency(data.dashboard_data.total_income)}</td></tr>
                    </table>
                </div>
                <div class="section">
                    <h2 class="section-title">Tax Regime Comparison</h2>
                    <table class="table">
                        <thead><tr><th></th><th style="font-weight: bold;">Old Regime</th><th style="font-weight: bold;">New Regime</th></tr></thead>
                        <tbody>
                            <tr><th>Taxable Income</th><td>INR ${formatCurrency(data.tax_analysis.old_regime.taxable_income)}</td><td>INR ${formatCurrency(data.tax_analysis.new_regime.taxable_income)}</td></tr>
                            <tr class="highlight"><th>Tax Payable</th><td>INR ${formatCurrency(data.tax_analysis.old_regime.tax_payable)}</td><td>INR ${formatCurrency(data.tax_analysis.new_regime.tax_payable)}</td></tr>
                        </tbody>
                    </table>
                </div>
                <div class="section">
                    <h2 class="section-title">Spending Breakdown</h2>
                    <div class="chart-container">
                        <img src="${chartImageSrc}" alt="Spending Breakdown Chart"/>
                    </div>
                </div>
                <div class="section">
                     <h2 class="section-title">AI Recommendations</h2>
                     <div class="recommendation-box">
                         <h3>Tax Savings</h3>
                         <ul>${taxRecsHTML}</ul>
                    </div>
                     <div class="recommendation-box">
                         <h3>CIBIL Score Improvement</h3>
                         <ul>${cibilRecsHTML}</ul>
                    </div>
                </div>
            </div>
        `;
    }
});
