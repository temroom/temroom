import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import '../styles/AdminPage.css';

// --- 타입 정의 ---
interface UserInfo {
  studentInfo: string;
  email: string;
  role?: string;
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

interface UserData {
  id: string;
  email: string;
  studentInfo: string;
  role: string;
  created_at: string;
  banned_at?: string;
}

interface UnavailableScheduleData {
  id?: string;
  campus: '인캠' | '경캠';
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  reason: string;
  frequencyType: 'once' | 'weekly' | 'monthly_by_week_day';
  dayOfWeek?: number;
  weekOfMonth?: number;
}

interface AdminPageProps {
  loggedInUserInfo: UserInfo | null;
  onLogout: () => void;
}

const AdminPage: React.FC<AdminPageProps> = ({ loggedInUserInfo }) => {
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<'reservations' | 'users' | 'schedules'>('reservations');
  
  const [reservations, setReservations] = useState<ReservationData[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [unavailableSchedules, setUnavailableSchedules] = useState<UnavailableScheduleData[]>([]);
  
  const [expandedResId, setExpandedResId] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [expandedScheduleId, setExpandedScheduleId] = useState<string | null>(null);

  const [newSchedule, setNewSchedule] = useState<UnavailableScheduleData>({
    campus: '인캠',
    startDate: '',
    endDate: '',
    startTime: '09:00',
    endTime: '18:00',
    reason: '',
    frequencyType: 'once',
    dayOfWeek: 0,
    weekOfMonth: 1
  });

  // --- 페이지 로드 시 즉시 데이터 및 권한 확인 ---
  useEffect(() => {
    const initPage = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        alert('로그인이 필요합니다.');
        navigate('/');
        return;
      }

      // 데이터 병렬 호출
      const [userRoleResult, resResult, usersResult, schResult] = await Promise.all([
        supabase.from('users').select('role').eq('id', session.user.id).single(),
        supabase.from('reservations').select('*').order('submittedAt', { ascending: false }),
        supabase.from('users').select('*'), 
        supabase.from('unavailableSchedules').select('*')
      ]);

      if (userRoleResult.error || userRoleResult.data?.role !== 'admin') {
        alert('관리자 권한이 필요합니다.');
        navigate('/');
        return;
      }

      if (resResult.data) setReservations(resResult.data as ReservationData[]);
      
      // 회원 목록 처리 (필터링 + 정렬)
      if (usersResult.data) {
        const fetchedUsers = usersResult.data as UserData[];
        
        // [수정] 추방된 유저(banned_at이 있는 유저)는 목록에서 제외
        const activeUsers = fetchedUsers.filter(user => !user.banned_at);
        
        const sortedUsers = sortUsers(activeUsers);
        setUsers(sortedUsers);
      }

      if (schResult.data) setUnavailableSchedules(schResult.data as UnavailableScheduleData[]);
    };

    initPage();
  }, [navigate]); 

  // --- 헬퍼 함수: 유저 정렬 ---
  const sortUsers = (list: UserData[]) => {
    return list.sort((a, b) => {
      // 1. 그룹 우선순위
      const getPriority = (role: string) => {
        if (role === 'admin') return 0;
        if (role === 'pending') return 1;
        return 2;
      };
      
      const pA = getPriority(a.role);
      const pB = getPriority(b.role);

      if (pA !== pB) return pA - pB;

      // 2. 그룹 내 정렬
      if (a.role === 'pending') {
        // 승인 대기: 오래된 순(먼저 신청한 사람)이 위로
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeA - timeB;
      } else {
        // 나머지: 이름순
        return a.studentInfo.localeCompare(b.studentInfo);
      }
    });
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('users').select('*');
    if (data) {
      // [수정] 데이터 새로고침 시에도 추방된 유저는 필터링하여 숨김
      const activeUsers = (data as UserData[]).filter(user => !user.banned_at);
      setUsers(sortUsers(activeUsers));
    }
  };

  // --- 핸들러들 ---
  const handleApproveReservation = async (id: string) => {
    if(!window.confirm('승인하시겠습니까?')) return;
    const { error } = await supabase.from('reservations').update({ status: 'approved' }).eq('id', id);
    if (!error) { 
      alert('승인되었습니다.'); 
      const { data } = await supabase.from('reservations').select('*').order('submittedAt', { ascending: false });
      if(data) setReservations(data as ReservationData[]);
      setExpandedResId(null); 
    }
  };

