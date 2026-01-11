Каталог игр:
Веб-приложение для просмотра каталога игр с возможностью фильтрации, поиска и сохранения избранных игр.
Использует API IGDB для получения данных об играх.

Технологии:
- Frontend: React, TypeScript, Vite
- Backend: Node.js, Express
- База данных: SQLite
- API: IGDB (Twitch)

Структура проекта:

Ludex-Game-Catalog/
├── backend/              # Backend 
│   ├── server.js        # Основной файл сервера
│   ├── auth.js          # Аутентификация
│   ├── database.js      # Работа с БД
│   ├── services/        # Сервисы
│   │   ├── igdbService.js
│   │   └── twitchAuth.js
│   └── package.json
├── frontend/            # Frontend 
│   ├── src/
│   │   ├── components/  # компоненты
│   │   ├── pages/       # Страницы приложения
│   │   ├── contexts/    # контексты
│   │   ├── hooks/       # Кастомные хуки
│   │   ├── services/    # API сервисы
│   │   └── types/       # типы
│   └── package.json
└── README.md

Запуск:

cd ../backend
npm run dev

cd ../frontend
npm run dev



