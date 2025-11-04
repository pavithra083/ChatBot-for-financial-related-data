import React, { useState, useEffect } from 'react';
import './Auth.css';

const ForgotPassword = ({ onSwitchToLogin, onSwitchToReset }) => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  // Clear fields when component mounts
  useEffect(() => {
    setEmail('');
    setMessage('');
    setMessageType('');
  }, []);

  const showMessage = (msg, type) => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 5000);
  };

  const handleForgotPassword = (e) => {
    e.preventDefault();
    
    if (!email) {
      showMessage('Please enter your email address', 'error');
      return;
    }

    const users = JSON.parse(localStorage.getItem('users')) || [];
    const user = users.find(u => u.email === email);

    if (user) {
      localStorage.setItem('resetEmail', email);
      showMessage('Password reset link sent to your email', 'success');
      setEmail('');
      setTimeout(() => {
        onSwitchToReset();
      }, 2000);
    } else {
      showMessage('Email not found', 'error');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>Reset Password</h2>
          <p>Enter your email to reset your password</p>
        </div>

        {message && (
          <div className={`auth-message ${messageType}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleForgotPassword} className="auth-form">
          <div className="input-group">
            <label htmlFor="forgot-email">Email Address</label>
            <input
              type="email"
              id="forgot-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              autoComplete="off"
            />
          </div>
          <button type="submit" className="btn-auth">
            Send Reset Link
          </button>
        </form>

        <div className="auth-links">
          <a onClick={onSwitchToLogin} className="auth-link">
            Back to Login
          </a>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;