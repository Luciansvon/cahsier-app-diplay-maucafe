---
version: alpha
name: Maucafe Queue Display System
description: >
  Sistem antrean kedai kopi Maucafe — mencakup Panel Kasir, Layar Display TV,
  Panel Owner, Panel Mitra, dan Launcher. Desain mengutamakan keterbacaan jarak
  jauh untuk TV display dan efisiensi operasional untuk kasir/owner.

colors:
  # --- Brand & Primary ---
  primary: "#c7161e"
  primary-dark: "#941017"
  primary-soft: "#fff0f1"

  # --- Neutral / Surface ---
  ink: "#211916"
  muted: "#756861"
  paper: "#f7f4ef"
  surface: "#ffffff"
  line: "#ded5cc"

  # --- Semantic ---
  green: "#16704e"
  green-soft: "#eaf5ef"
  amber: "#9a6200"
  amber-soft: "#fff5df"

  # --- Display TV ---
  display-bg: "#140d0b"
  display-queue-bg: "#b7131a"
  display-promo-bg: "#000000"

typography:
  heading-display:
    fontFamily: "Georgia, serif"
    fontWeight: 900
    fontSize: "clamp(88px, min(15vw, 27vh), 260px)"
    lineHeight: 1
    letterSpacing: "-0.04em"
    usage: "Nomor antrean besar di layar TV"

  h1:
    fontFamily: "Georgia, serif"
    fontWeight: 900
    fontSize: "clamp(22px, 4vw, 32px)"
    lineHeight: 1.1

  h2:
    fontFamily: "Georgia, serif"
    fontWeight: 900
    fontSize: "clamp(22px, 4vw, 29px)"
    lineHeight: 1.15

  h3:
    fontFamily: "Georgia, serif"
    fontWeight: 900
    fontSize: "20px"
    lineHeight: 1.2

  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontWeight: 400
    fontSize: "16px"
    lineHeight: 1.5

  eyebrow:
    fontFamily: inherit
    fontWeight: 900
    fontSize: "11px"
    letterSpacing: "0.15em"
    textTransform: uppercase
    usage: "Label sub-judul, badge kategori, heading seksi"

  body-small:
    fontFamily: inherit
    fontWeight: 800
    fontSize: "13px"

  caption:
    fontFamily: inherit
    fontWeight: 800
    fontSize: "12px"

spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "18px"
  xxl: "24px"

rounded:
  sm: "10px"
  md: "12px"
  lg: "14px"
  xl: "16px"
  pill: "999px"

shadows:
  none: "none"
  note: "Sistem ini tidak menggunakan box-shadow. Pemisahan visual menggunakan border solid 1px dengan warna 'line'."

breakpoints:
  mobile-small: "350px"
  mobile: "430px"
  tablet-small: "480px"
  tablet: "700px"
  tablet-landscape: "820px"
  desktop: "1120px"
---

# Maucafe — Design System

## Overview

Maucafe adalah sistem antrean kedai kopi dengan 5 halaman utama:
- **Launcher** — halaman awal untuk memilih akses (kasir/mitra/owner)
- **Admin (Kasir)** — panel operasional kasir: buat pesanan, kelola antrean, shift
- **Display** — layar TV 16:9 untuk menampilkan nomor antrean + media promo
- **Owner** — dashboard pemilik: laporan, manajemen produk, pengaturan
- **Partner (Mitra)** — panel mitra outlet: operasional harian

Brand identity: logo badge bulat merah dengan huruf "M" putih (font Georgia serif).

## Prinsip Visual

1. **Warm & earthy tone** — Background `paper` (#f7f4ef) bukan putih bersih, memberikan kesan hangat dan premium seperti kedai kopi.
2. **Red as hero** — Warna primer merah (#c7161e) digunakan untuk brand, CTA, dan elemen aktif. Tidak untuk teks panjang.
3. **Border-based separation** — Tidak menggunakan shadow. Pemisahan elemen menggunakan `border: 1px solid var(--line)`.
4. **Georgia for display, Inter for UI** — Heading menggunakan Georgia serif (bold, tegas). Body & UI menggunakan Inter sans-serif (modern, readable).
5. **Mobile-first responsive** — Layout 2-kolom di desktop, 1 kolom di mobile. Breakpoint utama 700px.

## Warna

### Brand
| Token | Hex | Penggunaan |
|-------|-----|------------|
| `primary` | #c7161e | Button CTA, tab aktif, badge brand, warna aksen utama |
| `primary-dark` | #941017 | Hover state button, danger action latar |
| `primary-soft` | #fff0f1 | Background chip aktif, highlight ringan |

### Neutral
| Token | Hex | Penggunaan |
|-------|-----|------------|
| `ink` | #211916 | Teks utama body |
| `muted` | #756861 | Teks sekunder, label, caption |
| `paper` | #f7f4ef | Background halaman utama |
| `surface` | #ffffff | Background card, input, modal |
| `line` | #ded5cc | Border card, divider, input border |

### Semantic
| Token | Hex | Penggunaan |
|-------|-----|------------|
| `green` | #16704e | Status ready/sukses, toast sukses, margin positif |
| `green-soft` | #eaf5ef | Background badge ready |
| `amber` | #9a6200 | Status waiting/pending |
| `amber-soft` | #fff5df | Background badge waiting |

### Display TV
| Token | Hex | Penggunaan |
|-------|-----|------------|
| `display-bg` | #140d0b | Background body TV |
| `display-queue-bg` | #b7131a | Background panel antrean kiri |
| `display-promo-bg` | #000000 | Background panel promo kanan |

## Tipografi

### Font Stack
- **Heading/Display**: `Georgia, serif` — weight 900
- **Body/UI**: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`

### Skala
| Level | Font | Size | Weight | Penggunaan |
|-------|------|------|--------|------------|
| Display | Georgia | clamp(88px–260px) | 900 | Nomor antrean TV besar |
| H1 | Georgia | clamp(22px–32px) | 900 | Judul halaman |
| H2 | Georgia | clamp(22px–29px) | 900 | Judul seksi |
| H3 | Georgia | 20px | 900 | Sub-heading |
| Eyebrow | Inter | 11px | 900 | Label uppercase, badge kategori |
| Body | Inter | 16px | 400 | Teks paragraf |
| Body Small | Inter | 13px | 800 | Teks sekunder, ringkasan |
| Caption | Inter | 12px | 800 | Label field, metadata |

## Spacing

Spacing menggunakan kelipatan 4px:
- `xs`: 4px — gap kecil dalam komponen
- `sm`: 8px — padding internal, gap grid kecil
- `md`: 12px — gap standar antar elemen
- `lg`: 16px — padding card, gap grid utama
- `xl`: 18px — padding section owner
- `xxl`: 24px — jarak besar antar section

## Border Radius

| Token | Value | Penggunaan |
|-------|-------|------------|
| `sm` | 10px | Button kecil, input compact, chip |
| `md` | 12px | Button standar, input, card kecil |
| `lg` | 14px | Card utama, tab bar |
| `xl` | 16px | Modal dialog |
| `pill` | 999px | Badge koneksi, status pill, category chip |

---

## Komponen

### Button

Ada 5 varian button:

| Varian | Warna Teks | Background | Border | Penggunaan |
|--------|-----------|------------|--------|------------|
| `primary` | #fff | primary (#c7161e) | none | CTA utama: Bayar, Simpan, Buka Shift |
| `success` | #fff | green (#16704e) | none | Aksi positif: Siap, Panggil |
| `ghost` / `secondary` | ink | surface + border line | 1px solid line | Aksi sekunder: Kunci, Kembali |
| `danger-btn` | #fff | primary-dark | none | Aksi destruktif: Konfirmasi Pembatalan |
| `small-btn` | — | — | — | Modifier: min-height 38px, font 13px |

Semua button:
- `min-height: 44px` (touch target)
- `border-radius: 999px` (kapsul / pill shape modern)
- `font-weight: 800`
- `cursor: pointer`
- `transition: transform 0.15s ease, background-color 0.15s ease`
- `:hover` → `transform: translateY(-1px)`
- `:active` → `transform: scale(0.97)`
- `:disabled` → `opacity: 0.45, cursor: not-allowed`

### Card

```
border: 1px solid var(--line);
border-radius: 14px;
background: var(--surface);
```

Varian khusus:
- **Cart card**: sticky di desktop, static di mobile
- **Order card**: border-left 5px solid amber (waiting) atau green (ready)
- **Owner metric card**: border-left 4px solid warna semantik
- **Danger zone**: border-color #e8aaae, background #fff8f8

### Input / Form Field

```
width: 100%;
min-height: 46px;
border: 1px solid var(--line);
border-radius: 11px;
padding: 0 12px;
color: var(--ink);
background: var(--surface);
```

Label di atas input:
- `color: var(--muted)`
- `font-size: 12px`
- `font-weight: 800`

### Tab Bar

```
display: grid;
grid-template-columns: repeat(N, minmax(0, 1fr));
gap: 5px;
border: 1px solid var(--line);
border-radius: 14px;
padding: 5px;
background: rgb(247 244 239 / 96%);
```

Tab aktif: `color: #fff; background: var(--red);`
Tab inaktif: `color: var(--muted); background: transparent;`

Sticky di bagian atas (top: safe-area).

### Status Pill

```
border-radius: 999px;
padding: 5px 10px;
font-size: 11px;
font-weight: 900;
text-transform: uppercase;
```

- Waiting: `color: amber, background: amber-soft`
- Ready: `color: green, background: green-soft`

### Connection Badge

```
display: inline-flex;
align-items: center;
gap: 7px;
border: 1px solid var(--line);
border-radius: 999px;
padding: 6px 11px;
font-size: 12px;
font-weight: 800;
```

Dengan dot pseudo-element 8×8px bulat.
- Online: `color: green`
- Offline: `color: red`

### Modal / Dialog

```
width: min(94vw, 620px);
border: 0;
border-radius: 16px;
padding: 20px;
background: var(--surface);
backdrop: rgb(20 14 12 / 70%);
```

### Toast

```
position: fixed;
bottom-right corner;
border-radius: 12px;
padding: 13px 16px;
color: #fff;
background: var(--green);
font-weight: 800;
```

### PIN Lock Screen

Layout: centered grid, full viewport height.
Card: `width: min(100%, 380px)`, text-align center.
Keypad: `grid 3×4`, gap 9px, button 54px tinggi.

### Brand Logo Badge

```
width: 42px (large: 64px);
border-radius: 50%;
color: #fff;
background: var(--red);
font-family: Georgia, serif;
font-weight: 900;
```

---

## Layout Halaman

### Launcher
- Full-screen centered card (max 430px)
- Brand badge + eyebrow + heading
- Form/action buttons stacked vertikal

### Admin (Kasir)
- Header: brand + connection badge + tombol kunci
- Tab bar 4 kolom: Kasir | Pesanan | Shift | Media TV
- Cashier panel: 2 kolom — product grid (1.75fr) + cart card (0.85fr)
- Product grid: auto-fill minmax(145px, 1fr)
- Mobile (<700px): 1 kolom + sticky cart bar di bawah

### Display (TV)
- Full viewport, aspect-ratio 16:9, no scroll
- 2 panel horizontal: queue (34%) + promo (66%)
- Queue panel: background merah, nomor raksasa centered
- Promo panel: video/gambar full-bleed

### Owner
- Header + outlet selector bar
- Tab bar 5 kolom: Ringkasan | Penjualan | Laporan | Produk | Pengaturan
- Metric grid: auto-fit minmax(155px, 1fr)
- Revenue card span 2 kolom

### Partner (Mitra)
- Header + toolbar dengan outlet selector
- Tab bar 4 kolom
- Operations grid 3 kolom → 1 kolom di mobile

---

## Anti-Patterns (Jangan Dilakukan)

1. ❌ **Jangan pakai box-shadow** — gunakan border solid
2. ❌ **Jangan pakai warna pure white (#fff) sebagai background halaman** — gunakan `paper` (#f7f4ef)
3. ❌ **Jangan pakai font sans-serif untuk heading** — selalu Georgia serif
4. ❌ **Jangan buat button lebih kecil dari 44px tinggi** — itu minimum touch target
5. ❌ **Jangan nest card di dalam card** — gunakan section/divider
6. ❌ **Jangan pakai uppercase di body text** — hanya untuk eyebrow/badge
7. ❌ **Jangan tambah dekorasi visual di Display TV** — fokus keterbacaan jarak jauh
8. ❌ **Jangan pakai border-radius > 16px** kecuali untuk pill (999px)

## Aksesibilitas

- Semua interaktif punya `focus-visible` outline: `3px solid color-mix(in srgb, var(--red) 28%, transparent)`
- Screen reader: gunakan `.sr-only` untuk label tersembunyi
- Touch target minimum 44px
- `role="status"` untuk toast dan connection badge
- `role="alert"` untuk error message
- `aria-label` untuk button tanpa teks visual
- `color-scheme: light` di root

## Responsive

| Breakpoint | Perilaku |
|------------|----------|
| ≤ 350px | Metric grid 1 kolom |
| ≤ 430px | Product grid 2 kolom, header stack vertikal |
| ≤ 480px | Owner header grid 1 kolom, outlet bar stack |
| ≤ 700px | Cashier 1 kolom + mobile cart bar, operations 1 kolom |
| ≤ 820px | Cashier grid lebih rapat |
| > 820px | Full 2-kolom layout |