  // 가입 승인
  const handleApproveUser = async (user: UserData) => {
    if(!window.confirm(`${user.studentInfo} 님의 가입을 승인하시겠습니까?`)) return;
    const { error } = await supabase.from('users').update({ role: 'user' }).eq('id', user.id);
    if(error) alert('오류: ' + error.message);
    else {
      alert('승인되었습니다.');
      fetchUsers();
    }
  };

  // 가입 거절 (완전 삭제)
  const handleRejectUser = async (user: UserData) => {
    if(!window.confirm(`${user.studentInfo} 님의 가입을 거절하시겠습니까?\n(데이터베이스에서 완전히 삭제되어 재가입이 가능해집니다)`)) return;
    
    const { error } = await supabase.rpc('delete_user_fully', { user_id: user.id });

    if(error) {
      console.error(error);
      alert('거절 실패: ' + error.message);
    } else {
      alert('가입이 거절(삭제)되었습니다.');
      fetchUsers();
    }
  };

  const handleToggleAdmin = async (user: UserData) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    if(!window.confirm(`${user.studentInfo}님을 ${newRole === 'admin' ? '관리자 지정' : '해제'} 하시겠습니까?`)) return;
    const { error } = await supabase.from('users').update({ role: newRole }).eq('id', user.id);
    if(!error) { 
      alert('변경되었습니다.'); 
      fetchUsers();
    }
  };

  // 추방 (이제 목록에서 사라짐)
  const handleBanUser = async (user: UserData) => {
    if(user.role === 'admin') return alert('관리자는 추방할 수 없습니다.');
    if(!window.confirm(`${user.studentInfo}님을 추방하시겠습니까?\n(1개월간 로그인 차단 후 삭제됩니다.)\n\n* 추방 시 회원 목록에서 즉시 사라집니다.`)) return;
    const { error } = await supabase.from('users').update({ banned_at: new Date().toISOString() }).eq('id', user.id);
    if(error) alert('오류: ' + error.message);
    else { 
      alert('추방되었습니다.'); 
      fetchUsers(); // 목록 갱신 시 추방된 유저는 사라짐
    }
  };

  const handleAddSchedule = async () => {
    if(!newSchedule.startDate || !newSchedule.reason) return alert('시작 날짜와 사유는 필수입니다.');
    const scheduleToAdd = { ...newSchedule };
    if(scheduleToAdd.frequencyType === 'once' && !scheduleToAdd.endDate) scheduleToAdd.endDate = scheduleToAdd.startDate;

    const { error } = await supabase.from('unavailableSchedules').insert([scheduleToAdd]);
    if(error) alert('추가 실패: ' + error.message);
    else {
      alert('일정이 추가되었습니다.');
      const { data } = await supabase.from('unavailableSchedules').select('*');
      if(data) setUnavailableSchedules(data as UnavailableScheduleData[]);
      
      setNewSchedule({ campus: '인캠', startDate: '', endDate: '', startTime: '09:00', endTime: '18:00', reason: '', frequencyType: 'once', dayOfWeek: 0, weekOfMonth: 1 });
    }
  };

  const handleDeleteSchedule = async (id?: string) => {
    if(!id || !window.confirm('삭제하시겠습니까?')) return;
    const { error } = await supabase.from('unavailableSchedules').delete().eq('id', id);
    if(!error) { 
      alert('삭제되었습니다.'); 
      const { data } = await supabase.from('unavailableSchedules').select('*');
      if(data) setUnavailableSchedules(data as UnavailableScheduleData[]);
    }
  };

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="admin-page-container">
      <div className="admin-header">
        <h2>관리자 페이지</h2>
        <button onClick={() => navigate('/')} className="admin-home-btn">메인으로</button>
      </div>

      <div className="admin-tabs">
        <button className={activeTab === 'reservations' ? 'active' : ''} onClick={() => setActiveTab('reservations')}>예약 관리</button>
        <button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>회원 관리</button>
        <button className={activeTab === 'schedules' ? 'active' : ''} onClick={() => setActiveTab('schedules')}>일정 제한</button>
      </div>

      <div className="admin-content">
        
        {/* 예약 관리 */}
        {activeTab === 'reservations' && (
          <div className="list-container">
            {reservations.map(res => (
              <div key={res.id} className={`list-item ${res.status} ${expandedResId === res.id ? 'expanded' : ''}`}>
                <div className="list-item-summary" onClick={() => setExpandedResId(expandedResId === res.id ? null : res.id)}>
                  <div className="info-left">
                    <span className={`badge ${res.campus === '인캠' ? 'incheon' : 'gyeong'}`}>{res.campus}</span>
                    <span className="date-text">{res.useDate} {res.startTime}~{res.endTime}</span>
                  </div>
                  <div className="info-right">
                    <span className="applicant-name">{res.applicant}</span>
                    <span className={`status-badge ${res.status}`}>
                      {res.status === 'pending' ? '대기중' : res.status === 'approved' ? '승인됨' : '거절/취소'}
                    </span>
                  </div>
                </div>
                {expandedResId === res.id && (
                  <div className="list-item-details">
                    <p><strong>팀명:</strong> {res.teamName}</p>
                    <p><strong>연락처:</strong> {res.phoneNumber}</p>
                    <p><strong>사유:</strong> {res.reason}</p>
                    <div className="detail-actions">
                      {res.status === 'pending' && (
                        <button className="approve-btn" onClick={() => handleApproveReservation(res.id)}>예약 승인</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 회원 관리 */}
        {activeTab === 'users' && (
          <div className="list-container">
            {users.length === 0 && <p className="no-data-msg">회원 정보가 없습니다.</p>}
            {users.map(user => (
              <div key={user.id} className={`list-item user-item ${expandedUserId === user.id ? 'expanded' : ''}`}>
                <div className="list-item-summary" onClick={() => setExpandedUserId(expandedUserId === user.id ? null : user.id)}>
                  <div className="info-left" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
                    <span className="user-name">{user.studentInfo}</span>
                    <span className="user-email" style={{ margin: 0 }}>{user.email}</span>
                  </div>
                  <div className="info-right">
                    {user.role === 'admin' && <span className="admin-badge">관리자</span>}
                    {user.role === 'pending' && <span className="status-badge approval-pending">승인 대기</span>}
                    {/* banned_at이 있는 유저는 이제 필터링되어 여기 보이지 않음 */}
                  </div>
                </div>
                {expandedUserId === user.id && (
                  <div className="list-item-details">
                    <p><strong>가입일:</strong> {user.created_at ? new Date(user.created_at).toLocaleDateString() : '날짜 없음'}</p>
                    <div className="detail-actions">
                      
                      {/* 승인 대기자 */}
                      {user.role === 'pending' && (
                        <>
                          <button className="approve-btn" onClick={() => handleApproveUser(user)}>가입 승인</button>
                          <button className="delete-btn" onClick={() => handleRejectUser(user)}>거절</button>
                        </>
                      )}

                      {/* 기존 유저 */}
                      {user.role !== 'pending' && (
                        <>
                          <button className={`role-btn ${user.role === 'admin' ? 'demote' : 'promote'}`} onClick={() => handleToggleAdmin(user)}>
                            {user.role === 'admin' ? '관리자 해제' : '관리자 지정'}
                          </button>
                          {user.role !== 'admin' && !user.banned_at && (
                            <button className="ban-btn" onClick={() => handleBanUser(user)}>추방</button>
                          )}
                        </>
                      )}

                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 일정 제한 */}
        {activeTab === 'schedules' && (
          <div className="schedules-container">
            <div className="add-schedule-card">
              <h3>새 일정 제한 추가</h3>
              <div className="schedule-form">
                <div className="form-row">
                  <select value={newSchedule.campus} onChange={e => setNewSchedule({...newSchedule, campus: e.target.value as any})}>
                    <option value="인캠">인캠</option>
                    <option value="경캠">경캠</option>
                  </select>
                  <input type="text" placeholder="사유 입력" value={newSchedule.reason} onChange={e => setNewSchedule({...newSchedule, reason: e.target.value})} />
                </div>
                <div className="form-row">
                  <label>빈도:</label>
                  <select value={newSchedule.frequencyType} onChange={e => setNewSchedule({...newSchedule, frequencyType: e.target.value as any})}>
                    <option value="once">단일 (1회성)</option>
                    <option value="weekly">매주</option>
                    <option value="monthly_by_week_day">매달 (주차+요일)</option>
                  </select>
                </div>
                <div className="form-row frequency-options">
                  {newSchedule.frequencyType === 'once' && (
                    <div className="date-range-inputs">
                      <input type="date" value={newSchedule.startDate} onChange={e => setNewSchedule({...newSchedule, startDate: e.target.value})} />
                      <span>~</span>
                      <input type="date" value={newSchedule.endDate} onChange={e => setNewSchedule({...newSchedule, endDate: e.target.value})} />
                      <span className="hint">* 종료일 미입력시 당일</span>
                    </div>
                  )}
                  {newSchedule.frequencyType === 'weekly' && (
                    <div className="weekly-inputs">
                      <input type="date" value={newSchedule.startDate} onChange={e => setNewSchedule({...newSchedule, startDate: e.target.value})} />
                      <span>~</span>
                      <input type="date" value={newSchedule.endDate} onChange={e => setNewSchedule({...newSchedule, endDate: e.target.value})} />
                      <div className="day-selector">
                        <select value={newSchedule.dayOfWeek} onChange={e => setNewSchedule({...newSchedule, dayOfWeek: parseInt(e.target.value)})}>
                          {dayNames.map((d, i) => <option key={i} value={i}>{d}요일</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                  {newSchedule.frequencyType === 'monthly_by_week_day' && (
                    <div className="monthly-inputs">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                        <input type="date" value={newSchedule.startDate} onChange={e => setNewSchedule({...newSchedule, startDate: e.target.value})} style={{ flex: 1 }} />
                        <span>~</span>
                        <input type="date" value={newSchedule.endDate} onChange={e => setNewSchedule({...newSchedule, endDate: e.target.value})} style={{ flex: 1 }} />
                      </div>
                      <div className="week-day-selector" style={{ width: '100%', marginTop: '8px', display: 'flex', alignItems: 'center' }}>
                        <select value={newSchedule.weekOfMonth} onChange={e => setNewSchedule({...newSchedule, weekOfMonth: parseInt(e.target.value)})}>
                          <option value={1}>1주차</option>
                          <option value={2}>2주차</option>
                          <option value={3}>3주차</option>
                          <option value={4}>4주차</option>
                          <option value={5}>5주차</option>
                        </select>
                        <select value={newSchedule.dayOfWeek} onChange={e => setNewSchedule({...newSchedule, dayOfWeek: parseInt(e.target.value)})}>
                          {dayNames.map((d, i) => <option key={i} value={i}>{d}요일</option>)}
                        </select>
                        <span className="hint" style={{ marginLeft: '10px', whiteSpace: 'nowrap' }}>
                          * 주차는 주일 기준
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="form-row">
                  <label>시간:</label>
                  <input type="time" value={newSchedule.startTime} onChange={e => setNewSchedule({...newSchedule, startTime: e.target.value})} />
                  <span>~</span>
                  <input type="time" value={newSchedule.endTime} onChange={e => setNewSchedule({...newSchedule, endTime: e.target.value})} />
                </div>
                <button className="add-btn" onClick={handleAddSchedule}>제한 일정 추가</button>
              </div>
            </div>

            {/* 일정 제한 목록 */}
            <div className="list-container">
              {unavailableSchedules.map(sch => (
                <div key={sch.id} className={`list-item ${expandedScheduleId === sch.id ? 'expanded' : ''}`}>
                  <div className="list-item-summary" onClick={() => setExpandedScheduleId(expandedScheduleId === sch.id ? null : (sch.id || null))}>
                    <div className="info-left" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
                      <span className={`badge ${sch.campus === '인캠' ? 'incheon' : 'gyeong'}`}>{sch.campus}</span>
                      <span className="date-text" style={{ fontSize: '1em', color: '#333', fontWeight: 'bold', margin: 0 }}>
                         {sch.reason}
                      </span>
                    </div>
                  </div>

                  {expandedScheduleId === sch.id && (
                    <div className="list-item-details">
                      <p><strong>기간:</strong> {sch.startDate} ~ {sch.endDate}</p>
                      <p><strong>빈도:</strong> 
                        {sch.frequencyType === 'once' && ' 단일 (1회성)'}
                        {sch.frequencyType === 'weekly' && ` 매주 ${dayNames[sch.dayOfWeek!]}요일`}
                        {sch.frequencyType === 'monthly_by_week_day' && ` 매달 ${sch.weekOfMonth}주차 ${dayNames[sch.dayOfWeek!]}요일`}
                      </p>
                      <p><strong>시간:</strong> {sch.startTime} ~ {sch.endTime}</p>
                      
                      <div className="detail-actions">
                        <button className="delete-btn" onClick={() => handleDeleteSchedule(sch.id)}>삭제</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminPage;