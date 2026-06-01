importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyBanBBtS727fWh3S_-cjkZVzuuCzMkA-Kw",
  authDomain: "atrail-86953.firebaseapp.com",
  projectId: "atrail-86953",
  storageBucket: "atrail-86953.firebasestorage.app",
  messagingSenderId: "164978076287",
  appId: "1:164978076287:web:6e50aa0fda6799c9e92d4a",
  measurementId: "G-HR20LSFBZV"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload?.notification?.title || 'New Notification';
  const notificationOptions = {
    body: payload?.notification?.body || 'You have a new message.',
    icon: '/icon.png' // Make sure you have an icon.png in public folder
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
