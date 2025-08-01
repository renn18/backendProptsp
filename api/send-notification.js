const admin = require('firebase-admin');

// Pastikan inisialisasi Firebase hanya sekali
if (!admin.apps.length) {
  // Ambil kredensial dari Environment Variable
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

// Handler utama untuk request HTTP
module.exports = async (req, res) => {
  // Hanya proses request POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Tambahkan validasi sederhana untuk keamanan (opsional tapi disarankan)
  const sharedSecret = process.env.VERCEL_SHARED_SECRET;
  if (req.headers['x-secret-key'] !== sharedSecret) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const { userId, dataId } = req.body;

    if (!userId || !dataId) {
      return res.status(400).json({ error: 'Missing userId or dataId in request body.' });
    }

    // Ambil semua token FCM dari pengguna dengan role 'Tim Teknis'
    const usersRef = admin.firestore().collection('users');
    const querySnapshot = await usersRef.where('role', '==', 'admin').get();
    
    const tokens = [];
    querySnapshot.forEach(doc => {
        const user = doc.data();
        if (user.fcmToken) {
            tokens.push(user.fcmToken);
        }
    });

    // Buat payload notifikasi
    const payload = {
      notification: {
        title: 'Data Identitas Baru Terinput!',
        body: 'Seorang pengguna telah menginput data identitas baru.',
      },
      data: {
        userId: userId,
        documentId: dataId,
      }
    };

    // Kirim notifikasi
    if (tokens.length > 0) {
      await admin.messaging().sendToDevice(tokens, payload);
      console.log('Notifikasi berhasil dikirim ke', tokens.length, 'perangkat');
    } else {
      console.log('Tidak ada pengguna Tim Teknis yang terdaftar.');
    }
    
    return res.status(200).json({ success: true, message: 'Notification sent successfully.' });

  } catch (error) {
    console.error('Gagal mengirim notifikasi:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};