const express = require('express')
const cors = require('cors')
const app = express()
const port = process.env.PORT || 3000
app.use(express.json());

app.use(cors())

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

require('dotenv').config();
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


        //post api for add new product
        app.post("/products", async (req, res) => {
            const data = req.body;

            const today = new Date().toISOString().split("T")[0];

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