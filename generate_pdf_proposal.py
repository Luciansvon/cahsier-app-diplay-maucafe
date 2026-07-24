from fpdf import FPDF

class ProposalPDF(FPDF):
    def header(self):
        self.set_draw_color(185, 28, 28) # Red accent line
        self.set_line_width(1.2)
        self.line(10, 10, 200, 10)
        
        self.set_y(13)
        self.set_font("Helvetica", "B", 12)
        self.set_text_color(153, 27, 27)
        self.cell(115, 6, "SISTEM ANTREAN & POS OUTLET KOPI", border=0)
        
        self.set_font("Helvetica", "", 8.5)
        self.set_text_color(100, 116, 139)
        self.cell(75, 6, "Tanggal: 23 Juli 2026", border=0, align="R")
        self.ln(5)
        
        self.set_font("Helvetica", "", 8.5)
        self.set_text_color(71, 85, 105)
        self.cell(115, 5, "Digital Signage TV & Monitoring Omzet", border=0)
        
        self.set_font("Helvetica", "", 8.5)
        self.set_text_color(100, 116, 139)
        self.cell(75, 5, "No. Proposal: PR/2026/07/001", border=0, align="R")
        self.ln(7)
        
        self.set_draw_color(226, 232, 240)
        self.set_line_width(0.4)
        self.line(10, 25, 200, 25)
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(148, 163, 184)
        self.cell(0, 10, f"Halaman {self.page_no()} | Proposal Penawaran, Opsi Harga & Analisis Komparasi Low Budget", align="C")

