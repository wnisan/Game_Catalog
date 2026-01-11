import axios from 'axios';
import twitchAuth from './twitchAuth.js';
import dotenv from 'dotenv';

dotenv.config();

class IGDBService {

    constructor() {
        this.baseURL = 'https://api.igdb.com/v4';
    }

    async getGamesCount({
        search,
        ratingMin,
        ratingMax,
        genres,
        platforms,
        engines,
        releaseDateMin,
        releaseDateMax,
        pegi
    }) {
            const headers = await twitchAuth.getAuthHeaders();
        const where = [];

        // Фильтрация по рейтингу с учетом округления
        if (ratingMin !== undefined && ratingMin !== null && !isNaN(Number(ratingMin))) {
            const minRating = Number(ratingMin);

            const minValue = minRating > 0 ? Math.max(0, Math.floor(minRating - 0.5)) : 0;
            where.push(`rating >= ${minValue}`);
            console.log(`Rating min filter (count): requesting rating >= ${minValue} (for minRating=${minRating})`);
        }
        if (ratingMax !== undefined && ratingMax !== null && !isNaN(Number(ratingMax))) {
            const maxRating = Number(ratingMax);
            let maxValue;
            if (maxRating >= 100) {
                maxValue = 100;
            } else if (maxRating >= 22 && maxRating <= 91) {
                maxValue = Math.min(100, maxRating + 15);
            } else if (maxRating < 22) {
                // Для низкого диапазона (0-21) расширяем больше, чтобы захватить игры с округлением
                maxValue = Math.min(100, maxRating + 5);
            } else {
                // Для высокого диапазона (92-99) используем меньшее расширение
                maxValue = Math.min(100, maxRating + 2);
            }
            where.push(`rating <= ${maxValue}`);
            console.log(`Rating max filter (count): requesting rating <= ${maxValue} (for maxRating=${maxRating})`);
        }

        const addFilterCondition = (filterValue, fieldName) => {
            if (!filterValue) return;
            const ids = filterValue.split(',').map(Number).filter(n => !isNaN(n));
            if (ids.length > 0) {
                if (ids.length === 1) {
                    where.push(`${fieldName} = (${ids[0]})`);
                } else {
                    const conditions = ids.map(id => `${fieldName} = (${id})`);
                    where.push(conditions.join(' & '));
                }
            }
        };

        addFilterCondition(genres, 'genres');
        addFilterCondition(platforms, 'platforms');
        addFilterCondition(engines, 'game_engines');

        const dateConditions = [];
        if (releaseDateMin) {
            const from = Math.floor(new Date(releaseDateMin).getTime() / 1000);
            if (!Number.isNaN(from)) {
                dateConditions.push(`first_release_date >= ${from}`);
            }
        }
        if (releaseDateMax) {
            const to = Math.floor(new Date(releaseDateMax).getTime() / 1000);
            if (!Number.isNaN(to)) {
                dateConditions.push(`first_release_date <= ${to}`);
            }
        }
        if (dateConditions.length) {
            where.push(...dateConditions);
        }

        if (search && search.trim()) {
            const searchTerm = search.trim();
            const escapedSearch = searchTerm.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            where.push(`name ~ "${escapedSearch}"*`);
        }

        // PEGI фильтрация: category = 2, rating: 1=3+, 2=7+, 3=12+, 4=16+, 5=18+
        if (pegi) {
            const pegiValues = pegi.split(',').map(Number).filter(n => !isNaN(n));
            if (pegiValues.length > 0) {
                const pegiMap = { 3: 1, 7: 2, 12: 3, 16: 4, 18: 5 };
                const apiRatings = pegiValues
                    .map(v => pegiMap[v])
                    .filter(v => v !== undefined);

                if (apiRatings.length > 0) {
                  
                    const ratingQuery = apiRatings.length === 1 
                        ? apiRatings[0] 
                        : `(${apiRatings.join(',')})`;

                    where.push(`age_ratings.category = 2 & age_ratings.rating = ${ratingQuery}`);
                    console.log(`PEGI filter (count): requesting category=2, ratings=${apiRatings.join(',')} (for user values: ${pegiValues.join(',')})`);
                }
            }
        }

        let query = '';
        if (where.length > 0) {
            query = `where ${where.join(' & ')};`;
        }

        try {
            const response = await axios.post(
                `${this.baseURL}/games/count`,
                query,
                { headers }
            );
            const count = response.data.count || 0;
            if (genres || platforms || engines || pegi) {
                console.log(`getGamesCount result: ${count} games`);
            }
            return count;
        } catch (error) {
            console.error('Error getting games count:', error.response?.data || error.message);
            console.error('Query was:', query);
            return 0;
        }
    }

