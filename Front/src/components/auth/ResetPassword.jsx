import React, { useState, useEffect } from 'react';
import './Auth.css';

const ResetPassword = ({ onSwitchToLogin }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

 
  useEffect(() => {
    setPassword('');
    setConfirmPassword('');
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

  const handleResetPassword = (e) => {
    e.preventDefault();
    
    if (!password || !confirmPassword) {
      showMessage('Please fill in all fields', 'error');
      return;
    }

    if (password !== confirmPassword) {
      showMessage('Passwords do not match', 'error');
      return;
    }

    if (password.length < 6) {
      showMessage('Password must be at least 6 characters', 'error');
      return;
    }

    const email = localStorage.getItem('resetEmail');
    if (!email) {
      showMessage('Email not found. Please try again.', 'error');
      return;
    }

    const users = JSON.parse(localStorage.getItem('users')) || [];
    const userIndex = users.findIndex(u => u.email === email);

    if (userIndex !== -1) {
      users[userIndex].password = password;
      localStorage.setItem('users', JSON.stringify(users));
      localStorage.removeItem('resetEmail');

      showMessage('Password reset successfully!', 'success');
      
      setPassword('');
      setConfirmPassword('');
      
      setTimeout(() => {
        onSwitchToLogin();
      }, 2000);
    } else {
      showMessage('User not found', 'error');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>Set New Password</h2>
          <p>Create your new password</p>
        </div>

        {message && (
          <div className={`auth-message ${messageType}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleResetPassword} className="auth-form">
          <div className="input-group">
            <label htmlFor="reset-password">New Password</label>
            <input
              type="password"
              id="reset-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
              required
              autoComplete="off"
            />
          </div>
          <div className="input-group">
            <label htmlFor="reset-confirm-password">Confirm Password</label>
            <input
              type="password"
              id="reset-confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
              autoComplete="off"
            />
          </div>
          <button type="submit" className="btn-auth">
            Reset Password
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;