document.addEventListener('DOMContentLoaded', function() {
    // Sentiment tracking variables
    let agreeCount = 0;
    let disagreeCount = 0;
    let hasVoted = false;
    
    // DOM elements
    const agreeBtn = document.getElementById('agree-btn');
    const disagreeBtn = document.getElementById('disagree-btn');
    const agreeBar = document.getElementById('agree-bar');
    const disagreeBar = document.getElementById('disagree-bar');
    const agreeCountEl = document.getElementById('agree-count');
    const disagreeCountEl = document.getElementById('disagree-count');
    const waitlistForm = document.getElementById('waitlist-form');
    const formMessage = document.getElementById('form-message');
    
    // Load sentiment data from server
    fetchSentimentData();
    
    // Event listeners
    agreeBtn.addEventListener('click', function() {
        if (!hasVoted) {
            recordSentiment('agree');
            hasVoted = true;
        }
    });
    
    disagreeBtn.addEventListener('click', function() {
        if (!hasVoted) {
            recordSentiment('disagree');
            hasVoted = true;
        }
    });
    
    waitlistForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const email = document.getElementById('email').value;
        submitEmail(email);
    });
    
    // Functions
    function fetchSentimentData() {
        fetch('/api/sentiment')
            .then(response => response.json())
            .then(data => {
                agreeCount = data.agree || 0;
                disagreeCount = data.disagree || 0;
                updateSentimentUI();
            })
            .catch(error => {
                console.error('Error fetching sentiment data:', error);
                // Use default values if fetch fails
                updateSentimentUI();
            });
    }
    
    function recordSentiment(type) {
        if (type === 'agree') {
            agreeCount++;
        } else {
            disagreeCount++;
        }
        
        // Update UI immediately for better UX
        updateSentimentUI();
        
        // Send to server
        fetch('/api/sentiment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ type }),
        })
        .catch(error => {
            console.error('Error recording sentiment:', error);
        });
    }
    
    function updateSentimentUI() {
        const total = agreeCount + disagreeCount;
        
        if (total > 0) {
            const agreePercentage = (agreeCount / total) * 100;
            const disagreePercentage = (disagreeCount / total) * 100;
            
            agreeBar.style.width = `${agreePercentage}%`;
            disagreeBar.style.width = `${disagreePercentage}%`;
        } else {
            // Default 50/50 if no votes
            agreeBar.style.width = '50%';
            disagreeBar.style.width = '50%';
        }
        
        agreeCountEl.textContent = agreeCount;
        disagreeCountEl.textContent = disagreeCount;
    }
    
    function submitEmail(email) {
        fetch('/api/subscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                formMessage.innerHTML = '<p class="success-message">Thank you for joining our waitlist!</p>';
                waitlistForm.reset();
            } else {
                formMessage.innerHTML = `<p class="error-message">${data.message || 'Something went wrong. Please try again.'}</p>`;
            }
        })
        .catch(error => {
            console.error('Error submitting email:', error);
            formMessage.innerHTML = '<p class="error-message">Something went wrong. Please try again.</p>';
        });
    }
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });
});
