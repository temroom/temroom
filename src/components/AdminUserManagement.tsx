import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { UserInfo } from '../App'; // App.tsx에서 가져오기

interface AdminUserManagementProps {
  loggedInUserInfo: UserInfo | null;
}

// 사용자 데이터 타입 정의 (DB 테이블 구조에 맞춤)
interface UserData {
  id: string;
  email: string;
  studentInfo: string;
  role: string;
  created_at: string;
}

const AdminUserManagement: React.FC<AdminUserManagementProps> = ({ loggedInUserInfo }) => {
  const [users, setUsers] = useState<UserData[]>([]);
  // ✅ 여기서 타입을 명시해줍니다.
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      // 관리자 상단 정렬 로직 등...
      setUsers(data as UserData[]);
    }
  };

  // ... (나머지 핸들러 함수들) ...

  const handleUserClick = (user: UserData) => {
    // ✅ 타입이 명시되었으므로 prev 에러가 사라집니다.
    setSelectedUser((prev) => (prev?.id === user.id ? null : user));
  };

  return (
    // ... (JSX 리턴 부분) ...
    <div className="list-container">
      {/* ... 리스트 렌더링 ... */}
    </div>
  );
};

export default AdminUserManagement;