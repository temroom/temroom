import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import '../styles/MyReservationsPage.css';
import '../App.css';

interface UserInfo {
  studentInfo: string;
  email: string;
  uid?: string;
}

interface ReservationData {
  id: string;
  teamName: string;
  useDate: string;
  startTime: string;
  endTime: string;
  reason: string;
  applicant: string;
  phoneNumber: string;
  campus: '인캠' | '경캠';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  userId: string;
  submittedAt: string;
}

interface MyReservationsPageProps {
  onClose: () => void;
  loggedInUserInfo: UserInfo | null;
  onLogout: () => void; // App.tsx에서 전달받은 로그아웃 함수
}

const MyReservationsPage: React.FC<MyReservationsPageProps> = ({ onClose, loggedInUserInfo, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'reservations' | 'profile'>('reservations');
  
  // 내 예약 관련 State
  const [userReservations, setUserReservations] = useState<ReservationData[]>([]);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 회원 정보 관련 State
  const [isChangingPw, setIsChangingPw] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); // [추가] 비밀번호 확인용 State
  
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawPassword, setWithdrawPassword] = useState('');

  // 1. 초기 데이터 로딩 (예약 목록)
  useEffect(() => {
    if (!loggedInUserInfo || !loggedInUserInfo.uid) {
      setError('로그인 정보가 없습니다.');
      setLoading(false);
      return;
    }

    const fetchReservations = async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('userId', loggedInUserInfo.uid)
        .order('submittedAt', { ascending: false });

      if (error) {
        console.error('Error fetching user reservations:', error);
        setError('예약 내역을 불러오는 중 오류가 발생했습니다.');
      } else {
        setUserReservations(data as ReservationData[]);
      }
      setLoading(false);
    };

    fetchReservations();
  }, [loggedInUserInfo]);

  // 2. 예약 취소 핸들러
  const handleCancelReservation = async (reservationId: string) => {
    if (!window.confirm('정말로 이 예약을 취소하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', reservationId);

      if (error) throw error;

      alert('예약이 취소되었습니다.');
      setUserReservations(prev => prev.filter(res => res.id !== reservationId));
      setSelectedReservationId(null);
    } catch (error) {
      console.error('Error canceling reservation:', error);
      alert('예약 취소 중 오류가 발생했습니다.');
    }
  };

  // 3. 비밀번호 변경 핸들러
  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert('비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    
    // [추가] 비밀번호 일치 확인 로직
    if (newPassword !== confirmPassword) {
      alert('비밀번호가 일치하지 않습니다.\n다시 확인해주세요.');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      alert('비밀번호 변경 실패: ' + error.message);
    } else {
      alert('비밀번호가 성공적으로 변경되었습니다.');
      setIsChangingPw(false);
      setNewPassword('');
      setConfirmPassword(''); // 초기화
    }
  };

  // 4. 회원 탈퇴 핸들러 (RPC 사용)
  const handleWithdraw = async () => {
    if (!withdrawPassword) {
      alert('비밀번호를 입력해주세요.');
      return;
    }
    if (!window.confirm('정말로 탈퇴하시겠습니까? 모든 예약 정보와 계정이 영구 삭제됩니다.')) return;

    // 1) 비밀번호 확인 (로그인 재시도) - 본인 확인 절차
    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: loggedInUserInfo!.email,
      password: withdrawPassword
    });

    if (loginError || !data.user) {
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }

    try {
      // 2) 서버 함수(RPC) 호출하여 계정 완전 삭제
      const { error: rpcError } = await supabase.rpc('delete_own_account');

      if (rpcError) throw rpcError;

      // 3) 성공 시 처리
      alert('회원 탈퇴가 완료되었습니다.\n이용해 주셔서 감사합니다.');
      onLogout(); // 로그아웃 처리 및 메인으로 이동
    } catch (err: any) {
      console.error(err);
      alert('탈퇴 처리 중 오류가 발생했습니다: ' + err.message);
    }
  };

  // 날짜 포맷팅
  const formatDateTime = (dateStr: string, start: string, end: string) => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    return `${month}/${day}(${dayOfWeek}) ${start}~${end}`;
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '승인 대기';
      case 'approved': return '승인됨';
      case 'rejected': return '거절됨';
      case 'cancelled': return '취소됨';
      default: return status;
    }
  };

  return (
    <div className="my-reservations-page-container">
      <div className="my-reservations-page">
        <button className="page-close-btn" onClick={onClose}>×</button>
        <h2>마이페이지</h2>

        {/* 탭 네비게이션 */}
        <div className="mypage-tabs">
          <button 
            className={`mypage-tab ${activeTab === 'reservations' ? 'active' : ''}`}
            onClick={() => setActiveTab('reservations')}
          >
            내 예약
          </button>
          <button 
            className={`mypage-tab ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            회원 정보
          </button>
        </div>

        {/* 1. 내 예약 탭 컨텐츠 */}
        {activeTab === 'reservations' && (
          <div className="tab-content">
            {loading ? (
              <p>불러오는 중...</p>
            ) : error ? (
              <p className="error-message">{error}</p>
            ) : userReservations.length === 0 ? (
              <p className="no-reservations">예약된 내역이 없습니다.</p>
            ) : (
              <ul className="reservation-list">
                {userReservations.map((reservation) => (
                  <li key={reservation.id} className="reservation-item">
                    <div 
                      className="reservation-summary" 
                      onClick={() => setSelectedReservationId(prev => prev === reservation.id ? null : reservation.id)}
                    >
                      <span className={`campus-indicator ${reservation.campus === '인캠' ? 'incheon' : 'gyeong'}`}>
                        <span className="full-text">{reservation.campus}</span>
                      </span>
                      <span className="reservation-datetime">
                        {formatDateTime(reservation.useDate, reservation.startTime, reservation.endTime)}
                      </span>
                      <span className={`reservation-status ${reservation.status}`}>
                        {getStatusText(reservation.status)}
                      </span>
                    </div>
                    {selectedReservationId === reservation.id && (
                      <div className="reservation-actions">
                        <button
                          className="action-button cancel-button"
                          onClick={() => handleCancelReservation(reservation.id)}
                        >
                          예약 취소
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* 2. 회원 정보 탭 컨텐츠 */}
        {activeTab === 'profile' && (
          <div className="tab-content profile-content">
            <div className="profile-info-card">
              <label>이메일</label>
              <p className="profile-email">{loggedInUserInfo?.email}</p>
            </div>

            <div className="profile-actions">
              {/* 로그아웃 */}
              <button className="profile-btn logout-btn" onClick={() => {
                if(window.confirm('로그아웃 하시겠습니까?')) onLogout();
              }}>
                로그아웃
              </button>

              {/* 비밀번호 변경 */}
              <div className="action-section">
                {!isChangingPw ? (
                  <button className="profile-btn change-pw-btn" onClick={() => setIsChangingPw(true)}>
                    비밀번호 변경
                  </button>
                ) : (
                  <div className="inline-form">
                    <input 
                      type="password" 
                      placeholder="새 비밀번호 (6자 이상)" 
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    {/* [추가] 비밀번호 확인 입력창 */}
                    <input 
                      type="password" 
                      placeholder="새 비밀번호 확인" 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <div className="inline-buttons">
                      <button className="confirm-btn" onClick={handleChangePassword}>변경</button>
                      <button className="cancel-btn" onClick={() => { 
                        setIsChangingPw(false); 
                        setNewPassword(''); 
                        setConfirmPassword(''); // 취소 시 초기화
                      }}>취소</button>
                    </div>
                  </div>
                )}
              </div>

              {/* 회원 탈퇴 */}
              <div className="action-section">
                {!isWithdrawing ? (
                  <button className="profile-btn withdraw-btn" onClick={() => setIsWithdrawing(true)}>
                    회원 탈퇴
                  </button>
                ) : (
                  <div className="inline-form">
                    <p className="warning-text">탈퇴를 위해 비밀번호를 입력해주세요.</p>
                    <input 
                      type="password" 
                      placeholder="비밀번호 입력" 
                      value={withdrawPassword}
                      onChange={(e) => setWithdrawPassword(e.target.value)}
                    />
                    <div className="inline-buttons">
                      <button className="confirm-btn danger" onClick={handleWithdraw}>탈퇴 확인</button>
                      <button className="cancel-btn" onClick={() => { setIsWithdrawing(false); setWithdrawPassword(''); }}>취소</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyReservationsPage;