import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import LoginModal from './components/LoginModal';
import SignupModal from './components/SignupModal';
import ReservationPage from './components/ReservationPage';
import MyReservationsPage from './components/MyReservationsPage';
import ReservationDetailsModal from './components/ReservationDetailsModal';
import AdminPage from './components/AdminPage';
import NotificationToast from './components/NotificationToast';

import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

// --- 타입 정의 ---
export interface UserInfo {
  studentInfo: string;
  email: string;
  role?: string;
  uid?: string;
}

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

// [헬퍼 함수] 브라우저 시스템 알림 보내기
const sendSystemNotification = (title: string, body: string) => {
  if (!("Notification" in window)) return;

  if (Notification.permission === "granted") {
    new Notification(title, {
      body: body,
      icon: '/favicon.ico',
      vibrate: [200, 100, 200] 
    }as any);
  }
};

const MainContent: React.FC<{
  selectedCampus: '인캠' | '경캠';
  handleCampusClick: () => void;
  isLoggedIn: boolean;
  loggedInUserInfo: UserInfo | null;
  handleLoginButtonClick: () => Promise<void>;
  displayYear: number;
  displayMonth: number;
  selectedDate: Date;
  handleTodayClick: () => void;
  handlePrevMonthClick: () => void;
  handleNextMonthClick: () => void;
  handleDateClick: (date: number) => void;
  handleSlotClick: (status: string, index: number) => void;
  handleOpenReservationPage: (initialStart?: string, initialEnd?: string) => void;
  requireLogin: () => void;
  currentDayReservations: ReservationData[];
  unavailableSchedules: UnavailableScheduleData[];
  navigate: (path: string) => void;
  handleOpenDetailsModal: (item: ReservationData | UnavailableScheduleData, type: 'reservation' | 'unavailable') => void;
  isLoading: boolean;
}> = ({
  selectedCampus,
  handleCampusClick,
  isLoggedIn,
  loggedInUserInfo,
  handleLoginButtonClick,
  displayYear,
  displayMonth,
  selectedDate,
  handleTodayClick,
  handlePrevMonthClick,
  handleNextMonthClick,
  handleDateClick,
  handleSlotClick,
  handleOpenReservationPage,
  requireLogin,
  currentDayReservations,
  unavailableSchedules,
  navigate,
  handleOpenDetailsModal,
  isLoading
}) => {
  const today = new Date();
  const todayDate = today.getDate();

  const dayNamesKorean = ['일', '월', '화', '수', '목', '금', '토'];
  const firstDayOfMonth = new Date(displayYear, displayMonth - 1, 1);
  const startDay = firstDayOfMonth.getDay();
  const daysInMonth = new Date(displayYear, displayMonth, 0).getDate();

  const allHours = Array.from({ length: 17 }, (_, i) => (i + 8) % 24);
  const hoursLine1 = allHours.slice(0, 9);
  const slotsLine1Count = 8 * 2;
  const hoursLine2 = allHours.slice(8);
  const slotsLine2Count = 8 * 2;

  const getSlotTime = (index: number) => {
    const totalMinutes = 8 * 60 + index * 30;
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${hours < 10 ? '0' : ''}${hours}:${minutes < 10 ? '0' : ''}${minutes}`;
  };

  const reservationSlots = Array.from({ length: 32 }, (_, index) => {
    const slotStartTime = getSlotTime(index);
    const slotEndTime = getSlotTime(index + 1);

    const slotStartMinutes = parseInt(slotStartTime.split(':')[0]) * 60 + parseInt(slotStartTime.split(':')[1]);
    const slotEndMinutes = parseInt(slotEndTime.split(':')[0]) * 60 + parseInt(slotEndTime.split(':')[1]);

    let slotStatus: 'available' | 'pending' | 'in-progress' | 'unavailable' = 'available';
    let hasApproved = false;
    let hasPending = false;
    let hasUnavailable = false;

    const year = selectedDate.getFullYear();
    const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
    const day = selectedDate.getDate().toString().padStart(2, '0');
    const formattedSelectedDate = `${year}-${month}-${day}`;
    const selectedDayOfWeek = selectedDate.getDay();

    for (const schedule of unavailableSchedules) {
      if (schedule.campus !== selectedCampus) continue;
      if (formattedSelectedDate < schedule.startDate || formattedSelectedDate > schedule.endDate) continue;

      const scheduleStartMinutes = parseInt(schedule.startTime.split(':')[0]) * 60 + parseInt(schedule.startTime.split(':')[1]);
      const scheduleEndMinutes = parseInt(schedule.endTime.split(':')[0]) * 60 + parseInt(schedule.endTime.split(':')[1]);

      if (scheduleStartMinutes < slotEndMinutes && scheduleEndMinutes > slotStartMinutes) {
        if (schedule.frequencyType === 'once') {
          hasUnavailable = true; break;
        } else if (schedule.frequencyType === 'weekly' && schedule.dayOfWeek === selectedDayOfWeek) {
          hasUnavailable = true; break;
        } else if (schedule.frequencyType === 'monthly_by_week_day') {
          const currentYear = selectedDate.getFullYear();
          const currentMonth = selectedDate.getMonth();
          const currentDayOfMonth = selectedDate.getDate();
          const firstDayOfCurrentMonth = new Date(currentYear, currentMonth, 1);
          const firstDayWeekday = firstDayOfCurrentMonth.getDay();
          const firstSunday = firstDayWeekday === 0 ? 1 : 1 + (7 - firstDayWeekday);
          const targetOccurrenceN = Math.floor((currentDayOfMonth - firstSunday) / 7) + 1;

          if (schedule.weekOfMonth === targetOccurrenceN && schedule.dayOfWeek === selectedDayOfWeek) {
            hasUnavailable = true; break;
          }
        }
      }
    }

    for (const res of currentDayReservations) {
      const resStartMinutes = parseInt(res.startTime.split(':')[0]) * 60 + parseInt(res.startTime.split(':')[1]);
      const resEndMinutes = parseInt(res.endTime.split(':')[0]) * 60 + parseInt(res.endTime.split(':')[1]);

      if (resStartMinutes < slotEndMinutes && resEndMinutes > slotStartMinutes) {
        if (res.status === 'approved') {
          hasApproved = true; break;
        } else if (res.status === 'pending') {
          hasPending = true;
        }
      }
    }

    if (hasApproved) slotStatus = 'in-progress';
    else if (hasUnavailable) slotStatus = 'unavailable';
    else if (hasPending) slotStatus = 'pending';
    
    return slotStatus;
  });

  const reservationSlotsLine1 = reservationSlots.slice(0, slotsLine1Count);
  const reservationSlotsLine2 = reservationSlots.slice(slotsLine1Count, slotsLine1Count + slotsLine2Count);

  const findOverlappingReservation = (slotIndex: number) => {
    const clickedSlotStartTime = getSlotTime(slotIndex);
    const clickedSlotEndTime = getSlotTime(slotIndex + 1);
    const clickedStart = parseInt(clickedSlotStartTime.split(':')[0]) * 60 + parseInt(clickedSlotStartTime.split(':')[1]);
    const clickedEnd = parseInt(clickedSlotEndTime.split(':')[0]) * 60 + parseInt(clickedSlotEndTime.split(':')[1]);

    let bestMatch: ReservationData | null = null;
    let bestPriority = 0;

    for (const res of currentDayReservations) {
        const rStart = parseInt(res.startTime.split(':')[0]) * 60 + parseInt(res.startTime.split(':')[1]);
        const rEnd = parseInt(res.endTime.split(':')[0]) * 60 + parseInt(res.endTime.split(':')[1]);
        
        if (rStart < clickedEnd && rEnd > clickedStart) {
            let priority = 0;
            if (res.status === 'approved') priority = 3;
            else if (res.status === 'pending') priority = 2;
            else if (res.status === 'rejected') priority = 1;

            if (priority > bestPriority) {
                bestMatch = res;
                bestPriority = priority;
                if (priority === 3) break;
            }
        }
    }
    return bestMatch;
  };

  const findOverlappingUnavailableSchedule = (slotIndex: number): UnavailableScheduleData | null => {
    const clickedSlotStartTime = getSlotTime(slotIndex);
    const clickedSlotEndTime = getSlotTime(slotIndex + 1);
    const clickedStart = parseInt(clickedSlotStartTime.split(':')[0]) * 60 + parseInt(clickedSlotStartTime.split(':')[1]);
    const clickedEnd = parseInt(clickedSlotEndTime.split(':')[0]) * 60 + parseInt(clickedSlotEndTime.split(':')[1]);

    const year = selectedDate.getFullYear();
    const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
    const day = selectedDate.getDate().toString().padStart(2, '0');
    const formattedSelectedDate = `${year}-${month}-${day}`;
    const selectedDayOfWeek = selectedDate.getDay();

    for (const schedule of unavailableSchedules) {
      if (schedule.campus !== selectedCampus) continue;
      if (formattedSelectedDate < schedule.startDate || formattedSelectedDate > schedule.endDate) continue;

      const scheduleStartMinutes = parseInt(schedule.startTime.split(':')[0]) * 60 + parseInt(schedule.startTime.split(':')[1]);
      const scheduleEndMinutes = parseInt(schedule.endTime.split(':')[0]) * 60 + parseInt(schedule.endTime.split(':')[1]);

      if (scheduleStartMinutes < clickedEnd && scheduleEndMinutes > clickedStart) {
        if (schedule.frequencyType === 'once') return schedule;
        else if (schedule.frequencyType === 'weekly' && schedule.dayOfWeek === selectedDayOfWeek) return schedule;
        else if (schedule.frequencyType === 'monthly_by_week_day') {
          const currentYear = selectedDate.getFullYear();
          const currentMonth = selectedDate.getMonth();
          const currentDayOfMonth = selectedDate.getDate();
          const firstDayOfCurrentMonth = new Date(currentYear, currentMonth, 1);
          const firstDayWeekday = firstDayOfCurrentMonth.getDay();
          const firstSunday = firstDayWeekday === 0 ? 1 : 1 + (7 - firstDayWeekday);
          const targetOccurrenceN = Math.floor((currentDayOfMonth - firstSunday) / 7) + 1;
          if (schedule.weekOfMonth === targetOccurrenceN && schedule.dayOfWeek === selectedDayOfWeek) return schedule;
        }
      }
    }
    return null;
  };

  const isRegularUser = isLoggedIn && loggedInUserInfo?.role !== 'admin';

  return (
    <>
      <header className="app-header">
        <div className="campus-selection">
          <button className={`campus-btn ${selectedCampus === '인캠' ? 'active-incheon' : 'inactive-gyeong'}`} onClick={handleCampusClick}>인캠</button>
          <button className={`campus-btn ${selectedCampus === '경캠' ? 'active-gyeong' : 'inactive-incheon'}`} onClick={handleCampusClick}>경캠</button>
        </div>
        <button 
          className={`login-btn ${isRegularUser ? 'static-mode' : ''}`} 
          onClick={handleLoginButtonClick} 
        >
          {isLoggedIn ? (loggedInUserInfo ? loggedInUserInfo.studentInfo : '로그인됨') : '로그인'}
        </button>
      </header>

      <h1>지아이템 템방 예약</h1>

      <div className="calendar-container">
        <div className="calendar-nav">
          <span className="current-month-year">{displayYear}년 {displayMonth}월</span>
          <div className="calendar-nav-buttons">
            <button className="nav-today-btn" onClick={handleTodayClick}>오늘</button>
            <button className="nav-prev-month-btn" onClick={handlePrevMonthClick}>&lt;</button>
            <button className="nav-next-month-btn" onClick={handleNextMonthClick}>&gt;</button>
          </div>
        </div>
        <div className="calendar-grid">
          {dayNamesKorean.map((day) => <span key={day} className="day-name">{day}</span>)}
          {Array.from({ length: startDay }).map((_, i) => <span key={`empty-${i}`} className="date-cell empty"></span>)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const date = i + 1;
            const isToday = date === todayDate && displayMonth === today.getMonth() + 1 && displayYear === today.getFullYear();
            const isSelected = date === selectedDate.getDate() && displayMonth === selectedDate.getMonth() + 1 && selectedDate.getFullYear() === displayYear;
            let cellClassName = 'date-cell';
            if (isSelected) cellClassName += ' selected-date';
            else if (isToday) cellClassName += ' today-date';

            return (
              <span key={date} className={cellClassName} onClick={() => handleDateClick(date)}>
                {date}
              </span>
            );
          })}
        </div>
      </div>

      <div className="action-buttons">
        <button className="my-reservation-btn" onClick={isLoggedIn ? () => navigate('/my-reservations') : requireLogin}>마이페이지</button>
        <button className="make-reservation-btn" onClick={() => handleOpenReservationPage()}>예약하기</button>
      </div>

      <div className="time-display-container">
        {isLoading ? (
          <div className="loading-message" style={{ textAlign: 'center', padding: '20px', fontSize: '1.2em', color: '#555' }}>예약 현황을 불러오는 중입니다...</div>
        ) : (
          <>
             <div className="time-line">
                <div className="time-labels">
                    {hoursLine1.map(h => <div key={h} className="time-label">{h < 10 ? `0${h}` : h}</div>)}
                </div>
                <div className="reservation-slots">
                    {reservationSlotsLine1.map((status, index) => (
                        <div key={index} className={`status-bar ${status}`} onClick={() => {
                             if(!isLoggedIn) { requireLogin(); return; }
                             
                             if (loggedInUserInfo?.role === 'pending') {
                               alert('관리자의 회원 가입 승인을 기다려주세요.');
                               return;
                             }

                             if(status === 'available') handleOpenReservationPage(getSlotTime(index), getSlotTime(index+1));
                             else if (status === 'unavailable') {
                                const un = findOverlappingUnavailableSchedule(index);
                                if(un) handleOpenDetailsModal(un, 'unavailable');
                             } else {
                                 const res = findOverlappingReservation(index);
                                 if(res) handleOpenDetailsModal(res, 'reservation');
                             }
                        }}></div>
                    ))}
                </div>
             </div>
             <div className="time-line">
                <div className="time-labels">
                    {hoursLine2.map(h => <div key={h} className="time-label">{h < 10 ? `0${h}` : h}</div>)}
                </div>
                <div className="reservation-slots">
                    {reservationSlotsLine2.map((status, index) => (
                        <div key={index + slotsLine1Count} className={`status-bar ${status}`} onClick={() => {
                             const absIndex = index + slotsLine1Count;
                             if(!isLoggedIn) { requireLogin(); return; }

                             if (loggedInUserInfo?.role === 'pending') {
                               alert('관리자의 회원 가입 승인을 기다려주세요.');
                               return;
                             }

                             if(status === 'available') handleOpenReservationPage(getSlotTime(absIndex), getSlotTime(absIndex+1));
                             else if (status === 'unavailable') {
                                const un = findOverlappingUnavailableSchedule(absIndex);
                                if(un) handleOpenDetailsModal(un, 'unavailable');
                             } else {
                                 const res = findOverlappingReservation(absIndex);
                                 if(res) handleOpenDetailsModal(res, 'reservation');
                             }
                        }}></div>
                    ))}
                </div>
             </div>
          </>
        )}
      </div>

      <div className="legend">
        <div className="legend-item"><span className="color-box available"></span> 이용 가능</div>
        <div className="legend-item"><span className="color-box in-progress"></span> 예약 중</div>
        <div className="legend-item"><span className="color-box unavailable"></span> 이용 불가</div>
        <div className="legend-item"><span className="color-box pending"></span> 승인 대기</div>
      </div>

      <p style={{ 
        textAlign: 'center', 
        color: '#999', 
        marginTop: '0px', 
        fontSize: '0.9em',
        marginBottom: '0px' 
      }}>
        시간 막대를 눌러 예약할 수도 있습니다.
      </p>
    </>
  );
};

function App() {
  const navigate = useNavigate();
  const today = new Date();
  
  const [displayYear, setDisplayYear] = useState(today.getFullYear());
  const [displayMonth, setDisplayMonth] = useState(today.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const [selectedCampus, setSelectedCampus] = useState<'인캠' | '경캠'>('인캠');
  
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loggedInUserInfo, setLoggedInUserInfo] = useState<UserInfo | null>(null);
  
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  
  const [initialReservationTime, setInitialReservationTime] = useState<{ start: string; end: string } | null>(null);

  const [allReservations, setAllReservations] = useState<ReservationData[]>([]);
  const [unavailableSchedules, setUnavailableSchedules] = useState<UnavailableScheduleData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedItemForDetails, setSelectedItemForDetails] = useState<ReservationData | UnavailableScheduleData | null>(null);
  const [detailsModalType, setDetailsModalType] = useState<'reservation' | 'unavailable' | null>(null);

  // [추가] 토스트 알림 상태
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'info' | 'success' | 'alert'>('info');

  // [추가] Realtime 구독 Ref
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    const { data: resData, error: resError } = await supabase
      .from('reservations')
      .select('*');
    if (resData) setAllReservations(resData as ReservationData[]);
    if (resError) console.error("Error fetching reservations:", resError);

    const { data: unData, error: unError } = await supabase
      .from('unavailableSchedules')
      .select('*');
    if (unData) setUnavailableSchedules(unData as UnavailableScheduleData[]);
    if (unError) console.error("Error fetching schedules:", unError);

    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUserInfo(session.user.id, session.user.email!);
      } else {
        setIsLoggedIn(false);
        setLoggedInUserInfo(null);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchUserInfo(session.user.id, session.user.email!);
      } else {
        setIsLoggedIn(false);
        setLoggedInUserInfo(null);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [/* ... */]);

  // [핵심] 로그인 정보가 바뀔 때마다 Realtime 구독 설정
  useEffect(() => {
    // 기존 구독이 있다면 해제
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (!isLoggedIn || !loggedInUserInfo) return;

    // Realtime 채널 구독
    const channel = supabase
      .channel('realtime-notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users' },
        (payload) => {
          // 1. [관리자] 새로운 가입 신청 (INSERT)
          if (loggedInUserInfo.role === 'admin' && payload.eventType === 'INSERT') {
            if (payload.new.role === 'pending') {
              const msg = '🔔 새로운 회원가입 신청이 있습니다!';
              setToastMessage(msg); // 앱 내 토스트
              setToastType('info');
              sendSystemNotification('템방 관리자 알림', '새로운 회원가입 신청이 들어왔습니다.'); // 시스템 알림
            }
          }

          // 2. [사용자] 내 계정 상태 변경 (UPDATE)
          if (payload.eventType === 'UPDATE' && payload.new.id === loggedInUserInfo.uid) {
            // 승인됨 (pending -> user)
            if (payload.old.role === 'pending' && payload.new.role === 'user') {
              const msg = '🎉 회원가입이 승인되었습니다! 이제 예약이 가능합니다.';
              setToastMessage(msg);
              setToastType('success');
              setLoggedInUserInfo(prev => prev ? { ...prev, role: 'user' } : null);
              
              sendSystemNotification('템방 알림', '회원가입이 승인되었습니다! 이제 예약할 수 있습니다.');
            }
            // 추방됨
            if (!payload.old.banned_at && payload.new.banned_at) {
              const msg = '🚫 계정이 관리자에 의해 추방되었습니다. 로그아웃됩니다.';
              setToastMessage(msg);
              setToastType('alert');
              sendSystemNotification('템방 알림', '계정이 추방되었습니다.');
              setTimeout(() => performLogout(), 3000);
            }
          }

          // 3. [사용자] 가입 거절 (DELETE)
          if (payload.eventType === 'DELETE' && payload.old.id === loggedInUserInfo.uid) {
            const msg = '🚫 회원가입 신청이 거절되었습니다. 계정이 삭제됩니다.';
            setToastMessage(msg);
            setToastType('alert');
            sendSystemNotification('템방 알림', '회원가입 신청이 거절되었습니다.');
            setTimeout(() => performLogout(), 3000);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations' },
        (payload) => {
          // 4. [관리자] 새로운 예약 신청 (INSERT)
          if (loggedInUserInfo.role === 'admin' && payload.eventType === 'INSERT') {
             const msg = '📅 새로운 예약 신청이 들어왔습니다!';
             setToastMessage(msg);
             setToastType('info');
             sendSystemNotification('템방 관리자 알림', '새로운 예약 신청이 있습니다.');
             fetchData(); 
          }

          // 5. [사용자] 내 예약 상태 변경 (UPDATE)
          if (payload.eventType === 'UPDATE' && payload.new.userId === loggedInUserInfo.uid) {
            if (payload.new.status === 'approved') {
               const msg = `✅ 예약이 승인되었습니다! (${payload.new.useDate})`;
               setToastMessage(msg);
               setToastType('success');
               sendSystemNotification('템방 알림', `예약이 승인되었습니다. (${payload.new.useDate})`);
               fetchData();
            }
            if (payload.new.status === 'rejected') {
               const msg = `❌ 예약이 거절되었습니다. (${payload.new.useDate})`;
               setToastMessage(msg);
               setToastType('alert');
               sendSystemNotification('템방 알림', `예약이 거절되었습니다. (${payload.new.useDate})`);
               fetchData();
            }
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, loggedInUserInfo?.uid, loggedInUserInfo?.role]);

  const fetchUserInfo = async (uid: string, email: string) => {
    // 1차 시도: 데이터 조회
    let { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', uid)
      .single();
    
    // [추가된 로직] 데이터가 없다면? (회원가입 직후라서 저장 중일 수 있음)
    if (!data) {
      console.log("데이터 없음. 회원가입 저장 대기 중... (1초 재시도)");
      // 1초(1000ms) 동안 기다림
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 2차 시도: 다시 조회
      const retry = await supabase
        .from('users')
        .select('*')
        .eq('id', uid)
        .single();
        
      data = retry.data;
    }
    
    if (data) {
      setIsLoggedIn(true);
      setLoggedInUserInfo({
        studentInfo: data.studentInfo,
        email: data.email,
        role: data.role,
        uid: uid
      });
    } else {
      //alert('가입이 거절되었거나 존재하지 않는 계정입니다.');
      await supabase.auth.signOut();
      setIsLoggedIn(false);
      setLoggedInUserInfo(null);
      navigate('/'); 
    }
  };

  const handleLoginSubmit = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert('로그인 실패: ' + error.message);
    } else {
      setShowLoginModal(false);
    }
  };

  const handleSignupSubmit = async (studentInfo: string, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      alert('회원가입 실패: ' + error.message);
      return;
    }
    if (data.user) {
      const { error: dbError } = await supabase
        .from('users')
        .insert([{ id: data.user.id, email: email, studentInfo: studentInfo, role: 'pending' }]);

      if (dbError) {
        console.error("Profile save error:", dbError);
        alert('회원가입은 되었으나 프로필 저장에 실패했습니다.');
      } else {
        alert('회원가입 신청이 완료되었습니다.\n관리자의 승인을 기다려 주세요.');
        await supabase.auth.signOut();
        setShowSignupModal(false);
        setShowLoginModal(true);
      }
    }
  };

  const performLogout = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setLoggedInUserInfo(null);
    setToastMessage(null); 
    navigate('/');
  };

  const handleReservationSubmit = async (reservationData: ReservationData) => {
    const { error } = await supabase
      .from('reservations')
      .insert([{ ...reservationData, userId: loggedInUserInfo?.uid }]);

    if (error) {
      console.error("Reservation error:", error);
      alert('예약 신청 중 오류가 발생했습니다.');
    } else {
      alert('예약 신청이 완료되었습니다.');
      fetchData();
      navigate('/');
    }
  };

  const handleOpenReservationPage = (initialStart?: string, initialEnd?: string) => {
    if (!isLoggedIn) {
      requireLogin();
      return;
    }
    if (loggedInUserInfo?.role === 'pending') {
      alert('관리자의 회원 가입 승인을 기다려주세요.');
      return;
    }
    setInitialReservationTime(initialStart && initialEnd ? { start: initialStart, end: initialEnd } : null);
    navigate('/reservation');
  };

  const handleLoginButtonClick = async () => {
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return;
    }
    if (loggedInUserInfo?.role === 'admin') {
      navigate('/admin');
      return;
    }
  };

  const handleCampusClick = () => {
    setSelectedCampus(prev => prev === '인캠' ? '경캠' : '인캠');
  };

  const requireLogin = () => {
    alert('로그인이 필요합니다.');
    setShowLoginModal(true);
  };

  const handleOpenDetailsModal = (item: ReservationData | UnavailableScheduleData, type: 'reservation' | 'unavailable') => {
    setSelectedItemForDetails(item);
    setDetailsModalType(type);
    setShowDetailsModal(true);
  };

  const currentDayReservations = allReservations.filter(res => {
    const year = selectedDate.getFullYear();
    const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
    const day = selectedDate.getDate().toString().padStart(2, '0');
    return res.useDate === `${year}-${month}-${day}` && res.campus === selectedCampus;
  });

  return (
    <div className="App">
      {/* 토스트 메시지 */}
      {toastMessage && (
        <NotificationToast 
          message={toastMessage} 
          type={toastType} 
          onClose={() => setToastMessage(null)} 
        />
      )}

      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          onLoginSubmit={handleLoginSubmit}
          onShowSignup={() => { setShowLoginModal(false); setShowSignupModal(true); }}
        />
      )}
      {showSignupModal && (
        <SignupModal
          onClose={() => setShowSignupModal(false)}
          onSignupSubmit={handleSignupSubmit}
          onShowLogin={() => { setShowSignupModal(false); setShowLoginModal(true); }}
        />
      )}
      {showDetailsModal && (
        <ReservationDetailsModal
          data={selectedItemForDetails}
          dataType={detailsModalType}
          onClose={() => { setShowDetailsModal(false); setSelectedItemForDetails(null); }}
        />
      )}

      <Routes>
        <Route path="/" element={
          <MainContent
            selectedCampus={selectedCampus}
            handleCampusClick={handleCampusClick}
            isLoggedIn={isLoggedIn}
            loggedInUserInfo={loggedInUserInfo}
            handleLoginButtonClick={handleLoginButtonClick}
            displayYear={displayYear}
            displayMonth={displayMonth}
            selectedDate={selectedDate}
            handleTodayClick={() => {
                const now = new Date();
                setDisplayYear(now.getFullYear());
                setDisplayMonth(now.getMonth() + 1);
                setSelectedDate(now);
            }}
            handlePrevMonthClick={() => {
                const d = new Date(selectedDate);
                d.setMonth(d.getMonth() - 1);
                setDisplayYear(d.getFullYear());
                setDisplayMonth(d.getMonth() + 1);
                setSelectedDate(d);
            }}
            handleNextMonthClick={() => {
                const d = new Date(selectedDate);
                d.setMonth(d.getMonth() + 1);
                setDisplayYear(d.getFullYear());
                setDisplayMonth(d.getMonth() + 1);
                setSelectedDate(d);
            }}
            handleDateClick={(d) => setSelectedDate(new Date(displayYear, displayMonth - 1, d))}
            handleSlotClick={() => {}}
            handleOpenReservationPage={handleOpenReservationPage}
            requireLogin={requireLogin}
            currentDayReservations={currentDayReservations}
            unavailableSchedules={unavailableSchedules}
            navigate={navigate}
            handleOpenDetailsModal={handleOpenDetailsModal}
            isLoading={isLoading}
          />
        } />
        <Route path="/reservation" element={
            <ReservationPage
              onClose={() => navigate('/')}
              selectedDate={selectedDate}
              initialStartTime={initialReservationTime?.start}
              initialEndTime={initialReservationTime?.end}
              loggedInUserInfo={loggedInUserInfo}
              selectedCampus={selectedCampus}
              handleCampusClick={handleCampusClick}
              onSubmitReservation={handleReservationSubmit}
              currentDayReservations={currentDayReservations}
              unavailableSchedules={unavailableSchedules} 
            />
        } />
        <Route path="/my-reservations" element={
            <MyReservationsPage
              onClose={() => navigate('/')}
              loggedInUserInfo={loggedInUserInfo}
              onLogout={performLogout}
            />
        } />
        <Route path="/admin" element={
            <AdminPage
              loggedInUserInfo={loggedInUserInfo}
              onLogout={performLogout}
            />
        } />
      </Routes>
    </div>
  );
}

const AppWrapper: React.FC = () => (
  <Router>
    <App />
  </Router>
);

export default AppWrapper;