    async getGamesWithFilters({
        limit,
        offset,
        search,
        ratingMin,
        ratingMax,
        genres,
        platforms,
        engines,
        releaseDateMin,
        releaseDateMax,
        pegi,
        sortBy
    }) {
        const headers = await twitchAuth.getAuthHeaders();

        const where = [];
        if (ratingMin !== undefined && ratingMin !== null && !isNaN(Number(ratingMin))) {

            const minRating = Number(ratingMin);
            const minValue = minRating > 0 ? Math.max(0, Math.floor(minRating - 0.5)) : 0;
            where.push(`rating >= ${minValue}`);
        }
        if (ratingMax !== undefined && ratingMax !== null && !isNaN(Number(ratingMax))) {
            const maxRating = Number(ratingMax);
            let maxValue;
            if (maxRating >= 100) {
                maxValue = 100;
            } else if (maxRating >= 22 && maxRating <= 91) {

                maxValue = Math.min(100, maxRating + 10);
            } else if (maxRating < 22) {
                // Для низкого диапазона (0-21) расширяем больше, чтобы захватить игры с округлением
                maxValue = Math.min(100, maxRating + 5);
            } else {
                // Для высокого диапазона (92-99) используем меньшее расширение
                maxValue = Math.min(100, maxRating + 2);
            }
            where.push(`rating <= ${maxValue}`);
            console.log(`Rating max filter: requesting rating <= ${maxValue} (for maxRating=${maxRating})`);
        }

        const addFilterCondition = (filterValue, fieldName) => {
            if (!filterValue) return;
            const ids = filterValue.split(',').map(Number).filter(n => !isNaN(n));
            if (ids.length > 0) {
                if (ids.length === 1) {
                    where.push(`${fieldName} = (${ids[0]})`);
                } else {
                    const conditions = ids.map(id => `${fieldName} = (${id})`);
                    where.push(conditions.join(' & '));
                }
            }
        };

        addFilterCondition(genres, 'genres');
        addFilterCondition(platforms, 'platforms');
        addFilterCondition(engines, 'game_engines');

        // PEGI фильтрация: category = 2, rating: 1=3+, 2=7+, 3=12+, 4=16+, 5=18+
        if (pegi) {
            const pegiValues = pegi.split(',').map(Number).filter(n => !isNaN(n));
            if (pegiValues.length > 0) {
                //пользователь выбирает 3, 7, 12, 16, 18 -> API использует 1, 2, 3, 4, 5
                const pegiMap = { 3: 1, 7: 2, 12: 3, 16: 4, 18: 5 };
                const apiRatings = pegiValues
                    .map(v => pegiMap[v])
                    .filter(v => v !== undefined);

                if (apiRatings.length > 0) {
                   
                    const ratingQuery = apiRatings.length === 1 
                        ? apiRatings[0] 
                        : `(${apiRatings.join(',')})`;

                    where.push(`age_ratings.category = 2 & age_ratings.rating = ${ratingQuery}`);
                    console.log(`PEGI filter: requesting category=2, ratings=${apiRatings.join(',')} (for user values: ${pegiValues.join(',')})`);
                }
            }
        }

        const dateConditions = [];
        if (releaseDateMin) {
            const from = Math.floor(new Date(releaseDateMin).getTime() / 1000);
            if (!Number.isNaN(from)) {
                dateConditions.push(`first_release_date >= ${from}`);
            }
        }
        if (releaseDateMax) {
            const to = Math.floor(new Date(releaseDateMax).getTime() / 1000);
            if (!Number.isNaN(to)) {
                dateConditions.push(`first_release_date <= ${to}`);
            }
        }
        if (dateConditions.length) {
            where.push(...dateConditions);
        }
        const sortMap = {
            'rating-desc': 'rating desc',
            'rating-asc': 'rating asc',
            'name-asc': 'name asc',
            'name-desc': 'name desc',
            'release-desc': 'first_release_date desc',
            'release-asc': 'first_release_date asc'
        };

        let query = `fields name, rating, summary, cover.image_id, genres.name, platforms.name, game_engines.name, first_release_date, age_ratings, websites.url, websites.category;`;

        if (search && search.trim()) {
            const searchTerm = search.trim();
            const escapedSearch = searchTerm.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            // Используем where name ~ "text"* для поиска по начальным буквам/части слова
            where.push(`name ~ "${escapedSearch}"*`);
            console.log(`Using where name ~ filter for search: "${searchTerm}"`);
        }

        if (where.length > 0) {
            query += ` where ${where.join(' & ')};`;
        }

        const hasRatingFilterInQuery = where.some(w => w.includes('rating'));
        if (hasRatingFilterInQuery && sortBy && sortBy.startsWith('rating')) {
            query += ` sort id desc;`;
        } else {
            query += ` sort ${sortMap[sortBy] || 'first_release_date desc'};`;
        }

        const hasRatingFilter = (ratingMin !== undefined && ratingMin !== null && !isNaN(Number(ratingMin))) ||
            (ratingMax !== undefined && ratingMax !== null && !isNaN(Number(ratingMax)));
        const actualLimit = hasRatingFilter ? 500 : limit;

        query += ` limit ${actualLimit};`;
        query += ` offset ${offset};`;

        if (pegi) {
            const pegiConditions = where.filter(w => w.includes('age_ratings'));
            console.log('PEGI where conditions:', pegiConditions);
        }
        console.log('IGDB Query:', query);
        const ratingFilters = where.filter(w => w.includes('rating'));
        console.log('Rating filter:', {
            ratingMin,
            ratingMax,
            whereRating: ratingFilters,
            actualLimit,
            offset
        });

        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        const maxRetries = 3;
        let lastError = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    const delayMs = 1000 * Math.pow(2, attempt - 1);
                    console.log(`IGDB API rate limit. Retrying in ${delayMs}ms... (attempt ${attempt}/${maxRetries})`);
                    await delay(delayMs);
                }

