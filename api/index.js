const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CFBD_API_KEY = process.env.CFBD_API_KEY;
const CFBD_BASE_URL = 'https://api.collegefootballdata.com';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours cache (CFBD updates once daily)

// ═══════════════════════════════════════════════════════════════════════════════
// IN-MEMORY CACHE (year-aware)
// ═══════════════════════════════════════════════════════════════════════════════

let transferCache = {
    year: null,
    data: null,
    lastUpdated: null,
    byTeam: {}
};

// ═══════════════════════════════════════════════════════════════════════════════
// TEAM DATA (matches iOS app exactly)
// ═══════════════════════════════════════════════════════════════════════════════

const TEAM_INFO = {
    // SEC
    "Alabama": { conference: "SEC", state: "AL", city: "Tuscaloosa", primaryColor: "9E1B32" },
    "Arkansas": { conference: "SEC", state: "AR", city: "Fayetteville", primaryColor: "9D2235" },
    "Auburn": { conference: "SEC", state: "AL", city: "Auburn", primaryColor: "0C2340" },
    "Florida": { conference: "SEC", state: "FL", city: "Gainesville", primaryColor: "0021A5" },
    "Georgia": { conference: "SEC", state: "GA", city: "Athens", primaryColor: "BA0C2F" },
    "Kentucky": { conference: "SEC", state: "KY", city: "Lexington", primaryColor: "0033A0" },
    "LSU": { conference: "SEC", state: "LA", city: "Baton Rouge", primaryColor: "461D7C" },
    "Mississippi State": { conference: "SEC", state: "MS", city: "Starkville", primaryColor: "660000" },
    "Missouri": { conference: "SEC", state: "MO", city: "Columbia", primaryColor: "F1B82D" },
    "Oklahoma": { conference: "SEC", state: "OK", city: "Norman", primaryColor: "841617" },
    "Ole Miss": { conference: "SEC", state: "MS", city: "Oxford", primaryColor: "14213D" },
    "South Carolina": { conference: "SEC", state: "SC", city: "Columbia", primaryColor: "73000A" },
    "Tennessee": { conference: "SEC", state: "TN", city: "Knoxville", primaryColor: "FF8200" },
    "Texas": { conference: "SEC", state: "TX", city: "Austin", primaryColor: "BF5700" },
    "Texas A&M": { conference: "SEC", state: "TX", city: "College Station", primaryColor: "500000" },
    "Vanderbilt": { conference: "SEC", state: "TN", city: "Nashville", primaryColor: "866D4B" },
    
    // Big Ten
    "Illinois": { conference: "Big Ten", state: "IL", city: "Champaign", primaryColor: "E84A27" },
    "Indiana": { conference: "Big Ten", state: "IN", city: "Bloomington", primaryColor: "990000" },
    "Iowa": { conference: "Big Ten", state: "IA", city: "Iowa City", primaryColor: "FFCD00" },
    "Maryland": { conference: "Big Ten", state: "MD", city: "College Park", primaryColor: "E03A3E" },
    "Michigan": { conference: "Big Ten", state: "MI", city: "Ann Arbor", primaryColor: "00274C" },
    "Michigan State": { conference: "Big Ten", state: "MI", city: "East Lansing", primaryColor: "18453B" },
    "Minnesota": { conference: "Big Ten", state: "MN", city: "Minneapolis", primaryColor: "7A0019" },
    "Nebraska": { conference: "Big Ten", state: "NE", city: "Lincoln", primaryColor: "E41C38" },
    "Northwestern": { conference: "Big Ten", state: "IL", city: "Evanston", primaryColor: "4E2A84" },
    "Ohio State": { conference: "Big Ten", state: "OH", city: "Columbus", primaryColor: "BB0000" },
    "Oregon": { conference: "Big Ten", state: "OR", city: "Eugene", primaryColor: "154733" },
    "Penn State": { conference: "Big Ten", state: "PA", city: "State College", primaryColor: "041E42" },
    "Purdue": { conference: "Big Ten", state: "IN", city: "West Lafayette", primaryColor: "CEB888" },
    "Rutgers": { conference: "Big Ten", state: "NJ", city: "Piscataway", primaryColor: "CC0033" },
    "UCLA": { conference: "Big Ten", state: "CA", city: "Los Angeles", primaryColor: "2D68C4" },
    "USC": { conference: "Big Ten", state: "CA", city: "Los Angeles", primaryColor: "990000" },
    "Washington": { conference: "Big Ten", state: "WA", city: "Seattle", primaryColor: "4B2E83" },
    "Wisconsin": { conference: "Big Ten", state: "WI", city: "Madison", primaryColor: "C5050C" },
    
    // Big 12
    "Arizona": { conference: "Big 12", state: "AZ", city: "Tucson", primaryColor: "CC0033" },
    "Arizona State": { conference: "Big 12", state: "AZ", city: "Tempe", primaryColor: "8C1D40" },
    "Baylor": { conference: "Big 12", state: "TX", city: "Waco", primaryColor: "154734" },
    "BYU": { conference: "Big 12", state: "UT", city: "Provo", primaryColor: "002E5D" },
    "Cincinnati": { conference: "Big 12", state: "OH", city: "Cincinnati", primaryColor: "E00122" },
    "Colorado": { conference: "Big 12", state: "CO", city: "Boulder", primaryColor: "CFB87C" },
    "Houston": { conference: "Big 12", state: "TX", city: "Houston", primaryColor: "C8102E" },
    "Iowa State": { conference: "Big 12", state: "IA", city: "Ames", primaryColor: "C8102E" },
    "Kansas": { conference: "Big 12", state: "KS", city: "Lawrence", primaryColor: "0051BA" },
    "Kansas State": { conference: "Big 12", state: "KS", city: "Manhattan", primaryColor: "512888" },
    "Oklahoma State": { conference: "Big 12", state: "OK", city: "Stillwater", primaryColor: "FF7300" },
    "TCU": { conference: "Big 12", state: "TX", city: "Fort Worth", primaryColor: "4D1979" },
    "Texas Tech": { conference: "Big 12", state: "TX", city: "Lubbock", primaryColor: "CC0000" },
    "UCF": { conference: "Big 12", state: "FL", city: "Orlando", primaryColor: "BA9B37" },
    "Utah": { conference: "Big 12", state: "UT", city: "Salt Lake City", primaryColor: "CC0000" },
    "West Virginia": { conference: "Big 12", state: "WV", city: "Morgantown", primaryColor: "002855" },
    
    // ACC
    "Boston College": { conference: "ACC", state: "MA", city: "Chestnut Hill", primaryColor: "98002E" },
    "California": { conference: "ACC", state: "CA", city: "Berkeley", primaryColor: "003262" },
    "Clemson": { conference: "ACC", state: "SC", city: "Clemson", primaryColor: "F56600" },
    "Duke": { conference: "ACC", state: "NC", city: "Durham", primaryColor: "003087" },
    "Florida State": { conference: "ACC", state: "FL", city: "Tallahassee", primaryColor: "782F40" },
    "Georgia Tech": { conference: "ACC", state: "GA", city: "Atlanta", primaryColor: "B3A369" },
    "Louisville": { conference: "ACC", state: "KY", city: "Louisville", primaryColor: "AD0000" },
    "Miami": { conference: "ACC", state: "FL", city: "Miami", primaryColor: "F47321" },
    "NC State": { conference: "ACC", state: "NC", city: "Raleigh", primaryColor: "CC0000" },
    "North Carolina": { conference: "ACC", state: "NC", city: "Chapel Hill", primaryColor: "7BAFD4" },
    "Pittsburgh": { conference: "ACC", state: "PA", city: "Pittsburgh", primaryColor: "003594" },
    "SMU": { conference: "ACC", state: "TX", city: "Dallas", primaryColor: "0033A0" },
    "Stanford": { conference: "ACC", state: "CA", city: "Stanford", primaryColor: "8C1515" },
    "Syracuse": { conference: "ACC", state: "NY", city: "Syracuse", primaryColor: "F76900" },
    "Virginia": { conference: "ACC", state: "VA", city: "Charlottesville", primaryColor: "232D4B" },
    "Virginia Tech": { conference: "ACC", state: "VA", city: "Blacksburg", primaryColor: "630031" },
    "Wake Forest": { conference: "ACC", state: "NC", city: "Winston-Salem", primaryColor: "9E7E38" },
    
    // American
    "Army": { conference: "American", state: "NY", city: "West Point", primaryColor: "000000" },
    "Charlotte": { conference: "American", state: "NC", city: "Charlotte", primaryColor: "005035" },
    "East Carolina": { conference: "American", state: "NC", city: "Greenville", primaryColor: "592A8A" },
    "FAU": { conference: "American", state: "FL", city: "Boca Raton", primaryColor: "003366" },
    "Memphis": { conference: "American", state: "TN", city: "Memphis", primaryColor: "003087" },
    "Navy": { conference: "American", state: "MD", city: "Annapolis", primaryColor: "00205B" },
    "North Texas": { conference: "American", state: "TX", city: "Denton", primaryColor: "00853E" },
    "Rice": { conference: "American", state: "TX", city: "Houston", primaryColor: "00205B" },
    "South Florida": { conference: "American", state: "FL", city: "Tampa", primaryColor: "006747" },
    "Temple": { conference: "American", state: "PA", city: "Philadelphia", primaryColor: "9D2235" },
    "Tulane": { conference: "American", state: "LA", city: "New Orleans", primaryColor: "006747" },
    "Tulsa": { conference: "American", state: "OK", city: "Tulsa", primaryColor: "002D62" },
    "UAB": { conference: "American", state: "AL", city: "Birmingham", primaryColor: "1E6B52" },
    "UTSA": { conference: "American", state: "TX", city: "San Antonio", primaryColor: "0C2340" },
    
    // Mountain West
    "Air Force": { conference: "Mountain West", state: "CO", city: "Colorado Springs", primaryColor: "003087" },
    "Boise State": { conference: "Mountain West", state: "ID", city: "Boise", primaryColor: "0033A0" },
    "Colorado State": { conference: "Mountain West", state: "CO", city: "Fort Collins", primaryColor: "1E4D2B" },
    "Fresno State": { conference: "Mountain West", state: "CA", city: "Fresno", primaryColor: "CC0000" },
    "Hawaii": { conference: "Mountain West", state: "HI", city: "Honolulu", primaryColor: "024731" },
    "Nevada": { conference: "Mountain West", state: "NV", city: "Reno", primaryColor: "003366" },
    "New Mexico": { conference: "Mountain West", state: "NM", city: "Albuquerque", primaryColor: "BA0C2F" },
    "San Diego State": { conference: "Mountain West", state: "CA", city: "San Diego", primaryColor: "CC0000" },
    "San Jose State": { conference: "Mountain West", state: "CA", city: "San Jose", primaryColor: "0055A2" },
    "UNLV": { conference: "Mountain West", state: "NV", city: "Las Vegas", primaryColor: "CC0000" },
    "Utah State": { conference: "Mountain West", state: "UT", city: "Logan", primaryColor: "0F2439" },
    "Wyoming": { conference: "Mountain West", state: "WY", city: "Laramie", primaryColor: "492F24" },
    
    // Sun Belt
    "Appalachian State": { conference: "Sun Belt", state: "NC", city: "Boone", primaryColor: "000000" },
    "Arkansas State": { conference: "Sun Belt", state: "AR", city: "Jonesboro", primaryColor: "CC092F" },
    "Coastal Carolina": { conference: "Sun Belt", state: "SC", city: "Conway", primaryColor: "006F71" },
    "Georgia Southern": { conference: "Sun Belt", state: "GA", city: "Statesboro", primaryColor: "011E41" },
    "Georgia State": { conference: "Sun Belt", state: "GA", city: "Atlanta", primaryColor: "0039A6" },
    "James Madison": { conference: "Sun Belt", state: "VA", city: "Harrisonburg", primaryColor: "450084" },
    "Louisiana": { conference: "Sun Belt", state: "LA", city: "Lafayette", primaryColor: "CE181E" },
    "Louisiana Monroe": { conference: "Sun Belt", state: "LA", city: "Monroe", primaryColor: "6F263D" },
    "Marshall": { conference: "Sun Belt", state: "WV", city: "Huntington", primaryColor: "00B140" },
    "Old Dominion": { conference: "Sun Belt", state: "VA", city: "Norfolk", primaryColor: "003057" },
    "South Alabama": { conference: "Sun Belt", state: "AL", city: "Mobile", primaryColor: "00205B" },
    "Southern Miss": { conference: "Sun Belt", state: "MS", city: "Hattiesburg", primaryColor: "000000" },
    "Texas State": { conference: "Sun Belt", state: "TX", city: "San Marcos", primaryColor: "501214" },
    "Troy": { conference: "Sun Belt", state: "AL", city: "Troy", primaryColor: "8B2332" },
    
    // MAC
    "Akron": { conference: "MAC", state: "OH", city: "Akron", primaryColor: "041E42" },
    "Ball State": { conference: "MAC", state: "IN", city: "Muncie", primaryColor: "BA0C2F" },
    "Bowling Green": { conference: "MAC", state: "OH", city: "Bowling Green", primaryColor: "4F2C1D" },
    "Buffalo": { conference: "MAC", state: "NY", city: "Buffalo", primaryColor: "005BBB" },
    "Central Michigan": { conference: "MAC", state: "MI", city: "Mount Pleasant", primaryColor: "6A0032" },
    "Eastern Michigan": { conference: "MAC", state: "MI", city: "Ypsilanti", primaryColor: "006633" },
    "Kent State": { conference: "MAC", state: "OH", city: "Kent", primaryColor: "002664" },
    "Miami (OH)": { conference: "MAC", state: "OH", city: "Oxford", primaryColor: "C41E3A" },
    "Northern Illinois": { conference: "MAC", state: "IL", city: "DeKalb", primaryColor: "BA0C2F" },
    "Ohio": { conference: "MAC", state: "OH", city: "Athens", primaryColor: "00694E" },
    "Toledo": { conference: "MAC", state: "OH", city: "Toledo", primaryColor: "003E7E" },
    "Western Michigan": { conference: "MAC", state: "MI", city: "Kalamazoo", primaryColor: "6C4023" },
    
    // Conference USA
    "FIU": { conference: "Conference USA", state: "FL", city: "Miami", primaryColor: "002F65" },
    "Jacksonville State": { conference: "Conference USA", state: "AL", city: "Jacksonville", primaryColor: "CC0000" },
    "Kennesaw State": { conference: "Conference USA", state: "GA", city: "Kennesaw", primaryColor: "000000" },
    "Liberty": { conference: "Conference USA", state: "VA", city: "Lynchburg", primaryColor: "002D62" },
    "Louisiana Tech": { conference: "Conference USA", state: "LA", city: "Ruston", primaryColor: "002F8B" },
    "Middle Tennessee": { conference: "Conference USA", state: "TN", city: "Murfreesboro", primaryColor: "0066CC" },
    "New Mexico State": { conference: "Conference USA", state: "NM", city: "Las Cruces", primaryColor: "8B1C42" },
    "Sam Houston": { conference: "Conference USA", state: "TX", city: "Huntsville", primaryColor: "F37021" },
    "UTEP": { conference: "Conference USA", state: "TX", city: "El Paso", primaryColor: "FF8200" },
    "Western Kentucky": { conference: "Conference USA", state: "KY", city: "Bowling Green", primaryColor: "C60C30" },
    
    // Independents
    "Notre Dame": { conference: "Independent", state: "IN", city: "South Bend", primaryColor: "0C2340" },
    "UConn": { conference: "Independent", state: "CT", city: "Storrs", primaryColor: "000E2F" },
    "UMass": { conference: "Independent", state: "MA", city: "Amherst", primaryColor: "881C1C" }
};

