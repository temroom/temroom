// src/index.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App'; // App 컴포넌트 임포트
// import { BrowserRouter as Router } from 'react-router-dom'; // App.tsx에서 이미 Router로 감싸므로 제거

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    {/* App.tsx 내부에서 BrowserRouter를 사용하도록 변경했으므로 여기서는 App만 렌더링 */}
    <App />
  </React.StrictMode>
);