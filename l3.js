const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const fs = require('fs');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const dns = require('dns').promises;

chromium.use(stealth);

// ==================== CONFIGURATION ====================
const SEED_PLACES = [
    'Bahraich   271801',
    'Nanpara   271865',
    'Kaiserganj   271903',
    'Mahasi   271824',
    'Payagpur   271871',
    'Motipur / Mihinpurwa   271855',
    'Chittaura   271801',
    'Risia   271875',
    'Visheshwarganj   271821',
    'Huzoorpur   271872',
    'Jarwal / Jarwal Road   271904',
    'Fakharpur   271902',
    'Tejwapur   271825',
    'Balha   271865',
    'Nawabganj   271881',
    'Shivpur   271830',
    'Rupaidiha   271881',
    'Chilwaria   271870',
    'Khutehna   271806',
    'Baundi   271902',
    'Hardi   271825',
    'Matera   271851',
    'Babaganj   271881',
    'Charda   271881',
    'Sujauli   271841',
    'Bichhiya   271841',
    'Semari   271855',
    'Urra   271855',
    'Gangwal   271821',
];

const state = 'Uttar Pradesh';
const district = 'Bahraich';
const subDistrict = '';
const zipCode = '';

// सर्वर ऑप्टिमाइज़ेशन के लिए headless mode (ज़रूरत पड़ने पर false करें)
const HEADLESS_MODE = true;
const JSON_FLUSH_BATCH_SIZE = 20;
const JSON_FLUSH_INTERVAL_MS = 45000;

// District-based Collection Names
const safeDistrictSlug = String(district).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
const contactsCollectionName = `${safeDistrictSlug}`;
const placesCollectionName = `${safeDistrictSlug}_places`;
const queriesCollectionName = `${safeDistrictSlug}_queries`;

const mongoHost = '127.0.0.1:27017';
const dbName = 'map_contact_data';
const MONGO_URI = `mongodb://${mongoHost}/${dbName}`;

const SEED_QUERY_TEMPLATES = [
    'Painter in {place}',
    'traders in {place}',
    'traveller agent $ agency in {place}',
    'grocerry shop in {place}',
    'Plumber in {place}',
    'Electrician in {place}',
    'Carpenter in {place}',
    'AC Repair / Appliance Repair in {place}',
    'Pest Control Service in {place}',
    'Home Cleaning Services in {place}',
    'Courier Service / Logistics in {place}',
    'Dry Cleaners & Laundry in {place}',
    'Photostat / Printing Shop in {place}',
    'Tailor / Boutique in {place}',
    'Packers and Movers in {place}',
    'Hair Salon / Barber Shop in {place}',
    'Beauty Parlour in {place}',
    'Gym / Fitness Center in {place}',
    'Yoga Studio in {place}',
    'Spa & Massage Center in {place}',
    'Tattoo Shop in {place}',
    'Coaching Center / Tuition & Home Tutors in {place}',
    'Driving School in {place}',
    'Computer Training School in {place}',
    'Library / Study Rooms in {place}',
    'Bookstore / Stationery Shop in {place}',
    'Mobile Phone Repair Shop in {place}',
    'Mobile Shop in {place}',
    'Computer Repairing Shop in {place}',
    'Computer Shop in {place}',
    'Hardware Store in {place}',
    'Saree Shop / Clothing Store in {place}',
    'Cosmetic Shops in {place}',
    'Shopping Mall in {place}',
    'Jewellery Store in {place}',
    'Pet Shop & Veterinary Clinic in {place}',
    'Gift Shop / Toy Store in {place}',
    'Chartered Accountant (CA) in {place}',
    'Law Firm / Advocate in {place}',
    'Real Estate Agency / Property Dealer in {place}',
    'Photographer / Photo Studio in {place}',
    'Schools, Colleges & Universities in {place}',
    'Skill Institutes (Fashion Designing, Beauty Academy, Digital Marketing) in {place}',
    'Language & Hobby Classes (English Speaking, Music/Dance, Martial Arts) in {place}',
    'Hospitals & Trauma Centers in {place}',
    'Pharmacy & Medical Shop in {place}',
    'Diagnostic Centers & Pathology Labs in {place}',
    'Mental Health & Counseling Centers in {place}',
    'Swimming Pools in {place}',
    'Cinema Halls & Multiplexes in {place}',
    'Amusement Parks & Water Parks in {place}',
    'Car & Bike Showrooms in {place}',
    '4-Wheeler Showrooms in {place}',
    'Car & Bike Repair Shop in {place}',
    'Used Car Dealers in {place}',
    'Car Wash & Detailing Centers in {place}',
    'Tyre Shop & Wheel Alignment in {place}',
    'Battery & Inverter Dealers in {place}',
    'Banquet Halls & Marriage Lawns in {place}',
    'Restaurants in {place}',
    'Puja Samagri Shops in {place}',
    'Astrologer & Pandit / Jyotish in {place}',
    'Hotels & OYO in {place}',
    'Gas Stove & Cylinder Repair in {place}',
    'Watch & Clock Repair Shop in {place}',
    'Bars in {place}',
    'Fastag Agents in {place}',
    'Gold Loan Companies in {place}',
    'Loan Agents in {place}',
    'LIC & Insurance Agents in {place}',
    'Car Rental & Bike Rental in {place}',
    'Key Maker / Locksmith in {place}',
    'Tea & Coffee Stalls / Tapri in {place}',
    'Dairy & Milk Booth in {place}',
    'Ice Cream Parlors & Juice Centers in {place}',
    'Meat, Chicken & Fish Shops in {place}',
    'Bakery & Cake Shops in {place}',
    'Sweet Shops (Mithai ki Dukan) in {place}',
    'Caterers & Halwai in {place}',
    'Event Planners & Decorators in {place}',
    'DJ & Sound Systems in {place}',
    'Tent House in {place}',
    'Electronic Stores in {place}',
    'Furniture Showrooms in {place}',
    'Flex, Banner & Signboard Printers in {place}',
    'Solar Panel Dealers in {place}',
    'Agriculture / Pesticide Shops in {place}',
    'Optical Shops (Chashme ki Dukan) in {place}',
    'Footwear Stores in {place}',
    'Nursery & Plant Shops in {place}',
    'Scrap Dealers (Kabadiwala) in {place}',
    'Delivery boy in {place}',
    'petrolpump in {place}',
    'adhar center $ csc in {place}'
];

