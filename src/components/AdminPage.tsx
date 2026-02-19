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

  // [수정] 입력 폼 표시 여부 State
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  // [수정] 현재 수정 중인 일정 ID (null이면 새 추가 모드)
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);

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

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

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
        const activeUsers = fetchedUsers.filter(user => !user.banned_at);
        setUsers(sortUsers(activeUsers));
      }

      if (schResult.data) setUnavailableSchedules(schResult.data as UnavailableScheduleData[]);
    };

    initPage();
  }, [navigate]); 

  // --- 헬퍼 함수: 유저 정렬 ---
  const sortUsers = (list: UserData[]) => {
    return list.sort((a, b) => {
      const getPriority = (role: string) => {
        if (role === 'admin') return 0;
        if (role === 'pending') return 1;
        return 2;
      };
      
      const pA = getPriority(a.role);
      const pB = getPriority(b.role);

      if (pA !== pB) return pA - pB;

      if (a.role === 'pending') {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeA - timeB;
      } else {
        return a.studentInfo.localeCompare(b.studentInfo);
      }
    });
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('users').select('*');
    if (data) {
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

  const handleApproveUser = async (user: UserData) => {
    if(!window.confirm(`${user.studentInfo} 님의 가입을 승인하시겠습니까?`)) return;
    const { error } = await supabase.from('users').update({ role: 'user' }).eq('id', user.id);
    if(error) alert('오류: ' + error.message);
    else {
      alert('승인되었습니다.');
      fetchUsers();
    }
  };

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

  const handleBanUser = async (user: UserData) => {
    if(user.role === 'admin') return alert('관리자는 추방할 수 없습니다.');
    if(!window.confirm(`${user.studentInfo}님을 추방하시겠습니까?\n(1개월간 로그인 차단 후 삭제됩니다.)\n\n* 추방 시 회원 목록에서 즉시 사라집니다.`)) return;
    const { error } = await supabase.from('users').update({ banned_at: new Date().toISOString() }).eq('id', user.id);
    if(error) alert('오류: ' + error.message);
    else { 
      alert('추방되었습니다.'); 
      fetchUsers(); 
    }
  };

  // [수정] 일정 저장 핸들러 (추가 & 수정 공용)
  const handleSaveSchedule = async () => {
    if(!newSchedule.startDate || !newSchedule.reason) return alert('시작 날짜와 사유는 필수입니다.');
    const scheduleToSave = { ...newSchedule };
    
    // 종료일이 없으면 시작일과 같게 (단일 일정의 경우)
    if((scheduleToSave.frequencyType === 'once' || !scheduleToSave.endDate) && !scheduleToSave.endDate) {
        scheduleToSave.endDate = scheduleToSave.startDate;
    }

    let error;
    if (editingScheduleId) {
      // 수정 모드: UPDATE
      const { error: updateError } = await supabase
        .from('unavailableSchedules')
        .update(scheduleToSave)
        .eq('id', editingScheduleId);
      error = updateError;
    } else {
      // 추가 모드: INSERT
      // id는 자동 생성이므로 insert 시 제외
      const { id, ...insertData } = scheduleToSave; 
      const { error: insertError } = await supabase.from('unavailableSchedules').insert([insertData]);
      error = insertError;
    }

    if(error) alert('저장 실패: ' + error.message);
    else {
      alert(editingScheduleId ? '일정이 수정되었습니다.' : '일정이 추가되었습니다.');
      const { data } = await supabase.from('unavailableSchedules').select('*');
      if(data) setUnavailableSchedules(data as UnavailableScheduleData[]);
      
      // 폼 초기화 및 닫기
      handleCloseScheduleForm();
    }
  };

  const handleDeleteSchedule = async (id?: string) => {
    if(!id || !window.confirm('정말로 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('unavailableSchedules').delete().eq('id', id);
    if(!error) { 
      alert('삭제되었습니다.'); 
      const { data } = await supabase.from('unavailableSchedules').select('*');
      if(data) setUnavailableSchedules(data as UnavailableScheduleData[]);
    }
  };

  // [추가] 수정 버튼 클릭 시 폼 채우기
  const handleEditClick = (sch: UnavailableScheduleData) => {
    setNewSchedule(sch);
    setEditingScheduleId(sch.id!);
    setShowScheduleForm(true);
    // 스크롤을 맨 위(폼 위치)로 이동
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // [추가] 폼 닫기 및 초기화
  const handleCloseScheduleForm = () => {
    setShowScheduleForm(false);
    setEditingScheduleId(null);
    setNewSchedule({ campus: '인캠', startDate: '', endDate: '', startTime: '09:00', endTime: '18:00', reason: '', frequencyType: 'once', dayOfWeek: 0, weekOfMonth: 1 });
  };

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
                  </div>
                </div>
                {expandedUserId === user.id && (
                  <div className="list-item-details">
                    <p><strong>가입일:</strong> {user.created_at ? new Date(user.created_at).toLocaleDateString() : '날짜 없음'}</p>
                    <div className="detail-actions">
                      {user.role === 'pending' && (
                        <>
                          <button className="approve-btn" onClick={() => handleApproveUser(user)}>가입 승인</button>
                          <button className="delete-btn" onClick={() => handleRejectUser(user)}>거절</button>
                        </>
                      )}
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
            
            {/* [수정] 안내 문구 및 추가 버튼 */}
            {!showScheduleForm && (
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <p style={{ color: '#999', fontSize: '0.9em', marginTop: '0', marginBottom: '10px' }}>
                  매 학기마다 수정 부탁드립니다.
                </p>
                <button 
                  className="add-btn" 
                  style={{ width: '100%', padding: '12px', fontSize: '1em' }}
                  onClick={() => setShowScheduleForm(true)}
                >
                  새 일정 제한 추가
                </button>
              </div>
            )}

            {/* 입력 폼 (조건부 렌더링) */}
            {showScheduleForm && (
              <div className="add-schedule-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h3>{editingScheduleId ? '일정 제한 수정' : '새 일정 제한 추가'}</h3>
                  <button onClick={handleCloseScheduleForm} style={{ background: 'none', border: 'none', fontSize: '1.2em', cursor: 'pointer' }}>✕</button>
                </div>
                
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
                  <div className="form-buttons" style={{ display: 'flex', gap: '10px' }}>
                    <button className="add-btn" style={{ flex: 1 }} onClick={handleSaveSchedule}>
                      {editingScheduleId ? '일정 제한 수정' : '제한 일정 추가'}
                    </button>
                    <button className="cancel-btn" style={{ flex: 1, backgroundColor: '#ccc' }} onClick={handleCloseScheduleForm}>
                      취소
                    </button>
                  </div>
                </div>
              </div>
            )}

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
                        {/* [수정] 수정 버튼 추가 */}
                        <button className="approve-btn" style={{ backgroundColor: '#6a9ceb' }} onClick={() => handleEditClick(sch)}>수정</button>
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