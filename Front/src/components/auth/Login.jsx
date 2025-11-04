import React, { useState, useEffect } from 'react';
import './Auth.css';

const Login = ({ onLogin, onSwitchToSignup, onSwitchToForgotPassword }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

 
  useEffect(() => {
    setEmail('');
    setPassword('');
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

  const handleLogin = (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      showMessage('Please fill in all fields', 'error');
      return;
    }

    const users = JSON.parse(localStorage.getItem('users')) || [];
    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
      showMessage('Login successful!', 'success');
      // Clear form immediately
      setEmail('');
      setPassword('');
      setTimeout(() => {
        onLogin(user);
      }, 1000);
    } else {
      showMessage('Invalid email or password', 'error');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>Welcome Back</h2>
          <p>Login to your account</p>
        </div>
        
        {message && (
          <div className={`auth-message ${messageType}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleLogin} className="auth-form">
          <div className="input-group">
            <label htmlFor="login-email">Email Address</label>
            <input
              type="email"
              id="login-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              autoComplete="off"
            />
          </div>
          <div className="input-group">
            <label htmlFor="login-password">Password</label>
            <input
              type="password"
              id="login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoComplete="off"
            />
          </div>
          <button type="submit" className="btn-auth">
            Login
          </button>
        </form>
        
        <div className="auth-links">
          <a onClick={onSwitchToForgotPassword} className="auth-link">
            Forgot your password?
          </a>
          <div style={{ marginTop: '20px' }}>
            <span>Don't have an account? </span>
            <a onClick={onSwitchToSignup} className="auth-link">
              Sign up
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;