const express = require("express");
const cors = require("cors");
const app = express();

require("dotenv").config();

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1jlx3rd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

let bookCollection;
let userCollection;
let reviewCollection;

async function connectDB() {
    if (!bookCollection) {
        await client.connect();

        const db = client.db("BookNest");

        bookCollection = db.collection("books");
        userCollection = db.collection("users");
        reviewCollection = db.collection("reviews");

        console.log("MongoDB Connected");
    }
}

connectDB();

app.get("/", (req, res) => {
    res.send("BookNest Server Running");
});


// USERS API
app.post("/users", async (req, res) => {
    await connectDB();

    const user = req.body;
    user.role = "user";
    user.createdAt = new Date();

    const email = user.email;

    const userExists = await userCollection.findOne({ email });

    if (userExists) {
        return res.send({ message: "user exists" });
    }

    const result = await userCollection.insertOne(user);
    res.send(result);
});


app.get("/users", async (req, res) => {
    await connectDB();
    const result = await userCollection.find().toArray();
    res.send(result);
});


app.get("/users/:email", async (req, res) => {
    await connectDB();

    const email = req.params.email;
    const user = await userCollection.findOne({ email });

    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }

    res.send(user);
});


app.delete("/users/:id", async (req, res) => {
    await connectDB();

    const id = req.params.id;

    const result = await userCollection.deleteOne({
        _id: new ObjectId(id),
    });

    res.send(result);
});


app.put("/users/:email", async (req, res) => {
    await connectDB();

    const email = req.params.email;
    const updatedData = req.body;

    const result = await userCollection.updateOne(
        { email },
        {
            $set: {
                displayName: updatedData.displayName,
                photoURL: updatedData.photoURL,
            },
        }
    );

    res.send(result);
});


app.patch("/users", async (req, res) => {
    await connectDB();

    const { email, lastSignInTime } = req.body;

    const result = await userCollection.updateOne(
        { email },
        {
            $set: { lastSignInTime },
        }
    );

    res.send(result);
});


// BOOK APIs
app.post("/books", async (req, res) => {
    await connectDB();

    const book = req.body;
    const result = await bookCollection.insertOne(book);

    res.send(result);
});


app.get("/books", async (req, res) => {
    await connectDB();

    const result = await bookCollection.find().toArray();
    res.send(result);
});


app.get("/books/:id", async (req, res) => {
    await connectDB();

    const id = req.params.id;

    const book = await bookCollection.findOne({
        _id: new ObjectId(id),
    });

    res.send(book);
});


app.delete("/books/:id", async (req, res) => {
    await connectDB();

    const id = req.params.id;

    const result = await bookCollection.deleteOne({
        _id: new ObjectId(id),
    });

    res.send(result);
});


app.put("/books/:id", async (req, res) => {
    await connectDB();

    const id = req.params.id;
    const updatedBook = req.body;

    delete updatedBook._id;

    const result = await bookCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedBook }
    );

    res.send(result);
});


app.patch("/upvote/:id", async (req, res) => {
    await connectDB();

    const id = req.params.id;

    const result = await bookCollection.updateOne(
        { _id: new ObjectId(id) },
        { $inc: { upvote: 1 } }
    );

    res.send(result);
});


app.get("/popular-books", async (req, res) => {
    await connectDB();

    const result = await bookCollection
        .find()
        .sort({ upvote: -1 })
        .limit(9)
        .toArray();

    res.send(result);
});


// REVIEWS
app.post("/reviews", async (req, res) => {
    await connectDB();

    const review = req.body;

    const existingReview = await reviewCollection.findOne({
        bookId: review.bookId,
        user_email: review.user_email,
    });

    if (existingReview) {
        return res.send({
            message: "You already reviewed this book",
        });
    }

    const result = await reviewCollection.insertOne(review);

    res.send(result);
});


app.get("/reviews/:bookId", async (req, res) => {
    await connectDB();

    const bookId = req.params.bookId;

    const reviews = await reviewCollection
        .find({ bookId })
        .toArray();

    res.send(reviews);
});


app.delete("/reviews/:id", async (req, res) => {
    await connectDB();

    const id = req.params.id;

    const result = await reviewCollection.deleteOne({
        _id: new ObjectId(id),
    });

    res.send(result);
});


app.patch("/reviews/:id", async (req, res) => {
    await connectDB();

    const id = req.params.id;
    const { review } = req.body;

    const result = await reviewCollection.updateOne(
        { _id: new ObjectId(id) },
        {
            $set: { review },
        }
    );

    res.send(result);
});


app.get("/mybooks", async (req, res) => {
    await connectDB();

    const email = req.query.email;

    const query = email ? { user_email: email } : {};

    const books = await bookCollection.find(query).toArray();

    res.send(books);
});

module.exports = app;