        const response = await axios.post(
            `${this.baseURL}/games`,
            query,
            { headers }
        );

                console.log(`IGDB API returned ${response.data.length} games`);
                console.log(`Query sent to IGDB:`, query.substring(0, 500));
                
                if (response.data.length > 0) {
                    console.log('=== RAW IGDB RESPONSE (first 2 games) ===');
                    response.data.slice(0, 2).forEach((game, idx) => {
                        console.log(`Game ${idx + 1} (ID: ${game.id}):`, JSON.stringify({
                            id: game.id,
                            name: game.name,
                            age_ratings: game.age_ratings,
                            age_ratings_type: typeof game.age_ratings,
                            age_ratings_isArray: Array.isArray(game.age_ratings),
                            age_ratings_length: Array.isArray(game.age_ratings) ? game.age_ratings.length : 'N/A'
                        }, null, 2));
                    });
          
                }

                if (response.data.length > 0) {

                    const sampleGames = response.data.slice(0, 3);
                    sampleGames.forEach((game, index) => {
                        console.log(`Game ${index + 1} (ID: ${game.id}, Name: ${game.name}):`);
                        console.log(`  - age_ratings exists: ${!!game.age_ratings}`);
                        if (game.age_ratings) {
                            console.log(`  - age_ratings type: ${typeof game.age_ratings}, isArray: ${Array.isArray(game.age_ratings)}`);
                            if (Array.isArray(game.age_ratings)) {
                                console.log(`  - age_ratings length: ${game.age_ratings.length}`);
                                if (game.age_ratings.length > 0) {
                                    console.log(`  - first item:`, JSON.stringify(game.age_ratings[0]).substring(0, 200));
                                }
                            } else {
                                console.log(`  - age_ratings object:`, JSON.stringify(game.age_ratings).substring(0, 200));
                            }
                        } else {
                            console.log(`  - age_ratings is null/undefined`);
                        }
                    });
                    
                    const gamesWithAgeRatings = response.data.filter(g => g.age_ratings && 
                        (Array.isArray(g.age_ratings) ? g.age_ratings.length > 0 : true));
                    console.log(`Summary: Games with age_ratings: ${gamesWithAgeRatings.length} out of ${response.data.length}`);
                    
                  
                }

