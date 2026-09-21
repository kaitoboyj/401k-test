document.addEventListener('DOMContentLoaded', function () {
  initNavbar();
  initScrollAnimations();
  initEligibilityChecker();
  initApplicationForm();
  initDashboardSidebar();
});

function initNavbar() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;

  const toggle = document.querySelector('.nav-toggle');
  const menu = document.querySelector('.nav-menu');

  window.addEventListener('scroll', function () {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      menu.classList.toggle('open');
      const icon = toggle.querySelector('svg');
      if (menu.classList.contains('open')) {
        icon.innerHTML = '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>';
      } else {
        icon.innerHTML = '<line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line>';
      }
    });
  }

  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-menu a').forEach(function (link) {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
}

function initScrollAnimations() {
  const elements = document.querySelectorAll('.fade-in');
  if (!elements.length) return;

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  elements.forEach(function (el) {
    observer.observe(el);
  });
}

function initEligibilityChecker() {
  const checker = document.querySelector('.checker-body');
  if (!checker) return;

  const questions = [
    {
      q: 'Do you currently have an active 401(k) account?',
      desc: 'This program is exclusively for individuals with an established 401(k) retirement account.',
      options: ['Yes, I have an active 401(k) account', 'No, I do not have a 401(k) account']
    },
    {
      q: 'Is your 401(k) account valued at $20,000 or more?',
      desc: 'Accounts must meet a minimum balance threshold to qualify for grant consideration.',
      options: ['Yes, my balance is $20,000+', 'My balance is between $10,000–$20,000', 'My balance is below $10,000']
    },
    {
      q: 'Do you own or plan to start a small business?',
      desc: 'Grants are intended for business purposes including startup, expansion, or recovery.',
      options: ['Yes, I currently own a business', 'Yes, I plan to start one within 90 days', 'No, not at this time']
    },
    {
      q: 'Are you a U.S. citizen or legal resident?',
      desc: 'This program requires applicants to be legally authorized to conduct business in the United States.',
      options: ['Yes, U.S. Citizen', 'Yes, Legal Permanent Resident', 'No / Prefer not to say']
    },
    {
      q: 'What is your current credit score range?',
      desc: 'While perfect credit is not required, we review financial responsibility as part of the process.',
      options: ['700 or higher (Excellent)', '650–699 (Good)', '600–649 (Fair)', 'Below 600 (Building)']
    }
  ];

  let currentStep = 0;
  let answers = [];
  let selectedOption = null;

  const progressFill = checker.querySelector('.fill');
  const progressCount = checker.querySelector('.count');
  const questionContainer = checker.querySelector('.checker-question');
  const resultContainer = checker.querySelector('.checker-result');
  const btnBack = checker.querySelector('.btn-back');
  const btnNext = checker.querySelector('.btn-next');

  function updateProgress() {
    const progress = ((currentStep) / questions.length) * 100;
    if (progressFill) progressFill.style.width = progress + '%';
    if (progressCount) progressCount.textContent = (currentStep + 1) + ' of ' + questions.length;
  }

  function showQuestion() {
    if (currentStep >= questions.length) {
      showResult();
      return;
    }

    resultContainer.style.display = 'none';
    questionContainer.style.display = 'flex';

    const q = questions[currentStep];
    questionContainer.innerHTML = `
      <h4>${q.q}</h4>
      <p class="question-desc">${q.desc}</p>
      <div class="answer-options">
        ${q.options.map(function (opt, i) {
          return `<button class="answer-btn" data-index="${i}">${opt}</button>`;
        }).join('')}
      </div>
    `;

    selectedOption = answers[currentStep] !== undefined ? answers[currentStep] : null;

    questionContainer.querySelectorAll('.answer-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        questionContainer.querySelectorAll('.answer-btn').forEach(function (b) {
          b.style.background = '';
          b.style.borderColor = '';
          b.style.color = '';
        });
        btn.style.background = 'rgba(212, 175, 55, 0.08)';
        btn.style.borderColor = '#d4af37';
        btn.style.color = '#0a1929';
        selectedOption = parseInt(btn.dataset.index);
        if (btnNext) btnNext.disabled = false;
      });
    });

    if (selectedOption !== null) {
      const btns = questionContainer.querySelectorAll('.answer-btn');
      if (btns[selectedOption]) {
        btns[selectedOption].style.background = 'rgba(212, 175, 55, 0.08)';
        btns[selectedOption].style.borderColor = '#d4af37';
        btns[selectedOption].style.color = '#0a1929';
      }
      if (btnNext) btnNext.disabled = false;
    } else {
      if (btnNext) btnNext.disabled = true;
    }

    if (btnBack) btnBack.style.visibility = currentStep === 0 ? 'hidden' : 'visible';
    if (btnNext) btnNext.textContent = currentStep === questions.length - 1 ? 'See Results' : 'Next';

    updateProgress();
  }

  function calculateEligibility() {
    let score = 0;

    if (answers[0] === 0) score += 30;
    else return { eligible: false, reason: 'This program is exclusive to 401(k) account holders.' };

    if (answers[1] === 0) score += 25;
    else if (answers[1] === 1) score += 15;
    else return { eligible: false, reason: 'Your 401(k) balance is below our minimum threshold at this time.' };

    if (answers[2] === 0 || answers[2] === 1) score += 20;
    else return { eligible: false, reason: 'Grants require a business purpose (existing or planned startup).' };

    if (answers[3] === 0 || answers[3] === 1) score += 15;

    if (answers[4] === 0) score += 10;
    else if (answers[4] === 1) score += 8;
    else if (answers[4] === 2) score += 5;

    return {
      eligible: score >= 75,
      score: score,
      range: score >= 90 ? '$35,000 – $40,000' : score >= 80 ? '$30,000 – $35,000' : '$25,000 – $30,000'
    };
  }

  function showResult() {
    const result = calculateEligibility();
    questionContainer.style.display = 'none';
    resultContainer.style.display = 'block';
    if (btnBack) btnBack.style.visibility = 'visible';
    if (btnNext) btnNext.style.display = 'none';

    if (result.eligible) {
      resultContainer.className = 'checker-result success';
      resultContainer.innerHTML = `
        <div class="result-icon success">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h4>You Qualify!</h4>
        <p>Congratulations! Based on your answers, you meet the eligibility requirements. Your estimated grant range is <strong>${result.range}</strong>.</p>
        <a href="application.html" class="btn btn-primary btn-lg glow">Start My Application</a>
      `;
    } else {
      resultContainer.className = 'checker-result rejected';
      resultContainer.innerHTML = `
        <div class="result-icon rejected">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h4>Not Eligible at This Time</h4>
        <p>${result.reason} Please review our requirements or contact our support team for more information.</p>
        <button class="btn btn-outline-dark btn-lg" onclick="resetChecker()">Review Requirements</button>
      `;
    }
  }

  window.resetChecker = function () {
    currentStep = 0;
    answers = [];
    selectedOption = null;
    if (btnNext) btnNext.style.display = '';
    showQuestion();
  };

  if (btnBack) {
    btnBack.addEventListener('click', function () {
      if (currentStep > 0) {
        currentStep--;
        selectedOption = answers[currentStep];
        if (btnNext) btnNext.style.display = '';
        showQuestion();
      } else {
        window.resetChecker();
      }
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', function () {
      if (selectedOption === null) return;
      answers[currentStep] = selectedOption;
      currentStep++;
      selectedOption = null;
      showQuestion();
    });
  }

  showQuestion();
}

