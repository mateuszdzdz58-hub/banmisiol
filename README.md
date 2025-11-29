# Bank Miśiołów - szybki start

## Co jest w paczce
- `server.js` - serwer Node (Express) + SQLite
- `db_init.sql` - schemat bazy
- `public/` - frontend (index.html + app.js)
- `.env.example` - przykład zmiennych środowiskowych

## Jak odpalic lokalnie (szybko)
1. Rozpakuj ZIP na maszynie z Node.js (wersja 16+).
2. Skopiuj `.env.example` do `.env` i ustaw `JWT_SECRET` na mocne hasło.
3. W katalogu projektu uruchom:
   ```bash
   npm install
   npm start
   ```
4. Otwórz w przeglądarce: `http://localhost:3000`

## Konta przykładowe (seedowane przy pierwszym uruchomieniu)
- login: `misiu1` / hasło: `haslo1`
- login: `misiu2` / hasło: `haslo2`
- login: `admin`  / hasło: `adminpass` (rola: admin)

## Uwaga o bezpieczeństwie
To demo. Nie używaj w produkcji bez dodatkowych zabezpieczeń (HTTPS, rate-limiting, audyt, hardening JWT secret).
