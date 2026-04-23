const express = require('express')
const cors = require('cors')

require('dotenv').config();

const app = express()
const port = process.env.PORT || 3000
app.use(express.json());

const stripe = require('stripe')(process.env.PAYMENT_GATEWAY_KEY);

app.use(cors())

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1jlx3rd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`

//const uri = "mongodb+srv://mezbahul:2A3NW9ZuLLtGXaGu@cluster0.1jlx3rd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";


const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        //Jobs api
        const usersCollection = client.db('PriceBazar').collection('users');


        // User related APIs

        //send users singup data to the mongodb server
        app.post('/users', async (req, res) => {
            const userProfile = req.body;

            // add extra fields
            const newUser = {
                ...userProfile,
                role: 'user',
                createdAt: new Date(),
                lastSignIn: new Date()
            };

            console.log(newUser);

            const result = await usersCollection.insertOne(newUser);
            res.send(result);
        });
        //get user singup data from mongodb server 
        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })

        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await usersCollection.deleteOne(query);
            res.send(result);
        });

        //change user role to admin
        app.patch('/users/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const { role } = req.body;

                const filter = { _id: new ObjectId(id) };
                const updateDoc = {
                    $set: { role }
                };

                const result = await usersCollection.updateOne(filter, updateDoc);

                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).send({ message: "Failed to update role" });
            }
        });


        // (Get role by email)
        app.get('/users/:email/role', async (req, res) => {
            try {
                const email = req.params.email;

                const user = await usersCollection.findOne({ email });

                if (!user) {
                    return res.status(404).send({ message: "User not found" });
                }

                res.send({ role: user.role || "user" });
            } catch (error) {
                console.error(error);
                res.status(500).send({ message: "Failed to get user role" });
            }
        });

        //change passific data like lastSignInTime
        app.patch('/users', async (req, res) => {
            const { email, lastSignInTime } = req.body;
            const filter = { email: email }
            const updatedDoc = {
                $set: {
                    lastSignInTime: lastSignInTime
                }
            }

            const result = await usersCollection.updateOne(filter, updatedDoc)
            res.send(result);
        })


        // Product related APIs........................................

        const productsCollection = client.db('PriceBazar').collection('products');

        // Advertisement related APIs........................................

        const advertisementsCollection = client.db('PriceBazar').collection('advertisements');


        //post api for add new product
        app.post("/products", async (req, res) => {
            const data = req.body;

            const today = new Date().toISOString();


            const product = {
                ...data,
                prices: [
                    {
                        date: today,
                        price: parseFloat(data.price),
                    },
                ],
                createdAt: new Date(),
            };

            delete product.price;

            const result = await productsCollection.insertOne(product);
            res.send(result);
        });

        //get api
        app.get("/products", async (req, res) => {
            try {
                const result = await productsCollection
                    .find({})
                    .sort({ createdAt: -1 }) // latest first
                    .toArray();

                res.send(result);
            } catch (error) {
                res.status(500).send({ message: "Failed to fetch products" });
            }
        });

        // delete api
        app.delete("/products/:id", async (req, res) => {
            try {
                const id = req.params.id;

                const result = await productsCollection.deleteOne({
                    _id: new ObjectId(id),
                });

                res.send(result);
            } catch (error) {
                res.status(500).send({ message: "Failed to delete product" });
            }
        });


        //get products for perticular gmail
        app.get("/products", async (req, res) => {
            try {
                const email = req.query.email;

                const query = {};

                // 🔒 If email exists → filter by vendor
                if (email) {
                    // security check
                    if (req.decoded.email !== email) {
                        return res.status(403).send({ message: "Forbidden access" });
                    }

                    query.vendorEmail = email;
                }

                const result = await productsCollection
                    .find(query)
                    .sort({ createdAt: -1 })
                    .toArray();

                res.send(result);
            } catch (error) {
                res.status(500).send({ message: "Failed to fetch products" });
            }
        });

        app.get('/product/:id', async (req, res) => {
            try {
                const { id } = req.params;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ success: false, message: 'Invalid product ID' });
                }

                const product = await productsCollection.findOne({ _id: new ObjectId(id) });

                if (!product) {
                    return res.status(404).json({ success: false, message: 'Product not found' });
                }

                res.json({ success: true, data: product });
            } catch (error) {
                console.error('Error fetching product:', error);
                res.status(500).json({ success: false, message: 'Failed to fetch product', error: error.message });
            }
        });

        // put api
        // PUT route to update a product
        app.put('/products/:id', async (req, res) => {
            try {
                const { id } = req.params;
                const { itemName, marketName, image, description, date, prices, status, vendorEmail } = req.body;

                // Validate MongoDB ObjectId
                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ message: 'Invalid product ID' });
                }

                // Build update object
                const updateData = {
                    itemName,
                    marketName,
                    image,
                    description,
                    date,
                    prices, // array with price history
                    status: status || 'pending',
                    vendorEmail,
                    updatedAt: new Date(),
                };

                // Update in MongoDB
                const result = await productsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updateData }
                );

                // Check if product was found and updated
                if (result.matchedCount === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'Product not found'
                    });
                }

                res.json({
                    success: true,
                    message: 'Product updated successfully',
                    modifiedCount: result.modifiedCount
                });

            } catch (error) {
                console.error('Error updating product:', error);
                res.status(500).json({
                    success: false,
                    message: 'Error updating product',
                    error: error.message
                });
            }
        });



        // =============================================
        // PRODUCTS - GET ALL (ADMIN)
        // =============================================
        app.get('/products/all', async (req, res) => {
            try {
                const products = await productsCollection
                    .find({})
                    .sort({ createdAt: -1 })
                    .toArray();

                res.json(products);

            } catch (error) {
                console.error('Error fetching all products:', error);
                res.status(500).json({
                    success: false,
                    message: 'Error fetching products',
                    error: error.message
                });
            }
        });

        // =============================================
        // PRODUCTS - UPDATE STATUS (ADMIN)
        // =============================================
        app.patch('/products/:id/status', async (req, res) => {
            try {
                const { id } = req.params;
                const { status, rejectionReason } = req.body;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid product ID'
                    });
                }

                if (!['pending', 'approved', 'rejected'].includes(status)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid status. Must be pending, approved, or rejected'
                    });
                }

                const updateData = {
                    status,
                    updatedAt: new Date(),
                };

                if (status === 'rejected' && rejectionReason) {
                    updateData.rejectionReason = rejectionReason;
                }

                const result = await productsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updateData }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'Product not found'
                    });
                }

                res.json({
                    success: true,
                    message: `Product ${status} successfully`,
                    modifiedCount: result.modifiedCount
                });

            } catch (error) {
                console.error('Error updating product status:', error);
                res.status(500).json({
                    success: false,
                    message: 'Error updating product status',
                    error: error.message
                });
            }
        });

        // =============================================
        // ADVERTISEMENTS - GET ALL (ADMIN)
        // =============================================
        app.get('/advertisements/all', async (req, res) => {
            try {
                const advertisements = await advertisementsCollection
                    .find({})
                    .sort({ createdAt: -1 })
                    .toArray();

                res.json(advertisements);

            } catch (error) {
                console.error('Error fetching all advertisements:', error);
                res.status(500).json({
                    success: false,
                    message: 'Error fetching advertisements',
                    error: error.message
                });
            }
        });

        // =============================================
        // ADVERTISEMENTS - UPDATE STATUS (ADMIN)
        // =============================================
        app.patch('/advertisements/:id/status', async (req, res) => {
            try {
                const { id } = req.params;
                const { status } = req.body;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid advertisement ID'
                    });
                }

                if (!['pending', 'approved', 'rejected'].includes(status)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid status. Must be pending, approved, or rejected'
                    });
                }

                const result = await advertisementsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status, updatedAt: new Date() } }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'Advertisement not found'
                    });
                }

                res.json({
                    success: true,
                    message: `Advertisement ${status} successfully`,
                    modifiedCount: result.modifiedCount
                });

            } catch (error) {
                console.error('Error updating advertisement status:', error);
                res.status(500).json({
                    success: false,
                    message: 'Error updating advertisement status',
                    error: error.message
                });
            }
        });



        // .............................................................................................................................

        // ==========================================
        // POST - CREATE ADVERTISEMENT
        // ==========================================
        app.post('/advertisements', async (req, res) => {
            try {
                const { adTitle, shortDescription, image, vendorEmail, vendorName, status } = req.body;

                // Validate required fields
                if (!adTitle || !shortDescription || !vendorEmail) {
                    return res.status(400).json({
                        success: false,
                        message: 'Missing required fields: adTitle, shortDescription, vendorEmail'
                    });
                }

                const newAdvertisement = {
                    adTitle: adTitle.trim(),
                    shortDescription: shortDescription.trim(),
                    image: image || '',
                    vendorEmail,
                    vendorName,
                    status: status || 'pending',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };

                const result = await advertisementsCollection.insertOne(newAdvertisement);

                res.json({
                    success: true,
                    message: 'Advertisement created successfully',
                    data: { _id: result.insertedId, ...newAdvertisement }
                });

            } catch (error) {
                console.error('Error creating advertisement:', error);
                res.status(500).json({
                    success: false,
                    message: 'Error creating advertisement',
                    error: error.message
                });
            }
        });

        // ==========================================
        // ==========================================
        // GET - FETCH ALL ADS (ADMIN)
        // ==========================================
        app.get('/advertisements/all', async (req, res) => {
            try {
                const advertisements = await advertisementsCollection
                    .find({})
                    .sort({ createdAt: -1 })
                    .toArray();

                res.json(advertisements);

            } catch (error) {
                console.error('Error fetching all advertisements:', error);
                res.status(500).json({
                    success: false,
                    message: 'Error fetching advertisements',
                    error: error.message
                });
            }
        });

        // ==========================================
        // GET - FETCH SINGLE AD BY ID
        // ==========================================
        app.get('/advertisements/:id', async (req, res) => {
            try {
                const { id } = req.params;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid advertisement ID'
                    });
                }

                const advertisement = await advertisementsCollection.findOne({
                    _id: new ObjectId(id)
                });

                if (!advertisement) {
                    return res.status(404).json({
                        success: false,
                        message: 'Advertisement not found'
                    });
                }

                res.json(advertisement);

            } catch (error) {
                console.error('Error fetching advertisement:', error);
                res.status(500).json({
                    success: false,
                    message: 'Error fetching advertisement',
                    error: error.message
                });
            }
        });

        // ==========================================
        // GET - FETCH ADS BY VENDOR EMAIL
        // ==========================================
        app.get('/advertisements', async (req, res) => {
            try {
                const { email } = req.query;

                if (!email) {
                    return res.status(400).json({
                        success: false,
                        message: 'Email query parameter is required'
                    });
                }

                const advertisements = await advertisementsCollection
                    .find({ vendorEmail: email })
                    .sort({ createdAt: -1 })
                    .toArray();

                res.json(advertisements);

            } catch (error) {
                console.error('Error fetching advertisements:', error);
                res.status(500).json({
                    success: false,
                    message: 'Error fetching advertisements',
                    error: error.message
                });
            }
        });

        // ==========================================
        // GET - FETCH ADS BY STATUS
        // ==========================================
        app.get('/advertisements', async (req, res) => {
            try {
                const { email, status } = req.query;
                const query = {};

                // If status is provided, filter by status
                if (status) {
                    query.status = status;
                }

                // If email is provided (vendor specific), filter by vendor email
                if (email) {
                    query.vendorEmail = email;
                }

                const advertisements = await advertisementsCollection
                    .find(query)
                    .sort({ createdAt: -1 })
                    .toArray();

                res.json(advertisements);

            } catch (error) {
                console.error('Error fetching advertisements:', error);
                res.status(500).json({
                    success: false,
                    message: 'Error fetching advertisements',
                    error: error.message
                });
            }
        });

        // ==========================================
        // PUT - UPDATE ADVERTISEMENT
        // ==========================================
        app.put('/advertisements/:id', async (req, res) => {
            try {
                const { id } = req.params;
                const { adTitle, shortDescription, image, status } = req.body;

                // Validate MongoDB ObjectId
                if (!ObjectId.isValid(id)) {
                    console.error("Invalid advertisement ID:", id);
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid advertisement ID'
                    });
                }

                // Validate required fields
                if (!adTitle || !shortDescription) {
                    return res.status(400).json({
                        success: false,
                        message: 'Missing required fields: adTitle, shortDescription'
                    });
                }

                // Build update object
                const updateData = {
                    adTitle: adTitle.trim(),
                    shortDescription: shortDescription.trim(),
                    image: image || '',
                    status: status || 'pending',
                    updatedAt: new Date(),
                };

                console.log("Updating advertisement with ID:", id);
                console.log("Update data:", updateData);

                // Update in MongoDB
                const result = await advertisementsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updateData }
                );

                console.log("Update result:", result);

                // Check if advertisement was found
                if (result.matchedCount === 0) {
                    console.error("Advertisement not found with ID:", id);
                    return res.status(404).json({
                        success: false,
                        message: 'Advertisement not found'
                    });
                }

                // Success response
                res.json({
                    success: true,
                    message: 'Advertisement updated successfully',
                    modifiedCount: result.modifiedCount,
                    acknowledged: result.acknowledged
                });

            } catch (error) {
                console.error('Error updating advertisement:', error);
                res.status(500).json({
                    success: false,
                    message: 'Error updating advertisement',
                    error: error.message
                });
            }
        });

        // ==========================================
        // DELETE - DELETE ADVERTISEMENT
        // ==========================================
        app.delete('/advertisements/:id', async (req, res) => {
            try {
                const { id } = req.params;

                // Validate MongoDB ObjectId
                if (!ObjectId.isValid(id)) {
                    console.error("Invalid advertisement ID:", id);
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid advertisement ID'
                    });
                }

                console.log("Deleting advertisement with ID:", id);

                // Delete from MongoDB
                const result = await advertisementsCollection.deleteOne({
                    _id: new ObjectId(id)
                });

                console.log("Delete result:", result);

                // Check if advertisement was found
                if (result.deletedCount === 0) {
                    console.error("Advertisement not found with ID:", id);
                    return res.status(404).json({
                        success: false,
                        message: 'Advertisement not found'
                    });
                }

                // Success response
                res.json({
                    success: true,
                    message: 'Advertisement deleted successfully',
                    deletedCount: result.deletedCount
                });

            } catch (error) {
                console.error('Error deleting advertisement:', error);
                res.status(500).json({
                    success: false,
                    message: 'Error deleting advertisement',
                    error: error.message
                });
            }
        });

        // ==========================================
        // PATCH - UPDATE AD STATUS (ADMIN)
        // ==========================================
        app.patch('/advertisements/:id/status', async (req, res) => {
            try {
                const { id } = req.params;
                const { status } = req.body;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid advertisement ID'
                    });
                }

                if (!['pending', 'approved', 'rejected'].includes(status)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid status. Must be pending, approved, or rejected'
                    });
                }

                const result = await advertisementsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status, updatedAt: new Date() } }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'Advertisement not found'
                    });
                }

                res.json({
                    success: true,
                    message: 'Advertisement status updated successfully'
                });

            } catch (error) {
                console.error('Error updating advertisement status:', error);
                res.status(500).json({
                    success: false,
                    message: 'Error updating status',
                    error: error.message
                });
            }
        });




        // GET all advertisements with filtering
        app.get('/api/advertisements', async (req, res) => {
            try {
                const { status = 'approved', email, limit = 100, skip = 0 } = req.query;
                const filter = {};

                if (status !== 'all') {
                    filter.status = status;
                }

                if (email) {
                    filter.vendorEmail = email;
                }

                const advertisements = await advertisementsCollection
                    .find(filter)
                    .sort({ createdAt: -1 })
                    .limit(parseInt(limit))
                    .skip(parseInt(skip))
                    .toArray();

                const total = await advertisementsCollection.countDocuments(filter);

                res.json({
                    success: true,
                    data: advertisements,
                    total: total,
                    limit: parseInt(limit),
                    skip: parseInt(skip)
                });
            } catch (error) {
                console.error('Error fetching advertisements:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch advertisements',
                    error: error.message
                });
            }
        });


        // ✅ ENDPOINT 2: GET SINGLE ADVERTISEMENT BY ID
        // ============================================================================

        app.get('/api/advertisements/:id', async (req, res) => {
            try {
                const { id } = req.params;

                // Validate ObjectId format
                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid advertisement ID format'
                    });
                }

                const advertisement = await advertisementsCollection.findOne({
                    _id: new ObjectId(id)
                });

                if (!advertisement) {
                    return res.status(404).json({
                        success: false,
                        message: 'Advertisement not found'
                    });
                }

                res.json({
                    success: true,
                    data: advertisement
                });
            } catch (error) {
                console.error('Error fetching advertisement:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch advertisement',
                    error: error.message
                });
            }
        });




        // .........................................................Product


        //..................

        // Add this at the top of your Express server file (app.js or server.js)
        const { ObjectId } = require('mongodb');

        // ENDPOINT 1: Get all products with filtering & sorting
        app.get('/api/products/all', async (req, res) => {
            try {
                const {
                    status = 'approved',
                    sort = 'latest',
                    order = 'desc',
                    dateFrom,
                    dateTo
                } = req.query;

                console.log('Fetching products with filters:', { status, sort, order, dateFrom, dateTo });

                // Build MongoDB query
                let query = { status };

                // Add date range filter
                if (dateFrom || dateTo) {
                    query.date = {};

                    if (dateFrom) {
                        const fromDate = new Date(dateFrom);
                        fromDate.setHours(0, 0, 0, 0);
                        query.date.$gte = fromDate;
                        console.log('From date filter:', fromDate);
                    }

                    if (dateTo) {
                        const toDate = new Date(dateTo);
                        toDate.setHours(23, 59, 59, 999);
                        query.date.$lte = toDate;
                        console.log('To date filter:', toDate);
                    }
                }

                // Determine sort field and order
                const sortOrder = order === 'asc' ? 1 : -1;
                let sortField = 'createdAt'; // default

                if (sort === 'price') {
                    // For price sorting, fetch all matching documents first
                    let products = await productsCollection
                        .find(query)
                        .toArray();

                    console.log(`Found ${products.length} products before price sorting`);

                    // Add calculated latestPrice field
                    products = products.map(product => {
                        let latestPrice = 0;
                        if (product.newPrices && product.newPrices.length > 0) {
                            const prices = product.newPrices.map(p => p.price);
                            latestPrice = Math.min(...prices); // Get lowest price
                        }
                        return { ...product, latestPrice };
                    });

                    // Sort by latestPrice
                    products.sort((a, b) => {
                        return sortOrder === 1
                            ? a.latestPrice - b.latestPrice
                            : b.latestPrice - a.latestPrice;
                    });

                    // Remove temporary field
                    products = products.map(({ latestPrice, ...product }) => product);

                    console.log(`Returning ${products.length} products after price sorting`);
                    return res.json(products);
                } else if (sort === 'date') {
                    sortField = 'date';
                } else {
                    // sort === 'latest'
                    sortField = 'createdAt';
                }

                // For non-price sorting, use MongoDB sort
                const products = await productsCollection
                    .find(query)
                    .sort({ [sortField]: sortOrder })
                    .toArray();

                console.log(`Found ${products.length} products`);
                res.json(products);

            } catch (error) {
                console.error('Error fetching products:', error);
                res.status(500).json({ message: 'Error fetching products', error: error.message });
            }
        });


        // ENDPOINT 2: Get single product details
        app.get('/api/products/:id', async (req, res) => {
            try {
                const { id } = req.params;

                // Validate MongoDB ObjectId
                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ message: 'Invalid product ID' });
                }

                const product = await productsCollection
                    .findOne({ _id: new ObjectId(id) });

                if (!product) {
                    return res.status(404).json({ message: 'Product not found' });
                }

                console.log(`Fetched product: ${product.itemName}`);
                res.json(product);

            } catch (error) {
                console.error('Error fetching product:', error);
                res.status(500).json({ message: 'Error fetching product', error: error.message });
            }
        });


        //.......................................................review..................
        const reviewsCollection = client.db('PriceBazar').collection('reviews');
        // GET all reviews for a product
        app.get('/api/reviews/:productId', async (req, res) => {
            try {
                const { productId } = req.params;
                const reviews = await reviewsCollection
                    .find({ productId })
                    .sort({ timestamp: -1 })
                    .toArray();

                res.json(reviews || []);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // POST new review
        app.post('/api/reviews', async (req, res) => {
            try {
                const { productId, userId, author, email, text, rating } = req.body;

                if (!productId || !userId || !author || !email || !text || !rating) {
                    return res.status(400).json({ error: 'Missing required fields' });
                }

                if (rating < 1 || rating > 5) {
                    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
                }

                const existingReview = await reviewsCollection
                    .findOne({ productId, userId });

                if (existingReview) {
                    return res.status(409).json({ error: 'You have already reviewed this product' });
                }

                const review = {
                    productId,
                    userId,
                    author,
                    email,
                    text,
                    rating,
                    timestamp: new Date(),
                    date: new Date().toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    })
                };

                const result = await reviewsCollection.insertOne(review);

                res.status(201).json({
                    _id: result.insertedId,
                    ...review
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // PUT update review
        app.put('/api/reviews/:id', async (req, res) => {
            try {
                const { id } = req.params;
                const { email, text, rating } = req.body;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ error: 'Invalid review ID' });
                }

                const review = await reviewsCollection
                    .findOne({ _id: new ObjectId(id) });

                if (!review) {
                    return res.status(404).json({ error: 'Review not found' });
                }

                if (review.email !== email) {
                    return res.status(403).json({ error: 'Not authorized to update this review' });
                }

                if (rating && (rating < 1 || rating > 5)) {
                    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
                }

                const updatedReview = {
                    text: text || review.text,
                    rating: rating || review.rating,
                    updatedAt: new Date()
                };

                await reviewsCollection
                    .updateOne({ _id: new ObjectId(id) }, { $set: updatedReview });

                const updated = await reviewsCollection
                    .findOne({ _id: new ObjectId(id) });

                res.json(updated);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // DELETE review
        app.delete('/api/reviews/:id', async (req, res) => {
            try {
                const { id } = req.params;
                const { email } = req.body;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({ error: 'Invalid review ID' });
                }

                const review = await reviewsCollection
                    .findOne({ _id: new ObjectId(id) });

                if (!review) {
                    return res.status(404).json({ error: 'Review not found' });
                }

                if (review.email !== email) {
                    return res.status(403).json({ error: 'Not authorized to delete this review' });
                }

                await reviewsCollection
                    .deleteOne({ _id: new ObjectId(id) });

                res.json({ message: 'Review deleted successfully', _id: id });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });



        // ========== WATCHLIST API ==========-------------------------------------------------------

        const watchlistCollection = client.db('PriceBazar').collection('watchlist');


        // GET user's watchlist
        app.get('/api/watchlist/:userId', async (req, res) => {
            try {
                const { userId } = req.params;
                const watchlist = await watchlistCollection
                    .findOne({ userId });

                res.json(watchlist || { userId, products: [] });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // POST/ADD to watchlist
        app.post('/api/watchlist', async (req, res) => {
            try {
                const { userId, productId } = req.body;

                if (!userId || !productId) {
                    return res.status(400).json({ error: 'Missing userId or productId' });
                }

                const watchlist = await watchlistCollection
                    .findOne({ userId });

                if (!watchlist) {
                    const result = await watchlistCollection
                        .insertOne({ userId, products: [productId], createdAt: new Date() });
                    return res.json({ message: 'Added to watchlist', _id: result.insertedId });
                }

                if (watchlist.products.includes(productId)) {
                    return res.status(409).json({ error: 'Already in watchlist' });
                }

                await watchlistCollection
                    .updateOne({ userId }, { $push: { products: productId } });

                res.json({ message: 'Added to watchlist' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // DELETE from watchlist
        app.delete('/api/watchlist/:userId/:productId', async (req, res) => {
            try {
                const { userId, productId } = req.params;

                if (!userId || !productId) {
                    return res.status(400).json({ error: 'Missing userId or productId' });
                }

                await watchlistCollection
                    .updateOne({ userId }, { $pull: { products: productId } });

                res.json({ message: 'Removed from watchlist' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        //..................Stripe.............................................................................
        
        // Create Payment Intent endpoint
        app.post("/create-payment-intent", async (req, res) => {
            try {
                const { amountInCents, product_id } = req.body;

                // Validate required fields
                if (!amountInCents || !product_id) {
                    return res.status(400).json({
                        success: false,
                        message: 'Missing required fields: amountInCents, product_id'
                    });
                }

                // Validate amount is a positive number
                if (typeof amountInCents !== 'number' || amountInCents <= 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'amountInCents must be a positive number'
                    });
                }

                // Create payment intent
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: Math.round(amountInCents), // Stripe requires amount in cents as integer
                    currency: 'usd',
                    metadata: {
                        product_id: product_id.toString()
                    }
                });

                res.json({
                    success: true,
                    clientSecret: paymentIntent.client_secret,
                    paymentIntentId: paymentIntent.id
                });

            } catch (error) {
                console.error('Error creating payment intent:', error);
                res.status(500).json({
                    success: false,
                    message: 'Error creating payment intent',
                    error: error.message
                });
            }
        });

        // Checkout Session endpoint (legacy)
        app.post("/create-checkout-session", async (req, res) => {
            try {
                const { amountInCents, product_id } = req.body;

                if (!amountInCents || !product_id) {
                    return res.status(400).json({
                        success: false,
                        message: 'Missing required fields'
                    });
                }

                const session = await stripe.checkout.sessions.create({
                    ui_mode: "embedded",
                    line_items: [
                        {
                            price_data: {
                                currency: 'usd',
                                product_data: {
                                    name: `Product: ${product_id}`,
                                },
                                unit_amount: Math.round(amountInCents),
                            },
                            quantity: 1,
                        },
                    ],
                    mode: 'payment',
                    return_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/complete?session_id={CHECKOUT_SESSION_ID}`,
                });

                res.json({
                    success: true,
                    clientSecret: session.client_secret,
                    sessionId: session.id
                });

            } catch (error) {
                console.error('Error creating checkout session:', error);
                res.status(500).json({
                    success: false,
                    message: 'Error creating checkout session',
                    error: error.message
                });
            }
        });

        // ========== ORDERS COLLECTION & ENDPOINTS ==========
        const ordersCollection = client.db('PriceBazar').collection('orders');

        // Create index for faster queries
        await ordersCollection.createIndex({ userEmail: 1, orderDate: -1 });

        // Confirm payment and create order
        app.post('/confirm-payment', async (req, res) => {
            try {
                const { productId, userEmail, transactionId, amount, productData, paymentStatus } = req.body;

                // Validate required fields
                if (!productId || !userEmail || !transactionId || !amount) {
                    return res.status(400).json({
                        success: false,
                        message: 'Missing required fields'
                    });
                }

                // Create order document
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

                // Insert order to database
                const result = await ordersCollection.insertOne(order);

                res.json({
                    success: true,
                    message: 'Order created successfully',
                    orderId: result.insertedId,
                    order: { ...order, _id: result.insertedId }
                });

            } catch (error) {
                console.error('Error confirming payment:', error);
                res.status(500).json({
                    success: false,
                    message: 'Error creating order',
                    error: error.message
                });
            }
        });

        // Get all orders for a user by email
        app.get('/orders/:email', async (req, res) => {
            try {
                const { email } = req.params;

                if (!email) {
                    return res.status(400).json({
                        success: false,
                        message: 'Email is required'
                    });
                }

                const orders = await ordersCollection
                    .find({ userEmail: email })
                    .sort({ orderDate: -1 })
                    .toArray();

                res.json(orders || []);

            } catch (error) {
                console.error('Error fetching orders:', error);
                res.status(500).json({
                    success: false,
                    message: 'Error fetching orders',
                    error: error.message
                });
            }
        });

        // Get specific order details by ID
        app.get('/order/:id', async (req, res) => {
            try {
                const { id } = req.params;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid order ID'
                    });
                }

                const order = await ordersCollection.findOne({ _id: new ObjectId(id) });

                if (!order) {
                    return res.status(404).json({
                        success: false,
                        message: 'Order not found'
                    });
                }

                res.json(order);

            } catch (error) {
                console.error('Error fetching order:', error);
                res.status(500).json({
                    success: false,
                    message: 'Error fetching order',
                    error: error.message
                });
            }
        });

        // Get order statistics for admin
        app.get('/orders-stats/:email', async (req, res) => {
            try {
                const { email } = req.params;

                const stats = await ordersCollection.aggregate([
                    { $match: { userEmail: email } },
                    {
                        $group: {
                            _id: null,
                            totalOrders: { $sum: 1 },
                            totalSpent: { $sum: '$amount' },
                            avgOrderValue: { $avg: '$amount' }
                        }
                    }
                ]).toArray();

                if (stats.length === 0) {
                    return res.json({
                        totalOrders: 0,
                        totalSpent: 0,
                        avgOrderValue: 0
                    });
                }

                res.json(stats[0]);

            } catch (error) {
                console.error('Error fetching order statistics:', error);
                res.status(500).json({
                    success: false,
                    message: 'Error fetching statistics',
                    error: error.message
                });
            }
        });

        // Send a ping to confirm a successful connection
        //await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        //await client.close();
    }
}

run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.get('/data', (req, res) => {
    res.send('this is data')
})


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})