function initApplicationForm() {
  const formCard = document.querySelector('.form-card');
  if (!formCard) return;

  const totalSteps = 5;
  let currentStep = 1;
  const formData = {
    personal: {},
    kverify: {},
    business: {},
    banking: {}
  };

  const stepLabels = ['Personal', '401(k)', 'Business', 'Banking', 'Review'];

  function updateProgressSteps() {
    const steps = document.querySelectorAll('.progress-step');
    const progressLine = document.querySelector('.progress-line');

    steps.forEach(function (step, i) {
      step.classList.remove('active', 'completed');
      if (i + 1 < currentStep) step.classList.add('completed');
      else if (i + 1 === currentStep) step.classList.add('active');

      const circle = step.querySelector('.step-circle');
      if (step.classList.contains('completed')) {
        circle.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3" width="16" height="16">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>`;
      } else {
        circle.textContent = i + 1;
      }
    });

    const progressPercent = ((currentStep - 1) / (totalSteps - 1)) * 90;
    if (progressLine) progressLine.style.width = (5 + progressPercent) + '%';
  }

  function showStep(step) {
    const allSteps = formCard.querySelectorAll('.form-step');
    allSteps.forEach(function (s) { s.style.display = 'none'; });

    const targetStep = formCard.querySelector(`.form-step[data-step="${step}"]`);
    if (targetStep) targetStep.style.display = 'block';

    updateProgressSteps();

    const btnPrev = formCard.querySelector('.btn-prev');
    const btnNext = formCard.querySelector('.btn-next-step');

    if (btnPrev) btnPrev.style.visibility = step === 1 ? 'hidden' : 'visible';
    if (btnNext) {
      btnNext.textContent = step === totalSteps ? 'Submit Application' : (step === totalSteps - 1 ? 'Review Application' : 'Continue');
    }
  }

  function collectStepData(step) {
    const stepEl = formCard.querySelector(`.form-step[data-step="${step}"]`);
    if (!stepEl) return;

    const stepKey = ['personal', 'kverify', 'business', 'banking', 'review'][step - 1];
    if (!formData[stepKey]) formData[stepKey] = {};

    stepEl.querySelectorAll('input, select, textarea').forEach(function (input) {
      if (input.name) {
        formData[stepKey][input.name] = input.value;
      }
    });
  }

  function populateReview() {
    const p = formData.personal;
    const k = formData.kverify;
    const b = formData.business;
    const ba = formData.banking;

    const reviewEl = formCard.querySelector('.review-grid');
    if (!reviewEl) return;

    reviewEl.innerHTML = `
      <div class="review-item"><span class="label">Full Name</span><span class="value">${(p.firstName || '—') + ' ' + (p.lastName || '—')}</span></div>
      <div class="review-item"><span class="label">Email</span><span class="value">${p.email || '—'}</span></div>
      <div class="review-item"><span class="label">Phone</span><span class="value">${p.phone || '—'}</span></div>
      <div class="review-item"><span class="label">Date of Birth</span><span class="value">${p.dob || '—'}</span></div>
      <div class="review-item"><span class="label">SSN (Last 4)</span><span class="value">${p.ssn ? '•••-••-' + p.ssn : '—'}</span></div>
      <div class="review-item"><span class="label">Street Address</span><span class="value">${p.address || '—'}</span></div>
      <div class="review-item"><span class="label">401(k) Provider</span><span class="value">${k.provider || '—'}</span></div>
      <div class="review-item"><span class="label">Account Balance</span><span class="value">${k.balance ? '$' + Number(k.balance).toLocaleString() : '—'}</span></div>
      <div class="review-item"><span class="label">Business Name</span><span class="value">${b.businessName || '—'}</span></div>
      <div class="review-item"><span class="label">Business Type</span><span class="value">${b.businessType || '—'}</span></div>
      <div class="review-item"><span class="label">Grant Amount</span><span class="value">${b.grantAmount ? '$' + Number(b.grantAmount).toLocaleString() : '—'}</span></div>
      <div class="review-item"><span class="label">Bank Name</span><span class="value">${ba.bankName || '—'}</span></div>
      <div class="review-item"><span class="label">Account Type</span><span class="value">${ba.accountType || '—'}</span></div>
      <div class="review-item"><span class="label">Routing Number</span><span class="value">${ba.routing ? '••••••' + (ba.routing.slice(-3) || '') : '—'}</span></div>
    `;
  }

  const btnPrev = formCard.querySelector('.btn-prev');
  const btnNext = formCard.querySelector('.btn-next-step');

  if (btnPrev) {
    btnPrev.addEventListener('click', function () {
      if (currentStep > 1) {
        collectStepData(currentStep);
        currentStep--;
        showStep(currentStep);
      }
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', function () {
      collectStepData(currentStep);

      if (currentStep === totalSteps) {
        btnNext.textContent = 'Submitting...';
        btnNext.disabled = true;
        setTimeout(function () {
          const successEl = document.querySelector('.application-success');
          if (successEl) {
            formCard.style.display = 'none';
            successEl.style.display = 'block';
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }, 2000);
        return;
      }

      if (currentStep === totalSteps - 1) {
        populateReview();
      }

      currentStep++;
      showStep(currentStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  const uploadArea = formCard.querySelector('.upload-area');
  const fileListEl = formCard.querySelector('.file-list');
  const fileInput = formCard.querySelector('#fileInput');
  const uploadedFiles = [];

  if (uploadArea && fileInput) {
    uploadArea.addEventListener('click', function () {
      fileInput.click();
    });

    fileInput.addEventListener('change', function (e) {
      handleFiles(e.target.files);
    });

    uploadArea.addEventListener('dragover', function (e) {
      e.preventDefault();
      uploadArea.style.borderColor = '#d4af37';
      uploadArea.style.background = 'rgba(212, 175, 55, 0.05)';
    });

    uploadArea.addEventListener('dragleave', function () {
      uploadArea.style.borderColor = '';
      uploadArea.style.background = '';
    });

    uploadArea.addEventListener('drop', function (e) {
      e.preventDefault();
      uploadArea.style.borderColor = '';
      uploadArea.style.background = '';
      handleFiles(e.dataTransfer.files);
    });
  }

  function handleFiles(files) {
    Array.from(files).forEach(function (file) {
      uploadedFiles.push(file);
      renderFileList();
    });
  }

  function renderFileList() {
    if (!fileListEl) return;
    fileListEl.innerHTML = uploadedFiles.map(function (file, i) {
      const sizeKB = (file.size / 1024).toFixed(1);
      const size = sizeKB > 1024 ? (sizeKB / 1024).toFixed(1) + ' MB' : sizeKB + ' KB';
      return `
        <div class="file-item">
          <div class="file-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div class="file-info">
            <div class="name">${file.name}</div>
            <div class="size">${size}</div>
          </div>
          <button class="file-remove" data-i="${i}">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      `;
    }).join('');

    fileListEl.querySelectorAll('.file-remove').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.i);
        uploadedFiles.splice(idx, 1);
        renderFileList();
      });
    });
  }

  showStep(1);
}

function initDashboardSidebar() {
  const toggleBtn = document.querySelector('.dash-sidebar-toggle');
  const sidebar = document.querySelector('.dashboard-sidebar');

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', function () {
      sidebar.classList.toggle('open');
    });
  }
}