// Team name aliases (CFBD uses different names sometimes)
const TEAM_ALIASES = {
    "Miami (OH)": ["Miami (OH)", "Miami Ohio", "Miami-OH", "Miami RedHawks"],
    "Ole Miss": ["Ole Miss", "Mississippi"],
    "USC": ["USC", "Southern California"],
    "LSU": ["LSU", "Louisiana State"],
    "UCF": ["UCF", "Central Florida"],
    "SMU": ["SMU", "Southern Methodist"],
    "BYU": ["BYU", "Brigham Young"],
    "TCU": ["TCU", "Texas Christian"],
    "UNLV": ["UNLV", "Nevada-Las Vegas"],
    "UTSA": ["UTSA", "Texas-San Antonio"],
    "UTEP": ["UTEP", "Texas-El Paso"],
    "UAB": ["UAB", "Alabama-Birmingham"],
    "FIU": ["FIU", "Florida International"],
    "FAU": ["FAU", "Florida Atlantic"],
    "NC State": ["NC State", "North Carolina State"],
    "UConn": ["UConn", "Connecticut"],
    "UMass": ["UMass", "Massachusetts"],
    "Appalachian State": ["Appalachian State", "App State", "Appalachian"],
    "Hawaii": ["Hawaii", "Hawai'i", "Hawai`i"],
    "San Jose State": ["San Jose State", "San José State", "SJSU"],
    "Louisiana Monroe": ["Louisiana Monroe", "UL Monroe", "Louisiana-Monroe", "ULM"],
    "Louisiana": ["Louisiana", "Louisiana-Lafayette", "UL Lafayette", "ULL"]
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function normalizeTeamName(name) {
    if (!name) return null;
    
    // Check aliases
    for (const [canonical, aliases] of Object.entries(TEAM_ALIASES)) {
        if (aliases.some(alias => alias.toLowerCase() === name.toLowerCase())) {
            return canonical;
        }
    }
    
    // Check direct match
    for (const teamName of Object.keys(TEAM_INFO)) {
        if (teamName.toLowerCase() === name.toLowerCase()) {
            return teamName;
        }
    }
    
    return name; // Return as-is if no match
}

function convertRatingToScale(rating) {
    // CFBD returns rating as 0-1 decimal, convert to 0-100 scale
    if (!rating) return null;
    return Math.round(rating * 100);
}

function getEligibilityYear(eligibility) {
    const mapping = {
        'FR': 'Fr',
        'SO': 'So',
        'JR': 'Jr',
        'SR': 'Sr',
        'GR': 'Gr'
    };
    return mapping[eligibility] || eligibility;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CFBD API FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchFromCFBD(endpoint) {
    const url = `${CFBD_BASE_URL}${endpoint}`;
    console.log(`📡 Fetching from CFBD: ${url}`);
    
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${CFBD_API_KEY}`,
            'Accept': 'application/json'
        }
    });
    
    if (!response.ok) {
        throw new Error(`CFBD API error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
}

async function fetchTransferPortalData(year = 2026) {
    // Check cache first (must match year)
    const now = Date.now();
    if (transferCache.data && transferCache.lastUpdated && 
        transferCache.year === year &&
        (now - transferCache.lastUpdated) < CACHE_DURATION_MS) {
        console.log(`📦 Using cached transfer data for ${year}`);
        return transferCache.data;
    }
    
    console.log(`🔄 Fetching fresh transfer data from CFBD for ${year}...`);
    
    try {
        const transfers = await fetchFromCFBD(`/player/portal?year=${year}`);
        
        // Process and organize by team
        const teamTransfers = {};
        
        for (const transfer of transfers) {
            const fromTeam = normalizeTeamName(transfer.origin);
            const toTeam = normalizeTeamName(transfer.destination);
            
            const playerData = {
                name: `${transfer.firstName} ${transfer.lastName}`,
                position: transfer.position || 'Unknown',
                rating: convertRatingToScale(transfer.rating),
                stars: transfer.stars,
                year: getEligibilityYear(transfer.eligibility),
                transferDate: transfer.transferDate,
                status: toTeam ? 'Committed' : 'Entered'
            };
            
            // Add to "from" team's playersOut
            if (fromTeam && TEAM_INFO[fromTeam]) {
                if (!teamTransfers[fromTeam]) {
                    teamTransfers[fromTeam] = { playersOut: [], playersIn: [] };
                }
                teamTransfers[fromTeam].playersOut.push({
                    ...playerData,
                    from: null,
                    destination: toTeam
                });
            }
            
            // Add to "to" team's playersIn
            if (toTeam && TEAM_INFO[toTeam]) {
                if (!teamTransfers[toTeam]) {
                    teamTransfers[toTeam] = { playersOut: [], playersIn: [] };
                }
                teamTransfers[toTeam].playersIn.push({
                    ...playerData,
                    from: fromTeam,
                    destination: null
                });
            }
        }
        
        // Update cache
        transferCache = {
            year: year,
            data: teamTransfers,
            lastUpdated: now,
            byTeam: teamTransfers
        };
        
        console.log(`✅ Processed ${transfers.length} transfers for ${Object.keys(teamTransfers).length} teams`);
        
        return teamTransfers;
        
    } catch (error) {
        console.error('❌ Error fetching from CFBD:', error);
        throw error;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// API ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Transfer Portal API',
        version: '1.0.0',
        endpoints: [
            'GET /api/transfers - Get all transfer data organized by team',
            'GET /api/transfers/:team - Get transfer data for a specific team',
            'GET /api/health - Health check with cache status'
        ]
    });
});

// Health check with cache info
app.get('/api/health', (req, res) => {
    const cacheAge = transferCache.lastUpdated 
        ? Math.round((Date.now() - transferCache.lastUpdated) / 1000)
        : null;
    
    res.json({
        status: 'ok',
        cache: {
            hasData: !!transferCache.data,
            ageSeconds: cacheAge,
            teamCount: transferCache.data ? Object.keys(transferCache.data).length : 0
        },
        cfbdConfigured: !!CFBD_API_KEY
    });
});

// Get all transfers (main endpoint for iOS app)
app.get('/api/transfers', async (req, res) => {
    try {
        const year = req.query.year || 2026;
        const teamData = await fetchTransferPortalData(year);
        
        // Calculate totals
        let totalPlayersOut = 0;
        let totalPlayersIn = 0;
        
        for (const team of Object.values(teamData)) {
            totalPlayersOut += team.playersOut.length;
            totalPlayersIn += team.playersIn.length;
        }
        
        res.json({
            teams: teamData,
            totalPlayers: totalPlayersOut,
            totalMovement: totalPlayersOut + totalPlayersIn,
            lastUpdated: transferCache.lastUpdated 
                ? new Date(transferCache.lastUpdated).toISOString()
                : new Date().toISOString(),
            season: year
        });
        
    } catch (error) {
        console.error('Error in /api/transfers:', error);
        res.status(500).json({
            error: 'Failed to fetch transfer data',
            message: error.message
        });
    }
});