                let needsAgeRatingsExpansion = false;
            
                const hasAnyAgeRatings = response.data.some(game => 
                    game.age_ratings && 
                    (Array.isArray(game.age_ratings) ? game.age_ratings.length > 0 : true)
                );
                
                if (hasAnyAgeRatings) {
               
                    for (const game of response.data) {
                        if (game.age_ratings) {
                            if (Array.isArray(game.age_ratings) && game.age_ratings.length > 0) {
                                const firstRating = game.age_ratings[0];
               
                                if (typeof firstRating === 'number' || 
                                    (firstRating && typeof firstRating === 'object' && firstRating.id !== undefined && firstRating.category === undefined)) {
                                    needsAgeRatingsExpansion = true;
                                    break;
                                }
                            } else if (typeof game.age_ratings === 'object' && !Array.isArray(game.age_ratings)) {
                                if (game.age_ratings.id !== undefined && game.age_ratings.category === undefined) {
                                    needsAgeRatingsExpansion = true;
                                    break;
                                }
                            }
                        }
                    }
                }

                console.log(`Age ratings expansion needed: ${needsAgeRatingsExpansion}, has any age_ratings: ${hasAnyAgeRatings}`);

                let ageRatingsMap = new Map();
     
                if (needsAgeRatingsExpansion || hasAnyAgeRatings) {
                    const ageRatingIds = new Set();
                    response.data.forEach(game => {
                        if (game.age_ratings) {
                            if (Array.isArray(game.age_ratings)) {
                                game.age_ratings.forEach(ar => {
                                    const id = typeof ar === 'number' ? ar : (ar && ar.id ? ar.id : null);
                                    if (id) {
                                        ageRatingIds.add(id);
                                    }
                                });
                            } else if (typeof game.age_ratings === 'object' && game.age_ratings.id !== undefined) {
                
                                ageRatingIds.add(game.age_ratings.id);
                            }
                        }
                    });

                    if (ageRatingIds.size > 0) {
                        try {
                            const ageRatingIdsArray = Array.from(ageRatingIds);
                            for (let i = 0; i < ageRatingIdsArray.length; i += 500) {
                                const batch = ageRatingIdsArray.slice(i, i + 500);
                                const ageRatingsQuery = `fields id, category, rating; where id = (${batch.join(',')}); limit 500;`;
                                const ageRatingsResponse = await axios.post(
                                    `${this.baseURL}/age_ratings`,
                                    ageRatingsQuery,
                                    { headers }
                                );
                                ageRatingsResponse.data.forEach(ar => {
                                    ageRatingsMap.set(ar.id, ar);
                                });
                            }
                            console.log(`Fetched ${ageRatingsMap.size} age_ratings details for expansion`);

                            if (ageRatingsMap.size > 0) {
                                const sampleRatings = Array.from(ageRatingsMap.values()).slice(0, 5);
                                console.log('Sample expanded age_ratings:', sampleRatings);
                            }
                        } catch (error) {
                            console.error('Error fetching age_ratings details:', error.response?.data || error.message);
                        }
                    }

                    let expandedCount = 0;
                    let alreadyExpandedCount = 0;
                    response.data.forEach(game => {
                        if (game.age_ratings) {
                            if (Array.isArray(game.age_ratings)) {
                                if (game.age_ratings.length > 0) {
                            
                                    const firstRating = game.age_ratings[0];
                                    const needsExpansion = typeof firstRating === 'number' || 
                                        (firstRating && firstRating.id !== undefined && firstRating.category === undefined);
                                    
                                    if (ageRatingsMap.size > 0) {
                                        const expandedRatings = [];
                                        game.age_ratings.forEach(ar => {
                                            const id = typeof ar === 'number' ? ar : (ar && ar.id ? ar.id : null);
                                            if (id && ageRatingsMap.has(id)) {
                                                expandedCount++;
                                                expandedRatings.push(ageRatingsMap.get(id));
                                            }
                                        });
                                        game.age_ratings = expandedRatings;
                                        if (game.age_ratings.length > 0) {
                                            console.log(`Game ${game.id} (${game.name}): expanded ${game.age_ratings.length} age_ratings`);
                                        } else {
                                            console.warn(`Game ${game.id} (${game.name}): age_ratings IDs found but not in expansion map`);
                                        }
                                    } else {
                                        console.warn(`Game ${game.id} (${game.name}): age_ratings found but expansion map is empty`);
                                        game.age_ratings = [];
                                    }
                                } else {
             
                                    game.age_ratings = [];
                                }
                            } else if (typeof game.age_ratings === 'object' && !Array.isArray(game.age_ratings)) {
            
                                if (game.age_ratings.category !== undefined) {
                      
                                    alreadyExpandedCount++;
                                    game.age_ratings = [game.age_ratings];
                                } else if (game.age_ratings.id !== undefined && ageRatingsMap.size > 0) {
                                    // Нужно расширение
                                    const id = game.age_ratings.id;
                                    if (ageRatingsMap.has(id)) {
                                        expandedCount++;
                                        game.age_ratings = [ageRatingsMap.get(id)];
                                        console.log(`Game ${game.id} age_ratings (single object) expanded successfully`);
                                    } else {
                                        game.age_ratings = [];
                                    }
                                } else {
                                    game.age_ratings = [];
                                }
                            }
                        } else {
            
                            game.age_ratings = [];
                        }
                    });
                    console.log(`Expanded ${expandedCount} age_ratings IDs to full objects, ${alreadyExpandedCount} already had category`);
                }

