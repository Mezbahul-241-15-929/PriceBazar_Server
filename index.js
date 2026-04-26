const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");

require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

let stripe;
try {
    if (process.env.PAYMENT_GATEWAY_KEY) {
        stripe = require('stripe')(process.env.PAYMENT_GATEWAY_KEY);
    } else {
        console.warn("Warning: PAYMENT_GATEWAY_KEY not set, Stripe functionality disabled");
    }
} catch (error) {
    console.error("Stripe initialization error:", error.message);
}

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1jlx3rd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

let usersCollection;
let productsCollection;
let advertisementsCollection;
let reviewsCollection;
let watchlistCollection;
let ordersCollection;
let isConnected = false;

// JWT Middleware - Verify token from Authorization header
const verifyJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return next();
    }

    const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : authHeader;

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.decoded = decoded;
        next();
    } catch (error) {
        console.log('JWT Verification Error:', error.message);
        next();
    }
};

app.use(verifyJWT);

// Lazy DB connection — safe for serverless
async function connectDB() {
    if (isConnected) return;

    await client.connect();
    isConnected = true;

    usersCollection          = client.db("PriceBazar").collection("users");
    productsCollection       = client.db("PriceBazar").collection("products");
    advertisementsCollection = client.db("PriceBazar").collection("advertisements");
    reviewsCollection        = client.db("PriceBazar").collection("reviews");
    watchlistCollection      = client.db("PriceBazar").collection("watchlist");
    ordersCollection         = client.db("PriceBazar").collection("orders");

    await ordersCollection.createIndex({ userEmail: 1, orderDate: -1 });

    console.log("MongoDB Connected");
}

// Middleware: ensure DB is connected before every request
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        console.error("DB connection error:", err);
        res.status(500).json({ message: "Database connection failed" });
    }
});

// ==================== ROUTES ====================

app.get("/", (req, res) => {
    res.send("PriceBazar Server Running");
});

app.get('/data', (req, res) => {
    res.send('this is data');
});

// ==================== JWT ====================

app.post('/jwt', async (req, res) => {
    const { email, uid } = req.body;

    if (!email) {
        return res.status(400).send({ message: 'Email is required' });
    }

    try {
        const token = jwt.sign(
            { email, uid },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        res.send({ token });
    } catch (error) {
        console.error('JWT Generation Error:', error);
        res.status(500).send({ message: 'Failed to generate token' });
    }
});

// ==================== USERS ====================

app.post('/users', async (req, res) => {
    const userProfile = req.body;

    const newUser = {
        ...userProfile,
        role: 'user',
        createdAt: new Date(),
        lastSignIn: new Date()
    };

    const result = await usersCollection.insertOne(newUser);
    res.send(result);
});

app.get('/users', async (req, res) => {
    const result = await usersCollection.find().toArray();
    res.send(result);
});

app.delete('/users/:id', async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await usersCollection.deleteOne(query);
    res.send(result);
});

app.patch('/users/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const { role } = req.body;

        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: { role } };

        const result = await usersCollection.updateOne(filter, updateDoc);
        res.send(result);
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to update role" });
    }
});

app.get('/users/:email/role', async (req, res) => {
    try {
        const email = req.params.email;
        const user = await usersCollection.findOne({ email });

        if (!user) return res.status(404).send({ message: "User not found" });

        res.send({ role: user.role || "user" });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to get user role" });
    }
});

app.get('/users/:email', async (req, res) => {
    try {
        const email = req.params.email;

        if (req.decoded && req.decoded.email !== email) {
            return res.status(403).send({ message: "Forbidden: You can only access your own profile" });
        }

        const user = await usersCollection.findOne({ email });
        if (!user) return res.status(404).send({ message: "User not found" });

        res.send(user);
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to get user profile" });
    }
});

app.put('/users/:email', async (req, res) => {
    try {
        const email = req.params.email;
        const { displayName, photoURL, phone, address, bio } = req.body;

        if (req.decoded && req.decoded.email !== email) {
            return res.status(403).send({ message: "Forbidden: You can only update your own profile" });
        }

        const updateData = {};
        if (displayName) updateData.displayName = displayName;
        if (photoURL)    updateData.photoURL    = photoURL;
        if (phone)       updateData.phone       = phone;
        if (address)     updateData.address     = address;
        if (bio)         updateData.bio         = bio;
        updateData.updatedAt = new Date();

        const result = await usersCollection.updateOne({ email }, { $set: updateData });

        if (result.matchedCount === 0) return res.status(404).send({ message: "User not found" });

        const updatedUser = await usersCollection.findOne({ email });
        res.send(updatedUser);
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to update user profile" });
    }
});

