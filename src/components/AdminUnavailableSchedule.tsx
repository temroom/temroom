import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import AddUnavailableScheduleModal from './AddUnavailableScheduleModal';

interface UserInfo {
  studentInfo: string;
  email: string;
  role?: string;
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
  createdAt?: string; // Date -> string
}

interface AdminUnavailableScheduleProps {
  loggedInUserInfo: UserInfo | null;
}

const AdminUnavailableSchedule: React.FC<AdminUnavailableScheduleProps> = ({ loggedInUserInfo }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [unavailableSchedules, setUnavailableSchedules] = useState<UnavailableScheduleData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSchedules = async () => {
    setLoading(true);
    const { data } = await supabase.from('unavailableSchedules').select('*');
    if (data) setUnavailableSchedules(data as UnavailableScheduleData[]);
    setLoading(false);
  };

  useEffect(() => { fetchSchedules(); }, []);

  const handleAddSubmit = async (data: UnavailableScheduleData) => {
    const { error } = await supabase.from('unavailableSchedules').insert([data]);
    if (error) alert('추가 실패');
    else { alert('추가되었습니다.'); fetchSchedules(); setShowAddModal(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('삭제하시겠습니까?')) return;
    const { error } = await supabase.from('unavailableSchedules').delete().eq('id', id);
    if (!error) { alert('삭제되었습니다.'); fetchSchedules(); }
  };

  if (loading) return <div>로딩 중...</div>;

  return (
    <div className="admin-unavailable-schedule">
      <h2 className="admin-section-title">예약 불가 일정 관리</h2>
      <ul className="unavailable-schedule-list">
        {unavailableSchedules.map((s) => (
          <li key={s.id}>
             <span>[{s.campus}] {s.reason} ({s.startDate}~)</span>
             <button onClick={() => handleDelete(s.id!)} style={{marginLeft: '10px'}}>삭제</button>
          </li>
        ))}
      </ul>
      <button className="add-unavailable-btn" onClick={() => setShowAddModal(true)}>+</button>
      {showAddModal && (
        <AddUnavailableScheduleModal 
          onClose={() => setShowAddModal(false)} 
          onSubmit={handleAddSubmit} 
        />
      )}
    </div>
  );
};

export default AdminUnavailableSchedule;