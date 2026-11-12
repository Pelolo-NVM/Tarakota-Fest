# GLOBAL ANTI-SLOP & BEHAVIOR RULES

- NO FLUFF. Output strictly the requested code.
- Write enterprise-grade, DRY, and modular PHP/JS code without placeholder comments.

# PROJECT MASTER BRIEF: TARAKOTA FEST

## 1. ARCHITECTURE: STRICTLY DECOUPLED (REST API)

**CRITICAL RULE:** The system is strictly divided into a Static Frontend and a PHP REST API Backend.

- **FRONTEND:** MUST remain as pure `.html`, `.css`, and `.js` files. DO NOT convert HTML files into `.php` views. DO NOT use PHP to render HTML.
- **BACKEND:** PHP is STRICTLY for building a JSON REST API. It must only receive HTTP requests and return `application/json`.
- **Directory Enforcement:**
  - `/` (Root or `/ui`): Contains pure `index.html`, `jadwal.html`, `pemesanan.html`, `daftar-band.html`, etc.
  - `/api`: Contains the PHP backend logic (e.g., `/api/index.php` acting as the Single Entry Point ONLY for JSON API routing).

## 2. TECH STACK

- **Back-end:** Native PHP 8.4 (API only). PDO (`ERRMODE_EXCEPTION`, `FETCH_ASSOC`).
- **Front-end:** HTML5, CSS3, Vanilla JavaScript (`fetch()` API).
- **Security:** PDO Prepared Statements, Transactions (`beginTransaction`, `commit`) for ticket purchasing, Soft Deletes via `status` ENUM, and Pagination (`LIMIT/OFFSET`).

# UI/UX BRIEF: TARAKOTA FEST (LIQUID GLASS + TROPICAL POP-ART)

Design a vibrant music festival web app combining Y2K sticker pop-art with modern "Liquid Glassmorphism".

## TOKENS & ASSETS

- **Colors:** Background is Sand Cream `#FDFBF7`. Accents: Sunset Tangerine `#FFB38A`, Seafoam Mint `#6EE7B7`, Lavender Lilac `#D8B4FE`. Text: Dark Espresso `#292524`.
- **Liquid Glass Effect:** UI panels, checkout modals, and navbar must use frosted glassmorphism (translucent backgrounds like `rgba(255, 255, 255, 0.4)` with heavy background-blur). Add subtle white inner-borders and glossy specular highlights to make them look like liquid water or polished glass.
- **Fonts:** Bubbly/rounded outlines (e.g., Fredoka) for headings. Clean sans-serif for UI.
- **Graphics:** Floating pop-art vectors of surfboards, seashells, and starfish.

## UI REQUIREMENTS

- **Navbar:** Liquid glass floating pill at the top.
- **Hero:** Big bubbly "TARAKOTA FEST 2026" surrounded by floating tropical vectors.
- **Event Grid:** Cards designed as physical torn tickets, encased in a liquid glass container.
- **Admin Portal:** Maintain Sand Cream bg, but use translucent liquid glass panels for Data Tables and Sidebar to keep it clean yet aesthetic.
