import React, { useState, useEffect } from 'react';
import '../styles/MyReservationsPage.css'; // 스타일 파일 필요 시 유지
import { supabase } from '../supabaseClient';
import { UserInfo } from '../App';

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
  onLogout: () => void;
}

const MyReservationsPage: React.FC<MyReservationsPageProps> = ({ onClose, loggedInUserInfo, onLogout }) => {
  const [myReservations, setMyReservations] = useState<ReservationData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (loggedInUserInfo?.uid) {
      fetchMyReservations(loggedInUserInfo.uid);
    }
  }, [loggedInUserInfo]);

  const fetchMyReservations = async (userId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('userId', userId)
      .order('submittedAt', { ascending: false });

    if (error) {
      console.error('Error fetching reservations:', error);
    } else {
      setMyReservations(data as ReservationData[]);
    }
    setLoading(false);
  };

  const handleCancelReservation = async (reservationId: string) => {
    if (!window.confirm('정말로 예약을 취소하시겠습니까?')) return;

    const { error } = await supabase
      .from('reservations')
      .update({ status: 'cancelled' })
      .eq('id', reservationId);

    if (error) {
      alert('취소 실패: ' + error.message);
    } else {
      alert('예약이 취소되었습니다.');
      if (loggedInUserInfo?.uid) fetchMyReservations(loggedInUserInfo.uid);
    }
  };

  // [수정된 회원 탈퇴 함수]
  const handleWithdrawal = async () => {
    if (!window.confirm('정말로 탈퇴하시겠습니까?\n모든 예약 내역과 회원 정보가 영구적으로 삭제됩니다.')) return;

    // 1. RPC 함수 호출 (서버에서 계정 삭제 수행)
    const { error } = await supabase.rpc('delete_own_account');

    if (error) {
      console.error(error);
      alert('탈퇴 처리 중 오류가 발생했습니다: ' + error.message);
    } else {
      alert('회원 탈퇴가 완료되었습니다.\n이용해 주셔서 감사합니다.');
      // 2. 로그아웃 처리 및 메인으로 이동
      onLogout(); 
    }
  };

  if (!loggedInUserInfo) {
    return <div className="my-page-container">로그인이 필요합니다.</div>;
  }

  return (
    <div className="my-page-container">
      <div className="my-page-header">
        <h2>마이페이지</h2>
        <button className="close-btn" onClick={onClose}>닫기</button>
      </div>

      <div className="user-info-section">
        <p><strong>이름/학번:</strong> {loggedInUserInfo.studentInfo}</p>
        <p><strong>이메일:</strong> {loggedInUserInfo.email}</p>
        <div className="user-actions">
          <button className="logout-btn" onClick={onLogout}>로그아웃</button>
          <button className="withdrawal-btn" onClick={handleWithdrawal}>회원 탈퇴</button>
        </div>
      </div>

      <div className="reservations-section">
        <h3>내 예약 내역</h3>
        {loading ? (
          <p>로딩 중...</p>
        ) : myReservations.length === 0 ? (
          <p className="no-data">예약 내역이 없습니다.</p>
        ) : (
          <ul className="my-reservation-list">
            {myReservations.map((res) => (
              <li key={res.id} className={`my-res-item ${res.status}`}>
                <div className="res-header">
                  <span className={`campus-badge ${res.campus === '인캠' ? 'incheon' : 'gyeong'}`}>{res.campus}</span>
                  <span className="res-date">{res.useDate} {res.startTime}~{res.endTime}</span>
                  <span className={`status-text ${res.status}`}>
                    {res.status === 'pending' && '승인 대기'}
                    {res.status === 'approved' && '승인됨'}
                    {res.status === 'rejected' && '거절됨'}
                    {res.status === 'cancelled' && '취소됨'}
                  </span>
                </div>
                <div className="res-body">
                  <p><strong>팀명:</strong> {res.teamName}</p>
                  <p><strong>사유:</strong> {res.reason}</p>
                </div>
                {res.status === 'pending' && (
                  <button className="cancel-res-btn" onClick={() => handleCancelReservation(res.id)}>예약 취소</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default MyReservationsPage;