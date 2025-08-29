const admin = require('firebase-admin');

// Pastikan inisialisasi Firebase hanya sekali
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

// Handler utama untuk request HTTP
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const sharedSecret = process.env.VERCEL_SHARED_SECRET;
  if (req.headers['x-secret-key'] !== sharedSecret) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const { userId, dataId, type } = req.body;

    if (!userId || !dataId || !type) {
      return res.status(400).json({ error: 'Missing required fields in request body.' });
    }

    // Tentukan payload notifikasi berdasarkan tipe
    let payload = {};
    if (type === 'new_data_input') {
      payload = {
        notification: {
          title: 'Data Identitas Baru Terinput!',
          body: 'Seorang pengguna telah menginput data identitas baru.',
        },
        data: {
          userId: userId,
          documentId: dataId,
          notificationType: 'new_data_input'
        }
      };
    } else if (type === 'new_order') {
      payload = {
        notification: {
          title: 'Pesanan Baru Diterima!',
          body: `Ada pesanan baru dari pengguna dengan ID: ${userId}.`,
        },
        data: {
          userId: userId,
          documentId: dataId,
          notificationType: 'new_order'
        }
      };
    } else {
      // Jika tipe notifikasi tidak dikenali
      return res.status(400).json({ error: 'Unknown notification type.' });
    }

    // Ambil semua token FCM dari pengguna dengan role 'admin'
    const usersRef = admin.firestore().collection('users');
    const querySnapshot = await usersRef.where('role', '==', 'admin').get();
    
    const tokens = [];
    querySnapshot.forEach(doc => {
      const user = doc.data();
      if (user.fcmToken) {
        tokens.push(user.fcmToken);
      }
    });

    // Kirim notifikasi
    if (tokens.length > 0) {
      const response = await admin.messaging().sendEachForMulticast({
          tokens: tokens,
          notification: payload.notification,
          data: payload.data
      });
      console.log('Notifikasi berhasil dikirim. Berhasil:', response.successCount, ', Gagal:', response.failureCount);
    } else {
      console.log('Tidak ada pengguna admin yang terdaftar.');
    }
    
    return res.status(200).json({ success: true, message: 'Notification sent successfully.' });

  } catch (error) {
    console.error('Gagal mengirim notifikasi:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};
