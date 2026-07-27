import os
from fpdf import FPDF

class VisualPresentationPDF(FPDF):
    def __init__(self):
        super().__init__(orientation='L', unit='mm', format='A4') # 297mm x 210mm
        self.set_auto_page_break(auto=True, margin=10)

    def header(self):
        if self.page_no() not in [1, 19]:
            # Top Header Bar
            self.set_fill_color(15, 23, 42)
            self.rect(0, 0, 297, 14, style='F')
            
            # Red Accent Line
            self.set_fill_color(220, 38, 38)
            self.rect(0, 13.2, 297, 1.2, style='F')

            self.set_y(3.5)
            self.set_x(12)
            self.set_font("Helvetica", "B", 9)
            self.set_text_color(255, 255, 255)
            self.cell(160, 6, "SISTEM OPERASIONAL OUTLET TERINTEGRASI", border=0)

            self.set_font("Helvetica", "B", 8)
            self.set_text_color(248, 113, 113)
            self.cell(113, 6, "Proposal PR/2026/07/001-R2 | 24 Juli 2026", border=0, align="R")
            self.ln(10)

    def footer(self):
        if self.page_no() not in [1, 19]:
            self.set_y(-12)
            self.set_draw_color(226, 232, 240)
            self.set_line_width(0.4)
            self.line(10, 198, 287, 198)

            self.set_font("Helvetica", "", 8)
            self.set_text_color(100, 116, 139)
            self.cell(140, 8, "Proposal Penawaran Bisnis & Presentasi Operasional Outlet Terintegrasi", border=0, align="L")
            self.set_font("Helvetica", "B", 8)
            self.set_text_color(153, 27, 27)
            self.cell(137, 8, f"Slide {self.page_no()} dari 19", border=0, align="R")

def draw_slide_header(pdf, tag, title, sub):
    pdf.set_y(18)
    pdf.set_x(12)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(220, 38, 38)
    pdf.cell(0, 4, f"[ {tag.upper()} ]")
    pdf.ln(4)

    pdf.set_x(12)
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 7, title)
    pdf.ln(7)

    pdf.set_x(12)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(71, 85, 105)
    pdf.cell(0, 5, sub)
    pdf.ln(6)

def draw_badge(pdf, x, y, text, bg_rgb, text_rgb=(255, 255, 255), width=0):
    pdf.set_font("Helvetica", "B", 7.5)
    tw = pdf.get_string_width(text) + 8 if width == 0 else width
    pdf.set_fill_color(*bg_rgb)
    pdf.rect(x, y, tw, 5.5, style='F')
    pdf.set_y(y + 0.8)
    pdf.set_x(x)
    pdf.set_text_color(*text_rgb)
    pdf.cell(tw, 4, text, align="C")