                let websitesMap = new Map();
                const websiteIds = new Set();
                response.data.forEach(game => {
                    if (game.websites) {
                        if (Array.isArray(game.websites)) {
                            game.websites.forEach(w => {
                                const id = typeof w === 'number' ? w : (w && w.id && !w.url ? w.id : null);
                                if (id) {
                                    websiteIds.add(id);
                                }
                            });
                        } else if (typeof game.websites === 'object' && game.websites.id !== undefined && !game.websites.url) {
                            websiteIds.add(game.websites.id);
                        }
                    }
                });

                if (websiteIds.size > 0) {
                    try {
                        const websiteIdsArray = Array.from(websiteIds);
                        for (let i = 0; i < websiteIdsArray.length; i += 500) {
                            const batch = websiteIdsArray.slice(i, i + 500);
                            const websitesQuery = `fields id, url, category; where id = (${batch.join(',')}); limit 500;`;
                            const websitesResponse = await axios.post(
                                `${this.baseURL}/websites`,
                                websitesQuery,
                                { headers }
                            );
                            websitesResponse.data.forEach(w => {
                                websitesMap.set(w.id, w);
                            });
                        }
                        console.log(`Fetched ${websitesMap.size} websites details for expansion`);
                    } catch (error) {
                        console.error('Error fetching websites details:', error.response?.data || error.message);
                    }
                }

                response.data.forEach(game => {
                    if (game.websites) {
                        if (Array.isArray(game.websites)) {
                            const expandedWebsites = [];
                            game.websites.forEach(w => {
                                const id = typeof w === 'number' ? w : (w && w.id ? w.id : null);
                                if (id && websitesMap.has(id)) {
                                    expandedWebsites.push(websitesMap.get(id));
                                } else if (w && typeof w === 'object' && w.url && w.category) {
                                    expandedWebsites.push(w);
                                }
                            });
                            if (expandedWebsites.length > 0) {
                                game.websites = expandedWebsites;
                            }
                        } else if (typeof game.websites === 'object') {
                            if (game.websites.id !== undefined && !game.websites.url && websitesMap.has(game.websites.id)) {
                                game.websites = [websitesMap.get(game.websites.id)];
                            } else if (game.websites.url && game.websites.category) {
                                game.websites = [game.websites];
                            }
                        }
                    }
                });

                let games = response.data.map(game => this.normalizeGame(game));

