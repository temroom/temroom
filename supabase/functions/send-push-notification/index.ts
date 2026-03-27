import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const publicVapidKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
const privateVapidKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

webpush.setVapidDetails(
  'mailto:admin@temroom.com',
  publicVapidKey,
  privateVapidKey
);

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const newRecord = payload.record;
    const table = payload.table; // 어느 테이블에서 알림이 왔는지 확인

    // 새로 데이터가 추가(INSERT)된 것이 아니면 무시
    if (payload.type !== 'INSERT') {
      return new Response('Not an insert event', { status: 200 });
    }

    let title = '';
    let body = '';
    let clickUrl = '/';

    // 🌟 [추가된 로직] 테이블 이름에 따라 알림 내용을 다르게 설정합니다.
    if (table === 'reservations') {
      title = '새로운 템방 예약 신청!';
      body = `📅 ${newRecord.useDate} ${newRecord.startTime}~${newRecord.endTime}\n👤 신청자: ${newRecord.applicant}`;
      clickUrl = '/'; 
    } else if (table === 'users') {
      // 회원가입이지만, 대기 상태(pending)가 아니면 알림 생략
      if (newRecord.role !== 'pending') {
         return new Response('Not a pending user', { status: 200 });
      }
      title = '🔔 새로운 회원가입 신청!';
      body = `👤 학번/이름: ${newRecord.studentInfo}\n관리자 페이지에서 가입을 승인해주세요.`;
      clickUrl = '/admin'; // 알림을 누르면 곧바로 관리자 페이지로 이동!
    } else {
      return new Response('Unknown table', { status: 200 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: subscriptions, error } = await supabase.from('push_subscriptions').select('*');

    if (error || !subscriptions || subscriptions.length === 0) {
      return new Response('No subscriptions found', { status: 200 });
    }

    const notificationPayload = JSON.stringify({
      title: title,
      body: body,
      url: clickUrl
    });

    const sendPromises = subscriptions.map((sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth }
      };
      
      return webpush.sendNotification(pushSubscription, notificationPayload)
        .catch(async (err) => {
          if (err.statusCode === 404 || err.statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          }
        });
    });

    await Promise.all(sendPromises);

    return new Response(JSON.stringify({ message: 'Push sent' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    return new Response(String(err), { status: 500 });
  }
});