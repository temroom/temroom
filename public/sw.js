// public/sw.js

// 1. 푸시 알림을 받았을 때 실행되는 이벤트
self.addEventListener('push', function(event) {
  if (event.data) {
    // 서버(Supabase)에서 보낸 데이터(JSON)를 해독합니다.
    const data = event.data.json();
    
    // 알림의 모양과 동작 설정
    const options = {
      body: data.body,
      icon: '/favicon.ico', // 알림에 뜰 동아리 로고 아이콘 (public 폴더 기준)
      badge: '/favicon.ico', // 안드로이드 상단바에 뜰 작은 아이콘
      vibrate: [200, 100, 200], // 진동 패턴 (징~ 징~)
      data: {
        url: data.url || '/' // 알림을 눌렀을 때 이동할 주소
      }
    };

    // 핸드폰 화면에 알림을 띄웁니다!
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// 2. 사용자가 뜬 알림을 터치(클릭)했을 때 실행되는 이벤트
self.addEventListener('notificationclick', function(event) {
  event.notification.close(); // 일단 알림창을 닫습니다.

  // 알림에 저장해둔 URL(예: 메인 화면)로 웹브라우저를 엽니다.
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});