const MAX_RECORDS_NEEDED = 5000;
const MAX_QUERY_RETRIES = 2;
const MAX_PLACE_RETRIES = 1;

const JSON_FILE = `scraped_${safeDistrictSlug}.json`;
const CSV_FILE = `scraped_${safeDistrictSlug}.csv`;

const EMAIL_CONFIG = {
    senderEmail: 'ghakskhxjdk@gmail.com',
    appPassword: '',
    receiverEmail: 'ramu@uprcart.com'
};

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
];

// ==================== MONGOOSE SCHEMAS ====================
const placeContactSchema = new mongoose.Schema({
    Name: { type: String, sparse: true },
    Phone: { type: String, sparse: true },
    Address: String,
    State: String,
    District: String,
    SubDistrict: String,
    ZipCode: String,
    Website: String,
    Email: String,
    Category: String,
    CreatedAt: { type: Date, default: Date.now }
});

const placeQueueSchema = new mongoose.Schema({
    place: { type: String, required: true, unique: true },
    district: { type: String, required: true, index: true },
    state: { type: String, default: '' },
    order: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ['pending', 'processing', 'done', 'retry'],
        default: 'pending',
        index: true
    },
    attemptCount: { type: Number, default: 0 },
    placeRetryCount: { type: Number, default: 0 },
    lastError: { type: String, default: '' },
    startedAt: Date,
    completedAt: Date,
    updatedAt: { type: Date, default: Date.now }
});

const searchQueryQueueSchema = new mongoose.Schema({
    place: { type: String, required: true, index: true },
    district: { type: String, required: true, index: true },
    query: { type: String, required: true },
    order: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ['pending', 'processing', 'done', 'retry', 'failed'],
        default: 'pending',
        index: true
    },
    attemptCount: { type: Number, default: 0 },
    retryCount: { type: Number, default: 0 },
    lastError: { type: String, default: '' },
    startedAt: Date,
    completedAt: Date,
    updatedAt: { type: Date, default: Date.now }
});

searchQueryQueueSchema.index({ place: 1, query: 1 }, { unique: true });

const PlaceContactModel = mongoose.model('PlaceContactModel', placeContactSchema, contactsCollectionName);
const PlaceQueueModel = mongoose.model('PlaceQueueModel', placeQueueSchema, placesCollectionName);
const SearchQueryQueueModel = mongoose.model('SearchQueryQueueModel', searchQueryQueueSchema, queriesCollectionName);

// ==================== UTILITY FUNCTIONS ====================
const randomDelay = (min, max) =>
    new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1)) + min));

function normalizePhone(rawPhone) {
    if (!rawPhone) return '';
    const digits = String(rawPhone).replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
    return digits || String(rawPhone).trim();
}

async function checkInternetConnection() {
    try {
        await dns.lookup('google.com');
        return true;
    } catch (e) {
        return false;
    }
}

async function waitUntilOnline() {
    let isOnline = await checkInternetConnection();
    if (!isOnline) {
        console.log("🌐 [OFFLINE / IDEAL STATE] इंटरनेट कनेक्शन नहीं है! स्क्रिप्ट प्रतीक्षा कर रही है...");
    }
    while (!isOnline) {
        await new Promise(res => setTimeout(res, 5000));
        isOnline = await checkInternetConnection();
        if (isOnline) {
            console.log("🟢 [ONLINE] इंटरनेट कनेक्शन फिर से चालू हो गया है! काम शुरू किया जा रहा है...");
        }
    }
}

async function resetFailedQueriesToPending(targetPlace = null) {
    const filter = { district, status: 'failed' };
    if (targetPlace) filter.place = targetPlace;
    const res = await SearchQueryQueueModel.updateMany(filter, {
        $set: { status: 'pending', retryCount: 0, lastError: '', updatedAt: new Date() }
    });
    console.log(`♻️ [RESET FAILED -> pending] ${res.modifiedCount || 0} queries reset.`);
    return res.modifiedCount || 0;
}