app.patch('/users', async (req, res) => {
    const { email, lastSignInTime } = req.body;
    const filter = { email };
    const updatedDoc = { $set: { lastSignInTime } };
    const result = await usersCollection.updateOne(filter, updatedDoc);
    res.send(result);
});

// ==================== PRODUCTS ====================

app.post("/products", async (req, res) => {
    const data = req.body;
    const today = new Date().toISOString();

    const product = {
        ...data,
        prices: [{ date: today, price: parseFloat(data.price) }],
        createdAt: new Date(),
    };

    delete product.price;
    const result = await productsCollection.insertOne(product);
    res.send(result);
});

app.get("/products", async (req, res) => {
    try {
        const email = req.query.email;
        const query = {};

        if (email) {
            if (req.decoded && req.decoded.email !== email) {
                return res.status(403).send({ message: "Forbidden access" });
            }
            query.vendorEmail = email;
        }

        const result = await productsCollection.find(query).sort({ createdAt: -1 }).toArray();
        res.send(result);
    } catch (error) {
        res.status(500).send({ message: "Failed to fetch products" });
    }
});

app.delete("/products/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const vendorEmail = req.body && req.body.vendorEmail;

        if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid product ID' });

        const product = await productsCollection.findOne({ _id: new ObjectId(id) });
        if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

        if (vendorEmail && product.vendorEmail !== vendorEmail) {
            return res.status(403).json({ success: false, message: 'You can only delete your own products' });
        }

        const result = await productsCollection.deleteOne({ _id: new ObjectId(id) });
        res.json({ success: true, message: 'Product deleted successfully', deletedCount: result.deletedCount });
    } catch (error) {
        res.status(500).send({ message: "Failed to delete product" });
    }
});

app.get('/product/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid product ID' });

        const product = await productsCollection.findOne({ _id: new ObjectId(id) });
        if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

        res.json({ success: true, data: product });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch product', error: error.message });
    }
});

app.put('/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { itemName, marketName, image, description, date, prices, status, vendorEmail } = req.body;

        if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid product ID' });

        const existingProduct = await productsCollection.findOne({ _id: new ObjectId(id) });
        if (!existingProduct) return res.status(404).json({ success: false, message: 'Product not found' });

        if (vendorEmail && existingProduct.vendorEmail !== vendorEmail) {
            return res.status(403).json({ success: false, message: 'You can only edit your own products' });
        }

        const updateData = {
            itemName, marketName, image, description, date, prices,
            status: status || 'pending',
            vendorEmail: existingProduct.vendorEmail,
            updatedAt: new Date(),
        };

        const result = await productsCollection.updateOne({ _id: new ObjectId(id) }, { $set: updateData });

        if (result.modifiedCount === 0 && result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        res.json({ success: true, message: 'Product updated successfully', modifiedCount: result.modifiedCount });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating product', error: error.message });
    }
});

app.get('/products/all', async (req, res) => {
    try {
        const products = await productsCollection.find({}).sort({ createdAt: -1 }).toArray();
        res.json(products);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching products', error: error.message });
    }
});

app.patch('/products/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, rejectionReason } = req.body;

        if (!ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid product ID' });
        if (!['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const updateData = { status, updatedAt: new Date() };
        if (status === 'rejected' && rejectionReason) updateData.rejectionReason = rejectionReason;

        const result = await productsCollection.updateOne({ _id: new ObjectId(id) }, { $set: updateData });
        if (result.matchedCount === 0) return res.status(404).json({ success: false, message: 'Product not found' });

        res.json({ success: true, message: `Product ${status} successfully`, modifiedCount: result.modifiedCount });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating product status', error: error.message });
    }
});

app.get('/api/products/all', async (req, res) => {
    try {
        const { status = 'approved', sort = 'latest', order = 'desc', dateFrom, dateTo } = req.query;

        let query = { status };

        if (dateFrom || dateTo) {
            query.date = {};
            if (dateFrom) { const d = new Date(dateFrom); d.setHours(0,0,0,0); query.date.$gte = d; }
            if (dateTo)   { const d = new Date(dateTo);   d.setHours(23,59,59,999); query.date.$lte = d; }
        }

        const sortOrder = order === 'asc' ? 1 : -1;

        if (sort === 'price') {
            let products = await productsCollection.find(query).toArray();
            products = products.map(p => {
                let latestPrice = 0;
                if (p.newPrices && p.newPrices.length > 0) {
                    latestPrice = Math.min(...p.newPrices.map(x => x.price));
                }
                return { ...p, latestPrice };
            });
            products.sort((a, b) => sortOrder === 1 ? a.latestPrice - b.latestPrice : b.latestPrice - a.latestPrice);
            products = products.map(({ latestPrice, ...p }) => p);
            return res.json(products);
        }

        const sortField = sort === 'date' ? 'date' : 'createdAt';
        const products = await productsCollection.find(query).sort({ [sortField]: sortOrder }).toArray();
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching products', error: error.message });
    }
});

app.get('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid product ID' });

        const product = await productsCollection.findOne({ _id: new ObjectId(id) });
        if (!product) return res.status(404).json({ message: 'Product not found' });

        res.json(product);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching product', error: error.message });
    }
});