// Get transfers for a specific team
app.get('/api/transfers/:team', async (req, res) => {
    try {
        const teamName = normalizeTeamName(decodeURIComponent(req.params.team));
        const year = req.query.year || 2026;
        
        if (!TEAM_INFO[teamName]) {
            return res.status(404).json({
                error: 'Team not found',
                team: req.params.team,
                suggestion: 'Check /api/teams for valid team names'
            });
        }
        
        const allData = await fetchTransferPortalData(year);
        const teamData = allData[teamName] || { playersOut: [], playersIn: [] };
        
        res.json({
            team: teamName,
            info: TEAM_INFO[teamName],
            ...teamData,
            netChange: teamData.playersIn.length - teamData.playersOut.length
        });
        
    } catch (error) {
        console.error('Error in /api/transfers/:team:', error);
        res.status(500).json({
            error: 'Failed to fetch team data',
            message: error.message
        });
    }
});

// List all teams
app.get('/api/teams', (req, res) => {
    const teams = Object.entries(TEAM_INFO).map(([name, info]) => ({
        name,
        ...info
    }));
    
    res.json({
        count: teams.length,
        teams: teams.sort((a, b) => a.name.localeCompare(b.name))
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ROSTER ENDPOINT
// ═══════════════════════════════════════════════════════════════════════════════

// Roster cache (per team, 30 minute cache)
const rosterCache = {};
const ROSTER_CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours (CFBD updates once daily)

// Get roster for a specific team
app.get('/api/roster/:team', async (req, res) => {
    try {
        const teamName = normalizeTeamName(decodeURIComponent(req.params.team));
        const year = req.query.year || 2025; // 2026 rosters not available yet
        
        if (!TEAM_INFO[teamName]) {
            return res.status(404).json({
                error: 'Team not found',
                team: req.params.team,
                suggestion: 'Check /api/teams for valid team names'
            });
        }
        
        // Check cache
        const cacheKey = `${teamName}-${year}`;
        const now = Date.now();
        if (rosterCache[cacheKey] && (now - rosterCache[cacheKey].lastUpdated) < ROSTER_CACHE_DURATION_MS) {
            console.log(`📦 Using cached roster for ${teamName}`);
            return res.json(rosterCache[cacheKey].data);
        }
        
        console.log(`🔄 Fetching fresh roster for ${teamName}...`);
        
        // Fetch from CFBD
        const roster = await fetchFromCFBD(`/roster?team=${encodeURIComponent(teamName)}&year=${year}`);
        
        // Debug: log first player to see field names
        if (roster.length > 0) {
            console.log('Sample player from CFBD:', JSON.stringify(roster[0], null, 2));
        }
        
        // Transform roster data (CFBD uses first_name/last_name or firstName/lastName)
        const players = roster.map(player => ({
            id: String(player.id),
            name: `${player.first_name || player.firstName || ''} ${player.last_name || player.lastName || ''}`.trim() || 'Unknown',
            firstName: player.first_name || player.firstName || '',
            lastName: player.last_name || player.lastName || '',
            position: player.position || 'Unknown',
            jersey: player.jersey,
            year: player.year || 'Unknown',
            height: player.height,
            weight: player.weight,
            city: player.home_city || player.homeCity || player.city,
            state: player.home_state || player.homeState || player.state,
            country: player.home_country || player.homeCountry || player.country
        }));
        
        // Sort by position groups, then by name
        const positionOrder = ['QB', 'RB', 'WR', 'TE', 'OL', 'OT', 'OG', 'C', 'DL', 'DE', 'DT', 'NT', 'LB', 'ILB', 'OLB', 'CB', 'S', 'DB', 'K', 'P', 'LS', 'ATH'];
        players.sort((a, b) => {
            const posA = positionOrder.indexOf(a.position);
            const posB = positionOrder.indexOf(b.position);
            if (posA !== posB) {
                return (posA === -1 ? 999 : posA) - (posB === -1 ? 999 : posB);
            }
            return a.name.localeCompare(b.name);
        });
        
        const responseData = {
            team: teamName,
            info: TEAM_INFO[teamName],
            year: year,
            playerCount: players.length,
            players: players,
            lastUpdated: new Date().toISOString()
        };
        
        // Cache the result
        rosterCache[cacheKey] = {
            data: responseData,
            lastUpdated: now
        };
        
        res.json(responseData);
        
    } catch (error) {
        console.error('Error in /api/roster/:team:', error);
        res.status(500).json({
            error: 'Failed to fetch roster data',
            message: error.message
        });
    }
});

// Force cache refresh
app.post('/api/refresh', async (req, res) => {
    try {
        transferCache = { data: null, lastUpdated: null, byTeam: {} };
        const data = await fetchTransferPortalData(2026);
        
        res.json({
            success: true,
            message: 'Cache refreshed',
            teamCount: Object.keys(data).length
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PLAYER STATS ENDPOINTS (Basic + Advanced)
// ═══════════════════════════════════════════════════════════════════════════════

// Stats cache
const statsCache = {};
const STATS_CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Advanced stats cache (usage + PPA)
const advancedStatsCache = {};

// Helper: Get current season year
function getCurrentSeasonYear() {
    const now = new Date();
    const month = now.getMonth() + 1; // JavaScript months are 0-indexed
    const year = now.getFullYear();
    // If before August, we're looking at previous season stats
    return month >= 8 ? year : year - 1;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AVAILABLE YEARS ENDPOINT - /api/stats/years
// Returns list of years with available stats data
// NOTE: Must be defined BEFORE /api/stats/:team to avoid route conflict
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/stats/years', (req, res) => {
    const currentYear = getCurrentSeasonYear();
    const years = [];
    
    // CFBD has data going back to around 2013 for most stats
    for (let year = currentYear; year >= 2013; year--) {
        years.push(year);
    }
    
    res.json({
        currentSeason: currentYear,
        availableYears: years
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BASIC STATS ENDPOINT - /api/stats/:team
// Returns: passing, rushing, receiving, defensive, kicking, punting, returns
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/stats/:team', async (req, res) => {
    try {
        const teamName = normalizeTeamName(decodeURIComponent(req.params.team));
        const year = parseInt(req.query.year) || getCurrentSeasonYear();
        
        if (!TEAM_INFO[teamName]) {
            return res.status(404).json({
                error: 'Team not found',
                team: req.params.team,
                suggestion: 'Check /api/teams for valid team names'
            });
        }
        
        // Check cache
        const cacheKey = `stats-${teamName}-${year}`;
        const now = Date.now();
        if (statsCache[cacheKey] && (now - statsCache[cacheKey].lastUpdated) < STATS_CACHE_DURATION_MS) {
            console.log(`📦 Using cached stats for ${teamName} (${year})`);
            return res.json(statsCache[cacheKey].data);
        }
        
        console.log(`🔄 Fetching fresh stats for ${teamName} (${year})...`);
        
        // Fetch all stat categories from CFBD
        const [passing, rushing, receiving, defensive, kicking, punting, kickReturns, puntReturns, interceptions, fumbles] = await Promise.all([
            fetchFromCFBD(`/stats/player/season?year=${year}&team=${encodeURIComponent(teamName)}&category=passing`).catch(() => []),
            fetchFromCFBD(`/stats/player/season?year=${year}&team=${encodeURIComponent(teamName)}&category=rushing`).catch(() => []),
            fetchFromCFBD(`/stats/player/season?year=${year}&team=${encodeURIComponent(teamName)}&category=receiving`).catch(() => []),
            fetchFromCFBD(`/stats/player/season?year=${year}&team=${encodeURIComponent(teamName)}&category=defensive`).catch(() => []),
            fetchFromCFBD(`/stats/player/season?year=${year}&team=${encodeURIComponent(teamName)}&category=kicking`).catch(() => []),
            fetchFromCFBD(`/stats/player/season?year=${year}&team=${encodeURIComponent(teamName)}&category=punting`).catch(() => []),
            fetchFromCFBD(`/stats/player/season?year=${year}&team=${encodeURIComponent(teamName)}&category=kickReturns`).catch(() => []),
            fetchFromCFBD(`/stats/player/season?year=${year}&team=${encodeURIComponent(teamName)}&category=puntReturns`).catch(() => []),
            fetchFromCFBD(`/stats/player/season?year=${year}&team=${encodeURIComponent(teamName)}&category=interceptions`).catch(() => []),
            fetchFromCFBD(`/stats/player/season?year=${year}&team=${encodeURIComponent(teamName)}&category=fumbles`).catch(() => [])
        ]);
        
        // Combine all stats by player
        const playerStatsMap = {};
        
        // Helper to add stats to player
        const addPlayerStats = (statsArray, category) => {
            for (const stat of statsArray) {
                const playerId = stat.playerId || stat.player_id || `${stat.player}-${stat.team}`;
                const playerName = stat.player;
                
                if (!playerStatsMap[playerId]) {
                    playerStatsMap[playerId] = {
                        playerId: String(playerId),
                        name: playerName,
                        team: teamName
                    };
                }
                
                // Parse stat type and value
                const statType = stat.statType || stat.stat_type;
                const statValue = parseFloat(stat.stat) || 0;
                
                if (!playerStatsMap[playerId][category]) {
                    playerStatsMap[playerId][category] = {};
                }
                
                playerStatsMap[playerId][category][statType] = statValue;
            }
        };
        
        // Process each category
        addPlayerStats(passing, 'passing');
        addPlayerStats(rushing, 'rushing');
        addPlayerStats(receiving, 'receiving');
        addPlayerStats(defensive, 'defensive');
        addPlayerStats(kicking, 'kicking');
        addPlayerStats(punting, 'punting');
        addPlayerStats(kickReturns, 'kickReturns');
        addPlayerStats(puntReturns, 'puntReturns');
        addPlayerStats(interceptions, 'interceptions');
        addPlayerStats(fumbles, 'fumbles');
        
        // Convert to array and clean up stats
        const players = Object.values(playerStatsMap).map(player => {
            // Clean up passing stats
            if (player.passing) {
                player.passing = {
                    completions: player.passing.COMPLETIONS || player.passing.completions || 0,
                    attempts: player.passing.ATT || player.passing.attempts || 0,
                    yards: player.passing.YDS || player.passing.yards || 0,
                    touchdowns: player.passing.TD || player.passing.touchdowns || 0,
                    interceptions: player.passing.INT || player.passing.interceptions || 0,
                    yardsPerAttempt: player.passing.YPA || player.passing.yardsPerAttempt || null,
                    qbRating: player.passing.QBR || player.passing.qbRating || null,
                    long: player.passing.LONG || player.passing.long || null
                };
            }
            
            // Clean up rushing stats
            if (player.rushing) {
                player.rushing = {
                    carries: player.rushing.CAR || player.rushing.carries || 0,
                    yards: player.rushing.YDS || player.rushing.yards || 0,
                    touchdowns: player.rushing.TD || player.rushing.touchdowns || 0,
                    yardsPerCarry: player.rushing.YPC || player.rushing.yardsPerCarry || null,
                    long: player.rushing.LONG || player.rushing.long || null
                };
            }
            
            // Clean up receiving stats
            if (player.receiving) {
                player.receiving = {
                    receptions: player.receiving.REC || player.receiving.receptions || 0,
                    yards: player.receiving.YDS || player.receiving.yards || 0,
                    touchdowns: player.receiving.TD || player.receiving.touchdowns || 0,
                    yardsPerReception: player.receiving.YPR || player.receiving.yardsPerReception || null,
                    long: player.receiving.LONG || player.receiving.long || null
                };
            }
            
            // Clean up defensive stats
            if (player.defensive) {
                player.defensive = {
                    totalTackles: player.defensive.TOT || player.defensive.TACKLES || player.defensive.totalTackles || 0,
                    soloTackles: player.defensive.SOLO || player.defensive.soloTackles || 0,
                    sacks: player.defensive.SACKS || player.defensive.sacks || 0,
                    tacklesForLoss: player.defensive.TFL || player.defensive.tacklesForLoss || 0,
                    passesDefended: player.defensive.PD || player.defensive.passesDefended || 0,
                    qbHurries: player.defensive.QBH || player.defensive.qbHurries || 0,
                    defensiveTDs: player.defensive.TD || player.defensive.defensiveTDs || 0
                };
            }
            
            // Add interceptions to defensive stats
            if (player.interceptions) {
                if (!player.defensive) player.defensive = {};
                player.defensive.interceptions = player.interceptions.INT || player.interceptions.interceptions || 0;
                player.defensive.intYards = player.interceptions.YDS || player.interceptions.yards || 0;
                player.defensive.intTDs = player.interceptions.TD || player.interceptions.touchdowns || 0;
                delete player.interceptions;
            }
            
            // Add fumbles to defensive stats
            if (player.fumbles) {
                if (!player.defensive) player.defensive = {};
                player.defensive.fumblesRecovered = player.fumbles.REC || player.fumbles.recovered || 0;
                player.defensive.fumblesTDs = player.fumbles.TD || player.fumbles.touchdowns || 0;
                delete player.fumbles;
            }
            
            // Clean up kicking stats
            if (player.kicking) {
                player.kicking = {
                    fgMade: player.kicking.FGM || player.kicking.fgMade || 0,
                    fgAttempts: player.kicking.FGA || player.kicking.fgAttempts || 0,
                    fgPercentage: player.kicking.PCT || player.kicking.fgPercentage || null,
                    xpMade: player.kicking.XPM || player.kicking.xpMade || 0,
                    xpAttempts: player.kicking.XPA || player.kicking.xpAttempts || 0,
                    points: player.kicking.PTS || player.kicking.points || 0,
                    long: player.kicking.LONG || player.kicking.long || null
                };
            }
            
            // Clean up punting stats
            if (player.punting) {
                player.punting = {
                    punts: player.punting.NO || player.punting.punts || 0,
                    yards: player.punting.YDS || player.punting.yards || 0,
                    average: player.punting.AVG || player.punting.average || null,
                    long: player.punting.LONG || player.punting.long || null,
                    inside20: player.punting.IN20 || player.punting.inside20 || 0,
                    touchbacks: player.punting.TB || player.punting.touchbacks || 0
                };
            }
            
            // Clean up kick returns
            if (player.kickReturns) {
                player.kickReturns = {
                    returns: player.kickReturns.NO || player.kickReturns.returns || 0,
                    yards: player.kickReturns.YDS || player.kickReturns.yards || 0,
                    average: player.kickReturns.AVG || player.kickReturns.average || null,
                    touchdowns: player.kickReturns.TD || player.kickReturns.touchdowns || 0,
                    long: player.kickReturns.LONG || player.kickReturns.long || null
                };
            }
            
            // Clean up punt returns
            if (player.puntReturns) {
                player.puntReturns = {
                    returns: player.puntReturns.NO || player.puntReturns.returns || 0,
                    yards: player.puntReturns.YDS || player.puntReturns.yards || 0,
                    average: player.puntReturns.AVG || player.puntReturns.average || null,
                    touchdowns: player.puntReturns.TD || player.puntReturns.touchdowns || 0,
                    long: player.puntReturns.LONG || player.puntReturns.long || null
                };
            }
            
            return player;
        });
        
        // Sort by total production (yards)
        players.sort((a, b) => {
            const aYards = (a.passing?.yards || 0) + (a.rushing?.yards || 0) + (a.receiving?.yards || 0);
            const bYards = (b.passing?.yards || 0) + (b.rushing?.yards || 0) + (b.receiving?.yards || 0);
            return bYards - aYards;
        });
        
        const responseData = {
            team: teamName,
            info: TEAM_INFO[teamName],
            year: year,
            playerCount: players.length,
            players: players,
            lastUpdated: new Date().toISOString()
        };
        
        // Cache the result
        statsCache[cacheKey] = {
            data: responseData,
            lastUpdated: now
        };
        
        res.json(responseData);
        
    } catch (error) {
        console.error('Error in /api/stats/:team:', error);
        res.status(500).json({
            error: 'Failed to fetch stats data',
            message: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADVANCED STATS ENDPOINT - /api/stats/advanced/:team
// Returns: usage metrics, PPA (Predicted Points Added)
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/stats/advanced/:team', async (req, res) => {
    try {
        const teamName = normalizeTeamName(decodeURIComponent(req.params.team));
        const year = parseInt(req.query.year) || getCurrentSeasonYear();
        
        if (!TEAM_INFO[teamName]) {
            return res.status(404).json({
                error: 'Team not found',
                team: req.params.team,
                suggestion: 'Check /api/teams for valid team names'
            });
        }
        
        // Check cache
        const cacheKey = `advanced-${teamName}-${year}`;
        const now = Date.now();
        if (advancedStatsCache[cacheKey] && (now - advancedStatsCache[cacheKey].lastUpdated) < STATS_CACHE_DURATION_MS) {
            console.log(`📦 Using cached advanced stats for ${teamName} (${year})`);
            return res.json(advancedStatsCache[cacheKey].data);
        }
        
        console.log(`🔄 Fetching fresh advanced stats for ${teamName} (${year})...`);
        
        // Fetch usage and PPA data from CFBD
        const [usageData, ppaData] = await Promise.all([
            fetchFromCFBD(`/player/usage?year=${year}&team=${encodeURIComponent(teamName)}`).catch(() => []),
            fetchFromCFBD(`/ppa/players/season?year=${year}&team=${encodeURIComponent(teamName)}`).catch(() => [])
        ]);
        
        // Combine stats by player
        const playerStatsMap = {};
        
        // Process usage data
        for (const player of usageData) {
            const playerId = player.id || player.playerId || `${player.name}-${teamName}`;
            
            playerStatsMap[playerId] = {
                playerId: String(playerId),
                name: player.name,
                team: teamName,
                position: player.position,
                usage: {
                    overall: player.usage?.overall || 0,
                    pass: player.usage?.pass || 0,
                    rush: player.usage?.rush || 0,
                    firstDown: player.usage?.firstDown || null,
                    secondDown: player.usage?.secondDown || null,
                    thirdDown: player.usage?.thirdDown || null,
                    standardDowns: player.usage?.standardDowns || null,
                    passingDowns: player.usage?.passingDowns || null
                }
            };
        }
        
        // Process PPA data
        for (const player of ppaData) {
            const playerId = player.id || player.playerId || `${player.name}-${teamName}`;
            
            if (!playerStatsMap[playerId]) {
                playerStatsMap[playerId] = {
                    playerId: String(playerId),
                    name: player.name,
                    team: teamName,
                    position: player.position
                };
            }
            
            playerStatsMap[playerId].ppa = {
                countablePlays: player.countablePlays || 0,
                averages: {
                    all: player.averagePPA?.all || null,
                    pass: player.averagePPA?.pass || null,
                    rush: player.averagePPA?.rush || null,
                    firstDown: player.averagePPA?.firstDown || null,
                    secondDown: player.averagePPA?.secondDown || null,
                    thirdDown: player.averagePPA?.thirdDown || null,
                    standardDowns: player.averagePPA?.standardDowns || null,
                    passingDowns: player.averagePPA?.passingDowns || null
                },
                totals: {
                    all: player.totalPPA?.all || null,
                    pass: player.totalPPA?.pass || null,
                    rush: player.totalPPA?.rush || null,
                    firstDown: player.totalPPA?.firstDown || null,
                    secondDown: player.totalPPA?.secondDown || null,
                    thirdDown: player.totalPPA?.thirdDown || null,
                    standardDowns: player.totalPPA?.standardDowns || null,
                    passingDowns: player.totalPPA?.passingDowns || null
                }
            };
        }
        
        // Convert to array
        const players = Object.values(playerStatsMap);
        
        // Sort by total PPA (descending)
        players.sort((a, b) => {
            const aPPA = a.ppa?.totals?.all || 0;
            const bPPA = b.ppa?.totals?.all || 0;
            return bPPA - aPPA;
        });
        
        const responseData = {
            team: teamName,
            info: TEAM_INFO[teamName],
            year: year,
            playerCount: players.length,
            players: players,
            lastUpdated: new Date().toISOString()
        };
        
        // Cache the result
        advancedStatsCache[cacheKey] = {
            data: responseData,
            lastUpdated: now
        };
        
        res.json(responseData);
        
    } catch (error) {
        console.error('Error in /api/stats/advanced/:team:', error);
        res.status(500).json({
            error: 'Failed to fetch advanced stats data',
            message: error.message
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// START SERVER (for local development)
// ═══════════════════════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3001;

// Only start server if running directly (not on Vercel)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🏈 Transfer Portal API Server Running!                    ║
║                                                              ║
║   Local:  http://localhost:${PORT}                            ║
║                                                              ║
║   Endpoints:                                                 ║
║   • GET  /api/transfers         - All transfer data          ║
║   • GET  /api/transfers/:team   - Team-specific transfers    ║
║   • GET  /api/teams             - List all teams             ║
║   • GET  /api/roster/:team      - Team roster                ║
║   • GET  /api/stats/:team       - Basic player stats         ║
║   • GET  /api/stats/advanced/:team - Advanced analytics      ║
║   • GET  /api/stats/years       - Available stat years       ║
║   • GET  /api/health            - Health check               ║
║   • POST /api/refresh           - Force cache refresh        ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
        `);
    });
}

// Export for Vercel
module.exports = app;