def create_pdf(output_path):
    pdf = ProposalPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    
    # ----------------------------------------------------
    # HALAMAN 1: Proposal & Rincian Opsi Skema Harga
    # ----------------------------------------------------
    pdf.add_page()
    
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 6, "PROPOSAL PENAWARAN HARGA & ANALYSIS SKEMA", align="C")
    pdf.ln(5)
    
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(0, 5, "Solusi Digitalisasi Antrean Smart TV, Kasir HP & Pemantauan Keuntungan Harian", align="C")
    pdf.ln(6)
    
    # Section I: Ringkasan Fitur
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(153, 27, 27)
    pdf.cell(0, 5, "I. RINGKASAN FITUR UTAMA SISTEM")
    pdf.ln(5.5)
    
    start_y = pdf.get_y()
    pdf.set_fill_color(248, 250, 252)
    pdf.set_draw_color(226, 232, 240)
    pdf.rect(10, start_y, 190, 24, style="FD")
    
    pdf.set_y(start_y + 2)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(51, 65, 85)
    
    features = [
        "1. Panel Kasir (HP/Tablet): Tombol sentuh besar, bebas salah tekan, memanggil antrean dengan praktis.",
        "2. Layar Display TV (16:9): Nomor antrean jelas terbaca 3m dipadu pemutar video/foto promosi produk.",
        "3. Pemantauan Pemilik: Cek omzet harian, pencocokan Tunai vs QRIS, modal (HPP), & laba bersih dari HP."
    ]
    for feat in features:
        pdf.set_x(14)
        pdf.cell(0, 5.5, feat)
        pdf.ln(5.5)
        
    pdf.set_y(start_y + 26)

    # Box Mengapa Ini Low Budget Terbaik
    pdf.set_fill_color(254, 243, 199)
    pdf.set_draw_color(252, 211, 77)
    pdf.rect(10, pdf.get_y(), 190, 20, style="FD")
    
    pdf.set_y(pdf.get_y() + 2)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(180, 83, 9)
    pdf.set_x(14)
    pdf.cell(0, 4, "MENGAPA PENAWARAN INI ADALAH PILIHAN PALING TERJANGKAU (LOW BUDGET):")
    pdf.ln(4.5)
    
    pdf.set_font("Helvetica", "", 7.5)
    pdf.set_text_color(146, 64, 14)
    budget_points = [
        "1. Paket 3-in-1: Dalam 1 harga sudah mencakup Panel Kasir + Smart TV Signage + Monitoring Pemilik (Tanpa Beli Terpisah).",
        "2. Lebih Hemat dari Alat Pager Fisik: Alat antrean fisik harganya 2-3 Juta tanpa tampilan layar TV promo & tanpa rekap omzet.",
        "3. Hemat 80% dari Custom Software House: Pembuatan sistem custom sekelas ini di perusahaan IT bernilai Rp 15-25 Juta."
    ]
    for b_pt in budget_points:
        pdf.set_x(14)
        pdf.cell(0, 4, b_pt)
        pdf.ln(4)

    pdf.ln(3)

    # Section II: Opsi Skema Harga
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(153, 27, 27)
    pdf.cell(0, 5, "II. OPSI SKEMA HARGA SISTEM")
    pdf.ln(5)
    
    def draw_table(option_title, badge_text, rows, total_val=None):
        pdf.set_fill_color(241, 245, 249)
        pdf.set_draw_color(203, 213, 225)
        pdf.set_font("Helvetica", "B", 8.5)
        pdf.set_text_color(15, 23, 42)
        pdf.cell(135, 5.5, f"  {option_title}", border=1, fill=True)
        
        pdf.set_font("Helvetica", "B", 7.5)
        pdf.set_text_color(185, 28, 28)
        pdf.cell(55, 5.5, f"[{badge_text}]  ", border=1, fill=True, align="R")
        pdf.ln(5.5)
        
        pdf.set_fill_color(153, 27, 27)
        pdf.set_font("Helvetica", "B", 7.5)
        pdf.set_text_color(255, 255, 255)
        pdf.cell(135, 5, "  Rincian Komponen Layanan", border=1, fill=True)
        pdf.cell(55, 5, "Harga / Biaya  ", border=1, fill=True, align="R")
        pdf.ln(5)
        
        pdf.set_font("Helvetica", "", 7.5)
        pdf.set_text_color(51, 65, 85)
        for i, (item, price, is_green) in enumerate(rows):
            fill = (i % 2 == 1)
            pdf.set_fill_color(248, 250, 252) if fill else pdf.set_fill_color(255, 255, 255)
            pdf.cell(135, 5, f"  {item}", border=1, fill=fill)
            
            if is_green:
                pdf.set_font("Helvetica", "B", 7.5)
                pdf.set_text_color(22, 163, 74)
            else:
                pdf.set_font("Helvetica", "", 7.5)
                pdf.set_text_color(51, 65, 85)
                
            pdf.cell(55, 5, f"{price}  ", border=1, fill=fill, align="R")
            pdf.ln(5)
            
        if total_val:
            pdf.set_fill_color(254, 226, 226)
            pdf.set_font("Helvetica", "B", 8)
            pdf.set_text_color(153, 27, 27)
            pdf.cell(135, 5.5, f"  TOTAL INVESTMENT ({option_title.split(':')[0].strip()})", border=1, fill=True)
            pdf.cell(55, 5.5, f"{total_val}  ", border=1, fill=True, align="R")
            pdf.ln(5.5)
            
        pdf.ln(2.5)

    # Opsi 1
    draw_table(
        "OPSI 1: Beli Putus 1 Outlet (Cloud Online - Tanpa Laptop)",
        "SEKALI BAYAR + SERVER",
        [
            ("Lisensi Sistem 1 Outlet (Panel Kasir + Layar TV + Monitoring Pemilik)", "Rp 3.500.000", False),
            ("Sewa Cloud Server Online (1 Tahun Pertama - Bebas Tanpa Laptop)", "Rp 750.000", False),
            ("Penyetelan & Pelatihan Kasir di Toko", "Rp 300.000", False),
            ("Garansi Bantuan Kendala (1 Bulan Pertama)", "GRATIS", True)
        ],
        total_val="Rp 4.550.000"
    )

    # Opsi 2
    draw_table(
        "OPSI 2: Beli Putus Multi-Outlet (Hingga 5 Cabang)",
        "REKOMENDASI CABANG",
        [
            ("Lisensi Sistem Multi-Outlet (Dapat dipantau hingga 5 cabang)", "Rp 5.800.000", False),
            ("Sewa Cloud Server Online Multi-Outlet (1 Tahun Pertama)", "Rp 1.000.000", False),
            ("Penyetelan & Pelatihan Kasir (Lokasi Utama)", "Rp 500.000", False),
            ("Garansi Bantuan Kendala (1 Bulan Pertama)", "GRATIS", True)
        ],
        total_val="Rp 7.300.000"
    )

    # Opsi 3
    draw_table(
        "OPSI 3: Sewa Bulanan (Hosting Server Sudah Termasuk)",
        "ALL-IN-ONE BULANAN",
        [
            ("Sewa Sistem & Cloud Server Online (Per 1 Outlet - Tanpa Laptop)", "Rp 275.000 / bln", False),
            ("Penyetelan Awal & Pelatihan Kasir (Dibayar 1x di awal)", "Rp 350.000", False),
            ("Sewa Cloud Server & Perawatan Sistem Rutin", "TERMASUK", True)
        ],
        total_val="Rp 625.000 (Bln 1) | Rp 275rb/bln"
    )

    # Opsi Starter Offline
    draw_table(
        "OPSI STARTER: Beli Putus Server Lokal (Wi-Fi Toko / Offline)",
        "PALING HEMAT / MINIM BUDGET",
        [
            ("Lisensi Sistem 1 Outlet Offline (Pakai Wi-Fi Lokal Toko)", "Rp 2.200.000", False),
            ("Penyetelan & Pelatihan Kasir di Toko", "Rp 300.000", False),
            ("Bebas Sewa Server Bulanan Selamanya", "TERMASUK", True)
        ],
        total_val="Rp 2.500.000"
    )

    # ----------------------------------------------------
    # HALAMAN 2: Kelebihan & Kekurangan Masing-Masing Opsi
    # ----------------------------------------------------
    pdf.add_page()
    
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(153, 27, 27)
    pdf.cell(0, 6, "III. ANALISIS KELEBIHAN & KEKURANGAN PER OPSI")
    pdf.ln(7)

    def draw_pros_cons_card(option_title, pros_list, cons_list):
        box_y = pdf.get_y()
        pdf.set_fill_color(248, 250, 252)
        pdf.set_draw_color(203, 213, 225)
        
        lines_count = max(len(pros_list), len(cons_list))
        card_h = 9 + (lines_count * 5) + 6
        pdf.rect(10, box_y, 190, card_h, style="FD")
        
        pdf.set_y(box_y + 2)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(15, 23, 42)
        pdf.set_x(14)
        pdf.cell(0, 5, option_title)
        pdf.ln(5)
        
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_x(14)
        pdf.set_text_color(22, 163, 74)
        pdf.cell(90, 4, "[+] Kelebihan System / Nilai Plus:")
        
        pdf.set_text_color(220, 38, 38)
        pdf.cell(90, 4, "[-] Kekurangan / Batasan System:")
        pdf.ln(4.5)
        
        for idx in range(lines_count):
            pro_txt = pros_list[idx] if idx < len(pros_list) else ""
            con_txt = cons_list[idx] if idx < len(cons_list) else ""
            
            pdf.set_font("Helvetica", "", 7.5)
            pdf.set_x(14)
            pdf.set_text_color(51, 65, 85)
            pdf.cell(90, 4.5, f"* {pro_txt}" if pro_txt else "")
            
            pdf.set_text_color(71, 85, 105)
            pdf.cell(90, 4.5, f"* {con_txt}" if con_txt else "")
            pdf.ln(4.5)
            
        pdf.set_y(box_y + card_h + 3.5)

    # Opsi 1 Pros/Cons
    draw_pros_cons_card(
        "OPSI 1: Beli Putus 1 Outlet (Cloud Online - Rp 4.550.000)",
        [
            "Tanpa butuh Laptop di toko (HP & TV langsung jalan).",
            "Pemilik bisa cek omzet & laba harian dari rumah.",
            "Bebas biaya sewa lisensi aplikasi selamanya."
        ],
        [
            "Butuh biaya server cloud Rp 750rb/thn (thn ke-2 dst).",
            "Memerlukan koneksi internet di toko."
        ]
    )

    # Opsi 2 Pros/Cons
    draw_pros_cons_card(
        "OPSI 2: Beli Putus Multi-Outlet 5 Cabang (Rp 7.300.000)",
        [
            "Sangat hemat per cabang (~Rp 1,4 Juta / cabang).",
            "Pantau 5 cabang sekaligus dari 1 HP Pemilik.",
            "Rekapan otomatis HPP, modal & laba per lokasi."
        ],
        [
            "Butuh perpanjangan server cloud multi Rp 1 Juta/thn.",
            "Memerlukan koneksi internet di setiap toko."
        ]
    )

    # Opsi 3 Pros/Cons
    draw_pros_cons_card(
        "OPSI 3: Sewa Bulanan All-in-One (Rp 625rb Awal / Rp 275rb Bln)",
        [
            "Tanpa modal besar di awal (Risiko 0%).",
            "Sewa server cloud & perawatan sudah termasuk.",
            "Cocok untuk uji coba operasional toko baru."
        ],
        [
            "Ada biaya rutin bulanan selama dipakai.",
            "Total bayar jangka panjang lebih tinggi dari Beli Putus."
        ]
    )

    # Opsi Starter Offline Pros/Cons
    draw_pros_cons_card(
        "OPSI STARTER: Beli Putus Server Lokal / Offline (Rp 2.500.000)",
        [
            "0 Rupiah biaya bulanan selamanya (Paling Low Budget).",
            "Tahan mati internet (100% jalan via Wi-Fi toko)."
        ],
        [
            "Wajib menyalakan 1 Laptop/PC di toko saat jam buka.",
            "Pemilik hanya bisa cek omzet saat berada di toko."
        ]
    )

    # Section IV: Layanan Tambahan
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(153, 27, 27)
    pdf.cell(0, 5, "IV. LAYANAN TAMBAHAN (OPSIONAL)")
    pdf.ln(5.5)

    pdf.set_fill_color(153, 27, 27)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(135, 5.5, "  Jenis Layanan / Perawatan", border=1, fill=True)
    pdf.cell(55, 5.5, "Tarif  ", border=1, fill=True, align="R")
    pdf.ln(5.5)

    extras = [
        ("Paket Perawatan (Maintenance) & Support Tahunan", "Rp 1.500.000 / thn"),
        ("Perpanjangan Sewa Cloud Server (Tahun ke-2 dan seterusnya)", "Rp 750.000 / thn"),
        ("Pengembangan Fitur Khusus Baru (Custom Feature)", "Rp 300rb - Rp 600rb")
    ]
    pdf.set_font("Helvetica", "", 7.5)
    pdf.set_text_color(51, 65, 85)
    for i, (item, price) in enumerate(extras):
        fill = (i % 2 == 1)
        pdf.set_fill_color(248, 250, 252) if fill else pdf.set_fill_color(255, 255, 255)
        pdf.cell(135, 5, f"  {item}", border=1, fill=fill)
        pdf.cell(55, 5, f"{price}  ", border=1, fill=fill, align="R")
        pdf.ln(5)

    pdf.ln(4)

    # Syarat Ketentuan & Hak Cipta Box
    term_y = pdf.get_y()
    pdf.set_fill_color(255, 248, 248)
    pdf.set_draw_color(252, 165, 165)
    pdf.rect(10, term_y, 190, 22, style="FD")
    
    pdf.set_y(term_y + 1.5)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(153, 27, 27)
    pdf.set_x(14)
    pdf.cell(0, 4, "V. SYARAT KETENTUAN & HAK CIPTA LISENSI")
    pdf.ln(4)
    
    pdf.set_font("Helvetica", "", 7.5)
    pdf.set_text_color(127, 29, 29)
    terms = [
        "1. Beli Putus (Opsi 1 & 2 & Starter): DP 50% saat kesepakatan awal, Pelunasan 50% setelah sistem terpasang.",
        "2. Opsi Sewa Bulanan (Opsi 3): Pembayaran dilakukan di awal setiap bulan berjalan.",
        "3. Garansi bantuan teknis gratis berlaku selama 30 hari pertama sejak sistem dipasang.",
        "4. Hak Cipta & Kode Program sepenuhnya milik Pengembang. Klien menerima Hak Guna Pakai (Lisensi)."
    ]
    for term in terms:
        pdf.set_x(14)
        pdf.cell(0, 3.8, term)
        pdf.ln(3.8)

    pdf.ln(5)

    # Signature Block
    pdf.set_font("Helvetica", "", 8.5)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(130, 4, "")
    pdf.cell(60, 4, "Hormat kami,", align="C")
    pdf.ln(10)
    
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(130, 4, "")
    pdf.cell(60, 4, "Tim Pengembang Sistem", align="C")

    pdf.output(output_path)
    print(f"PDF Low Budget berhasil dibuat: {output_path}")

if __name__ == "__main__":
    output = "c:/Users/shint/Documents/Codex/2026-07-22/eh/nescafe-queue-display/Proposal_Penawaran_Harga_Sistem.pdf"
    create_pdf(output)