// ==================== ADVERTISEMENTS ====================

app.post('/advertisements', async (req, res) => {
    try {
        const { adTitle, shortDescription, image, vendorEmail, vendorName, status } = req.body;

        if (!adTitle || !shortDescription || !vendorEmail) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const newAd = {
            adTitle: adTitle.trim(),
            shortDescription: shortDescription.trim(),
            image: image || '',
            vendorEmail,
            vendorName,
            status: status || 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await advertisementsCollection.insertOne(newAd);
        res.json({ success: true, message: 'Advertisement created successfully', data: { _id: result.insertedId, ...newAd } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error creating advertisement', error: error.message });
    }
});

app.get('/advertisements/all', async (req, res) => {
    try {
        const advertisements = await advertisementsCollection.find({}).sort({ createdAt: -1 }).toArray();
        res.json(advertisements);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching advertisements', error: error.message });
    }
});

app.get('/advertisements', async (req, res) => {
    try {
        const { email, status } = req.query;
        const query = {};
        if (status) query.status = status;
        if (email)  query.vendorEmail = email;

        if (!email && !status) {
            return res.status(400).json({ success: false, message: 'Email or status query parameter is required' });
        }

        const advertisements = await advertisementsCollection.find(query).sort({ createdAt: -1 }).toArray();
        res.json(advertisements);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching advertisements', error: error.message });
    }
});

app.get('/advertisements/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid advertisement ID' });

        const ad = await advertisementsCollection.findOne({ _id: new ObjectId(id) });
        if (!ad) return res.status(404).json({ success: false, message: 'Advertisement not found' });

        res.json(ad);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching advertisement', error: error.message });
    }
});

app.put('/advertisements/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { adTitle, shortDescription, image, status } = req.body;

        if (!ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid advertisement ID' });
        if (!adTitle || !shortDescription) return res.status(400).json({ success: false, message: 'Missing required fields' });

        const updateData = {
            adTitle: adTitle.trim(),
            shortDescription: shortDescription.trim(),
            image: image || '',
            status: status || 'pending',
            updatedAt: new Date(),
        };

        const result = await advertisementsCollection.updateOne({ _id: new ObjectId(id) }, { $set: updateData });
        if (result.matchedCount === 0) return res.status(404).json({ success: false, message: 'Advertisement not found' });

        res.json({ success: true, message: 'Advertisement updated successfully', modifiedCount: result.modifiedCount });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating advertisement', error: error.message });
    }
});

app.delete('/advertisements/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid advertisement ID' });

        const result = await advertisementsCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) return res.status(404).json({ success: false, message: 'Advertisement not found' });

        res.json({ success: true, message: 'Advertisement deleted successfully', deletedCount: result.deletedCount });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error deleting advertisement', error: error.message });
    }
});

app.patch('/advertisements/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid advertisement ID' });
        if (!['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const result = await advertisementsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { status, updatedAt: new Date() } }
        );

        if (result.matchedCount === 0) return res.status(404).json({ success: false, message: 'Advertisement not found' });

        res.json({ success: true, message: 'Advertisement status updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating status', error: error.message });
    }
});

