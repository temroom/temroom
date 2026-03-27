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
    // Insert뿐만 아니라 Update 정보도 받아옵니다.
    const { type, table, record: newRecord, old_record: oldRecord } = payload;

    let title = '';
    let body = '';
    let clickUrl = '/';
    let targetUserId = null; // 특정 유저에게만 보낼 때 사용

    // 1. 새로운 예약 신청 (INSERT) -> 관리자에게
    if (table === 'reservations' && type === 'INSERT') {
      title = '새로운 템방 예약 신청!';
      body = `📅 ${newRecord.useDate} ${newRecord.startTime}~${newRecord.endTime}\n👤 신청자: ${newRecord.applicant}`;
      clickUrl = '/';
    } 
    // 2. 새로운 회원가입 (INSERT) -> 관리자에게
    else if (table === 'users' && type === 'INSERT') {
      if (newRecord.role !== 'pending') return new Response('Not a pending user', { status: 200 });
      title = '🔔 새로운 회원가입 신청!';
      body = `👤 학번/이름: ${newRecord.studentInfo}\n관리자 페이지에서 가입을 승인해주세요.`;
      clickUrl = '/admin';
    } 
    // 3. 예약 상태 변경 (UPDATE) -> 해당 신청자에게!
    else if (table === 'reservations' && type === 'UPDATE') {
      if (newRecord.status === 'approved' && oldRecord?.status === 'pending') {
        title = '✅ 예약이 승인되었습니다!';
        body = `📅 ${newRecord.useDate} ${newRecord.startTime}~${newRecord.endTime}\n템방 사용이 확정되었습니다.`;
        clickUrl = '/my-reservations'; // 누르면 마이페이지로 이동!
        targetUserId = newRecord.userId; // ✨ 해당 유저 1명에게만 알림 발송
      } else {
         return new Response('Not an approval update', { status: 200 });
      }
    } else {
      return new Response('Ignored event', { status: 200 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    let query = supabase.from('push_subscriptions').select('*');

    if (targetUserId) {
      // 일반 회원에게 보낼 때: 신청자의 구독 정보만 가져옴
      query = query.eq('user_id', targetUserId);
    } else {
      // 관리자에게 보낼 때: 관리자 권한을 가진 사람들의 구독 정보만 가져옴
      const { data: adminUsers } = await supabase.from('users').select('id').eq('role', 'admin');
      if (!adminUsers || adminUsers.length === 0) return new Response('No admins found', { status: 200 });
      const adminIds = adminUsers.map(u => u.id);
      query = query.in('user_id', adminIds);
    }

    const { data: subscriptions, error } = await query;

    if (error || !subscriptions || subscriptions.length === 0) {
      return new Response('No subscriptions found', { status: 200 });
    }

    const notificationPayload = JSON.stringify({ title, body, url: clickUrl });

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