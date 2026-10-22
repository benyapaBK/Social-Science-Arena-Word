# Social Science Arena

เกมคำศัพท์ทางสังคมศาสตร์แบบเว็บหน้าเดียว

## Deploy ด้วย GitHub และ Firebase Hosting

การตั้งค่านี้ deploy เว็บขึ้น Firebase Hosting อัตโนมัติเมื่อ push โค้ดไปยัง branch `main`

1. สร้าง GitHub repository ใหม่โดยยังไม่ต้องเพิ่ม README
2. สร้าง Google Cloud service account สำหรับ deploy และกำหนด role `Firebase Hosting Admin` ให้กับบัญชีนั้น จากนั้นสร้างและดาวน์โหลด JSON key
3. ใน GitHub repository ไปที่ **Settings → Secrets and variables → Actions → New repository secret** ตั้งชื่อ secret เป็น `FIREBASE_SERVICE_ACCOUNT_SOCIAL_SCIENCE_ARENA_WORD` แล้วใส่เนื้อหาทั้งหมดจากไฟล์ JSON key ห้าม commit หรือเผยแพร่ไฟล์ key นี้
4. เปิด PowerShell ในโฟลเดอร์โปรเจกต์ แล้วใช้คำสั่งต่อไปนี้ โดยแทน `<username>` และ `<repository>` ด้วยชื่อผู้ใช้ GitHub และชื่อ repository ของคุณ:

   ```powershell
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<username>/<repository>.git
   git push -u origin main
   ```

5. เปิดแท็บ **Actions** ใน GitHub repository เพื่อติดตาม workflow **Deploy to Firebase Hosting** เมื่อทำงานสำเร็จ เว็บไซต์จะอยู่ที่ <https://social-science-arena-word.web.app>

เมื่อแก้ไขเว็บในครั้งต่อไป ใช้ `git add .`, `git commit -m "Update website"` และ `git push` เพื่อ deploy เวอร์ชันใหม่อัตโนมัติ

การ deploy ด้วย Firebase CLI จากเครื่องที่ลงชื่อเข้า Firebase แล้ว:

```powershell
firebase deploy --only hosting --project social-science-arena-word
```

ไฟล์ QR อยู่ที่ `social_science_arena_fairytale_assets/website-qr-code.png` และแสดงอยู่ในกรอบ QR ทั้งหน้าแนะนำและหน้าขยาย

ไฟล์กำหนดค่า Web SDK (`apiKey`, `authDomain` และอื่น ๆ) ไม่จำเป็นสำหรับ Firebase Hosting และยังไม่ถูกเพิ่มลงในหน้าเว็บ เพราะเกมปัจจุบันยังไม่ได้เรียกใช้ Firebase Authentication, Firestore หรือบริการ Firebase อื่น ๆ