async function syncSeedPlacesAndQueriesToDB() {
    if (mongoose.connection.readyState !== 1) {
        throw new Error('MongoDB कनेक्ट नहीं है, कार्य आगे नहीं बढ़ाया जा सकता।');
    }

    console.log(`🔄 डेटाबेस ("${dbName}") में Places ("${placesCollectionName}") और Queries ("${queriesCollectionName}") सिंक की जा रही हैं...`);

    if (SEED_PLACES.length > 0) {
        const placeOps = SEED_PLACES.map((placeStr, idx) => ({
            updateOne: {
                filter: { place: placeStr },
                update: {
                    $setOnInsert: {
                        place: placeStr,
                        district,
                        state,
                        order: idx,
                        status: 'pending',
                        attemptCount: 0,
                        placeRetryCount: 0,
                        lastError: ''
                    },
                    $set: { updatedAt: new Date() }
                },
                upsert: true
            }
        }));
        const pRes = await PlaceQueueModel.bulkWrite(placeOps);
        console.log(`📌 Places Sync: upserted/inserted=${pRes.upsertedCount || 0}, matched=${pRes.matchedCount || 0}`);
    }

    const allPlacesDocs = await PlaceQueueModel.find({ district }).sort({ order: 1, _id: 1 }).lean();

    if (SEED_QUERY_TEMPLATES.length > 0 && allPlacesDocs.length > 0) {
        const queryOps = [];
        for (const pDoc of allPlacesDocs) {
            SEED_QUERY_TEMPLATES.forEach((tpl, qIdx) => {
                const resolvedQuery = tpl.replace(/\{place\}/g, pDoc.place);
                queryOps.push({
                    updateOne: {
                        filter: { place: pDoc.place, query: resolvedQuery },
                        update: {
                            $setOnInsert: {
                                place: pDoc.place,
                                district,
                                query: resolvedQuery,
                                order: qIdx,
                                status: 'pending',
                                attemptCount: 0,
                                retryCount: 0,
                                lastError: ''
                            },
                            $set: { updatedAt: new Date() }
                        },
                        upsert: true
                    }
                });
            });
        }

        if (queryOps.length > 0) {
            const CHUNK_SIZE = 1000;
            let totalUpserted = 0;
            let totalMatched = 0;
            for (let i = 0; i < queryOps.length; i += CHUNK_SIZE) {
                const chunk = queryOps.slice(i, i + CHUNK_SIZE);
                const qRes = await SearchQueryQueueModel.bulkWrite(chunk);
                totalUpserted += qRes.upsertedCount || 0;
                totalMatched += qRes.matchedCount || 0;
            }
            console.log(`🔎 Queries Sync (${queryOps.length} total mapped): upserted/inserted=${totalUpserted}, matched=${totalMatched}`);
        }
    }

    const processingPlaces = await PlaceQueueModel.countDocuments({ district, status: 'processing' });
    const processingQueries = await SearchQueryQueueModel.countDocuments({ district, status: 'processing' });
    const pendingPlaces = await PlaceQueueModel.countDocuments({ district, status: 'pending' });
    const donePlaces = await PlaceQueueModel.countDocuments({ district, status: 'done' });
    console.log(`📊 DB Queue Summary [${district}]: Places(pending=${pendingPlaces}, processing=${processingPlaces}, done=${donePlaces}) | Queries(processing=${processingQueries})`);
}

async function setPlaceStatus(placeStr, status, errorMsg = '', { incrementAttempt = false, incrementPlaceRetry = false } = {}) {
    const setFields = {
        status,
        lastError: errorMsg,
        updatedAt: new Date()
    };
    if (status === 'processing') setFields.startedAt = new Date();
    if (status === 'done') setFields.completedAt = new Date();

    const incFields = {};
    if (incrementAttempt) incFields.attemptCount = 1;
    if (incrementPlaceRetry) incFields.placeRetryCount = 1;

    const updateDoc = { $set: setFields };
    if (Object.keys(incFields).length > 0) {
        updateDoc.$inc = incFields;
    }

    await PlaceQueueModel.updateOne({ place: placeStr }, updateDoc);
}

async function setQueryStatus(queryDocId, status, errorMsg = '', { incrementAttempt = false, incrementRetry = false } = {}) {
    const setFields = {
        status,
        lastError: errorMsg,
        updatedAt: new Date()
    };
    if (status === 'processing') setFields.startedAt = new Date();
    if (status === 'done' || status === 'failed') setFields.completedAt = new Date();

    const incFields = {};
    if (incrementAttempt) incFields.attemptCount = 1;
    if (incrementRetry) incFields.retryCount = 1;

    const updateDoc = { $set: setFields };
    if (Object.keys(incFields).length > 0) {
        updateDoc.$inc = incFields;
    }

    return await SearchQueryQueueModel.findOneAndUpdate({ _id: queryDocId }, updateDoc, { new: true });
}

async function markQueryRetryOrFailed(queryDoc, errMsg) {
    const nextRetryCount = (queryDoc.retryCount || 0) + 1;
    if (nextRetryCount <= MAX_QUERY_RETRIES) {
        await setQueryStatus(queryDoc._id, 'retry', errMsg, { incrementRetry: true });
        console.log(`🔁 [QUERY -> retry] "${queryDoc.query}" (retryCount=${nextRetryCount}/${MAX_QUERY_RETRIES}) | Reason: ${errMsg}`);
        return 'retry';
    } else {
        await setQueryStatus(queryDoc._id, 'failed', `Max retries (${MAX_QUERY_RETRIES}) reached: ${errMsg}`, { incrementRetry: true });
        console.log(`⛔ [QUERY -> failed] "${queryDoc.query}" (max retries ${MAX_QUERY_RETRIES} reached) | Reason: ${errMsg}`);
        return 'failed';
    }
}

