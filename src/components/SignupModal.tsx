import React, { useState } from 'react';
import '../styles/Modal.css';
import { supabase } from '../supabaseClient';

interface SignupModalProps {
  onClose: () => void;
  onSignupSubmit: (studentInfo: string, email: string, password: string) => Promise<void>;
  onShowLogin: () => void;
}

const SignupModal: React.FC<SignupModalProps> = ({ onClose, onSignupSubmit, onShowLogin }) => {
  const [studentInfo, setStudentInfo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  const validateStudentInfo = (info: string): boolean => {
    const regex = /^\d{2}\s.+$/;
    return regex.test(info);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== passwordConfirm) {
      alert('비밀번호가 일치하지 않습니다.\n다시 확인해주세요.');
      return;
    }

    if (!validateStudentInfo(studentInfo)) {
      alert('학번(숫자2자리) 띄어쓰기 이름 형식으로 입력해주세요.\n예: 23 홍길동');
      return;
    }
    
    // [추가] 회원가입 시도 시 알림 권한 요청
    if ("Notification" in window && Notification.permission !== "granted") {
      await Notification.requestPermission();
    }

    // 1. 회원가입 시도
    const { data, error } = await supabase.auth.signUp({ email, password });

    // 2. 이미 가입된 이메일인 경우 (추방된 유저 등)
    if (error?.message === "User already registered") {
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();
      
      // 추방된 유저인 경우 -> 재가입 로직 실행
      if (existingUser && existingUser.banned_at) {
        if (window.confirm('추방된 이력이 있는 계정입니다.\n재가입(복구) 신청을 하시겠습니까?\n\n* 승인 대기 상태로 전환되며 관리자 승인이 필요합니다.')) {
          
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password
          });

          if (signInError) {
            alert('재가입 신청 실패: 비밀번호가 일치하지 않습니다.\n본인 확인을 위해 올바른 비밀번호를 입력해주세요.');
            return;
          }

          const { error: rpcError } = await supabase.rpc('reapply_banned_user');

          if (rpcError) {
            console.error(rpcError);
            alert('오류가 발생했습니다: ' + rpcError.message);
          } else {
            alert('재가입 신청이 완료되었습니다.\n관리자의 승인을 기다려 주세요.');
            await supabase.auth.signOut();
            onShowLogin();
          }
        }
        return;
      } else {
        alert('이미 가입된 이메일입니다. 로그인해주세요.');
        onShowLogin();
        return;
      }
    }

    if (error) {
      alert('회원가입 실패: ' + error.message);
      return;
    }

    // 3. 신규 가입 성공 시 프로필 저장
    if (data.user) {
      const { error: dbError } = await supabase
        .from('users')
        .insert([{ 
          id: data.user.id, 
          email: email, 
          studentInfo: studentInfo, 
          role: 'pending' // 승인 대기
        }]);

      if (dbError) {
        console.error("Profile save error:", dbError);
        alert('회원가입은 되었으나 프로필 저장에 실패했습니다.');
      } else {
        alert('회원가입 신청이 완료되었습니다.\n관리자의 승인을 기다려 주세요.');
        await supabase.auth.signOut();
        onShowLogin();
      }
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="modal-close-x-btn" onClick={onClose}>×</button>
        <h2>회원가입</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="studentInfo">학번 이름 (예: 23 홍길동)</label>
            <input type="text" id="studentInfo" value={studentInfo} onChange={(e) => setStudentInfo(e.target.value)} placeholder="23 홍길동" required />
          </div>
          <div className="form-group">
            <label htmlFor="signup-email">이메일</label>
            <input type="email" id="signup-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일을 입력하세요" required />
          </div>
          <div className="form-group">
            <label htmlFor="signup-password">비밀번호</label>
            <input type="password" id="signup-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호를 입력하세요" required />
          </div>
          <div className="form-group">
            <label htmlFor="signup-password-confirm">비밀번호 확인</label>
            <input 
              type="password" 
              id="signup-password-confirm" 
              value={passwordConfirm} 
              onChange={(e) => setPasswordConfirm(e.target.value)} 
              placeholder="비밀번호를 다시 입력하세요" 
              required 
            />
          </div>
          <button type="submit" className="modal-signup-btn">가입하기</button>
        </form>
        <div className="modal-footer">
          <p>
            이미 계정이 있으신가요? <button type="button" className="login-link-btn" onClick={onShowLogin}>로그인</button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignupModal;