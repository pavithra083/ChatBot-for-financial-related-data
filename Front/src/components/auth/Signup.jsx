import React, { useState, useEffect } from 'react';
import './Auth.css';

const Signup = ({ onSignup, onSwitchToLogin }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  
  useEffect(() => {
    setName('');
    setEmail('');
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

  const handleSignup = (e) => {
    e.preventDefault();
    
    if (!name || !email || !password || !confirmPassword) {
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

    const users = JSON.parse(localStorage.getItem('users')) || [];
    
    if (users.find(u => u.email === email)) {
      showMessage('Email already exists', 'error');
      return;
    }

    const newUser = {
      id: Date.now(),
      name,
      email,
      password,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));

    showMessage('Account created successfully!', 'success');
    
    // Clear form after successful signup
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');

    setTimeout(() => {
      onSignup(newUser);
    }, 2000);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>Create Account</h2>
          <p>Sign up for a new account</p>
        </div>

        {message && (
          <div className={`auth-message ${messageType}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSignup} className="auth-form">
          <div className="input-group">
            <label htmlFor="signup-name">Full Name</label>
            <input
              type="text"
              id="signup-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              required
              autoComplete="off"
            />
          </div>
          <div className="input-group">
            <label htmlFor="signup-email">Email Address</label>
            <input
              type="email"
              id="signup-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              autoComplete="off"
            />
          </div>
          <div className="input-group">
            <label htmlFor="signup-password">Password</label>
            <input
              type="password"
              id="signup-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              required
              autoComplete="off"
            />
          </div>
          <div className="input-group">
            <label htmlFor="signup-confirm-password">Confirm Password</label>
            <input
              type="password"
              id="signup-confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
              autoComplete="off"
            />
          </div>
          <button type="submit" className="btn-auth">
            Create Account
          </button>
        </form>

        <div className="auth-links">
          <span>Already have an account? </span>
          <a onClick={onSwitchToLogin} className="auth-link">
            Login
          </a>
        </div>
      </div>
    </div>
  );
};

export default Signup;