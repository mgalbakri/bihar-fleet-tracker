// BIHAR SENTINEL -- Client-side authentication handler
(function() {
  'use strict';

  const form = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const errorEl = document.getElementById('errorMessage');
  const submitBtn = document.getElementById('submitBtn');
  const toggleBtn = document.getElementById('togglePassword');

  // Toggle password visibility
  toggleBtn.addEventListener('click', function() {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    this.querySelector('.eye-icon').style.opacity = isPassword ? '1' : '0.5';
  });

  // Show error with shake animation
  function showError(message) {
    errorEl.textContent = message;
    errorEl.classList.remove('visible');
    // Force reflow to restart animation
    void errorEl.offsetWidth;
    errorEl.classList.add('visible');
  }

  function hideError() {
    errorEl.classList.remove('visible');
  }

  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.querySelector('.btn-text').style.display = loading ? 'none' : '';
    submitBtn.querySelector('.btn-spinner').style.display = loading ? 'inline-block' : 'none';
  }

  // Handle login form submit
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    hideError();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showError('Please enter email and password');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        showError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      // Store token for API calls (cookie is set automatically by server)
      sessionStorage.setItem('sentinel_access_token', data.accessToken);
      sessionStorage.setItem('sentinel_refresh_token', data.refreshToken);
      sessionStorage.setItem('sentinel_user', JSON.stringify(data.user));

      // Redirect to main app
      window.location.href = '/app.html';

    } catch (err) {
      showError('Connection error. Please try again.');
      setLoading(false);
    }
  });

  // Focus email input on load
  emailInput.focus();
})();