                const hasRatingFilterInQuery = where.some(w => w.includes('rating'));
                const wasSortChanged = hasRatingFilterInQuery && sortBy && sortBy.startsWith('rating');

             
                if (games.length > 0 && (ratingMin !== undefined || ratingMax !== undefined)) {
                    const sampleRatings = games.slice(0, 10).map(g => ({
                        name: g.name,
                        rating: g.rating,
                        rounded: g.rating ? Math.round(g.rating) : null
                    }));
                    console.log('Sample game ratings (first 10):', sampleRatings);

                    const ratings = games.filter(g => g.rating).map(g => Math.round(g.rating));
                    if (ratings.length > 0) {
                        const minR = Math.min(...ratings);
                        const maxR = Math.max(...ratings);
                        const avgR = Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length);
                        console.log(`Rating stats: min=${minR}, max=${maxR}, avg=${avgR}, total=${ratings.length}`);
                    }
                }

                if (ratingMin !== undefined && ratingMin !== null && !isNaN(Number(ratingMin))) {
                    const minRating = Number(ratingMin);
                    const beforeFilter = games.length;
                    const gamesWithoutRating = games.filter(g => !g.rating).length;
                    console.log(`Before rating min filter: ${beforeFilter} games (${gamesWithoutRating} without rating), minRating=${minRating}`);
                    games = games.filter(game => {
                        if (!game.rating) return false;
                        const roundedRating = Math.round(game.rating);
                        return roundedRating >= minRating;
                    });
                    console.log(`Rating min filter (>= ${minRating}): ${beforeFilter} -> ${games.length} games`);
                }
                if (ratingMax !== undefined && ratingMax !== null && !isNaN(Number(ratingMax))) {
                    const maxRating = Number(ratingMax);
                    const beforeFilter = games.length;
                    const gamesWithoutRating = games.filter(g => !g.rating).length;
                    console.log(`Before rating max filter: ${beforeFilter} games (${gamesWithoutRating} without rating), maxRating=${maxRating}`);
                    games = games.filter(game => {
                        if (!game.rating) return false;
                        const roundedRating = Math.round(game.rating);
                        return roundedRating <= maxRating;
                    });
                    console.log(`Rating max filter (<= ${maxRating}): ${beforeFilter} -> ${games.length} games`);
                }

                console.log(`Final games count after rating filters: ${games.length}`);

                if (wasSortChanged) {
                    const sortDirection = sortBy.includes('desc') ? 'desc' : 'asc';
                    games.sort((a, b) => {
                        const ratingA = a.rating || 0;
                        const ratingB = b.rating || 0;
                        return sortDirection === 'desc' ? ratingB - ratingA : ratingA - ratingB;
                    });
                    console.log(`Re-sorted games by rating ${sortDirection} after filtering`);
                }

                if (games.length === 0 && (ratingMin !== undefined || ratingMax !== undefined) && response.data.length > 0) {
                    console.warn(`No games after rating filter! ratingMin=${ratingMin}, ratingMax=${ratingMax}`);
                    const sampleRatings = response.data.slice(0, 20).map(g => ({
                        id: g.id,
                        name: g.name?.substring(0, 40),
                        rating: g.rating,
                        rounded: g.rating ? Math.round(g.rating) : null
                    }));
                    console.log('Sample ratings from API response (first 20):', sampleRatings);
                }

                if (search && search.trim()) {
                    const searchLower = search.trim().toLowerCase();
                    games.sort((a, b) => {
                        const aStarts = a.name && a.name.toLowerCase().startsWith(searchLower);
                        const bStarts = b.name && b.name.toLowerCase().startsWith(searchLower);
                        if (aStarts && !bStarts) return -1;
                        if (!aStarts && bStarts) return 1;
                        return 0;
                    });
                }

                const applyClientSideFilter = (filterValue, gameField) => {
                    if (!filterValue) return;
                    const ids = filterValue.split(',').map(Number).filter(n => !isNaN(n));
                    if (ids.length > 1) {
                        games = games.filter(game => {
                            if (!game[gameField] || game[gameField].length === 0) return false;
                            const gameIds = game[gameField].map(item => item.id);
                            return ids.every(id => gameIds.includes(id));
                        });
                    }
                };

                applyClientSideFilter(genres, 'genres');
                applyClientSideFilter(platforms, 'platforms');
                applyClientSideFilter(engines, 'engines');

                return games;
            } catch (error) {
                lastError = error;

                if (error.response?.status === 429 && attempt < maxRetries) {
                    continue;
                }

                console.error('IGDB API Error:', error.response?.data || error.message);
                console.error('Query that failed:', query);
                throw error;
            }
        }

        throw lastError;
    }

    async getGameById(id) {
        const headers = await twitchAuth.getAuthHeaders();
        
        const query = `fields name, rating, summary, cover.image_id, genres.name, platforms.name, game_engines.name, first_release_date, age_ratings, websites.url, websites.category; where id = ${id};`;
        
        try {
            const response = await axios.post(
                `${this.baseURL}/games`,
                query,
                { headers }
            );
            
            if (response.data.length === 0) {
                throw new Error('Game not found');
            }
            
            const game = response.data[0];
            
            if (game.age_ratings) {
                const ageRatingIds = new Set();
                
                if (Array.isArray(game.age_ratings)) {
                    game.age_ratings.forEach(ar => {
                        const id = typeof ar === 'number' ? ar : (ar && ar.id ? ar.id : null);
                        if (id) ageRatingIds.add(id);
                    });
                } else if (game.age_ratings.id !== undefined) {
                    ageRatingIds.add(game.age_ratings.id);
                }
                
                if (ageRatingIds.size > 0) {
                    try {
                        const ageRatingsQuery = `fields id, category, rating; where id = (${Array.from(ageRatingIds).join(',')});`;
                        const ageRatingsResponse = await axios.post(
                            `${this.baseURL}/age_ratings`,
                            ageRatingsQuery,
                            { headers }
                        );
                        
                        const ageRatingsMap = new Map();
                        ageRatingsResponse.data.forEach(ar => {
                            ageRatingsMap.set(ar.id, ar);
                        });
                        
                        if (Array.isArray(game.age_ratings)) {
                            game.age_ratings = game.age_ratings.map(ar => {
                                const id = typeof ar === 'number' ? ar : (ar && ar.id ? ar.id : null);
                                return ageRatingsMap.get(id) || ar;
                            }).filter(ar => ar && typeof ar === 'object');
                        } else if (game.age_ratings.id !== undefined) {
                            const expanded = ageRatingsMap.get(game.age_ratings.id);
                            if (expanded) {
                                game.age_ratings = [expanded];
                            } else {
                                game.age_ratings = [];
                            }
                        }
                    } catch (error) {
                        console.error('Error expanding age_ratings:', error.message);
                    }
                }
            }
            
            if (game.websites) {
                if (Array.isArray(game.websites)) {
                    const needsExpansion = game.websites.some(w => {
                        if (typeof w === 'number') return true;
                        if (w && w.id && !w.category) return true;
                        return false;
                    });
                    
                    if (needsExpansion) {
                        const websiteIds = new Set();
                        game.websites.forEach(w => {
                            const id = typeof w === 'number' ? w : (w && w.id ? w.id : null);
                            if (id) websiteIds.add(id);
                        });
                        
                        if (websiteIds.size > 0) {
                            try {
                                const websitesQuery = `fields id, url, category; where id = (${Array.from(websiteIds).join(',')});`;
                                const websitesResponse = await axios.post(
                                    `${this.baseURL}/websites`,
                                    websitesQuery,
                                    { headers }
                                );
                                
                                const websitesMap = new Map();
                                websitesResponse.data.forEach(w => {
                                    websitesMap.set(w.id, w);
                                });
                                
                                const expandedWebsites = [];
                                game.websites.forEach(w => {
                                    const id = typeof w === 'number' ? w : (w && w.id ? w.id : null);
                                    if (id && websitesMap.has(id)) {
                                        expandedWebsites.push(websitesMap.get(id));
                                    } else if (w && typeof w === 'object' && w.url) {
                                        expandedWebsites.push(w);
                                    }
                                });
                                game.websites = expandedWebsites;
                            } catch (error) {
                                console.error('Error expanding websites:', error.message);
                                game.websites = game.websites.filter(w => w && typeof w === 'object' && w.url);
                            }
                        }
                    } else {
                        game.websites = game.websites.filter(w => w && typeof w === 'object' && w.url);
                    }
                } else if (typeof game.websites === 'object') {
                    if (!game.websites.category && game.websites.id) {
                        try {
                            const websitesQuery = `fields id, url, category; where id = ${game.websites.id};`;
                            const websitesResponse = await axios.post(
                                `${this.baseURL}/websites`,
                                websitesQuery,
                                { headers }
                            );
                            if (websitesResponse.data.length > 0) {
                                game.websites = [websitesResponse.data[0]];
                            } else {
                                game.websites = [];
                            }
                        } catch (error) {
                            console.error('Error expanding website:', error.message);
                            game.websites = [];
                        }
                    } else if (game.websites.url) {
                        game.websites = [game.websites];
                    } else {
                        game.websites = [];
                    }
                }
            }
            
            return this.normalizeGame(game);
        } catch (error) {
            console.error('Error getting game by ID:', error.response?.data || error.message);
            throw error;
        }
    }

    normalizeGame(game) {
        const releaseDate = game.first_release_date
            ? new Date(game.first_release_date * 1000).toISOString()
            : undefined;

        let pegi = undefined;
        if (game.age_ratings) {
            let ageRatingsArray = [];

            if (Array.isArray(game.age_ratings)) {
                if (game.age_ratings.length > 0) {
                    ageRatingsArray = game.age_ratings.filter(ar => 
                        ar && typeof ar === 'object' && ar.category !== undefined
                    );
                }
            }
            else if (typeof game.age_ratings === 'object' && game.age_ratings.category !== undefined) {
                ageRatingsArray = [game.age_ratings];
            }

            const pegiRating = ageRatingsArray.find(ar => ar && ar.category === 2);
            if (pegiRating && pegiRating.rating !== undefined) {
                const pegiMap = { 1: 3, 2: 7, 3: 12, 4: 16, 5: 18 };
                const pegiValue = pegiMap[pegiRating.rating];
                pegi = pegiValue || undefined;
                if (pegi) {
                    console.log(`Game ${game.id} (${game.name}): PEGI rating found: category=${pegiRating.category}, rating=${pegiRating.rating}, mapped to ${pegi}`);
                }
            } else if (game.age_ratings && Array.isArray(game.age_ratings) && game.age_ratings.length > 0) {
                if (game.id && game.id < 1000) {
                    console.log(`Game ${game.id} (${game.name}): No PEGI rating found. age_ratings:`, JSON.stringify(game.age_ratings).substring(0, 200));
                }
            }
        }

        let externalLinks = undefined;
        if (game.websites) {
            const websites = Array.isArray(game.websites) ? game.websites : [game.websites];
            const links = {};
            
            websites.forEach(w => {
                if (w && w.url && w.category !== undefined) {
                    if (w.category === 13) {
                        links.steam = w.url;
                    } else if (w.category === 17) {
                        links.gog = w.url;
                    } else if (w.category === 16) {
                        links.epic = w.url;
                    } else if (w.category === 26) {
                        links.playstation = w.url;
                    } else if (w.category === 27) {
                        links.xbox = w.url;
                    }
                } else if (w && w.url) {
                    if (w.url.includes('store.steampowered.com') || w.url.includes('steampowered.com')) {
                        links.steam = w.url;
                    } else if (w.url.includes('gog.com')) {
                        links.gog = w.url;
                    } else if (w.url.includes('epicgames.com') || w.url.includes('store.epicgames.com')) {
                        links.epic = w.url;
                    } else if (w.url.includes('playstation.com') || w.url.includes('store.playstation.com')) {
                        links.playstation = w.url;
                    } else if (w.url.includes('xbox.com') || w.url.includes('microsoft.com')) {
                        links.xbox = w.url;
                    }
                }
            });
            
            if (links.steam || links.gog || links.epic || links.playstation || links.xbox) {
                externalLinks = links;
            }
        }

        return {
            ...game,
            releaseDate,
            cover: game.cover
                ? { url: `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg` }
                : null,
            engines: game.game_engines || undefined,
            pegi: pegi,
            externalLinks: externalLinks,
            age_ratings: game.age_ratings || []
        };
    }
}

const service = new IGDBService();
export default service;