async function getNextPlaceToProcess() {
    let placeDoc = await PlaceQueueModel.findOne({ district, status: 'processing' }).sort({ order: 1, _id: 1 });
    if (placeDoc) {
        console.log(`🔄 [CRASH RECOVERY - PLACE] Resuming 'processing' place: "${placeDoc.place}"`);
        return placeDoc;
    }

    placeDoc = await PlaceQueueModel.findOne({ district, status: 'pending' }).sort({ order: 1, _id: 1 });
    if (placeDoc) return placeDoc;

    placeDoc = await PlaceQueueModel.findOne({
        district,
        status: 'retry',
        placeRetryCount: { $lt: MAX_PLACE_RETRIES }
    }).sort({ order: 1, _id: 1 });
    if (placeDoc) {
        console.log(`🔁 [RETRY PLACE] Picking 'retry' place: "${placeDoc.place}" (placeRetryCount=${placeDoc.placeRetryCount}/${MAX_PLACE_RETRIES})`);
    }
    return placeDoc;
}

async function getNextPrimaryQueryForPlace(placeStr) {
    let qDoc = await SearchQueryQueueModel.findOne({
        place: placeStr,
        district,
        status: 'processing'
    }).sort({ order: 1, _id: 1 });
    if (qDoc) {
        console.log(`🔄 [CRASH RECOVERY - QUERY] Resuming 'processing' query: "${qDoc.query}"`);
        return qDoc;
    }

    qDoc = await SearchQueryQueueModel.findOne({
        place: placeStr,
        district,
        status: 'pending'
    }).sort({ order: 1, _id: 1 });
    return qDoc;
}

async function getNextRetryQueryForPlace(placeStr) {
    return await SearchQueryQueueModel.findOne({
        place: placeStr,
        district,
        status: 'retry',
        retryCount: { $lt: MAX_QUERY_RETRIES }
    }).sort({ order: 1, _id: 1 });
}

async function getResultItemsOnPage(page) {
    const primary = await page.$$('div[role="feed"] > div > div a.hfpxzc').catch(() => []);
    if (primary.length > 0) return primary;
    return await page.$$('div[role="feed"] a[href*="/maps/place/"]').catch(() => []);
}

async function sendEmailAlert(subject, message, attachFilePath = null) {
    if (EMAIL_CONFIG.senderEmail.includes('YOUR_GMAIL') || !EMAIL_CONFIG.appPassword || !EMAIL_CONFIG.senderEmail) {
        console.log("⚠️ ईमेल अलर्ट स्किप किया गया क्योंकि ईमेल कॉन्फ़िगरेशन सेट नहीं है।");
        return;
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: EMAIL_CONFIG.senderEmail.trim(),
            pass: EMAIL_CONFIG.appPassword.replace(/\s/g, '')
        }
    });

    const mailOptions = {
        from: EMAIL_CONFIG.senderEmail,
        to: EMAIL_CONFIG.receiverEmail,
        subject,
        text: message
    };

    if (attachFilePath && fs.existsSync(attachFilePath)) {
        mailOptions.attachments = [{ filename: attachFilePath, path: attachFilePath }];
    }

    try {
        await transporter.sendMail(mailOptions);
        console.log(`📩 ईमेल अलर्ट सफलतापूर्वक भेजा गया: ${subject}`);
    } catch (error) {
        console.error("\n❌ [Email Error]: ईमेल भेजने में समस्या आई!");
        console.error(`👉 एरर डिटेल: ${error.message}\n`);
    }
}

// JSON को बैच/इंटरवल में फ्लश करना ताकि सर्वर डिस्क I/O और RAM spike कम रहे
let lastJsonFlushTime = Date.now();
let pendingJsonWritesCount = 0;

function flushJsonFile(allRecords, force = false) {
    const now = Date.now();
    if (!force && pendingJsonWritesCount < JSON_FLUSH_BATCH_SIZE && (now - lastJsonFlushTime) < JSON_FLUSH_INTERVAL_MS) {
        return;
    }
    fs.writeFileSync(JSON_FILE, JSON.stringify(allRecords, null, 4), 'utf8');
    lastJsonFlushTime = now;
    pendingJsonWritesCount = 0;
    console.log(`💾 [JSON Flushed] ${JSON_FILE} (${allRecords.length} records)`);
}