app.get('/api/advertisements', async (req, res) => {
    try {
        const { status = 'approved', email, limit = 100, skip = 0 } = req.query;
        const filter = {};
        if (status !== 'all') filter.status = status;
        if (email) filter.vendorEmail = email;

        const advertisements = await advertisementsCollection
            .find(filter).sort({ createdAt: -1 })
            .limit(parseInt(limit)).skip(parseInt(skip)).toArray();

        const total = await advertisementsCollection.countDocuments(filter);
        res.json({ success: true, data: advertisements, total, limit: parseInt(limit), skip: parseInt(skip) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch advertisements', error: error.message });
    }
});

app.get('/api/advertisements/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid advertisement ID format' });

        const ad = await advertisementsCollection.findOne({ _id: new ObjectId(id) });
        if (!ad) return res.status(404).json({ success: false, message: 'Advertisement not found' });

        res.json({ success: true, data: ad });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch advertisement', error: error.message });
    }
});

// ==================== REVIEWS ====================

app.get('/api/reviews/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        const reviews = await reviewsCollection.find({ productId }).sort({ timestamp: -1 }).toArray();
        res.json(reviews || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/reviews', async (req, res) => {
    try {
        const { productId, userId, author, email, text, rating } = req.body;
        if (!productId || !userId || !author || !email || !text || !rating) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be between 1 and 5' });

        const existing = await reviewsCollection.findOne({ productId, userId });
        if (existing) return res.status(409).json({ error: 'You have already reviewed this product' });

        const review = {
            productId, userId, author, email, text, rating,
            timestamp: new Date(),
            date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        };

        const result = await reviewsCollection.insertOne(review);
        res.status(201).json({ _id: result.insertedId, ...review });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/reviews/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { email, text, rating } = req.body;

        if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid review ID' });

        const review = await reviewsCollection.findOne({ _id: new ObjectId(id) });
        if (!review) return res.status(404).json({ error: 'Review not found' });
        if (review.email !== email) return res.status(403).json({ error: 'Not authorized to update this review' });
        if (rating && (rating < 1 || rating > 5)) return res.status(400).json({ error: 'Rating must be between 1 and 5' });

        await reviewsCollection.updateOne({ _id: new ObjectId(id) }, { $set: { text: text || review.text, rating: rating || review.rating, updatedAt: new Date() } });
        const updated = await reviewsCollection.findOne({ _id: new ObjectId(id) });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/reviews/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { email } = req.body;

        if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid review ID' });

        const review = await reviewsCollection.findOne({ _id: new ObjectId(id) });
        if (!review) return res.status(404).json({ error: 'Review not found' });
        if (review.email !== email) return res.status(403).json({ error: 'Not authorized to delete this review' });

        await reviewsCollection.deleteOne({ _id: new ObjectId(id) });
        res.json({ message: 'Review deleted successfully', _id: id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== WATCHLIST ====================

app.get('/api/watchlist/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const watchlist = await watchlistCollection.findOne({ userId });
        res.json(watchlist || { userId, products: [] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/watchlist', async (req, res) => {
    try {
        const { userId, productId } = req.body;
        if (!userId || !productId) return res.status(400).json({ error: 'Missing userId or productId' });

        const watchlist = await watchlistCollection.findOne({ userId });

        if (!watchlist) {
            const result = await watchlistCollection.insertOne({ userId, products: [productId], createdAt: new Date() });
            return res.json({ message: 'Added to watchlist', _id: result.insertedId });
        }

        if (watchlist.products.includes(productId)) return res.status(409).json({ error: 'Already in watchlist' });

        await watchlistCollection.updateOne({ userId }, { $push: { products: productId } });
        res.json({ message: 'Added to watchlist' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/watchlist/:userId/:productId', async (req, res) => {
    try {
        const { userId, productId } = req.params;
        if (!userId || !productId) return res.status(400).json({ error: 'Missing userId or productId' });

        await watchlistCollection.updateOne({ userId }, { $pull: { products: productId } });
        res.json({ message: 'Removed from watchlist' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== STRIPE / PAYMENTS ====================

app.post("/create-payment-intent", async (req, res) => {
    try {
        if (!stripe) {
            return res.status(500).json({ success: false, message: 'Stripe is not configured' });
        }
        const { amountInCents, product_id } = req.body;
        if (!amountInCents || !product_id) return res.status(400).json({ success: false, message: 'Missing required fields' });
        if (typeof amountInCents !== 'number' || amountInCents <= 0) return res.status(400).json({ success: false, message: 'amountInCents must be a positive number' });

        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amountInCents),
            currency: 'usd',
            metadata: { product_id: product_id.toString() }
        });

        res.json({ success: true, clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error creating payment intent', error: error.message });
    }
});

app.post("/create-checkout-session", async (req, res) => {
    try {
        if (!stripe) {
            return res.status(500).json({ success: false, message: 'Stripe is not configured' });
        }
        const { amountInCents, product_id } = req.body;
        if (!amountInCents || !product_id) return res.status(400).json({ success: false, message: 'Missing required fields' });

        const session = await stripe.checkout.sessions.create({
            ui_mode: "embedded",
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: { name: `Product: ${product_id}` },
                    unit_amount: Math.round(amountInCents),
                },
                quantity: 1,
            }],
            mode: 'payment',
            return_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/complete?session_id={CHECKOUT_SESSION_ID}`,
        });

        res.json({ success: true, clientSecret: session.client_secret, sessionId: session.id });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error creating checkout session', error: error.message });
    }
});

// ==================== ORDERS ====================

app.post('/confirm-payment', async (req, res) => {
    try {
        const { productId, userEmail, transactionId, amount, productData, paymentStatus } = req.body;
        if (!productId || !userEmail || !transactionId || !amount) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const order = {
            productId: new ObjectId(productId),
            productName: productData?.name || productData?.itemName || 'Unknown Product',
            marketName: productData?.marketName || 'Unknown Market',
            productImage: productData?.image || '',
            userEmail,
            transactionId,
            amount: parseFloat(amount),
            paymentStatus: paymentStatus || 'completed',
            orderDate: new Date(),
            createdAt: new Date(),
        };

        const result = await ordersCollection.insertOne(order);
        res.json({ success: true, message: 'Order created successfully', orderId: result.insertedId, order: { ...order, _id: result.insertedId } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error creating order', error: error.message });
    }
});

app.get('/orders/:email', async (req, res) => {
    try {
        const { email } = req.params;
        if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

        const orders = await ordersCollection.find({ userEmail: email }).sort({ orderDate: -1 }).toArray();
        res.json(orders || []);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching orders', error: error.message });
    }
});

app.get('/all-orders', async (req, res) => {
    try {
        const orders = await ordersCollection.find({}).sort({ orderDate: -1 }).toArray();
        res.json(orders || []);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching all orders', error: error.message });
    }
});

app.get('/order/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid order ID' });

        const order = await ordersCollection.findOne({ _id: new ObjectId(id) });
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        res.json(order);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching order', error: error.message });
    }
});

app.get('/orders-stats/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const stats = await ordersCollection.aggregate([
            { $match: { userEmail: email } },
            { $group: { _id: null, totalOrders: { $sum: 1 }, totalSpent: { $sum: '$amount' }, avgOrderValue: { $avg: '$amount' } } }
        ]).toArray();

        res.json(stats.length > 0 ? stats[0] : { totalOrders: 0, totalSpent: 0, avgOrderValue: 0 });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching statistics', error: error.message });
    }
});

app.get('/admin-stats', async (req, res) => {
    try {
        const totalUsers    = await usersCollection.countDocuments();
        const totalProducts = await productsCollection.countDocuments();
        const totalOrders   = await ordersCollection.countDocuments();

        const revenueData = await ordersCollection.aggregate([
            { $group: { _id: null, totalRevenue: { $sum: '$amount' }, completedOrders: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'completed'] }, 1, 0] } }, pendingOrders: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'pending'] }, 1, 0] } } } }
        ]).toArray();

        const revenue = revenueData.length > 0 ? revenueData[0] : { totalRevenue: 0, completedOrders: 0, pendingOrders: 0 };

        res.json({ totalUsers, totalProducts, totalOrders, totalRevenue: revenue.totalRevenue || 0, completedOrders: revenue.completedOrders || 0, pendingOrders: revenue.pendingOrders || 0 });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching admin statistics', error: error.message });
    }
});

app.get('/vendor-stats/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const totalProducts       = await productsCollection.countDocuments({ vendorEmail: email });
        const totalAdvertisements = await advertisementsCollection.countDocuments({ vendorEmail: email });

        const salesData = await ordersCollection.aggregate([
            { $match: { marketName: { $exists: true } } },
            { $group: { _id: null, totalSales: { $sum: '$amount' }, totalOrdersReceived: { $sum: 1 } } }
        ]).toArray();

        const sales = salesData.length > 0 ? salesData[0] : { totalSales: 0, totalOrdersReceived: 0 };
        res.json({ totalProducts, totalAdvertisements, totalSales: sales.totalSales || 0, totalOrdersReceived: sales.totalOrdersReceived || 0 });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching vendor statistics', error: error.message });
    }
});

// ==================== EXPORT FOR VERCEL ====================
module.exports = app;