def build_pdf_presentation(output_path):
    pdf = VisualPresentationPDF()

    # ---------------------------------------------------------
    # SLIDE 1: COVER HERO
    # ---------------------------------------------------------
    pdf.add_page()
    # Dark hero background
    pdf.set_fill_color(9, 13, 22)
    pdf.rect(0, 0, 297, 210, style='F')

    # Top red accent bar
    pdf.set_fill_color(220, 38, 38)
    pdf.rect(0, 0, 297, 4, style='F')

    draw_badge(pdf, 100, 35, "PENAWARAN BISNIS OUTLET & F&B", (185, 28, 28), (255, 255, 255), width=97)

    pdf.set_y(46)
    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 10, "SISTEM OPERASIONAL OUTLET TERINTEGRASI", align="C")
    pdf.ln(12)

    pdf.set_font("Helvetica", "", 12)
    pdf.set_text_color(203, 213, 225)
    pdf.cell(0, 6, "Kasir Digital  |  Smart Queue Display  |  Digital Signage  |  Owner Monitoring", align="C")
    pdf.ln(14)

    # Tagline box
    pdf.set_fill_color(15, 23, 42)
    pdf.set_draw_color(220, 38, 38)
    pdf.set_line_width(0.8)
    pdf.rect(48, 102, 201, 16, style='FD')
    pdf.set_y(106)
    pdf.set_font("Helvetica", "I", 10)
    pdf.set_text_color(254, 202, 202)
    pdf.cell(0, 8, '"Satu sistem untuk menghubungkan transaksi, antrean, promosi, dan monitoring bisnis."', align="C")

    # Node cards
    nodes = [("Panel Kasir", "HP / Tablet"), ("Display TV", "Smart TV 16:9"), ("Dashboard Owner", "HP / Laptop / PC")]
    start_x = 20
    card_w = 72
    for i, (n_title, n_sub) in enumerate(nodes):
        x = start_x + i * 88
        pdf.set_fill_color(30, 41, 59)
        pdf.set_draw_color(100, 116, 139)
        pdf.set_line_width(0.5)
        pdf.rect(x, 140, card_w, 20, style='FD')

        pdf.set_y(143)
        pdf.set_x(x)
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(255, 255, 255)
        pdf.cell(card_w, 5, n_title, align="C")
        pdf.ln(5)

        pdf.set_x(x)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(248, 113, 113)
        pdf.cell(card_w, 4, n_sub, align="C")

        if i < 2:
            pdf.set_y(146)
            pdf.set_x(x + card_w + 3)
            pdf.set_font("Helvetica", "B", 14)
            pdf.set_text_color(220, 38, 38)
            pdf.cell(10, 6, "<->", align="C")

    # ---------------------------------------------------------
    # SLIDE 2: SATU SISTEM, TIGA MODUL UTAMA
    # ---------------------------------------------------------
    pdf.add_page()
    draw_slide_header(pdf, "Arsitektur Terpadu", "Satu Sistem, Tiga Modul Utama", "Kasir, Display TV, dan Dashboard Owner menggunakan satu basis data yang saling terhubung.")

    card_w = 88
    card_h = 142
    y_top = 42

    modules = [
        ("01. PANEL KASIR", (185, 28, 28), "HP / Tablet", [
            "Digunakan staf/kasir di toko",
            "Memilih produk & kategori menu",
            "Membuat transaksi pesanan",
            "Memilih pembayaran Tunai / QRIS",
            "Melihat antrean (Waiting/Ready)",
            "Memanggil pesanan ke Display TV",
            "Menyelesaikan pesanan"
        ]),
        ("02. DISPLAY TV", (22, 163, 74), "Smart TV 16:9", [
            "Layar informasi untuk pelanggan",
            "Tampilan nomor antrean besar",
            "Suara panggilan otomatis ('No 005')",
            "Pemutar foto promosi produk",
            "Pemutar video promosi otomatis",
            "Status koneksi sistem real-time",
            "Optimasi penuh layar 16:9"
        ]),
        ("03. DASHBOARD OWNER", (37, 99, 235), "HP / Laptop / PC", [
            "Pusat pemantauan pemilik toko",
            "Ringkasan omzet & total transaksi",
            "Pencatatan HPP & estimasi laba",
            "Perbandingan Tunai vs QRIS",
            "Pengelolaan produk & harga menu",
            "Ringkasan per cabang / outlet",
            "Akses jarak jauh (Paket Cloud)"
        ])
    ]

    for i, (m_title, m_color, m_badge, m_items) in enumerate(modules):
        x = 12 + i * 92
        pdf.set_fill_color(248, 250, 252)
        pdf.set_draw_color(203, 213, 225)
        pdf.rect(x, y_top, card_w, card_h, style='FD')

        pdf.set_fill_color(*m_color)
        pdf.rect(x, y_top, card_w, 12, style='F')

        pdf.set_y(y_top + 3)
        pdf.set_x(x + 4)
        pdf.set_font("Helvetica", "B", 9.5)
        pdf.set_text_color(255, 255, 255)
        pdf.cell(52, 6, m_title, border=0)
        pdf.set_font("Helvetica", "B", 7.5)
        pdf.cell(28, 6, f"[{m_badge}]", border=0, align="R")

        pdf.set_y(y_top + 16)
        pdf.set_font("Helvetica", "", 8.5)
        pdf.set_text_color(51, 65, 85)
        for item in m_items:
            pdf.set_x(x + 6)
            pdf.cell(0, 5.5, f"[v]  {item}")
            pdf.ln(5.5)

    # ---------------------------------------------------------
    # SLIDE 3: CARA KERJA SISTEM
    # ---------------------------------------------------------
    pdf.add_page()
    draw_slide_header(pdf, "Alur Operasional Otomatis", "Cara Kerja Sistem Terintegrasi", "Alur pesanan dari kasir hingga pemantauan pemilik berjalan otomatis tanpa jeda manual.")

    steps = [
        ("1. KASIR MEMBUAT PESANAN", "Kasir memilih produk & metode pembayaran di tablet. Sistem otomatis menghitung total, mencatat transaksi, dan menerbitkan nomor antrean."),
        ("2. PESANAN MASUK DAFTAR ANTREAN", "Pesanan tampil di layar kasir dalam kategori 'Menunggu Diproses' (Waiting). Bar/dapur menyiapkan pesanan sesuai urutan."),
        ("3. PESANAN DIPANGGIL KASIR", "Saat pesanan selesai disiapkan, kasir menekan tombol 'Panggil'. Display TV menampilkan nomor antrean besar & menyuarakan panggilan suara."),
        ("4. DATA TERCATAT KE DASHBOARD OWNER", "Seluruh rincian transaksi, metode pembayaran, status pesanan, dan estimasi keuntungan langsung diperbarui ke Dashboard Pemilik.")
    ]

    y_flow = 42
    for i, (title, desc) in enumerate(steps):
        pdf.set_fill_color(255, 255, 255)
        pdf.set_draw_color(185, 28, 28) if i == 0 else pdf.set_draw_color(203, 213, 225)
        pdf.set_line_width(0.6) if i == 0 else pdf.set_line_width(0.3)
        pdf.rect(12, y_flow, 273, 24, style='FD')

        draw_badge(pdf, 16, y_flow + 4, str(i + 1), (185, 28, 28), width=7)

        pdf.set_y(y_flow + 3)
        pdf.set_x(28)
        pdf.set_font("Helvetica", "B", 9.5)
        pdf.set_text_color(15, 23, 42)
        pdf.cell(0, 5, title)
        pdf.ln(5)

        pdf.set_x(28)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(71, 85, 105)
        pdf.cell(0, 5, desc)

        if i < 3:
            pdf.set_y(y_flow + 24)
            pdf.set_x(12)
            pdf.set_font("Helvetica", "B", 10)
            pdf.set_text_color(220, 38, 38)
            pdf.cell(273, 6, "v", align="C")

        y_flow += 35

    # ---------------------------------------------------------
    # SLIDE 4: FITUR PANEL KASIR (GRAPHICAL MOCKUP)
    # ---------------------------------------------------------
    pdf.add_page()
    draw_slide_header(pdf, "Staf & Kasir Toko", "Fitur Panel Kasir Digital", "Dirancang khusus untuk layar sentuh HP/Tablet agar mudah digunakan staf tanpa pelatihan rumit.")

    # Left graphical mockup tablet frame
    pdf.set_fill_color(15, 23, 42)
    pdf.set_draw_color(51, 65, 85)
    pdf.set_line_width(0.8)
    pdf.rect(12, 42, 135, 140, style='FD')

    # Window control bar
    pdf.set_fill_color(30, 41, 59)
    pdf.rect(12, 42, 135, 10, style='F')
    pdf.set_fill_color(239, 68, 68); pdf.rect(16, 45, 3.5, 3.5, style='F')
    pdf.set_fill_color(245, 158, 11); pdf.rect(21, 45, 3.5, 3.5, style='F')
    pdf.set_fill_color(16, 185, 129); pdf.rect(26, 45, 3.5, 3.5, style='F')

    pdf.set_y(44)
    pdf.set_x(32)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(203, 213, 225)
    pdf.cell(0, 5, "PANEL KASIR DIGITAL (TABLET / HP)")

    # Category Bar
    pdf.set_fill_color(30, 41, 59)
    pdf.rect(16, 56, 127, 8, style='F')
    pdf.set_y(57.5)
    pdf.set_x(20)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(96, 165, 250)
    pdf.cell(60, 5, "Kategori: [ Minuman Kopi ]")
    pdf.set_text_color(74, 222, 128)
    pdf.cell(59, 5, "Outlet: Utama", align="R")

    # Item Cards
    items = [("1. Kopi Susu Aren", "Qty: 2", "Rp 36.000"), ("2. Americano Ice", "Qty: 1", "Rp 15.000")]
    y_it = 68
    for name, qty, price in items:
        pdf.set_fill_color(30, 41, 59)
        pdf.rect(16, y_it, 127, 10, style='F')
        pdf.set_y(y_it + 2.5)
        pdf.set_x(20)
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(255, 255, 255)
        pdf.cell(60, 5, name)
        pdf.set_font("Helvetica", "", 7.5)
        pdf.set_text_color(148, 163, 184)
        pdf.cell(25, 5, qty)
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(74, 222, 128)
        pdf.cell(34, 5, price, align="R")
        y_it += 13

    # Total & QRIS Box
    pdf.set_fill_color(30, 41, 59)
    pdf.rect(16, 96, 127, 12, style='F')
    pdf.set_y(99)
    pdf.set_x(20)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(60, 6, "Total: Rp 51.000")
    draw_badge(pdf, 100, 99.5, "QRIS", (245, 158, 11), (15, 23, 42), width=39)

    # Big Action Button
    pdf.set_fill_color(220, 38, 38)
    pdf.rect(16, 114, 127, 14, style='F')
    pdf.set_y(118)
    pdf.set_x(16)
    pdf.set_font("Helvetica", "B", 9.5)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(127, 6, "+ BUAT ANTREAN NO. 014", align="C")

    # Queue Status Section
    pdf.set_fill_color(30, 41, 59)
    pdf.rect(16, 134, 127, 40, style='F')
    pdf.set_y(137)
    pdf.set_x(20)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(248, 113, 113)
    pdf.cell(0, 5, "STATUS ANTREAN TOKO:")
    pdf.ln(5)

    draw_badge(pdf, 20, 145, "WAITING", (245, 158, 11), (15, 23, 42), width=22)
    pdf.set_y(145)
    pdf.set_x(45)
    pdf.set_font("Helvetica", "", 7.5)
    pdf.set_text_color(203, 213, 225)
    pdf.cell(0, 5, "No. 012, 013 (Dalam Proses Bar)")

    draw_badge(pdf, 20, 153, "READY", (22, 163, 74), (255, 255, 255), width=22)
    pdf.set_y(153)
    pdf.set_x(45)
    pdf.set_font("Helvetica", "", 7.5)
    pdf.set_text_color(203, 213, 225)
    pdf.cell(0, 5, "No. 010, 011 (Siap Diambil)")

    pdf.set_y(162)
    pdf.set_x(20)
    pdf.set_font("Helvetica", "I", 7.5)
    pdf.set_text_color(96, 165, 250)
    pdf.cell(0, 5, "* Tombol Panggil -> Otomatis kirim sinyal suara ke Display TV")

    # Right Features Grid
    features = [
        ("Pemilihan Menu", "Navigasi per kategori produk."),
        ("Keranjang Pesanan", "Cek rincian item & kuantitas."),
        ("Tunai & QRIS", "Pilihan pembayaran instan."),
        ("Pengelolaan Antrean", "Status Waiting & Ready terpisah."),
        ("Panggil & Selesaikan", "Suara panggilan ke TV."),
        ("Responsif HP/Tablet", "Optimal di Android / iPad.")
    ]

    y_grid = 42
    for i, (ft_t, ft_d) in enumerate(features):
        x = 153 if i % 2 == 0 else 222
        if i % 2 == 0 and i > 0:
            y_grid += 45

        pdf.set_fill_color(248, 250, 252)
        pdf.set_draw_color(203, 213, 225)
        pdf.set_line_width(0.4)
        pdf.rect(x, y_grid, 63, 40, style='FD')

        pdf.set_y(y_grid + 5)
        pdf.set_x(x + 4)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(15, 23, 42)
        pdf.cell(55, 5, ft_t)
        pdf.ln(6)

        pdf.set_x(x + 4)
        pdf.set_font("Helvetica", "", 7.5)
        pdf.set_text_color(71, 85, 105)
        pdf.multi_cell(55, 4, ft_d)

    # ---------------------------------------------------------
    # SLIDE 5: SMART QUEUE DISPLAY + DIGITAL SIGNAGE
    # ---------------------------------------------------------
    pdf.add_page()
    draw_slide_header(pdf, "Media Display Pelanggan", "Smart Queue Display & Digital Signage", "Menggabungkan nomor antrean besar dan promosi produk dalam satu layar Smart TV 16:9.")

    # Smart TV Mockup Frame
    pdf.set_fill_color(15, 23, 42)
    pdf.set_draw_color(51, 65, 85)
    pdf.set_line_width(0.8)
    pdf.rect(12, 42, 273, 112, style='FD')

    # TV Header
    pdf.set_fill_color(30, 41, 59)
    pdf.rect(12, 42, 273, 10, style='F')
    pdf.set_y(44)
    pdf.set_x(16)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(100, 5, "SMART TV DISPLAY 16:9")
    pdf.set_text_color(74, 222, 128)
    pdf.cell(161, 5, "[ONLINE CONNECTED]", align="R")

    # Left TV Queue Section
    pdf.set_fill_color(30, 41, 59)
    pdf.rect(16, 56, 120, 94, style='F')
    draw_badge(pdf, 20, 60, "NOMOR ANTREAN DIPANGGIL", (185, 28, 28), width=70)

    # BIG QUEUE NUMBER
    pdf.set_y(70)
    pdf.set_x(16)
    pdf.set_font("Helvetica", "B", 38)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(120, 16, "014", align="C")

    draw_badge(pdf, 50, 90, "READY / SIAP AMBIL", (22, 163, 74), width=52)

    pdf.set_y(102)
    pdf.set_x(20)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(248, 113, 113)
    pdf.cell(0, 5, "PANGGILAN SUARA:")
    pdf.set_font("Helvetica", "I", 7.5)
    pdf.set_text_color(203, 213, 225)
    pdf.cell(0, 5, '  "Nomor antrean 014, silakan mengambil pesanan..."')

    # Right TV Signage Section
    pdf.set_fill_color(30, 41, 59)
    pdf.rect(142, 56, 139, 94, style='F')
    draw_badge(pdf, 146, 60, "DIGITAL SIGNAGE PROMOSI", (37, 99, 235), width=65)

    pdf.set_y(72)
    pdf.set_x(146)
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(131, 6, "PEMUTAR FOTO & VIDEO PROMO", align="C")
    pdf.ln(7)

    pdf.set_x(146)
    pdf.set_font("Helvetica", "", 8.5)
    pdf.set_text_color(148, 163, 184)
    pdf.cell(131, 5, "Promosi produk & iklan outlet berputar otomatis", align="C")

    # Info Box
    pdf.set_fill_color(219, 234, 254)
    pdf.set_draw_color(147, 197, 253)
    pdf.rect(12, 160, 273, 18, style='FD')
    pdf.set_y(163)
    pdf.set_x(16)
    pdf.set_font("Helvetica", "B", 8.5)
    pdf.set_text_color(30, 64, 175)
    pdf.cell(0, 5, "KEUNGGULAN TERINTEGRASI:")
    pdf.ln(4.5)
    pdf.set_x(16)
    pdf.set_font("Helvetica", "", 8)
    pdf.cell(0, 5, "Anda tidak perlu membeli pemutar iklan terpisah. Layar antrean pelanggan sekaligus berfungsi sebagai media promosi penambah omzet bisnis.")

    # ---------------------------------------------------------
    # SLIDE 6: DASHBOARD OWNER
    # ---------------------------------------------------------
    pdf.add_page()
    draw_slide_header(pdf, "Monitoring Pemilik Bisnis", "Dashboard Pemantauan Owner", "Pantau omzet, jumlah transaksi, perbandingan pembayaran, dan estimasi laba dari HP atau laptop.")

    card_w3 = 88
    y_c3 = 42
    cards3 = [
        ("RINGKASAN OMZET", "Penjualan & Transaksi", "Pantau total pendapatan kotor harian dan jumlah nota transaksi terjual secara real-time.", (185, 28, 28)),
        ("METODE PEMBAYARAN", "Tunai vs QRIS", "Pencocokan mutasi kas laci tunai dan pembayaran non-tunai QRIS secara akurat.", (37, 99, 235)),
        ("MARGIN OPERASIONAL", "HPP & Estimasi Laba", "Perhitungan estimasi keuntungan bersih operasional berdasarkan HPP per produk.", (22, 163, 74))
    ]

    for i, (tag, val, desc, color_rgb) in enumerate(cards3):
        x = 12 + i * 92
        pdf.set_fill_color(248, 250, 252)
        pdf.set_draw_color(203, 213, 225)
        pdf.rect(x, y_c3, card_w3, 62, style='FD')

        pdf.set_fill_color(*color_rgb)
        pdf.rect(x, y_c3, card_w3, 8, style='F')

        pdf.set_y(y_c3 + 1.5)
        pdf.set_x(x)
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(255, 255, 255)
        pdf.cell(card_w3, 5, tag, align="C")
        pdf.ln(6)

        pdf.set_x(x)
        pdf.set_font("Helvetica", "B", 12)
        pdf.set_text_color(*color_rgb)
        pdf.cell(card_w3, 8, val, align="C")
        pdf.ln(9)

        pdf.set_x(x + 6)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(71, 85, 105)
        pdf.multi_cell(card_w3 - 12, 4.5, desc, align="C")

    # Warning Box
    pdf.set_fill_color(254, 243, 199)
    pdf.set_draw_color(252, 211, 77)
    pdf.rect(12, 112, 273, 35, style='FD')

    pdf.set_y(115)
    pdf.set_x(16)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(180, 83, 9)
    pdf.cell(0, 5, "CATATAN PENTING PERHITUNGAN KEUNTUNGAN:")
    pdf.ln(5.5)

    pdf.set_x(16)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(146, 64, 14)
    pdf.multi_cell(265, 4.5, "Estimasi keuntungan pada dashboard dihitung berdasarkan Data Penjualan minus HPP Produk yang dimasukkan. Angka tersebut merupakan indikator laba kotor operasional produk dan TIDAK OTOMATIS MEMOTONG BIAYA TETAP BISNIS seperti gaji staf, sewa tempat, listrik, penyusutan, atau pajak usaha (kecuali dikembangkan khusus sebagai fitur tambahan).")

    # ---------------------------------------------------------
    # SLIDE 7: FITUR MANAJEMEN & KEAMANAN
    # ---------------------------------------------------------
    pdf.add_page()
    draw_slide_header(pdf, "Keamanan & Kontrol Fitur", "Fitur Manajemen, Hak Akses & Laporan", "Pengaturan produk lengkap, keamanan multi-level, serta pembatasan akses antar outlet.")

    mgt_cards = [
        ("PENGELOLAAN PRODUK", (185, 28, 28), [
            "Tambah & Edit Produk / Menu",
            "Pengelompokan Kategori Menu",
            "Pengaturan Harga Jual Produk",
            "Pencatatan HPP (Harga Pokok)",
            "Status Aktif / Non-aktif Menu"
        ]),
        ("KEAMANAN & HAK AKSES", (37, 99, 235), [
            "Login berdasarkan peran (Kasir/Owner)",
            "Pembatasan kasir hanya ke outlet miliknya",
            "Tindakan sensitif butuh otorisasi Owner",
            "Data HPP disembunyikan dari Kasir & TV"
        ]),
        ("SISTEM MULTI-OUTLET", (22, 163, 74), [
            "Isolasi data antar cabang terjamin",
            "Kasir Outlet A tidak bisa lihat Outlet B",
            "Owner dapat melihat rekap gabungan",
            "Filter laporan per cabang spesifik"
        ]),
        ("LAPORAN OPERASIONAL", (217, 119, 6), [
            "Ringkasan transaksi & total omzet",
            "Rekap kuantitas produk per kategori",
            "Catatan: Bukan pengganti akuntansi",
            "lengkap atau laporan pajak resmi"
        ])
    ]

    y_m = 42
    for i, (mc_title, mc_color, mc_items) in enumerate(mgt_cards):
        x = 12 if i % 2 == 0 else 152
        if i % 2 == 0 and i > 0:
            y_m += 68

        pdf.set_fill_color(248, 250, 252)
        pdf.set_draw_color(203, 213, 225)
        pdf.rect(x, y_m, 133, 62, style='FD')

        pdf.set_fill_color(*mc_color)
        pdf.rect(x, y_m, 133, 8, style='F')

        pdf.set_y(y_m + 1.5)
        pdf.set_x(x + 6)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(255, 255, 255)
        pdf.cell(0, 5, mc_title)
        pdf.ln(8)

        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(51, 65, 85)
        for item in mc_items:
            pdf.set_x(x + 6)
            pdf.cell(0, 4.8, f"[v]  {item}")
            pdf.ln(4.8)

    # ---------------------------------------------------------
    # SLIDE 8: LOCAL VS CLOUD COMPARISON
    # ---------------------------------------------------------
    pdf.add_page()
    draw_slide_header(pdf, "Pilihan Arsitektur", "Perbandingan: Local vs Cloud Online", "Pahami perbedaan mendasar cara kerja, kebutuhan perangkat, dan batas akses sebelum memilih paket.")

    # Local Box
    pdf.set_fill_color(248, 250, 252)
    pdf.set_draw_color(100, 116, 139)
    pdf.rect(12, 42, 132, 140, style='FD')

    pdf.set_fill_color(71, 85, 105)
    pdf.rect(12, 42, 132, 10, style='F')
    pdf.set_y(44)
    pdf.set_x(16)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 6, "STARTER LOCAL / OFFLINE (SERVER TOKO)")

    loc_pts = [
        "Lokasi Server: Mini PC / Laptop di dalam toko (wajib menyala selama operasional).",
        "Internet Toko: TIDAK WAJIB untuk transaksi lokal kasir & TV antrean.",
        "Akses Dashboard Owner: Hanya bisa dari jaringan Wi-Fi toko secara default. Tidak bisa dibuka dari rumah.",
        "Kelebihan: Biaya awal paling hemat, tidak ada biaya server tahunan.",
        "Kekurangan: Membutuhkan komputer server di toko, pantauan jarak jauh terbatas."
    ]
    pdf.set_y(56)
    pdf.set_font("Helvetica", "", 8.5)
    pdf.set_text_color(51, 65, 85)
    for lp in loc_pts:
        pdf.set_x(16)
        pdf.multi_cell(124, 5, f"* {lp}")
        pdf.ln(3)

    # Cloud Box
    pdf.set_fill_color(254, 242, 242)
    pdf.set_draw_color(239, 68, 68)
    pdf.rect(153, 42, 132, 140, style='FD')

    pdf.set_fill_color(185, 28, 28)
    pdf.rect(153, 42, 132, 10, style='F')
    pdf.set_y(44)
    pdf.set_x(157)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 6, "BUSINESS CLOUD / MULTI-OUTLET (SERVER ONLINE)")

    cld_pts = [
        "Lokasi Server: Berada di cloud server internet (server terpusat).",
        "Internet Toko: WAJIB tersedia agar Kasir, TV, & Owner terhubung.",
        "Akses Dashboard Owner: Bisa diakses dari mana saja (rumah, luar kota, HP/Laptop) via internet.",
        "Kelebihan: Toko tidak butuh laptop server khusus, praktis untuk multi-cabang.",
        "Kekurangan: Tergantung koneksi internet, ada biaya perpanjangan server tahunan."
    ]
    pdf.set_y(56)
    pdf.set_font("Helvetica", "", 8.5)
    pdf.set_text_color(51, 65, 85)
    for cp in cld_pts:
        pdf.set_x(157)
        pdf.multi_cell(124, 5, f"* {cp}")
        pdf.ln(3)

    # ---------------------------------------------------------
    # SLIDE 9: PERANGKAT YANG DIBUTUHKAN
    # ---------------------------------------------------------
    pdf.add_page()
    draw_slide_header(pdf, "Spesifikasi Hardware", "Kebutuhan Perangkat Operasional", "Matriks kebutuhan hardware fisik untuk menjalankan paket Local vs Cloud.")

    pdf.set_fill_color(185, 28, 28)
    pdf.set_font("Helvetica", "B", 8.5)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(85, 7, "  Perangkat / Kebutuhan", border=1, fill=True)
    pdf.cell(94, 7, "  Starter Local / Offline", border=1, fill=True)
    pdf.cell(94, 7, "  Business Cloud / Multi-Outlet", border=1, fill=True)
    pdf.ln(7)

    hw_rows = [
        ("HP / Tablet Kasir", "WAJIB (Untuk Panel Kasir)", "WAJIB (Untuk Panel Kasir)"),
        ("Smart TV / Layar Display", "DIPERLUKAN (Jika pakai TV antrean)", "DIPERLUKAN (Jika pakai TV antrean)"),
        ("Router / Wi-Fi Toko", "WAJIB (Untuk koneksi lokal toko)", "WAJIB (Untuk akses internet toko)"),
        ("Mini PC / Laptop Server", "WAJIB (Harus menyala saat operasional)", "TIDAK DIPERLUKAN (Server Cloud)"),
        ("Koneksi Internet", "TIDAK WAJIB (Hanya fitur luar)", "WAJIB (Untuk terhubung ke Cloud)"),
        ("Perangkat Owner", "HP/Laptop terhubung Wi-Fi toko", "HP/Laptop dengan internet dari mana saja")
    ]

    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(51, 65, 85)
    for i, (r_dev, r_loc, r_cld) in enumerate(hw_rows):
        fill = (i % 2 == 1)
        pdf.set_fill_color(248, 250, 252) if fill else pdf.set_fill_color(255, 255, 255)
        pdf.cell(85, 6, f"  {r_dev}", border=1, fill=fill)
        pdf.cell(94, 6, f"  {r_loc}", border=1, fill=fill)
        pdf.cell(94, 6, f"  {r_cld}", border=1, fill=fill)
        pdf.ln(6)

    # Warning Box
    pdf.set_y(102)
    pdf.set_fill_color(254, 243, 199)
    pdf.set_draw_color(252, 211, 77)
    pdf.rect(12, 102, 273, 22, style='FD')

    pdf.set_y(105)
    pdf.set_x(16)
    pdf.set_font("Helvetica", "B", 8.5)
    pdf.set_text_color(180, 83, 9)
    pdf.cell(0, 5, "PERANGKAT FISIK TIDAK TERMASUK DALAM HARGA LISENSI APLIKASI:")
    pdf.ln(4.5)
    pdf.set_x(16)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(146, 64, 14)
    pdf.cell(0, 5, "Harga proposal ini adalah untuk lisensi software, penyetelan awal, dan pelatihan. Perangkat fisik (HP, Tablet, TV, Mini PC, Router) disiapkan oleh pemilik toko atau dipesan terpisah melalui penawaran khusus hardware.")

    # ---------------------------------------------------------
    # SLIDE 10: PAKET STARTER LOCAL
    # ---------------------------------------------------------
    pdf.add_page()
    draw_slide_header(pdf, "Opsi Beli Putus #1", "Paket Starter Local / Offline", "Solusi beli putus paling hemat untuk 1 outlet dengan server berada di dalam toko.")

    # Card Left
    pdf.set_fill_color(255, 255, 255)
    pdf.set_draw_color(203, 213, 225)
    pdf.rect(12, 42, 132, 140, style='FD')

    draw_badge(pdf, 16, 46, "PALING HEMAT", (245, 158, 11), (15, 23, 42), width=30)

    pdf.set_y(54)
    pdf.set_x(16)
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 6, "STARTER LOCAL")
    pdf.ln(6)

    pdf.set_x(16)
    pdf.set_font("Helvetica", "", 8.5)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(0, 5, "Beli Putus | 1 Outlet | Server Toko")
    pdf.ln(8)

    pdf.set_x(16)
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(185, 28, 28)
    pdf.cell(0, 8, "Rp 2.500.000")
    pdf.ln(8)

    pdf.set_x(16)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(0, 4, "Total Investment Pertama")
    pdf.ln(8)

    starter_items = [
        ("Lisensi 1 Outlet (3 Modul)", "Rp 2.200.000"),
        ("Penyetelan & Pelatihan Kasir", "Rp 300.000"),
        ("Biaya Cloud Server Tahunan", "TIDAK PERLU"),
        ("Garansi Teknis 30 Hari Pertama", "GRATIS")
    ]
    for st_item, st_price in starter_items:
        pdf.set_x(16)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(51, 65, 85)
        pdf.cell(82, 5.5, f"* {st_item}")
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(22, 163, 74) if "TIDAK" in st_price or "GRATIS" in st_price else pdf.set_text_color(15, 23, 42)
        pdf.cell(40, 5.5, st_price, align="R")
        pdf.ln(5.5)

    # Card Right
    pdf.set_fill_color(254, 243, 199)
    pdf.set_draw_color(252, 211, 77)
    pdf.rect(153, 42, 132, 140, style='FD')

    pdf.set_y(46)
    pdf.set_x(157)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(180, 83, 9)
    pdf.cell(0, 5, "SYARAT WAJIB PAKET STARTER LOCAL:")
    pdf.ln(6)

    st_reqs = [
        "Toko harus menyediakan 1 Mini PC / Laptop / PC sebagai server lokal.",
        "Komputer server harus tetap menyala selama jam operasional toko.",
        "Dashboard Owner hanya dapat dibuka dari jaringan Wi-Fi lokal toko.",
        "Akses dari rumah / luar toko tidak tersedia secara default.",
        "Perangkat server tidak termasuk harga paket lisensi."
    ]
    pdf.set_font("Helvetica", "", 8.5)
    pdf.set_text_color(146, 64, 14)
    for req in st_reqs:
        pdf.set_x(157)
        pdf.multi_cell(124, 5, f"* {req}")
        pdf.ln(3)

    # ---------------------------------------------------------
    # SLIDE 11: PAKET BUSINESS CLOUD
    # ---------------------------------------------------------
    pdf.add_page()
    draw_slide_header(pdf, "Opsi Beli Putus #2", "Paket Business Cloud Online", "Solusi fleksibel tanpa server komputer di toko, dapat dipantau dari mana saja melalui internet.")

    # Card Left
    pdf.set_fill_color(255, 255, 255)
    pdf.set_draw_color(185, 28, 28)
    pdf.set_line_width(0.8)
    pdf.rect(12, 42, 132, 140, style='FD')

    draw_badge(pdf, 16, 46, "REKOMENDASI 1 OUTLET", (185, 28, 28), width=45)

    pdf.set_y(54)
    pdf.set_x(16)
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 6, "BUSINESS CLOUD")
    pdf.ln(6)

    pdf.set_x(16)
    pdf.set_font("Helvetica", "", 8.5)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(0, 5, "Beli Putus | 1 Outlet | Online Internet")
    pdf.ln(8)

    pdf.set_x(16)
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(185, 28, 28)
    pdf.cell(0, 8, "Rp 4.950.000")
    pdf.ln(8)

    pdf.set_x(16)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(0, 4, "Total Investment Tahun Pertama")
    pdf.ln(8)

    biz_items = [
        ("Lisensi 1 Outlet (3 Modul Terintegrasi)", "Rp 3.700.000"),
        ("Cloud Server Online (1 Tahun Pertama)", "Rp 750.000"),
        ("Penyetelan Awal & Pelatihan Kasir", "Rp 500.000"),
        ("Garansi Teknis 30 Hari Pertama", "GRATIS")
    ]
    for bz_item, bz_price in biz_items:
        pdf.set_x(16)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(51, 65, 85)
        pdf.cell(82, 5.5, f"* {bz_item}")
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(22, 163, 74) if "GRATIS" in bz_price else pdf.set_text_color(15, 23, 42)
        pdf.cell(40, 5.5, bz_price, align="R")
        pdf.ln(5.5)

    # Card Right
    pdf.set_fill_color(248, 250, 252)
    pdf.set_draw_color(203, 213, 225)
    pdf.rect(153, 42, 132, 140, style='FD')

    pdf.set_y(46)
    pdf.set_x(157)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 5, "KEUNTUNGAN UTAMA PAKET BUSINESS:")
    pdf.ln(6)

    bz_benefits = [
        "Tanpa Server Lokal: Outlet tidak perlu menyiapkan komputer/laptop server khusus.",
        "Remote Monitoring: Pemilik dapat memantau omzet & transaksi dari rumah via HP.",
        "Cloud Tahun Pertama Termasuk: Langsung siap pakai tanpa biaya sewa server tambahan di tahun ke-1.",
        "Praktis & Bebas Perawatan Perangkat Server Toko.",
        "Koneksi Internet Toko: Memerlukan Wi-Fi / Seluler yang stabil."
    ]
    pdf.set_font("Helvetica", "", 8.5)
    pdf.set_text_color(51, 65, 85)
    for bnf in bz_benefits:
        pdf.set_x(157)
        pdf.multi_cell(124, 5, f"* {bnf}")
        pdf.ln(3)

    # ---------------------------------------------------------
    # SLIDE 12: PAKET MULTI-OUTLET
    # ---------------------------------------------------------
    pdf.add_page()
    draw_slide_header(pdf, "Opsi Beli Putus #3", "Paket Multi-Outlet (Hingga 5 Cabang)", "Satu platform cloud terpusat untuk memantau hingga 5 cabang outlet dalam satu Dashboard Owner.")

    # Card Left
    pdf.set_fill_color(255, 255, 255)
    pdf.set_draw_color(22, 163, 74)
    pdf.set_line_width(0.8)
    pdf.rect(12, 42, 132, 140, style='FD')

    draw_badge(pdf, 16, 46, "REKOMENDASI BISNIS MULTI-CABANG", (22, 163, 74), width=65)

    pdf.set_y(54)
    pdf.set_x(16)
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 6, "MULTI-OUTLET (5 CABANG)")
    pdf.ln(6)

    pdf.set_x(16)
    pdf.set_font("Helvetica", "", 8.5)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(0, 5, "Beli Putus | s/d 5 Cabang | 1 Cloud Server Pusat")
    pdf.ln(8)

    pdf.set_x(16)
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(185, 28, 28)
    pdf.cell(0, 8, "Rp 9.000.000")
    pdf.ln(8)

    pdf.set_x(16)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(0, 4, "Total Investment Tahun Pertama")
    pdf.ln(8)

    m_items = [
        ("Lisensi Platform Multi (s/d 5 Cabang)", "Rp 7.500.000"),
        ("1 Cloud Server Terpusat (Tahun ke-1)", "Rp 1.000.000"),
        ("Penyetelan & Pelatihan (Lokasi Utama)", "Rp 500.000"),
        ("Garansi Teknis 30 Hari Pertama", "GRATIS")
    ]
    for m_item, m_price in m_items:
        pdf.set_x(16)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(51, 65, 85)
        pdf.cell(82, 5.5, f"* {m_item}")
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(22, 163, 74) if "GRATIS" in m_price else pdf.set_text_color(15, 23, 42)
        pdf.cell(40, 5.5, m_price, align="R")
        pdf.ln(5.5)

    # Card Right
    pdf.set_fill_color(240, 253, 244)
    pdf.set_draw_color(187, 247, 208)
    pdf.rect(153, 42, 132, 140, style='FD')

    pdf.set_y(46)
    pdf.set_x(157)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(22, 101, 52)
    pdf.cell(0, 5, "HEMAT BIAYA SERVER MULTI-CABANG:")
    pdf.ln(6)

    m_notes = [
        "1 Server Terpusat: Biaya Cloud Rp 1.000.000/tahun adalah biaya total untuk 1 server terpusat penampung 5 cabang (BUKAN Rp 1 Juta dikali per cabang).",
        "Isolasi Data Cabang: Setiap outlet tetap memiliki isolasi data dan akses kasirnya sendiri.",
        "Dashboard Owner Gabungan: Owner dapat melihat ringkasan seluruh outlet sekaligus atau memfilter per cabang.",
        "Sangat Efisien & Hemat untuk ekspansi jaringan outlet."
    ]
    pdf.set_font("Helvetica", "", 8.5)
    pdf.set_text_color(22, 101, 52)
    for mn in m_notes:
        pdf.set_x(157)
        pdf.multi_cell(124, 5, f"* {mn}")
        pdf.ln(3)

    # ---------------------------------------------------------
    # SLIDE 13: OPSI SEWA BULANAN
    # ---------------------------------------------------------
    pdf.add_page()
    draw_slide_header(pdf, "Opsi Langganan", "Opsi Sewa Bulanan (Cloud All-in-One)", "Skema sewa fleksibel tanpa investasi besar di awal, sudah mencakup server cloud dan perawatan rutin.")

    # Card Left
    pdf.set_fill_color(255, 255, 255)
    pdf.set_draw_color(37, 99, 235)
    pdf.rect(12, 42, 132, 140, style='FD')

    draw_badge(pdf, 16, 46, "FLEKSIBEL", (37, 99, 235), width=25)

    pdf.set_y(54)
    pdf.set_x(16)
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 6, "SEWA BULANAN")
    pdf.ln(6)

    pdf.set_x(16)
    pdf.set_font("Helvetica", "", 8.5)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(0, 5, "Langganan | Per 1 Outlet | Cloud Termasuk")
    pdf.ln(8)

    pdf.set_x(16)
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_text_color(185, 28, 28)
    pdf.cell(0, 7, "Rp 825.000 (Bulan 1)")
    pdf.ln(7)

    pdf.set_x(16)
    pdf.set_font("Helvetica", "B", 9.5)
    pdf.set_text_color(22, 163, 74)
    pdf.cell(0, 5, "Rp 325.000 / bulan / outlet (Bulan berikutnya)")
    pdf.ln(8)

    sw_items = [
        ("Sewa Sistem & Cloud Online / Outlet", "Rp 325.000 / bln"),
        ("Penyetelan & Pelatihan (Dibayar 1x awal)", "Rp 500.000"),
        ("Maintenance & Update Minor", "TERMASUK"),
        ("Cloud Server selama Langganan", "TERMASUK")
    ]
    for sw_item, sw_price in sw_items:
        pdf.set_x(16)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(51, 65, 85)
        pdf.cell(82, 5.5, f"* {sw_item}")
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(22, 163, 74) if "TERMASUK" in sw_price else pdf.set_text_color(15, 23, 42)
        pdf.cell(40, 5.5, sw_price, align="R")
        pdf.ln(5.5)

    # Card Right
    pdf.set_fill_color(239, 246, 255)
    pdf.set_draw_color(191, 219, 254)
    pdf.rect(153, 42, 132, 140, style='FD')

    pdf.set_y(46)
    pdf.set_x(157)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(30, 64, 175)
    pdf.cell(0, 5, "KAPAN SEBAIKNYA MEMILIH SEWA BULANAN?")
    pdf.ln(6)

    sw_recs = [
        "Bisnis baru yang ingin meminimalkan modal pengeluaran awal.",
        "Ingin mencoba keandalan sistem sebelum komitmen beli putus.",
        "Menyukai kemudahan karena pemeliharaan server sudah ditangani penuh selama berlangganan.",
        "Pembayaran dilakukan di awal setiap periode berjalan."
    ]
    pdf.set_font("Helvetica", "", 8.5)
    pdf.set_text_color(30, 64, 175)
    for sr in sw_recs:
        pdf.set_x(157)
        pdf.multi_cell(124, 5, f"* {sr}")
        pdf.ln(3)

    # ---------------------------------------------------------
    # SLIDE 14: PERBANDINGAN SEMUA PAKET
    # ---------------------------------------------------------
    pdf.add_page()
    draw_slide_header(pdf, "Ringkasan Penawaran", "Tabel Perbandingan Semua Paket", "Ringkasan komparasi harga, server, dan skema pembayaran dari seluruh opsi.")

    pdf.set_fill_color(185, 28, 28)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(48, 7, " PAKET", border=1, fill=True)
    pdf.cell(28, 7, " OUTLET", border=1, fill=True)
    pdf.cell(50, 7, " SERVER", border=1, fill=True)
    pdf.cell(45, 7, " REMOTE OWNER", border=1, fill=True)
    pdf.cell(52, 7, " HARGA INVESTASI", border=1, fill=True)
    pdf.cell(50, 7, " CLOUD THN KE-2", border=1, fill=True)
    pdf.ln(7)

    all_pkgs = [
        ("STARTER LOCAL", "1 Outlet", "Mini PC / Laptop Toko", "Tidak (Wi-Fi Toko)", "Rp 2.500.000", "Rp 0 (Tanpa Cloud)"),
        ("BUSINESS CLOUD", "1 Outlet", "Cloud Online", "YA (Dari mana saja)", "Rp 4.950.000", "Rp 750.000 / thn"),
        ("MULTI-OUTLET", "s/d 5 Cabang", "1 Cloud Terpusat", "YA (Dashboard Gabungan)", "Rp 9.000.000", "Rp 1.000.000 / thn (5 Cabang)"),
        ("SEWA BULANAN", "Per Outlet", "Cloud Online", "YA (Dari mana saja)", "Rp 825.000 (Bln 1)", "Termasuk dalam Sewa")
    ]

    pdf.set_font("Helvetica", "", 7.5)
    pdf.set_text_color(51, 65, 85)
    for i, (pk_n, pk_o, pk_s, pk_r, pk_h, pk_c) in enumerate(all_pkgs):
        fill = (i % 2 == 1)
        pdf.set_fill_color(248, 250, 252) if fill else pdf.set_fill_color(255, 255, 255)
        pdf.set_font("Helvetica", "B", 7.5)
        pdf.cell(48, 6, f" {pk_n}", border=1, fill=fill)
        pdf.set_font("Helvetica", "", 7.5)
        pdf.cell(28, 6, f" {pk_o}", border=1, fill=fill)
        pdf.cell(50, 6, f" {pk_s}", border=1, fill=fill)
        pdf.cell(45, 6, f" {pk_r}", border=1, fill=fill)
        pdf.cell(52, 6, f" {pk_h}", border=1, fill=fill)
        pdf.cell(50, 6, f" {pk_c}", border=1, fill=fill)
        pdf.ln(6)

    # Note Box
    pdf.set_y(82)
    pdf.set_fill_color(239, 246, 255)
    pdf.set_draw_color(191, 219, 254)
    pdf.rect(12, 82, 273, 20, style='FD')

    pdf.set_y(85)
    pdf.set_x(16)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(30, 64, 175)
    pdf.cell(0, 4, "KETENTUAN PERPANJANGAN CLOUD (TAHUN KE-2):")
    pdf.ln(4.5)
    pdf.set_x(16)
    pdf.set_font("Helvetica", "", 7.5)
    pdf.cell(0, 4, "Biaya perpanjangan cloud untuk Business Cloud adalah Rp 750.000/tahun, dan Multi-Outlet 5 cabang adalah Rp 1.000.000/tahun. Biaya dapat ditinjau kembali jika terjadi peningkatan kapasitas, trafik, atau penyimpanan yang sangat signifikan.")

    # ---------------------------------------------------------
    # SLIDE 15: SKENARIO NYATA
    # ---------------------------------------------------------
    pdf.add_page()
    draw_slide_header(pdf, "Studi Skenario Operasional", "Skenario Nyata Operasional Outlet", "Bagaimana sistem merespons berbagai kondisi riil di toko?")

    scenarios = [
        ("Skenario 1: Owner di rumah ingin mengecek omzet harian", "LOCAL: Tidak dapat diakses dari luar toko secara default.\nCLOUD / MULTI: Bisa dibuka kapan saja dari HP/Laptop via internet."),
        ("Skenario 2: Internet Wi-Fi provider di toko tiba-tiba mati", "LOCAL: Kasir & TV Antrean tetap berjalan lancar via jaringan router lokal.\nCLOUD: Terhenti sementara sampai koneksi internet toko kembali terhubung."),
        ("Skenario 3: Komputer Mini PC server di toko mati/rusak", "LOCAL: Sistem lokal terhenti sampai server dinyalakan.\nCLOUD: Tidak terpengaruh karena tidak menggunakan server komputer lokal toko."),
        ("Skenario 4: Membuka cabang/outlet baru di lokasi lain", "LOCAL: Membutuhkan pengadaan server lokal baru.\nMULTI-OUTLET: Cabang baru langsung ditambahkan ke dalam server terpusat yang sama.")
    ]

    y_sc = 42
    for sc_title, sc_desc in scenarios:
        pdf.set_fill_color(255, 255, 255)
        pdf.set_draw_color(203, 213, 225)
        pdf.rect(12, y_sc, 273, 24, style='FD')

        pdf.set_y(y_sc + 3)
        pdf.set_x(16)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(185, 28, 28)
        pdf.cell(0, 4, sc_title)
        pdf.ln(5)

        pdf.set_x(16)
        pdf.set_font("Helvetica", "", 7.5)
        pdf.set_text_color(51, 65, 85)
        pdf.multi_cell(265, 4, sc_desc)

        y_sc += 32

    # ---------------------------------------------------------
    # SLIDE 16: PROSES IMPLEMENTASI
    # ---------------------------------------------------------
    pdf.add_page()
    draw_slide_header(pdf, "Tahapan Pengerjaan", "Proses Implementasi 6 Langkah", "Langkah terstruktur dari kesepakatan awal hingga sistem aktif beroperasi penuh di toko.")

    steps6 = [
        ("TAHAP 1: Konfirmasi Kebutuhan", "Menentukan paket, jumlah outlet, ketersediaan perangkat, Wi-Fi, daftar menu, harga, & HPP."),
        ("TAHAP 2: Persiapan Sistem", "Pengembang menyiapkan konfigurasi outlet, akun akses, input menu awal, & lingkungan server."),
        ("TAHAP 3: Instalasi & Penyetelan", "Pemasangan sistem di toko, menghubungkan Kasir -> Display TV -> Dashboard Owner."),
        ("TAHAP 4: Pelatihan Kasir & Staf", "Penjelasan langsung penggunaan kasir, pembuatan transaksi, panggil antrean, & monitoring."),
        ("TAHAP 5: Uji Operasional", "Pengujian transaksi nyata di toko untuk memastikan seluruh fungsi berjalan tanpa kendala."),
        ("TAHAP 6: Masa Garansi 30 Hari", "Dukungan bantuan teknis gratis selama 30 hari pertama untuk menangani kendala operasional.")
    ]

    y_s6 = 42
    for i, (s6_t, s6_d) in enumerate(steps6):
        x = 12 if i % 2 == 0 else 152
        if i % 2 == 0 and i > 0:
            y_s6 += 44

        pdf.set_fill_color(248, 250, 252)
        pdf.set_draw_color(203, 213, 225)
        pdf.rect(x, y_s6, 133, 38, style='FD')

        pdf.set_y(y_s6 + 4)
        pdf.set_x(x + 6)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(185, 28, 28)
        pdf.cell(0, 5, s6_t)
        pdf.ln(5.5)

        pdf.set_x(x + 6)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(51, 65, 85)
        pdf.multi_cell(121, 4.5, s6_d)

    # ---------------------------------------------------------
    # SLIDE 17: YANG TIDAK TERMASUK + LAYANAN OPSIONAL
    # ---------------------------------------------------------
    pdf.add_page()
    draw_slide_header(pdf, "Batasan Scope & Add-On", "Batasan Scope & Layanan Opsional", "Transparansi mengenai item di luar penawaran standar dan opsi pengembangan tambahan.")

    # Exclusions
    pdf.set_fill_color(254, 242, 242)
    pdf.set_draw_color(252, 165, 165)
    pdf.rect(12, 42, 132, 140, style='FD')

    pdf.set_y(46)
    pdf.set_x(16)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(185, 28, 28)
    pdf.cell(0, 5, "TIDAK TERMASUK DALAM HARGA DASAR:")
    pdf.ln(6)

    excl_pts = [
        "Perangkat fisik (HP, Tablet, Smart TV, Mini PC, Printer, Router, Kabel UPS).",
        "Biaya berlangganan internet ISP / Pemasangan jaringan fisik toko.",
        "Domain khusus milik klien atau layanan pihak ketiga berbayar.",
        "Integrasi khusus (Payment Gateway, EDC, Inventory Penuh, Akuntansi, Payroll, Absensi, Loyalty, Marketplace).",
        "Pengembangan fitur baru di luar scope proposal awal."
    ]
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(127, 29, 29)
    for ep in excl_pts:
        pdf.set_x(16)
        pdf.multi_cell(124, 4.5, f"* {ep}")
        pdf.ln(3)

    # Add-ons
    pdf.set_fill_color(248, 250, 252)
    pdf.set_draw_color(203, 213, 225)
    pdf.rect(153, 42, 132, 140, style='FD')

    pdf.set_y(46)
    pdf.set_x(157)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 5, "LAYANAN TAMBAHAN (OPSIONAL):")
    pdf.ln(6)

    addons = [
        ("Maintenance & Support Tahunan", "Rp 1.500.000 / tahun"),
        ("Pengembangan Fitur Khusus", "Mulai Rp 300.000"),
        ("Outlet Tambahan (Luar Paket)", "Dihitung terpisah"),
        ("Remote Access Paket Local", "Dianalisis & ditawarkan terpisah")
    ]
    for ad_t, ad_p in addons:
        pdf.set_x(157)
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(15, 23, 42)
        pdf.cell(75, 5, f"* {ad_t}")
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(185, 28, 28)
        pdf.cell(45, 5, ad_p, align="R")
        pdf.ln(6)

    # ---------------------------------------------------------
    # SLIDE 18: KETENTUAN + REKOMENDASI AKHIR
    # ---------------------------------------------------------
    pdf.add_page()
    draw_slide_header(pdf, "Syarat & Panduan Keputusan", "Ketentuan Pembayaran & Panduan Pemilihan", "Ringkasan skema pembayaran dan panduan memilih paket yang paling tepat.")

    # Terms
    pdf.set_fill_color(248, 250, 252)
    pdf.set_draw_color(203, 213, 225)
    pdf.rect(12, 42, 132, 140, style='FD')

    pdf.set_y(46)
    pdf.set_x(16)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(185, 28, 28)
    pdf.cell(0, 5, "SYARAT & KETENTUAN PEMBAYARAN:")
    pdf.ln(6)

    terms_list = [
        "Skema Beli Putus: DP 50% saat kesepakatan; Pelunasan 50% setelah terpasang & fungsi utama siap pakai.",
        "Sewa Bulanan: Pembayaran dilakukan di awal periode berjalan.",
        "Garansi Teknis: 30 hari sejak aktif (mencakup perbaikan kendala fitur awal).",
        "Hak Cipta: Source code milik pengembang. Klien memperoleh Hak Guna Paket.",
        "Validitas Proposal: 30 hari sejak tanggal diterbitkan."
    ]
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(51, 65, 85)
    for tm in terms_list:
        pdf.set_x(16)
        pdf.multi_cell(124, 4.8, f"* {tm}")
        pdf.ln(3)

    # Recommendations
    pdf.set_fill_color(240, 253, 244)
    pdf.set_draw_color(187, 247, 208)
    pdf.rect(153, 42, 132, 140, style='FD')

    pdf.set_y(46)
    pdf.set_x(157)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(22, 101, 52)
    pdf.cell(0, 5, "PANDUAN REKOMENDASI PEMILIHAN:")
    pdf.ln(6)

    recs_guide = [
        ("1 Outlet & Biaya Paling Rendah", "Pilih Paket Starter Local (Rp 2.500.000)"),
        ("1 Outlet & Monitoring dari Mana Saja", "Pilih Paket Business Cloud (Rp 4.950.000)"),
        ("Banyak Cabang dalam 1 Dashboard", "Pilih Paket Multi-Outlet (Rp 9.000.000)"),
        ("Minim Pengeluaran Modal Awal", "Pilih Opsi Sewa Bulanan (Rp 825rb -> Rp 325rb/bln)")
    ]
    for rg_c, rg_p in recs_guide:
        pdf.set_x(157)
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(22, 101, 52)
        pdf.cell(0, 4, f"-> {rg_c}:")
        pdf.ln(4)
        pdf.set_x(163)
        pdf.set_font("Helvetica", "", 8)
        pdf.cell(0, 4, rg_p)
        pdf.ln(6)

    # ---------------------------------------------------------
    # SLIDE 19: SLIDE PENUTUP
    # ---------------------------------------------------------
    pdf.add_page()
    pdf.set_fill_color(9, 13, 22)
    pdf.rect(0, 0, 297, 210, style='F')

    pdf.set_fill_color(220, 38, 38)
    pdf.rect(0, 0, 297, 4, style='F')

    pdf.set_y(55)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(248, 113, 113)
    pdf.cell(0, 6, "[ SOLUSI TERHUBUNG UNTUK OUTLET ANDA ]", align="C")
    pdf.ln(12)

    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 10, "SATU SISTEM. SATU ALUR OPERASIONAL. LEBIH MUDAH DIPANTAU.", align="C")
    pdf.ln(14)

    pdf.set_font("Helvetica", "", 12)
    pdf.set_text_color(203, 213, 225)
    pdf.cell(0, 6, "Kasir Digital + Smart Queue Display + Digital Signage + Owner Monitoring", align="C")
    pdf.ln(16)

    pdf.set_fill_color(15, 23, 42)
    pdf.set_draw_color(34, 197, 94)
    pdf.set_line_width(0.8)
    pdf.rect(48, 130, 201, 16, style='FD')
    pdf.set_y(134)
    pdf.set_font("Helvetica", "B", 9.5)
    pdf.set_text_color(134, 239, 172)
    pdf.cell(0, 8, '"Solusi fleksibel yang dapat disesuaikan dengan jumlah outlet dan kebutuhan operasional bisnis Anda."', align="C")

    pdf.set_y(165)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(148, 163, 184)
    pdf.cell(0, 6, "Terima kasih atas perhatian Anda. Tim Pengembang siap membantu modernisasi outlet Anda.", align="C")

    pdf.output(output_path)
    print(f"Visual PDF Presentasi berhasil dibuat: {output_path}")

if __name__ == "__main__":
    out_pdf = "c:/Users/shint/Documents/Codex/2026-07-22/eh/nescafe-queue-display/Presentasi_Penawaran_Harga_Sistem_Revisi_Rinci.pdf"
    build_pdf_presentation(out_pdf)
