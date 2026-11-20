# CloudHub Lab TI UMPO CLI (`cloudhub-labti-cli`)

Official Command-Line Interface (CLI) untuk ekosistem **CloudHub Lab TI Universitas Muhammadiyah Ponorogo**.

Memungkinkan mahasiswa dan asisten laboratorium menghubungkan terminal lokal komputer pribadi (Windows, macOS, Linux) dan **VS Code Remote SSH** langsung ke dalam isolated container sandbox (`app_{nim}_ssh`) melalui **WebSocket Tunnel Port 443 HTTPS**.

---

## ✨ Fitur Utama
- **Zero Configuration**: Tidak perlu konfigurasi IP publik, VPN Tailscale, atau pembukaan firewall kampus.
- **Tembus Segala Jaringan (Port 443)**: Berjalan di atas protokol WebSocket HTTPS standar yang lolos dari pembatasan Wi-Fi kampus, hotspot seluler, maupun proteksi Cloudflare CDN.
- **Browser-Based Device Flow**: Otentikasi aman tanpa perlu mengetikkan password di terminal. Cukup konfirmasi izin sekali klik di browser web CloudHub.
- **Direct Workspace Mount**: Langsung masuk ke folder kerja `/home/{nim}` yang tersinkronisasi 100% dengan File Manager web.
- **VS Code Remote SSH Support**: Terintegrasi mulus dengan extension Remote SSH Visual Studio Code di laptop pribadi.

---

## 🚀 Penggunaan Instan (via npx)

Anda **tidak perlu** menginstal apapun secara global! Cukup jalankan perintah berikut menggunakan `npx`:

### 1. Login Akun Mahasiswa
```bash
npx github:irhamkaraman/cloudhub-labti-cli login
```
*Browser akan terbuka otomatis. Klik tombol **"Izinkan Akses"** di portal CloudHub untuk menyelesaikan otentikasi.*

### 2. Buka Terminal CloudHub Sandbox
```bash
npx github:irhamkaraman/cloudhub-labti-cli ssh
```
*Terminal Anda akan langsung terhubung ke container Linux mahasiswa dengan hak akses unprivileged aman.*

### 3. Periksa Status Sesi
```bash
npx github:irhamkaraman/cloudhub-labti-cli status
```

---

## 💻 Integrasi VS Code Remote SSH

Tambahkan konfigurasi berikut pada file SSH config Anda (`~/.ssh/config` di macOS/Linux atau `C:\Users\<User>\.ssh\config` di Windows):

```ssh-config
Host cloudhub-labti
    User {nim}
    ProxyCommand npx -y github:irhamkaraman/cloudhub-labti-cli proxy
```

Buka VS Code -> Tekan `F1` -> Pilih **Remote-SSH: Connect to Host...** -> Pilih `cloudhub-labti`. Workspace CloudHub Anda akan langsung terbuka di jendela VS Code lokal!

---

## 🛡️ Lisensi & Hak Cipta
Dikembangkan oleh **Bos Irham Karaman & Laboratorium Teknik Informatika Universitas Muhammadiyah Ponorogo**.  
Lisensi: **MIT**.
