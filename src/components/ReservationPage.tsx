import React, { useState, useEffect} from 'react';
import '../styles/ReservationPage.css';
import '../App.css';

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

// [추가] 이용 불가 일정 타입 정의
interface UnavailableScheduleData {
  campus: '인캠' | '경캠' | '';
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  frequencyType: string;
  dayOfWeek?: number;
  weekOfMonth?: number;
}

interface ReservationPageProps {
  onClose: () => void;
  selectedDate: Date;
  initialStartTime?: string;
  initialEndTime?: string;
  loggedInUserInfo: { studentInfo: string; email: string; } | null;
  selectedCampus: '인캠' | '경캠';
  onSubmitReservation: (reservationData: ReservationData) => Promise<void>;
  handleCampusClick: () => void;
  currentDayReservations: ReservationData[];
  // [추가] 중복 확인을 위해 필요한 데이터
  unavailableSchedules: UnavailableScheduleData[];
}

const reasonOptions = ['양육', '팀모임', '기타'];
const hours = Array.from({ length: 16 }, (_, i) => (i + 8).toString().padStart(2, '0'));

const ReservationPage: React.FC<ReservationPageProps> = ({
  onClose,
  selectedDate,
  initialStartTime,
  initialEndTime,
  loggedInUserInfo,
  selectedCampus,
  onSubmitReservation,
  currentDayReservations,
  unavailableSchedules // [추가]
}) => {
  const [teamName, setTeamName] = useState('');
  const [startHour, setStartHour] = useState('09');
  const [startMinute, setStartMinute] = useState('00');
  const [endHour, setEndHour] = useState('10');
  const [endMinute, setEndMinute] = useState('00');
  const [reason, setReason] = useState(reasonOptions[0]);
  const [isReasonOther, setIsReasonOther] = useState(false);
  const [otherReason, setOtherReason] = useState('');
  const [applicant, setApplicant] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  useEffect(() => {
    if (initialStartTime) {
      const [h, m] = initialStartTime.split(':');
      setStartHour(h); setStartMinute(m);
    }
    if (initialEndTime) {
      const [h, m] = initialEndTime.split(':');
      setEndHour(h); setEndMinute(m);
    }
  }, [initialStartTime, initialEndTime]);

  useEffect(() => {
    if (loggedInUserInfo) setApplicant(loggedInUserInfo.studentInfo);
  }, [loggedInUserInfo]);

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    let formattedValue = '';
    if (value.length <= 3) formattedValue = value;
    else if (value.length <= 7) formattedValue = `${value.slice(0, 3)}-${value.slice(3)}`;
    else formattedValue = `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7, 11)}`;
    setPhoneNumber(formattedValue);
  };

  // [추가] 시간 중복 체크 함수
  const checkOverlap = (newStart: number, newEnd: number) => {
    // 1. 기존 예약과 겹치는지 확인 (승인됨, 대기중 인 것만)
    const hasReservationOverlap = currentDayReservations.some(res => {
      if (res.status === 'rejected' || res.status === 'cancelled') return false;
      const rStart = parseInt(res.startTime.replace(':', '')); // 예: 09:30 -> 930
      const rEnd = parseInt(res.endTime.replace(':', ''));
      // 겹침 조건: (기존 시작 < 내 종료) AND (기존 종료 > 내 시작)
      return rStart < newEnd && rEnd > newStart;
    });

    if (hasReservationOverlap) return '이미 예약이 있거나 승인 대기 중인 시간대입니다.';

    // 2. 이용 불가 일정과 겹치는지 확인
    const year = selectedDate.getFullYear();
    const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
    const day = selectedDate.getDate().toString().padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const dayOfWeek = selectedDate.getDay();

    const hasUnavailableOverlap = unavailableSchedules.some(sch => {
      if (sch.campus !== selectedCampus) return false;
      if (dateStr < sch.startDate || dateStr > sch.endDate) return false;

      // 요일/주차 확인 로직
      let matchesDay = false;
      if (sch.frequencyType === 'once') matchesDay = true;
      else if (sch.frequencyType === 'weekly' && sch.dayOfWeek === dayOfWeek) matchesDay = true;
      else if (sch.frequencyType === 'monthly_by_week_day') {
        const firstDayOfMonth = new Date(year, selectedDate.getMonth(), 1);
        const firstDayWeekday = firstDayOfMonth.getDay();
        const firstSunday = firstDayWeekday === 0 ? 1 : 1 + (7 - firstDayWeekday);
        const targetOccurrenceN = Math.floor((selectedDate.getDate() - firstSunday) / 7) + 1;
        if (sch.weekOfMonth === targetOccurrenceN && sch.dayOfWeek === dayOfWeek) matchesDay = true;
      }

      if (!matchesDay) return false;

      const uStart = parseInt(sch.startTime.replace(':', ''));
      const uEnd = parseInt(sch.endTime.replace(':', ''));
      return uStart < newEnd && uEnd > newStart;
    });

    if (hasUnavailableOverlap) return '이용이 불가능한 시간대입니다.';

    return null; // 문제 없음
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // [5. 날짜 유효성 검사 추가]
    const today = new Date();
    // 시간을 00:00:00으로 맞춰서 날짜만 비교
    today.setHours(0, 0, 0, 0);
    
    // 선택된 날짜
    const targetDate = new Date(selectedDate);
    targetDate.setHours(0, 0, 0, 0);

    // 어제 날짜 구하기
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // 선택한 날짜가 어제보다 이전이면 차단 (어제까진 예약 가능? 아니면 오늘부터 가능?)
    // "어제 이전에는 예약을 못하게" -> 어제는 가능? 불가능?
    // 보통은 "오늘 이후(미래)만 예약 가능"이 일반적입니다.
    // 만약 "오늘 포함 미래만 가능"하게 하려면:
    if (targetDate < today) {
       alert('지난 날짜에는 예약할 수 없습니다.');
       return;
    }

    const finalReason = isReasonOther ? otherReason : reason;
    const startTimeStr = `${startHour}:${startMinute}`;
    const endTimeStr = `${endHour}:${endMinute}`;
    
    // 시간 숫자 변환 (비교용)
    const startTimeNum = parseInt(startHour + startMinute);
    const endTimeNum = parseInt(endHour + endMinute);

    if (startTimeNum >= endTimeNum) {
      alert('종료 시간은 시작 시간보다 늦어야 합니다.');
      return;
    }

    // [추가] 중복 검사 실행
    const overlapError = checkOverlap(startTimeNum, endTimeNum);
    if (overlapError) {
      alert(overlapError);
      return;
    }

    const year = selectedDate.getFullYear();
    const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
    const day = selectedDate.getDate().toString().padStart(2, '0');
    const useDate = `${year}-${month}-${day}`;

    const newReservation: ReservationData = {
      teamName: teamName,
      useDate,
      startTime: startTimeStr,
      endTime: endTimeStr,
      reason: finalReason,
      applicant,
      phoneNumber,
      campus: selectedCampus,
      status: 'pending',
      userId: '',
      submittedAt: new Date().toISOString()
    };

    await onSubmitReservation(newReservation);
  };

  return (
    <div className="reservation-page-container">
      <div className="reservation-page">
        <button className="page-close-btn" onClick={onClose}>×</button>
        <h2>예약하기 ({selectedCampus})</h2>
        <div className="reservation-info-header">
           <span>{selectedDate.getFullYear()}년 {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일</span>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>팀명 (소속)</label>
            <input type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="팀명을 입력하세요" required />
          </div>
          <div className="form-group">
             <label>사용 시간</label>
             <div className="time-input-wrapper">
               <div className="time-input-group">
                 <select value={startHour} onChange={e=>setStartHour(e.target.value)}>
                    {hours.map(h => <option key={h} value={h}>{h}시</option>)}
                 </select>
                 <select value={startMinute} onChange={e=>setStartMinute(e.target.value)}>
                    <option value="00">00분</option>
                    <option value="30">30분</option>
                 </select>
               </div>
               <span className="tilde">~</span>
               <div className="time-input-group">
                 <select value={endHour} onChange={e=>setEndHour(e.target.value)}>
                    {hours.map(h => <option key={h} value={h}>{h}시</option>)}
                 </select>
                 <select value={endMinute} onChange={e=>setEndMinute(e.target.value)}>
                    <option value="00">00분</option>
                    <option value="30">30분</option>
                 </select>
               </div>
             </div>
          </div>
          <div className="form-group">
            <label>사용 목적</label>
            <select value={reason} onChange={(e) => { setReason(e.target.value); setIsReasonOther(e.target.value === '기타'); }}>
              {reasonOptions.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            {isReasonOther && <input value={otherReason} onChange={e => setOtherReason(e.target.value)} placeholder="사유 직접 입력" required />}
          </div>
          <div className="form-group">
            <label>신청자 / 연락처</label>
            <div className="applicant-row">
                <input value={applicant} onChange={e => setApplicant(e.target.value)} placeholder="학번 이름" required style={{flex: 1}}/>
                <input type="tel" value={phoneNumber} onChange={handlePhoneNumberChange} placeholder="010-0000-0000" maxLength={13} required style={{flex: 1.2}}/>
            </div>
          </div>
          <button type="submit" className="submit-reservation-btn">예약 신청</button>
        </form>
      </div>
    </div>
  );
};
export default ReservationPage;