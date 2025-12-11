const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

const app = express();
const PORT = process.env.PORT || 3000;
const ADDRESS = process.env.ADDRESS || 'http://localhost';
const BASE_URL = `${ADDRESS}:${PORT}`;

app.use(cors());
app.use(express.json());

// DB bağlantısı
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

console.log('PostgreSQL bağlantı havuzu oluşturuldu.');

// MIDDLEWARE

// Token doğrulama
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    return res.status(401).json({ message: 'Yetkisiz: Token gerekli.' });
  }

  jwt.verify(token, JWT_SECRET, (err, userPayload) => {
    if (err) {
      return res.status(403).json({ message: 'Geçersiz Token.' });
    }
    req.user = userPayload;
    next();
  });
}

// Yetki kontrolü (çoklu yetki desteği)
function checkRole(requiredYetkiler) {
  return (req, res, next) => {
    const userYetkiler = req.user.yetkiler || [];
    const hasPermission = requiredYetkiler.some(yetki => userYetkiler.includes(yetki));

    if (!hasPermission) {
      return res.status(403).json({ message: 'Yetersiz yetki: Bu işlemi yapamazsınız.' });
    }
    next();
  }
}

// Giriş
app.post('/auth/login', async (req, res) => {
  try {
    const { sicil, sifre } = req.body;
    if (!sicil || !sifre) return res.status(400).json({ message: 'Sicil ve şifre zorunludur.' });

    const userResult = await pool.query(
      'SELECT * FROM portal_user WHERE sicil = $1 AND is_delete = false',
      [sicil]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Kullanıcı bulunamadı veya pasif.' });
    }

    const user = userResult.rows[0];
    if (sifre !== user.password) {
      return res.status(401).json({ message: 'Hatalı şifre.' });
    }

    // Kullanıcının yetkilerini gk_yetkilendirme tablosundan çek
    const yetkilerResult = await pool.query(
      `SELECT array_agg(gyl.rol_adi) as yetkiler
       FROM gk_yetkilendirme gy
       JOIN gk_yetki_list gyl ON gy.rol_id = gyl.id
       WHERE gy.user_id = $1`,
      [user.id]
    );

    const yetkiler = yetkilerResult.rows[0]?.yetkiler || [];
    const yetki = yetkiler.length > 0 ? yetkiler[0] : 'kullanici';

    const token = jwt.sign(
      { id: user.id, yetki: yetki, yetkiler: yetkiler, isim: user.user_name },
      JWT_SECRET,
      { expiresIn: '10h' }
    );

    res.json({
      message: 'Giriş başarılı!',
      token: token,
      user: {
        id: user.id,
        sicil: user.sicil,
        isim: user.user_name,
        rol: user.rol,
        yetki: yetki,
        yetkiler: yetkiler
      }
    });
  } catch (err) {
    console.error('Login hatası:', err);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// Departmanlar
app.get('/api/departmanlar', authenticateToken, async (req, res) => {
  try {
    const departmanResult = await pool.query('SELECT id, departman_adi as name FROM portal_departman ORDER BY departman_adi ASC');
    res.json(departmanResult.rows);
  } catch (err) {
    console.error('Departmanlar alınırken hata:', err);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// DUYURU İŞLEMLERİ

// Duyuru Listesi (Çoklu departman desteği ile)
app.get('/api/duyurular', authenticateToken, async (req, res) => {
  try {
    const { durum } = req.query;
    const kullaniciId = req.user.id;

    // Yönetici yetkisi kontrolü
    const privilegedYetkiler = ['admin', 'duyuru_yonetimi', 'duyuru_raporlama'];
    const userYetkiler = req.user.yetkiler || [];
    const isPrivileged = privilegedYetkiler.some(yetki => userYetkiler.includes(yetki));

    let query = `
      SELECT D.*, U.user_name as olusturan_isim,
             CASE WHEN O.kullanici_id IS NOT NULL THEN true ELSE false END AS okundu,
             (
               SELECT COALESCE(json_agg(json_build_object('id', Dep.id, 'departman_adi', Dep.departman_adi)), '[]'::json)
               FROM portal_duyuru_birim DB
               JOIN portal_departman Dep ON DB.department_id = Dep.id
               WHERE DB.duyuru_id = D.id
             ) as departmanlar
      FROM portal_duyuru D
      LEFT JOIN portal_user U ON D.created_by = U.id
      LEFT JOIN portal_duyuru_user O ON D.id = O.duyuru_id AND O.kullanici_id = $1
      WHERE D.is_delete = false
    `;

    const queryParams = [kullaniciId];

    // Durum filtresi
    if (durum === 'guncel') {
      query += ` AND (D.duyuru_bitis_tarihi IS NULL OR D.duyuru_bitis_tarihi >= NOW())`;
    } else if (durum === 'gecmis') {
      query += ` AND D.duyuru_bitis_tarihi IS NOT NULL AND D.duyuru_bitis_tarihi < NOW()`;
    }

    // Yetkisiz kullanıcı sadece kendi departmanındaki duyuruları görsün
    if (!isPrivileged) {
      query += ` AND EXISTS (
        SELECT 1
        FROM portal_duyuru_birim DB
        INNER JOIN portal_departman_users PDU ON DB.department_id = PDU.department_id
        INNER JOIN portal_user PU ON PDU.sicil = PU.sicil
        WHERE DB.duyuru_id = D.id
          AND PU.id = $1
          AND PDU.is_delete = false
          AND PDU.is_active = true
      )`;
    }

    query += ` ORDER BY D.oncelik DESC, D.duyuru_baslangic_tarihi DESC`;

    const duyuruListResult = await pool.query(query, queryParams);

    // Boolean'a dönüştür
    const duyurular = duyuruListResult.rows.map(row => ({
      ...row,
      okundu: row.okundu === true || row.okundu === 't' || row.okundu === 'true'
    }));

    res.json(duyurular);
  } catch (err) {
    console.error('Duyurular alınırken hata:', err);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// Yeni duyuru (Çoklu departman)
app.post('/api/duyurular', authenticateToken, checkRole(['admin', 'duyuru_yonetimi']), async (req, res) => {
  const client = await pool.connect();

  try {
    const { baslik, aciklama, oncelik, departmanlar, duyuru_baslangic_tarihi, duyuru_bitis_tarihi } = req.body;
    const created_by = req.user.id;

    if (!baslik || !aciklama || !oncelik) {
      return res.status(400).json({ message: 'Başlık, açıklama ve öncelik zorunludur.' });
    }

    if (!departmanlar || !Array.isArray(departmanlar) || departmanlar.length === 0) {
      return res.status(400).json({ message: 'En az bir departman seçilmelidir.' });
    }

    await client.query('BEGIN');

    const createDuyuruResult = await client.query(
      `INSERT INTO portal_duyuru (baslik, aciklama, oncelik, created_by, duyuru_baslangic_tarihi, duyuru_bitis_tarihi)
       VALUES ($1, $2, $3, $4, COALESCE($5, NOW()), $6)
       RETURNING id`,
      [baslik, aciklama, oncelik, created_by, duyuru_baslangic_tarihi, duyuru_bitis_tarihi]
    );

    const duyuruId = createDuyuruResult.rows[0].id;

    // Departmanları ekle
    for (const deptId of departmanlar) {
      await client.query(
        'INSERT INTO portal_duyuru_birim (duyuru_id, department_id) VALUES ($1, $2)',
        [duyuruId, deptId]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Duyuru başarıyla oluşturuldu!', duyuruId });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Duyuru oluşturulurken hata:', err);
    res.status(500).json({ message: 'Sunucu hatası' });
  } finally {
    client.release();
  }
});

// Duyuru Güncelle (Çoklu departman)
app.put('/api/duyurular/:id', authenticateToken, checkRole(['admin', 'duyuru_yonetimi']), async (req, res) => {
  const client = await pool.connect();

  try {
    const duyuruId = parseInt(req.params.id, 10);
    const { baslik, aciklama, oncelik, departmanlar, duyuru_baslangic_tarihi, duyuru_bitis_tarihi } = req.body;

    if (!baslik || !aciklama || !oncelik) {
      return res.status(400).json({ message: 'Başlık, açıklama ve öncelik zorunludur.' });
    }

    await client.query('BEGIN');

    // Duyuruyu güncelle
    const updateResult = await client.query(
      `UPDATE portal_duyuru
       SET baslik = $1, aciklama = $2, oncelik = $3,
           duyuru_baslangic_tarihi = $4, duyuru_bitis_tarihi = $5,
           guncellenme_tarihi = NOW()
       WHERE id = $6`,
      [baslik, aciklama, oncelik, duyuru_baslangic_tarihi, duyuru_bitis_tarihi, duyuruId]
    );

    if (updateResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Duyuru bulunamadı.' });
    }

    // Departmanları güncelle
    if (departmanlar && Array.isArray(departmanlar)) {
      // Mevcut departmanları sil
      await client.query('DELETE FROM portal_duyuru_birim WHERE duyuru_id = $1', [duyuruId]);

      // Yeni departmanları ekle
      for (const deptId of departmanlar) {
        await client.query(
          'INSERT INTO portal_duyuru_birim (duyuru_id, department_id) VALUES ($1, $2)',
          [duyuruId, deptId]
        );
      }
    }

    await client.query('COMMIT');
    res.status(200).json({ message: 'Duyuru başarıyla güncellendi.' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Duyuru güncellenirken hata:', err);
    res.status(500).json({ message: 'Sunucu hatası' });
  } finally {
    client.release();
  }
});

// Duyuru Sil
app.patch('/api/duyurular/:id/delete', authenticateToken, checkRole(['admin', 'duyuru_yonetimi']), async (req, res) => {
  try {
    const { id } = req.params;
    const deleteResult = await pool.query('UPDATE portal_duyuru SET is_delete = true WHERE id = $1', [id]);

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ message: 'Duyuru bulunamadı.' });
    }

    res.status(200).json({ message: 'Duyuru başarıyla silindi.' });
  } catch (err) {
    console.error('Duyuru silinirken hata:', err);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// Duyuruyu Oku
app.post('/api/duyurular/:id/oku', authenticateToken, async (req, res) => {
  try {
    const duyuruId = parseInt(req.params.id, 10);
    const kullaniciId = req.user.id;

    if (isNaN(duyuruId)) {
      return res.status(400).json({ message: 'Geçersiz duyuru ID' });
    }

    await pool.query(
      `INSERT INTO portal_duyuru_user (duyuru_id, kullanici_id, okunma_tarihi)
       VALUES ($1, $2, NOW())
       ON CONFLICT (kullanici_id, duyuru_id) DO NOTHING`,
      [duyuruId, kullaniciId]
    );

    res.status(200).json({ message: 'Duyuru okundu olarak işaretlendi.' });
  } catch (err) {
    console.error('Duyuru okunurken hata:', err);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// RAPORLAR

// Genel İstatistikler
app.get('/api/raporlar/genel-istatistikler', authenticateToken, checkRole(['admin', 'duyuru_raporlama']), async (req, res) => {
  try {
    const duyuruResult = await pool.query('SELECT COUNT(id) as toplam_duyuru FROM portal_duyuru WHERE is_delete = false');
    const okumaResult = await pool.query('SELECT COUNT(id) as toplam_okunma FROM portal_duyuru_user');

    res.json({
      toplamDuyuru: parseInt(duyuruResult.rows[0].toplam_duyuru),
      toplamOkunma: parseInt(okumaResult.rows[0].toplam_okunma)
    });
  } catch (err) {
    console.error('Genel istatistikler alınırken hata:', err);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// Duyuru Listesi Raporu
app.get('/api/raporlar/duyuru-listesi', authenticateToken, checkRole(['admin', 'duyuru_raporlama']), async (req, res) => {
  try {
    const duyuruListesiResult = await pool.query(
      `SELECT
         D.id, D.baslik, D.oncelik, D.duyuru_baslangic_tarihi, D.duyuru_bitis_tarihi,
         U.user_name AS olusturan_isim,
         (SELECT COUNT(O.id) FROM portal_duyuru_user O WHERE O.duyuru_id = D.id) as okunma_sayisi,
         (
           SELECT COALESCE(json_agg(json_build_object('id', Dep.id, 'departman_adi', Dep.departman_adi)), '[]'::json)
           FROM portal_duyuru_birim DB
           JOIN portal_departman Dep ON DB.department_id = Dep.id
           WHERE DB.duyuru_id = D.id
         ) as departmanlar
       FROM portal_duyuru D
       LEFT JOIN portal_user U ON D.created_by = U.id
       WHERE D.is_delete = false
       GROUP BY D.id, D.baslik, D.oncelik, D.duyuru_baslangic_tarihi, D.duyuru_bitis_tarihi, U.user_name
       ORDER BY okunma_sayisi DESC`
    );

    const listesi = duyuruListesiResult.rows.map(item => ({
      ...item,
      okunmaSayisi: parseInt(item.okunma_sayisi),
      duyuru_tarihi: item.duyuru_baslangic_tarihi  // Frontend compatibility
    }));

    res.json(listesi);
  } catch (err) {
    console.error('Duyuru listesi raporu alınırken hata:', err);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// Okuma Detayları
app.get('/api/raporlar/okuma-detaylari/:id', authenticateToken, checkRole(['admin', 'duyuru_raporlama']), async (req, res) => {
  try {
    const duyuruId = parseInt(req.params.id, 10);
    if (isNaN(duyuruId)) return res.status(400).json({ message: 'Geçersiz duyuru ID' });

    const okumaDetaylariResult = await pool.query(
      `SELECT
        K.sicil, K.user_name as isim,
        O.okunma_tarihi
      FROM portal_duyuru_user O
      JOIN portal_user K ON O.kullanici_id = K.id
      WHERE O.duyuru_id = $1 AND K.is_delete = false
      ORDER BY O.okunma_tarihi DESC`,
      [duyuruId]
    );

    res.json(okumaDetaylariResult.rows);
  } catch (err) {
    console.error(`Okuma detayları (${req.params.id}) alınırken hata:`, err);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// Kullanıcı Aktiviteleri
app.get('/api/kullanici/aktiviteler', authenticateToken, async (req, res) => {
  try {
    const kullaniciId = req.user.id;

    const aktivitelerResult = await pool.query(
      `SELECT
        O.duyuru_id,
        O.okunma_tarihi,
        D.baslik,
        D.aciklama,
        D.oncelik,
        (
          SELECT COALESCE(json_agg(json_build_object('id', Dep.id, 'departman_adi', Dep.departman_adi)), '[]'::json)
          FROM portal_duyuru_birim DB
          JOIN portal_departman Dep ON DB.department_id = Dep.id
          WHERE DB.duyuru_id = D.id
        ) as departmanlar
      FROM portal_duyuru_user O
      JOIN portal_duyuru D ON O.duyuru_id = D.id
      WHERE O.kullanici_id = $1 AND D.is_delete = false
      ORDER BY O.okunma_tarihi DESC
      LIMIT 50`,
      [kullaniciId]
    );

    res.json(aktivitelerResult.rows);
  } catch (err) {
    console.error('Kullanıcı aktiviteleri alınırken hata:', err);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// Kullanıcı Aktiviteleri Detay
app.get('/api/duyurular/kullanici-aktiviteleri', authenticateToken, async (req, res) => {
  try {
    const kullaniciId = req.user.id;

    const kullaniciAktiviteleriResult = await pool.query(
      `SELECT
        D.id, D.baslik, D.aciklama, D.oncelik,
        D.duyuru_baslangic_tarihi,
        D.duyuru_bitis_tarihi,
        U.user_name AS olusturan_isim,
        O.okunma_tarihi,
        true AS okundu,
        (
          SELECT COALESCE(json_agg(json_build_object('id', Dep.id, 'departman_adi', Dep.departman_adi)), '[]'::json)
          FROM portal_duyuru_birim DB
          JOIN portal_departman Dep ON DB.department_id = Dep.id
          WHERE DB.duyuru_id = D.id
        ) as departmanlar
      FROM portal_duyuru_user O
      JOIN portal_duyuru D ON O.duyuru_id = D.id
      LEFT JOIN portal_user U ON D.created_by = U.id
      WHERE O.kullanici_id = $1 AND D.is_delete = false
      ORDER BY O.okunma_tarihi DESC`,
      [kullaniciId]
    );

    res.json(kullaniciAktiviteleriResult.rows);
  } catch (err) {
    console.error('Kullanıcı aktiviteleri alınırken hata:', err);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// SUNUCU BASLATMA

app.listen(PORT, () => {
  console.log(`Sunucu ${BASE_URL} adresinde başlatıldı.`);
});
