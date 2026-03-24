const express = require('express')
const cors = require('cors')
const app = express()
const port = process.env.PORT || 3000
app.use(express.json());

app.use(cors())




const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

//require('dotenv').config();
//const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1jlx3rd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`

const uri = "mongodb+srv://mezbahul:2A3NW9ZuLLtGXaGu@cluster0.1jlx3rd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";


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

    //For Plant Care Website
    const plantCollection = client.db('plantDB').collection('coffees');

    app.post('/plants', async (req, res) => {
      const newplant = req.body;
      console.log(newplant);

      //add formdata into mongodb coffee server
      const result = await plantCollection.insertOne(newplant);
      res.send(result);
    })

    app.get('/plants', async (req, res) => {
      // const cursor = coffeesCollection.find();
      // const result = await cursor.toArray();
      const result = await plantCollection.find().toArray();
      res.send(result);
    });

    app.get('/plants/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await plantCollection.findOne(query);
      res.send(result);
    });

    app.delete('/plants/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await plantCollection.deleteOne(query);
      res.send(result);

    })

    app.put('/plants/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true };
      const updatedPlant = req.body;
      const updatedDoc = {
        $set: updatedPlant

      }
      const result = await plantCollection.updateOne(filter, updatedDoc, options);

      res.send(result);

    })

    

    

    // **********************************************************************************


    //connection or create a new db as name coffees
    const coffeesCollection = client.db('coffeeDB').collection('coffees');

    app.post('/coffess', async (req, res) => {
      const newCoffee = req.body;
      console.log(newCoffee);

      //add formdata into mongodb coffee server
      const result = await coffeesCollection.insertOne(newCoffee);
      res.send(result);
    })

    //delete coffee or delete one document
    app.delete('/coffees/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await coffeesCollection.deleteOne(query);
      res.send(result);

    })

    // create localhost:3000/coffees 
    app.get('/coffees', async (req, res) => {
      // const cursor = coffeesCollection.find();
      // const result = await cursor.toArray();
      const result = await coffeesCollection.find().toArray();
      res.send(result);
    });

    //create dynamic coffee details data
    app.get('/coffees/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await coffeesCollection.findOne(query);
      res.send(result);
    });

    //update coffee 
    app.put('/coffees/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true };
      const updatedCoffee = req.body;
      const updatedDoc = {
        $set: updatedCoffee

      }
      // const updatedDoc = {
      //     $set: {
      //         name: updatedCoffee.name, 
      //         supplier: updatedCoffee.supplier
      //     }
      // }
      const result = await coffeesCollection.updateOne(filter, updatedDoc, options);

      res.send(result);

    })

    const usersCollection = client.db('coffeeDB').collection('users');

    // User related APIs

    //send users singup data to the mongodb server
    app.post('/users', async (req, res) => {
      const userProfile = req.body;
      console.log(userProfile)
      const result = await usersCollection.insertOne(userProfile);
      res.send(result);
    })
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
    })

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