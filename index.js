const express = require("express");
require("dotenv").config();
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const port = process.env.PORT || 5000;

const app = express();

// middleware
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("TalkTrove server is running");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dgzmwwl.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    //await client.connect();

    const classCollection = client
      .db("TalkTrovesDB")
      .collection("classCollection");
    const userCollection = client
      .db("TalkTrovesDB")
      .collection("usersCollection");

    //users apis
    app.put("/users/:email", async (req, res) => {
      const { email } = req.params;
      console.log(email);
      const user = req.body;
      console.log(user);
      const query = { email: email };
      const options = { upsert: true }
      const updatedDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(query, updatedDoc, options);
      res.send(result);
    });

    app.get("/classes", async (req, res) => {
      const result = await classCollection
        .find()
        .sort({ students: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    app.get("/instructors", async (req, res) => {});

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
