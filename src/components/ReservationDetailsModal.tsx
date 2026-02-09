import React from 'react';
import '../styles/ReservationDetailsModal.css';

interface ReservationData {
  id?: string;
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

interface UnavailableScheduleData {
  id?: string;
  reason: string;
  campus: '인캠' | '경캠' | '';
  startDate: string;
  endDate: string;
  frequencyType: 'once' | 'weekly' | 'monthly_by_week_day' | '';
  dayOfWeek?: number;
  weekOfMonth?: number;
  startTime: string;
  endTime: string;
  createdAt?: string;
}

interface ReservationDetailsModalProps {
  data: ReservationData | UnavailableScheduleData | null;
  dataType: 'reservation' | 'unavailable' | null;
  onClose: () => void;
}

const ReservationDetailsModal: React.FC<ReservationDetailsModalProps> = ({ data, dataType, onClose }) => {
  if (!data) return null;

  const isReservation = dataType === 'reservation';
  const isUnavailable = dataType === 'unavailable';

  // 요일 텍스트 변환 (이제 아래에서 사용하므로 에러가 사라집니다)
  const formatFrequency = (schedule: UnavailableScheduleData) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    if (schedule.frequencyType === 'once') return '1회성';
    if (schedule.frequencyType === 'weekly') return `매주 ${days[schedule.dayOfWeek || 0]}요일`;
    if (schedule.frequencyType === 'monthly_by_week_day') return `매월 ${schedule.weekOfMonth}번째 ${days[schedule.dayOfWeek || 0]}요일`;
    return '반복 일정';
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        {isReservation && (
          <>
            <h2>예약 상세 정보</h2>
            <p><strong>팀명:</strong> {(data as ReservationData).teamName}</p>
            <p><strong>일시:</strong> {(data as ReservationData).useDate} {(data as ReservationData).startTime}~{(data as ReservationData).endTime}</p>
            <p><strong>사유:</strong> {(data as ReservationData).reason}</p>
            <p><strong>신청자:</strong> {(data as ReservationData).applicant}</p>
            <div className="modal-actions">
              <button className="confirm-btn" onClick={onClose}>확인</button>
            </div>
          </>
        )}

        {isUnavailable && (
          <>
            <h2>이용 불가 상세 정보</h2>
            {/* [수정됨] 여기서 formatFrequency 함수를 사용했습니다. */}
            <p><strong>일정 구분:</strong> {formatFrequency(data as UnavailableScheduleData)}</p>
            <p><strong>시간:</strong> {(data as UnavailableScheduleData).startTime} ~ {(data as UnavailableScheduleData).endTime}</p>
            <p><strong>사유:</strong> {(data as UnavailableScheduleData).reason}</p>
            <div className="modal-actions">
              <button className="confirm-btn" onClick={onClose}>확인</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ReservationDetailsModal;