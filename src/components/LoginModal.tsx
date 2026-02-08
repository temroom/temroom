// src/components/LoginModal.tsx (전체 덮어쓰기 또는 handleLoginSubmit 수정)

import React, { useState } from 'react';
import '../styles/Modal.css';
import { supabase } from '../supabaseClient';

interface LoginModalProps {
  onClose: () => void;
  onLoginSubmit: (email: string, password: string) => Promise<void>;
  onShowSignup: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ onClose, onLoginSubmit, onShowSignup }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1. 우선 로그인 시도
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      alert('로그인 실패: 이메일이나 비밀번호를 확인해주세요.');
      return;
    }

    if (data.user) {
      // 2. 로그인 성공 후, 추방 여부(banned_at) 확인
      const { data: userData} = await supabase
        .from('users')
        .select('banned_at')
        .eq('id', data.user.id)
        .single();

      if (userData && userData.banned_at) {
        // 추방된 유저라면 즉시 로그아웃 및 경고
        await supabase.auth.signOut();
        alert('관리자로부터 추방되었습니다.\n(추방일로부터 1개월 뒤 계정이 삭제됩니다.)');
        return;
      }

      // 3. 정상 유저라면 로그인 진행
      // 부모 컴포넌트(App.tsx)의 상태 업데이트를 위해 페이지 새로고침 혹은 함수 호출
      window.location.reload(); 
      // 또는 onLoginSubmit을 사용해도 되지만, 이미 signIn이 되었으므로 reload가 깔끔함
      onClose();
    }
  };

  const handleMagicLinkLogin = async () => {
    if (!email) {
      alert('로그인 링크를 받으시려면 이메일 주소를 먼저 입력해 주세요.');
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) alert('링크 발송 실패: ' + error.message);
    else alert('이메일로 로그인 링크가 발송되었습니다.');
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="modal-close-x-btn" onClick={onClose}>×</button>
        <h2>로그인</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">이메일</label>
            <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일을 입력하세요" required />
          </div>
          <div className="form-group">
            <label htmlFor="password">비밀번호</label>
            <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호를 입력하세요" required />
          </div>
          <div className="remember-me-group">
            <input type="checkbox" id="rememberMe" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="remember-me-checkbox" />
            <label htmlFor="rememberMe" className="remember-me-label">자동 로그인</label>
          </div>
          <button type="submit" className="modal-login-btn">로그인</button>
        </form>
        <div className="modal-footer">
          <p className="reset-password-text">
            비밀번호를 잊으셨나요? <button type="button" className="reset-link-btn" onClick={handleMagicLinkLogin}>이메일로 로그인</button>
          </p>
          <p>
            계정이 없으신가요? <button type="button" className="signup-link-btn" onClick={onShowSignup}>회원가입</button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;