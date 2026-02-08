import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

interface UserInfo {
  studentInfo: string;
  email: string;
  role?: string;
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
  submittedAt: string; // Date -> string 변경
}

interface AdminReservationManagementProps {
  loggedInUserInfo: UserInfo | null;
}

const AdminReservationManagement: React.FC<AdminReservationManagementProps> = ({ loggedInUserInfo }) => {
  const [pendingReservations, setPendingReservations] = useState<ReservationData[]>([]);
  const [selectedReservation, setSelectedReservation] = useState<ReservationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReservations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('status', 'pending')
      .order('submittedAt', { ascending: false });

    if (error) {
      console.error('불러오기 실패:', error);
      setError('예약 목록을 불러오지 못했습니다.');
    } else {
      setPendingReservations(data as ReservationData[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReservations();
  }, []);

  const handleReservationClick = (reservation: ReservationData) => {
    setSelectedReservation(prev => (prev?.id === reservation.id ? null : reservation));
  };

  const handleApproveReservation = async (reservationId: string) => {
    if (!window.confirm('이 예약을 승인하시겠습니까?')) return;
    
    const { error } = await supabase
      .from('reservations')
      .update({ status: 'approved' })
      .eq('id', reservationId);

    if (error) {
      alert('승인 중 오류가 발생했습니다.');
      console.error(error);
    } else {
      alert('예약이 승인되었습니다.');
      setSelectedReservation(null);
      fetchReservations();
    }
  };

  const formatDateTimeForDisplay = (useDate: string, startTime: string, endTime: string) => {
    const date = new Date(useDate);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];

    return (
      <>
        {month}/{day}({dayOfWeek})<br />
        {startTime}~{endTime}
      </>
    );
  };

  if (loading) return <div>로딩 중...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="admin-reservation-management">
      <h2 className="admin-section-title">예약 일정 관리</h2>
      <div className="reservation-list-container">
        {pendingReservations.length === 0 ? (
          <p className="no-pending-reservations">승인 대기 중인 예약이 없습니다.</p>
        ) : (
          <ul className="pending-reservation-list">
            {pendingReservations.map((reservation) => (
              <li
                key={reservation.id}
                className={`pending-reservation-item ${selectedReservation?.id === reservation.id ? 'selected' : ''}`}
                onClick={() => handleReservationClick(reservation)}
              >
                <span className={`campus-label ${reservation.campus === '인캠' ? 'incheon' : 'gyeong'}`}>
                  {reservation.campus}
                </span>
                <span className="reservation-time-display">
                  {formatDateTimeForDisplay(reservation.useDate, reservation.startTime, reservation.endTime)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedReservation && (
        <div className="reservation-detail-card">
          <h3>예약 상세 정보</h3>
          <p><strong>팀명:</strong> {selectedReservation.teamName}</p>
          <p><strong>사유:</strong> {selectedReservation.reason}</p>
          <p><strong>신청자:</strong> {selectedReservation.applicant}</p>
          <p><strong>연락처:</strong> {selectedReservation.phoneNumber}</p>
          <div className="detail-actions">
            <button className="approve-btn" onClick={() => handleApproveReservation(selectedReservation.id)}>
              예약 승인
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReservationManagement;