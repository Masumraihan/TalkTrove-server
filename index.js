const express = require("express");
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion } = require("mongodb");
const port = process.env.PORT || 5000;

const app = express();

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  const token = authorization.split(" ")[1];
  if (!token) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

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

    app.post("/jwt", (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send(token);
    });

    const classCollection = client
      .db("TalkTrovesDB")
      .collection("classCollection");
    const userCollection = client
      .db("TalkTrovesDB")
      .collection("usersCollection");
    const studentFeedbackCollection = client
      .db("TalkTrovesDB")
      .collection("studentsFeedbackCollection");
    const selectedClassCollection = client
      .db("TalkTrovesDB")
      .collection("selectedClassCollection");

    //users apis
    app.put("/users/:email", async (req, res) => {
      const { email } = req.params;
      const newUser = req.body;
      const query = { email: email };

      const user = await userCollection.findOne(query);
      if (!user) {
        newUser.role = "student";
      }

      const options = { upsert: true };
      const updatedDoc = {
        $set: newUser,
      };
      const result = await userCollection.updateOne(query, updatedDoc, options);
      res.send(result);
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params;
      const query = email;
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    // classes api
    app.get("/classes", async (req, res) => {
      const result = await classCollection
        .find()
        .sort({ students: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });
    app.get("/allClasses", async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    });

    app.post("/classes", verifyJWT, async (req, res) => {
      const info = req.body;
      const result = await selectedClassCollection.insertOne(info);
      res.send(result);
    });

    app.get("/classes/:email",verifyJWT, async(req,res) => {
      const email = req.params;
      const query = email;
      const result = await selectedClassCollection.find(query).toArray()
      res.send(result)
    })

    // instructors api
    app.get("/instructors", async (req, res) => {
      const query = { role: "instructor" };
      const result = await userCollection
        .find(query)
        .sort({ students: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });
    app.get("/allInstructors", async (req, res) => {
      const query = { role: "instructor" };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/studentFeedback", async (req, res) => {
      const result = await studentFeedbackCollection.find().toArray();
      res.send(result);
    });

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
