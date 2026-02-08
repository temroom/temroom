import React, { useState } from 'react';
import '../styles/AddUnavailableScheduleModal.css'; // 모달 전용 CSS 파일

interface UnavailableScheduleData {
  reason: string;
  campus: '인캠' | '경캠' | '';
  startDate: string; //YYYY-MM-DD
  endDate: string;   //YYYY-MM-DD
  frequencyType: 'once' | 'weekly' | 'monthly_by_week_day' | '';
  dayOfWeek?: number; // 0 (일요일) - 6 (토요일)
  weekOfMonth?: number; // 1 (첫째 주) - 4 (넷째 주), 5 (마지막 주)
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
}

interface AddUnavailableScheduleModalProps {
  onClose: () => void;
  onSubmit: (data: UnavailableScheduleData) => void;
}

const AddUnavailableScheduleModal: React.FC<AddUnavailableScheduleModalProps> = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState<UnavailableScheduleData>({
    reason: '',
    campus: '',
    startDate: '',
    endDate: '',
    frequencyType: '',
    startTime: '',
    endTime: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFrequencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = e.target;
    setFormData(prev => ({
      ...prev,
      frequencyType: value as 'once' | 'weekly' | 'monthly_by_week_day' | '',
      dayOfWeek: undefined, // 빈도 타입 변경 시 초기화
      weekOfMonth: undefined, // 빈도 타입 변경 시 초기화
    }));
  };

  const handleDayOfWeekChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, dayOfWeek: parseInt(e.target.value, 10) }));
  };

  const handleWeekOfMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, weekOfMonth: parseInt(e.target.value, 10) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.reason || !formData.campus || !formData.startDate || !formData.endDate || !formData.frequencyType || !formData.startTime || !formData.endTime) {
      alert('모든 필수 항목을 입력해주세요.');
      return;
    }

    if (formData.frequencyType === 'weekly' && formData.dayOfWeek === undefined) {
      alert('요일을 선택해주세요.');
      return;
    }

    if (formData.frequencyType === 'monthly_by_week_day' && (formData.dayOfWeek === undefined || formData.weekOfMonth === undefined)) {
      alert('주차와 요일을 선택해주세요.');
      return;
    }

    onSubmit(formData);
    onClose();
  };

  const dayOfWeekOptions = ['일', '월', '화', '수', '목', '금', '토'];
  const weekOfMonthOptions = ['첫째', '둘째', '셋째', '넷째', '마지막'];

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="modal-close-btn" onClick={onClose}>×</button>
        <h2>예약 불가 일정 추가</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="reason">사유:</label>
            <input type="text" id="reason" name="reason" value={formData.reason} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label htmlFor="campus">캠퍼스:</label>
            <select id="campus" name="campus" value={formData.campus} onChange={handleChange} required>
              <option value="">선택</option>
              <option value="인캠">인캠</option>
              <option value="경캠">경캠</option>
            </select>
          </div>

          <div className="form-group date-range">
            <label>기간:</label>
            <input type="date" id="startDate" name="startDate" value={formData.startDate} onChange={handleChange} required />
            <span> ~ </span>
            <input type="date" id="endDate" name="endDate" value={formData.endDate} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label htmlFor="frequencyType">빈도:</label>
            <select id="frequencyType" name="frequencyType" value={formData.frequencyType} onChange={handleFrequencyChange} required>
              <option value="">선택</option>
              <option value="once">단일 (1회성)</option>
              <option value="weekly">매주</option>
              <option value="monthly_by_week_day">매달 특정 요일</option>
            </select>
          </div>

          {formData.frequencyType === 'weekly' && (
            <div className="form-group">
              <label htmlFor="dayOfWeek">요일:</label>
              <select id="dayOfWeek" name="dayOfWeek" value={formData.dayOfWeek ?? ''} onChange={handleDayOfWeekChange} required>
                <option value="">선택</option>
                {dayOfWeekOptions.map((day, idx) => (
                  <option key={idx} value={idx}>{day}</option>
                ))}
              </select>
            </div>
          )}

          {formData.frequencyType === 'monthly_by_week_day' && (
            <div className="form-group">
              <label htmlFor="weekOfMonth">주차:</label>
              <select id="weekOfMonth" name="weekOfMonth" value={formData.weekOfMonth ?? ''} onChange={handleWeekOfMonthChange} required>
                <option value="">선택</option>
                {weekOfMonthOptions.map((week, idx) => (
                  <option key={idx} value={idx + 1}>{week}</option>
                ))}
              </select>
              <label htmlFor="dayOfWeek">요일:</label>
              <select id="dayOfWeek" name="dayOfWeek" value={formData.dayOfWeek ?? ''} onChange={handleDayOfWeekChange} required>
                <option value="">선택</option>
                {dayOfWeekOptions.map((day, idx) => (
                  <option key={idx} value={idx}>{day}</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group time-slot">
            <label>시간대:</label>
            <input type="time" id="startTime" name="startTime" value={formData.startTime} onChange={handleChange} required />
            <span> ~ </span>
            <input type="time" id="endTime" name="endTime" value={formData.endTime} onChange={handleChange} required />
          </div>

          <div className="modal-buttons"> {/* 버튼들을 감싸는 div 추가 */}
            <button type="submit" className="submit-btn">추가</button>
            <button type="button" className="exit-btn" onClick={onClose}>나가기</button> {/* 나가기 버튼 추가 */}
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddUnavailableScheduleModal;