async function updateFilesAndDBLive(record, allRecords) {
    try {
        const escapedName = (record.Name || '').replace(/"/g, '""');
        const escapedAddress = (record.Address || '').replace(/"/g, '""');
        const escapedState = (record.State || '').replace(/"/g, '""');
        const escapedDistrict = (record.District || '').replace(/"/g, '""');
        const escapedSubDistrict = (record.SubDistrict || '').replace(/"/g, '""');
        const escapedCategory = (record.Category || '').replace(/"/g, '""');

        const csvLine = `"${escapedName}","${record.Phone}","${escapedAddress}","${escapedState}","${escapedDistrict}","${escapedSubDistrict}","${record.ZipCode}","${record.Website}","${record.Email}","${escapedCategory}"\n`;
        fs.appendFileSync(CSV_FILE, csvLine, 'utf8');

        pendingJsonWritesCount++;
        flushJsonFile(allRecords, false);

        if (mongoose.connection.readyState === 1) {
            try {
                await PlaceContactModel.create(record);
                console.log(`🗄️ [MongoDB Saved] DB: "${dbName}" | Collection: "${contactsCollectionName}" | Record: "${record.Name}"`);
            } catch (dbWriteErr) {
                if (dbWriteErr && dbWriteErr.code === 11000) {
                    console.log(`⏩ [SKIP - MONGO E11000 DUPLICATE] "${record.Name}" | Phone: ${record.Phone}`);
                } else {
                    console.error("⚠️ MongoDB insert error:", dbWriteErr.message);
                }
            }
        } else {
            console.log(`⚠️ [MongoDB Skip] Connection active नहीं है।`);
        }
    } catch (err) {
        console.error("⚠️ Data saving error:", err.message);
    }
}

// ==================== MAIN EXECUTION ====================
(async () => {
    await waitUntilOnline();

    try {
        await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
        console.log(`✅ MongoDB Database ("${dbName}") से सफलतापूर्वक कनेक्शन स्थापित हुआ!`);
        console.log(`📁 Collections -> Contacts: "${contactsCollectionName}" | Places: "${placesCollectionName}" | Queries: "${queriesCollectionName}"`);
    } catch (dbErr) {
        console.error("❌ MongoDB Connection Error:", dbErr.message);
        return;
    }

    await syncSeedPlacesAndQueriesToDB();

    let collectedData = [];
    const existingPhones = new Set();
    const existingNameAddressKeys = new Set();

    const csvHeader = '\uFEFFName,Phone,Address,State,District,SubDistrict,ZipCode,Website,Email,SearchCategory\n';
    if (!fs.existsSync(CSV_FILE)) {
        fs.writeFileSync(CSV_FILE, csvHeader, 'utf8');
        console.log(`📄 नई CSV फ़ाइल बनाई गई: ${CSV_FILE}`);
    }
    if (fs.existsSync(JSON_FILE)) {
        try {
            collectedData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
            collectedData.forEach(item => {
                const normP = normalizePhone(item.Phone);
                if (normP) existingPhones.add(normP);
                if (item.Name && item.Name !== 'N/A') {
                    existingNameAddressKeys.add(`${item.Name.toLowerCase()}||${(item.Address || '').toLowerCase()}`);
                }
            });
            console.log(`📂 पुराना डेटा लोड हुआ: ${collectedData.length} रिकॉर्ड्स पहले से मौजूद हैं।`);
        } catch (e) {
            console.error("⚠️ पुराना JSON पढ़ने में समस्या:", e.message);
            collectedData = [];
        }
    } else {
        fs.writeFileSync(JSON_FILE, JSON.stringify([], null, 4), 'utf8');
        console.log(`📄 नई JSON फ़ाइल बनाई गई: ${JSON_FILE}`);
    }

    let browser;
    try {
        console.log(`🚀 Playwright Chromium ब्राउज़र लॉन्च किया जा रहा है (headless=${HEADLESS_MODE})...`);
        browser = await chromium.launch({
            headless: HEADLESS_MODE,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-zygote',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                ...(HEADLESS_MODE ? [] : ['--start-maximized'])
            ]
        });
        console.log("✅ ब्राउज़र सफलतापूर्वक लॉन्च हो गया।");
    } catch (launchErr) {
        console.error("❌ Browser Launch Failure:", launchErr.message);
        flushJsonFile(collectedData, true);
        await mongoose.connection.close().catch(() => {});
        return;
    }

    let isBlockedByGoogle = false;
    let isTargetAchieved = false;
    let stopReason = "";
    let activePlaceStr = null;
    let activeQueryDoc = null;
    let isShuttingDown = false;

    async function cleanupAndExit(reason = 'SHUTDOWN') {
        if (isShuttingDown) return;
        isShuttingDown = true;
        console.log(`\n🛑 [CLEANUP - ${reason}] सुरक्षित रूप से बंद किया जा रहा है...`);
        try {
            flushJsonFile(collectedData, true);
            if (activeQueryDoc && mongoose.connection.readyState === 1) {
                await setQueryStatus(activeQueryDoc._id, 'processing', `Interrupted by ${reason}`);
                console.log(`📌 Query status preserved as 'processing': "${activeQueryDoc.query}"`);
            }
            if (activePlaceStr && mongoose.connection.readyState === 1) {
                await setPlaceStatus(activePlaceStr, 'processing', `Interrupted by ${reason}`);
                console.log(`📌 Place status preserved as 'processing': "${activePlaceStr}"`);
            }
        } catch (e) {}

        if (browser) {
            await browser.close().catch(() => {});
            console.log("🌐 Browser बंद कर दिया गया।");
        }
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close().catch(() => {});
            console.log("🔌 MongoDB Connection सुरक्षित रूप से बंद कर दिया गया।");
        }
    }

    process.on('SIGINT', async () => { await cleanupAndExit('SIGINT'); process.exit(0); });
    process.on('SIGTERM', async () => { await cleanupAndExit('SIGTERM'); process.exit(0); });
    process.on('unhandledRejection', async (r) => { console.error('❌ Unhandled Rejection:', r); await cleanupAndExit('UNHANDLED_REJECTION'); process.exit(1); });
    process.on('uncaughtException', async (err) => { console.error('❌ Uncaught Exception:', err); await cleanupAndExit('UNCAUGHT_EXCEPTION'); process.exit(1); });

    async function executeQueryWithStatus(queryDoc) {
        if (isBlockedByGoogle || isTargetAchieved || isShuttingDown) return 'blocked';

        activeQueryDoc = queryDoc;
        const updatedQ = await setQueryStatus(queryDoc._id, 'processing', '', { incrementAttempt: true });
        const attemptNum = updatedQ ? updatedQ.attemptCount : (queryDoc.attemptCount || 0) + 1;
        console.log(`🔄 [QUERY -> processing] "${queryDoc.query}" (Attempt: ${attemptNum}, Retry: ${queryDoc.retryCount})`);

        await waitUntilOnline();

        const randomUA = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
        let context, page;

        try {
            context = await browser.newContext({
                viewport: HEADLESS_MODE ? { width: 1280, height: 800 } : null,
                userAgent: randomUA,
                locale: 'en-US'
            });
            page = await context.newPage();
            page.setDefaultTimeout(60000);
        } catch (ctxErr) {
            const errMsg = `Context creation failed: ${ctxErr.message}`;
            console.error(`⚠️ ${errMsg}`);
            if (context) await context.close().catch(() => {});
            const outcome = await markQueryRetryOrFailed(queryDoc, errMsg);
            activeQueryDoc = null;
            return outcome;
        }

        const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(queryDoc.query)}`;
        console.log(`🌐 Navigating to: ${searchUrl}`);

        try {
            await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
            await randomDelay(4000, 7000);

            const pageContent = await page.content();
            if (pageContent.includes("detected unusual traffic") || pageContent.includes("captcha")) {
                isBlockedByGoogle = true;
                stopReason = `🚨 Google Block/CAPTCHA Detected on query: "${queryDoc.query}"`;
                console.log(stopReason);
                await setQueryStatus(queryDoc._id, 'processing', stopReason);
                await context.close().catch(() => {});
                activeQueryDoc = null;
                return 'blocked';
            }
        } catch (e) {
            const errMsg = `Navigation error: ${e.message}`;
            console.log(`⚠️ ${errMsg} for query "${queryDoc.query}"`);
            await context.close().catch(() => {});
            const outcome = await markQueryRetryOrFailed(queryDoc, errMsg);
            activeQueryDoc = null;
            return outcome;
        }

        const scrollablePanelSelector = 'div[role="feed"]';
        let isFeedFound = true;
        await page.waitForSelector(scrollablePanelSelector, { timeout: 15000 }).catch(() => {
            isFeedFound = false;
        });

        if (!isFeedFound) {
            const errMsg = `Feed panel did not load in time`;
            console.log(`⚠️ Feed panel load नहीं हुआ: "${queryDoc.query}"`);
            await context.close().catch(() => {});
            const outcome = await markQueryRetryOrFailed(queryDoc, errMsg);
            activeQueryDoc = null;
            return outcome;
        }

        console.log(`✅ Feed panel loaded for "${queryDoc.query}". Scrolling & extracting items...`);

        let processedIndices = 0;
        let noNewItemsCounter = 0;
        let consecutiveNoPhoneCounter = 0;
        let recordsForThisQuery = 0;

        try {
            while (noNewItemsCounter < 10 && !isShuttingDown) {
                if (collectedData.length >= MAX_RECORDS_NEEDED) {
                    isTargetAchieved = true;
                    console.log(`\n🎯 कुल टारगेट (${MAX_RECORDS_NEEDED} रिकॉर्ड्स) पूरा हो गया है!`);
                    await setQueryStatus(queryDoc._id, 'done', '');
                    await context.close().catch(() => {});
                    activeQueryDoc = null;
                    return 'target_reached';
                }

                if (consecutiveNoPhoneCounter >= 15) {
                    isBlockedByGoogle = true;
                    stopReason = `🚨 Rate Limit Warning: लगातार 15 रिजल्ट्स में कोई फोन नंबर नहीं मिला।`;
                    console.log(stopReason);
                    await setQueryStatus(queryDoc._id, 'processing', stopReason);
                    await context.close().catch(() => {});
                    activeQueryDoc = null;
                    return 'blocked';
                }

                if (page.isClosed()) {
                    throw new Error('Page closed unexpectedly during scraping');
                }

                const items = await getResultItemsOnPage(page);

                if (items.length <= processedIndices) {
                    const panel = await page.$(scrollablePanelSelector).catch(() => null);
                    if (panel) {
                        console.log(`📜 Scrolling feed... (Loaded: ${items.length}, Processed: ${processedIndices}, NoNewStreak: ${noNewItemsCounter}/10)`);
                        await panel.evaluate((el) => el.scrollTo(0, el.scrollHeight)).catch(() => {});
                        await randomDelay(3000, 5000);
                    }

                    const newItems = await getResultItemsOnPage(page);
                    if (newItems.length === items.length) {
                        noNewItemsCounter++;
                    } else {
                        console.log(`➕ New items loaded: ${newItems.length - items.length} (Total feed items: ${newItems.length})`);
                        noNewItemsCounter = 0;
                    }

                    const isEnd = await page.evaluate(() => document.body.innerText.includes("You've reached the end of the list")).catch(() => false);
                    if (isEnd) {
                        console.log("🏁 Category finished (" + queryDoc.query + ").");
                        break;
                    }
                    continue;
                }

                const currentItem = items[processedIndices];
                processedIndices++;

                try {
                    await randomDelay(1500, 3000);
                    await currentItem.scrollIntoViewIfNeeded().catch(() => {});
                    await currentItem.click({ force: true, timeout: 10000 });

                    await randomDelay(3000, 5500);
                    await page.waitForSelector('h1.DUwDvf', { timeout: 5000 }).catch(() => {});

                    const nameEl = await page.$('h1.DUwDvf').catch(() => null);
                    if (!nameEl) {
                        console.log(`⚠️ [SKIP - NO NAME ELEMENT] Item #${processedIndices}`);
                        continue;
                    }
                    const name = await nameEl.innerText().then(t => t.trim()).catch(() => 'N/A');

                    const rawPhone = await page.$eval('button[data-item-id^="phone:tel:"]', el => {
                        return el.getAttribute('data-item-id').replace('phone:tel:', '').trim();
                    }).catch(() => null);

                    const phone = normalizePhone(rawPhone);
                    if (!phone) {
                        console.log(`⏩ [SKIP - NO PHONE] "${name}" (Streak: ${consecutiveNoPhoneCounter + 1}/15)`);
                        consecutiveNoPhoneCounter++;
                        continue;
                    }

                    consecutiveNoPhoneCounter = 0;

                    const address = await page.$eval('button[data-item-id="address"]', el => el.innerText.trim()).catch(() => 'N/A');
                    const nameAddrKey = `${name.toLowerCase()}||${address.toLowerCase()}`;

                    if (existingPhones.has(phone) || (name !== 'N/A' && existingNameAddressKeys.has(nameAddrKey))) {
                        console.log(`⏩ [SKIP - MEMORY DUPLICATE] "${name}" | Phone: ${phone}`);
                        continue;
                    }

                    if (mongoose.connection.readyState === 1) {
                        const duplicateInDB = await PlaceContactModel.findOne({
                            $or: [{ Phone: phone }, { Name: name, Address: address }]
                        }).catch(() => null);

                        if (duplicateInDB) {
                            console.log(`⏩ [SKIP - MONGO DUPLICATE] "${name}" | Phone: ${phone}`);
                            existingPhones.add(phone);
                            if (name !== 'N/A') existingNameAddressKeys.add(nameAddrKey);
                            continue;
                        }
                    }

                    let extractedZip = zipCode;
                    if (address !== 'N/A') {
                        const pinMatch = address.match(/\b\d{6}\b/);
                        if (pinMatch) extractedZip = pinMatch[0];
                    }

                    const weblink = await page.$eval('a[data-item-id="authority"]', el => el.getAttribute('href')).catch(() => 'N/A');

                    let email = 'N/A';
                    try {
                        const panelText = await page.evaluate(() => document.querySelector('div[role="main"]')?.innerText || '');
                        const emailMatches = panelText.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi);
                        if (emailMatches && emailMatches.length > 0) {
                            const validEmail = emailMatches.find(e => !e.includes('google') && !e.includes('schema'));
                            if (validEmail) email = validEmail;
                        }
                    } catch (e) {}

                    const record = {
                        Name: name,
                        Phone: phone,
                        Address: address,
                        State: state,
                        District: district,
                        SubDistrict: subDistrict,
                        ZipCode: extractedZip,
                        Website: weblink,
                        Email: email,
                        Category: queryDoc.query
                    };

                    existingPhones.add(phone);
                    if (name !== 'N/A') existingNameAddressKeys.add(nameAddrKey);

                    collectedData.push(record);
                    recordsForThisQuery++;

                    await updateFilesAndDBLive(record, collectedData);
                    console.log(`✅ [SAVED (${collectedData.length} Total)] ${name} | 📞 ${phone} | 📍 ${queryDoc.place}`);

                    await randomDelay(2000, 4500);
                } catch (itemErr) {
                    console.error(`⚠️ Item skipped at index ${processedIndices} due to:`, itemErr.message);
                }
            }

            if (isShuttingDown) {
                await context.close().catch(() => {});
                activeQueryDoc = null;
                return 'blocked';
            }

            await setQueryStatus(queryDoc._id, 'done', '');
            console.log(`✅ [QUERY -> done] "${queryDoc.query}" | Added ${recordsForThisQuery} unique records.`);
            await context.close().catch(() => {});
            activeQueryDoc = null;

            if (!isBlockedByGoogle && !isTargetAchieved) {
                await randomDelay(8000, 12000);
            }
            return 'done';
        } catch (loopErr) {
            const errMsg = `Query loop error: ${loopErr.message}`;
            console.error(`❌ ${errMsg} on "${queryDoc.query}"`);
            await context.close().catch(() => {});
            const outcome = await markQueryRetryOrFailed(queryDoc, errMsg);
            activeQueryDoc = null;
            return outcome;
        }
    }

    try {
        let placeStep = 0;
        while (!isBlockedByGoogle && !isTargetAchieved && !isShuttingDown) {
            const placeDoc = await getNextPlaceToProcess();
            if (!placeDoc) {
                console.log("\n🏁 जिले के सभी Places सफलतापूर्वक पूरे हो गए हैं!");
                break;
            }

            placeStep++;
            const isRetryPick = placeDoc.status === 'retry';
            activePlaceStr = placeDoc.place;
            await setPlaceStatus(placeDoc.place, 'processing', '', {
                incrementAttempt: true,
                incrementPlaceRetry: isRetryPick
            });
            console.log(`\n==================================================`);
            console.log(`📍 [PLACE #${placeStep} -> processing]: "${placeDoc.place}" (order=${placeDoc.order}, prevStatus=${placeDoc.status})`);
            console.log(`==================================================`);

            // 1. Primary queries ('processing' first for crash recovery, then 'pending')
            let qStep = 0;
            while (!isBlockedByGoogle && !isTargetAchieved && !isShuttingDown) {
                const nextQuery = await getNextPrimaryQueryForPlace(placeDoc.place);
                if (!nextQuery) break;

                qStep++;
                console.log(`\n🔎 [PRIMARY QUERY #${qStep}]: "${nextQuery.query}" (order=${nextQuery.order})`);
                await executeQueryWithStatus(nextQuery);
            }

            if (isBlockedByGoogle || isTargetAchieved || isShuttingDown) break;

            // 2. Retry failed ('retry') queries of this place once all primary queries finish
            const retryCandidatesCount = await SearchQueryQueueModel.countDocuments({
                place: placeDoc.place,
                district,
                status: 'retry',
                retryCount: { $lt: MAX_QUERY_RETRIES }
            });

            if (retryCandidatesCount > 0) {
                console.log(`\n🔁 [END-OF-PLACE RETRY] "${placeDoc.place}" की बाकी queries पूरी हुईं। अब ${retryCandidatesCount} error/retry queries दोबारा चलाई जा रही हैं...`);
                let rStep = 0;
                while (!isBlockedByGoogle && !isTargetAchieved && !isShuttingDown) {
                    const retryQuery = await getNextRetryQueryForPlace(placeDoc.place);
                    if (!retryQuery) break;

                    rStep++;
                    console.log(`\n🔂 [RETRY QUERY #${rStep} (retryCount=${retryQuery.retryCount}/${MAX_QUERY_RETRIES})]: "${retryQuery.query}"`);
                    await executeQueryWithStatus(retryQuery);
                }
            } else {
                console.log(`ℹ️ "${placeDoc.place}" के लिए कोई retry query बाकी नहीं है।`);
            }

            if (isBlockedByGoogle || isTargetAchieved || isShuttingDown) break;

            // 3. Finalize place status
            const remainingUnfinished = await SearchQueryQueueModel.countDocuments({
                place: placeDoc.place,
                district,
                status: { $in: ['pending', 'processing', 'retry'] }
            });

            if (remainingUnfinished === 0) {
                await setPlaceStatus(placeDoc.place, 'done', '');
                console.log(`🎉 [PLACE -> done]: "${placeDoc.place}" की सभी queries पूरी हो गईं।`);
            } else {
                await setPlaceStatus(placeDoc.place, 'retry', `${remainingUnfinished} queries still pending/retry`);
                console.log(`⚠️ [PLACE -> retry]: "${placeDoc.place}" में ${remainingUnfinished} queries बाकी/retry सीमा में हैं।`);
            }

            flushJsonFile(collectedData, true);
            activePlaceStr = null;
        }

        if (!isBlockedByGoogle && !isShuttingDown) {
            flushJsonFile(collectedData, true);
            const successMsg = `🎉 स्क्रैपिंग पूरी हो गई है!\n\nकुल नया डेटा: ${collectedData.length} रिकॉर्ड्स\nफ़ाइलें: ${CSV_FILE}, ${JSON_FILE}`;
            console.log(`\n${successMsg}`);
            await sendEmailAlert('✅ Google Maps Scraper: Success Notification', successMsg, CSV_FILE);
        }
    } catch (globalError) {
        stopReason = `❌ Fatal Runtime Error: ${globalError.message}`;
        console.error(stopReason);
        flushJsonFile(collectedData, true);
        if (activeQueryDoc) {
            await setQueryStatus(activeQueryDoc._id, 'processing', globalError.message).catch(() => {});
        }
        if (activePlaceStr) {
            await setPlaceStatus(activePlaceStr, 'processing', globalError.message).catch(() => {});
        }
    } finally {
        if (!isShuttingDown) {
            flushJsonFile(collectedData, true);
            if (browser) {
                await browser.close().catch(() => {});
                console.log("🌐 Browser बंद कर दिया गया।");
            }
            if (mongoose.connection.readyState === 1) {
                await mongoose.connection.close().catch(() => {});
                console.log("🔌 MongoDB Connection सुरक्षित रूप से बंद कर दिया गया।");
            }
        }

        if (isBlockedByGoogle || stopReason.startsWith("❌")) {
            const alertMsg = `${stopReason}\n\nकुल ${collectedData.length} रिकॉर्ड्स सेव हुए।\n\n📌 Place और Query का status MongoDB (${placesCollectionName}, ${queriesCollectionName}) में सेव है। दोबारा रन करने पर वहीं से शुरू होगा।`;
            console.log(`\n${alertMsg}`);
            await sendEmailAlert('🚨 Google Maps Scraper: STOPPED / ERROR ALERT', alertMsg, null);
        }
    }
})();

module.exports = {
    resetFailedQueriesToPending,
    PlaceContactModel,
    PlaceQueueModel,
    SearchQueryQueueModel
};